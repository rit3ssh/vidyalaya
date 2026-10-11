// Controllers for the 1:1 chat feature.
//
// Reachability is scoped by role (all within the same school):
//   STUDENT  — classmates (same class) + teachers of that class + admins
//   PARENT   — students, parents and teachers of their child's class(es) + admins
//   TEACHER  — students, parents and fellow teachers of the classes they teach + admins
//   ADMIN    — everyone in the school
//
// Conversations are private 1:1 threads; messages track readBy for unread
// counts and read receipts. The frontend polls for new messages.

import mongoose from "mongoose";
import { emitChatUpdate, getOnlineUserIds } from "../sockets/chat.socket.js";
import { uploadToImageKit, deleteFromImageKit } from "../config/imagekit.js";
import conversationModel from "../models/conversation.model.js";
import messageModel from "../models/message.model.js";
import userModel from "../models/user.model.js";
import studentModel from "../models/student.model.js";
import parentModel from "../models/parent.model.js";
import teacherModel from "../models/teacher.model.js";
import studentParentModel from "../models/studentParent.model.js";
import classSubjectTeacherModel from "../models/classSubjectTeacher.model.js";

function isInvalidId(id) {
    return !mongoose.isValidObjectId(id);
}

// Fetch users with their profile virtuals populated (class for students,
// designation for teachers). Used for the people list and conversation info.
function userPopulate() {
    return [
        { path: "studentProfile", populate: { path: "classId", select: "name section" } },
        { path: "teacherProfile", select: "designation" },
        { path: "parentProfile", select: "occupation" },
    ];
}

function formatUser(user) {
    const student = user.studentProfile;
    const teacher = user.teacherProfile;
    return {
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        className: student?.classId?.name || null,
        section: student?.classId?.section || null,
        designation: teacher?.designation || null,
    };
}

// The set of User ids the current user may chat with (never includes self).
// Class-scoped roles resolve their classes first, then expand to people.
async function computeScope(req) {
    const schoolId = req.user.schoolId;
    const role = req.user.role;
    const me = req.user.id;
    const ids = new Set();
    let classIds = [];

    // Admins can talk to everyone in the school.
    if (role === "SCHOOL_ADMIN" || role === "SUPER_ADMIN") {
        const users = await userModel.find({ schoolId }).select("_id");
        users.forEach((u) => ids.add(String(u._id)));
        ids.delete(String(me));
        return ids;
    }

    // Resolve the classes this role is tied to.
    if (role === "STUDENT") {
        const student = await studentModel.findOne({ userId: me });
        if (student) classIds = [student.classId];
    } else if (role === "PARENT") {
        const parent = await parentModel.findOne({ userId: me });
        if (parent) {
            const links = await studentParentModel.find({ parentId: parent._id }).select("studentId");
            const children = await studentModel
                .find({ _id: { $in: links.map((l) => l.studentId) } })
                .select("classId");
            classIds = [...new Set(children.map((c) => String(c.classId)))];
        }
    } else if (role === "TEACHER") {
        const teacher = await teacherModel.findOne({ userId: me });
        if (teacher) {
            const assignments = await classSubjectTeacherModel
                .find({ teacherId: teacher._id })
                .select("classId");
            classIds = [...new Set(assignments.map((a) => String(a.classId)))];
        }
    }

    if (classIds.length > 0) {
        // Students of the scope classes (classmates / students of the class).
        const students = await studentModel.find({ classId: { $in: classIds } }).select("userId");
        students.forEach((s) => ids.add(String(s.userId)));

        // Teachers teaching those classes.
        const assignments = await classSubjectTeacherModel
            .find({ classId: { $in: classIds } })
            .select("teacherId");
        const teacherProfiles = await teacherModel
            .find({ _id: { $in: assignments.map((a) => a.teacherId) } })
            .select("userId");
        teacherProfiles.forEach((t) => ids.add(String(t.userId)));

        // Parents of those students — for parent and teacher roles only
        // (students don't chat with parents directly).
        if (role === "PARENT" || role === "TEACHER") {
            const studentIds = students.map((s) => s._id);
            const links = await studentParentModel
                .find({ studentId: { $in: studentIds } })
                .select("parentId");
            const parentProfiles = await parentModel
                .find({ _id: { $in: links.map((l) => l.parentId) } })
                .select("userId");
            parentProfiles.forEach((p) => ids.add(String(p.userId)));
        }
    }

    // Teachers can chat with every fellow teacher in the school (not just the
    // ones teaching the same classes).
    if (role === "TEACHER") {
        const fellowTeachers = await userModel
            .find({ schoolId, role: "TEACHER" })
            .select("_id");
        fellowTeachers.forEach((t) => ids.add(String(t._id)));
    }

    // Everyone can reach the school admins.
    const admins = await userModel.find({ schoolId, role: "SCHOOL_ADMIN" }).select("_id");
    admins.forEach((a) => ids.add(String(a._id)));

    ids.delete(String(me));
    return ids;
}

// GET /api/chats/people — everyone the current user can start a chat with.
async function getChatPeople(req, res) {
    try {
        const userIds = await computeScope(req);
        const users = await userModel
            .find({ _id: { $in: [...userIds] } })
            .populate(userPopulate());

        const people = users
            .map(formatUser)
            .sort((a, b) => a.name.localeCompare(b.name));

        res.status(200).json({ message: "People retrieved successfully", people });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve people", details: error.message });
    }
}

// GET /api/chats/conversations — the current user's conversations, newest first,
// with the other participant's info and unread count.
async function getMyConversations(req, res) {
    const me = req.user.id;
    const schoolId = req.user.schoolId;

    try {
        const conversations = await conversationModel
            .find({ schoolId, participants: me })
            .sort({ lastMessageAt: -1 });

        const otherIds = conversations
            .map((c) => c.participants.find((p) => String(p) !== String(me)))
            .filter(Boolean);
        const others = await userModel
            .find({ _id: { $in: otherIds } })
            .populate(userPopulate());
        const otherById = new Map(others.map((u) => [String(u._id), formatUser(u)]));

        // Unread count = messages not sent by me that I haven't read yet.
        const convIds = conversations.map((c) => c._id);
        const meId = new mongoose.Types.ObjectId(String(me));
        const unreadAgg = await messageModel.aggregate([
            { $match: { conversationId: { $in: convIds }, senderId: { $ne: meId }, readBy: { $ne: meId } } },
            { $group: { _id: "$conversationId", count: { $sum: 1 } } },
        ]);
        const unreadByConv = new Map(unreadAgg.map((r) => [String(r._id), r.count]));

        res.status(200).json({
            message: "Conversations retrieved successfully",
            conversations: conversations.map((c) => {
                const otherId = c.participants.find((p) => String(p) !== String(me));
                return {
                    conversationId: c._id,
                    other: otherById.get(String(otherId)) || null,
                    lastMessage: c.lastMessage,
                    lastMessageAt: c.lastMessageAt,
                    unread: unreadByConv.get(String(c._id)) || 0,
                };
            }),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve conversations", details: error.message });
    }
}

// The stable key for a (me, other) pair — sorted ids joined, so both sides
// produce the same key regardless of who initiates.
function pairKey(idA, idB) {
    return [String(idA), String(idB)].sort().join("|");
}

// The conversation between me and otherUserId, if it exists.
async function findConversation(schoolId, me, otherUserId) {
    return conversationModel.findOne({ schoolId, pairKey: pairKey(me, otherUserId) });
}

// GET /api/chats/conversations/:otherUserId/messages — the full thread with a
// user. Marks the other party's messages as read. Returns empty when no
// conversation exists yet.
async function getMessages(req, res) {
    const me = req.user.id;
    const schoolId = req.user.schoolId;
    const { otherUserId } = req.params;

    if (isInvalidId(otherUserId)) {
        return res.status(400).json({ message: "Invalid user" });
    }
    if (String(otherUserId) === String(me)) {
        return res.status(400).json({ message: "You can't chat with yourself" });
    }

    try {
        const scope = await computeScope(req);
        if (!scope.has(String(otherUserId))) {
            return res.status(403).json({ error: "You can't chat with this user" });
        }

        const conversation = await findConversation(schoolId, me, otherUserId);
        if (!conversation) {
            return res.status(200).json({ message: "Messages retrieved successfully", conversationId: null, messages: [] });
        }

        // Mark the other party's messages as read by me.
        const meId = new mongoose.Types.ObjectId(String(me));
        await messageModel.updateMany(
            { conversationId: conversation._id, senderId: otherUserId, readBy: { $ne: meId } },
            { $addToSet: { readBy: meId } }
        );

        const messages = await messageModel
            .find({ conversationId: conversation._id })
            .sort({ createdAt: 1 });

        res.status(200).json({
            message: "Messages retrieved successfully",
            conversationId: conversation._id,
            messages: messages.map((m) => formatMessage(m, me)),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve messages", details: error.message });
    }
}

// The one-line preview stored on the conversation (text, or a label for a
// file-only message).
function messagePreview(text, attachment) {
    if (text) return text;
    if (!attachment) return "";
    return String(attachment.fileType || "").startsWith("image/")
        ? "📷 Photo"
        : `📎 ${attachment.fileName || "File"}`;
}

// POST /api/chats/conversations/:otherUserId/messages — send a message.
// Multipart/form-data: optional "text" field + optional "file" (uploaded to
// ImageKit). At least one of the two is required. Creates the conversation on
// first contact.
async function sendMessage(req, res) {
    const me = req.user.id;
    const schoolId = req.user.schoolId;
    const { otherUserId } = req.params;
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const file = req.file; // multer single("file")

    if (isInvalidId(otherUserId)) {
        return res.status(400).json({ message: "Invalid user" });
    }
    if (String(otherUserId) === String(me)) {
        return res.status(400).json({ message: "You can't chat with yourself" });
    }
    if (!text && !file) {
        return res.status(400).json({ message: "Message text or a file is required" });
    }

    // Upload any file to ImageKit first — cleaned up again if the DB write fails.
    let uploadedFileId = null;
    let attachment = null;

    try {
        const scope = await computeScope(req);
        if (!scope.has(String(otherUserId))) {
            return res.status(403).json({ error: "You can't chat with this user" });
        }

        if (file) {
            const uploaded = await uploadToImageKit({
                buffer: file.buffer,
                originalName: file.originalname,
                folder: "/chat",
            });
            uploadedFileId = uploaded.fileId;
            attachment = {
                fileName: file.originalname,
                fileType: file.mimetype,
                fileUrl: uploaded.url,
                fileSize: file.size,
                fileId: uploaded.fileId,
            };
        }

        const preview = messagePreview(text, attachment);

        let conversation = await findConversation(schoolId, me, otherUserId);
        if (!conversation) {
            conversation = await conversationModel.create({
                schoolId,
                participants: [me, otherUserId],
                pairKey: pairKey(me, otherUserId),
                lastMessage: preview,
                lastMessageAt: new Date(),
            });
        }

        const message = await messageModel.create({
            schoolId,
            conversationId: conversation._id,
            senderId: me,
            text,
            attachment,
            readBy: [me],
        });

        await conversationModel.updateOne(
            { _id: conversation._id },
            { lastMessage: preview, lastMessageAt: new Date() }
        );

        // Push to both participants so their UIs update instantly (no polling).
        emitChatUpdate([me, otherUserId], "chat:update", {
            conversationId: conversation._id,
            otherUserId,
            senderId: me,
            senderName: req.user.name,
            text,
            attachment: formatAttachment(attachment),
        });

        res.status(201).json({
            message: "Message sent successfully",
            conversationId: conversation._id,
            message: formatMessage(message, me),
        });
    } catch (error) {
        if (error.code === 11000) {
            // Race: conversation was created between our check and the insert —
            // retry once with the existing conversation. The uploaded file must
            // stay on ImageKit until this retry either succeeds or fails.
            try {
                const conversation = await findConversation(schoolId, me, otherUserId);
                const message = await messageModel.create({
                    schoolId,
                    conversationId: conversation._id,
                    senderId: me,
                    text,
                    attachment,
                    readBy: [me],
                });
                await conversationModel.updateOne(
                    { _id: conversation._id },
                    { lastMessage: messagePreview(text, attachment), lastMessageAt: new Date() }
                );
                emitChatUpdate([me, otherUserId], "chat:update", {
                    conversationId: conversation._id,
                    otherUserId,
                    senderId: me,
                    senderName: req.user.name,
                    text,
                    attachment: formatAttachment(attachment),
                });
                return res.status(201).json({
                    message: "Message sent successfully",
                    conversationId: conversation._id,
                    message: formatMessage(message, me),
                });
            } catch (retryErr) {
                // Remove the file uploaded moments ago so a failed send doesn't leak it.
                if (uploadedFileId) {
                    await deleteFromImageKit(uploadedFileId);
                }
                return res.status(500).json({ error: "Failed to send message", details: retryErr.message });
            }
        }
        // Remove the file uploaded moments ago so a failed send doesn't leak it.
        if (uploadedFileId) {
            await deleteFromImageKit(uploadedFileId);
        }
        res.status(500).json({ error: "Failed to send message", details: error.message });
    }
}

// GET /api/chats/online — the user ids currently connected (socket open).
async function getOnlineUsers(req, res) {
    try {
        res.status(200).json({
            message: "Online users retrieved successfully",
            online: getOnlineUserIds(),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve online users", details: error.message });
    }
}

// Strip the internal fileId before returning an attachment to the client.
// NOTE: Mongoose stores the `attachment` nested path as an empty object on
// text-only messages, so a truthy check alone is not enough — a message only
// has an attachment when a real fileUrl is present.
function formatAttachment(attachment) {
    if (!attachment || !attachment.fileUrl) return null;
    return {
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileUrl: attachment.fileUrl,
        fileSize: attachment.fileSize,
    };
}

function formatMessage(message, viewerId) {
    const viewer = new mongoose.Types.ObjectId(String(viewerId));
    return {
        messageId: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        text: message.text,
        attachment: formatAttachment(message.attachment),
        createdAt: message.createdAt,
        // "Read" means someone OTHER than the viewer has read it — the sender
        // is in readBy at creation, so checking the viewer would always show
        // the double tick on the sender's own messages before the recipient
        // ever opens the thread.
        read: (message.readBy || []).some((id) => String(id) !== String(viewer)),
    };
}

export { getChatPeople, getMyConversations, getMessages, sendMessage, getOnlineUsers };
