// Controllers for the class "notes room".
//
// Teachers share notes for a specific class + subject (only for combos they're
// assigned to via ClassSubjectTeacher). Students can only see notes of their
// own class, and can filter them by subject. Parents have no access here.
//
// Requests use multipart/form-data (handled by the upload middleware):
//   text fields:  title, description, classId, subjectId
//   optional file:  file (PDF or image, forwarded to ImageKit)
//   optional URL fallback:  fileUrl (when no file is sent)
// Uploaded files are stored on ImageKit and only the returned URL (plus the
// ImageKit fileId for later cleanup) is persisted in MongoDB.

import mongoose from "mongoose";
import noteModel from "../models/note.model.js";
import subjectModel from "../models/subject.model.js";
import teacherModel from "../models/teacher.model.js";
import studentModel from "../models/student.model.js";
import classSubjectTeacherModel from "../models/classSubjectTeacher.model.js";
import { uploadToImageKit, deleteFromImageKit } from "../config/imagekit.js";

// The note shape sent to clients: fileId stays private (only for cleanup).
const NOTE_POPULATE = [
    { path: "subjectId", select: "name code" },
    { path: "classId", select: "name section academicYear" },
    { path: "teacherId", populate: { path: "userId", select: "firstName lastName" } },
];

function isInvalidId(id) {
    return !mongoose.isValidObjectId(id);
}

// A file/url is treated as "cleared" when sent as empty string / null.
function isClearedValue(value) {
    return value === "" || value === null || value === "null";
}

// Resolve the logged-in teacher's profile (JWT carries the User id, notes
// reference the Teacher profile). Returns null when there is no profile.
async function getTeacherProfile(userId) {
    return teacherModel.findOne({ userId });
}

// Resolve the logged-in student's class (JWT carries the User id, students
// reference their class via the Student profile). Returns null when missing.
async function getStudent(userId) {
    return studentModel.findOne({ userId });
}

async function getTeacherAssignments(teacherId) {
    return classSubjectTeacherModel
        .find({ teacherId })
        .populate("classId", "name section academicYear")
        .populate("subjectId", "name code");
}

// Upload the optional note file (if present) to ImageKit. Returns null when
// no file was attached.
async function uploadFileIfPresent(req) {
    if (!req.file) return null;
    return uploadToImageKit({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        folder: "/notes",
    });
}

// Distinct subjects that have notes within `scope`, with note counts — powers
// the student's subject dropdown and the teacher's filter.
// NOTE: scope ids come from the JWT as strings; unlike find(), aggregate() does
// not cast $match values, so they must be cast to ObjectId explicitly or the
// match silently returns nothing.
async function distinctSubjects(scope) {
    const toObjectId = (id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id);
    const match = { schoolId: toObjectId(scope.schoolId) };
    if (scope.classId) match.classId = toObjectId(scope.classId);

    const rows = await noteModel.aggregate([
        { $match: match },
        { $group: { _id: "$subjectId", count: { $sum: 1 } } },
        {
            $lookup: {
                from: subjectModel.collection.name,
                localField: "_id",
                foreignField: "_id",
                as: "subject",
            },
        },
        { $unwind: "$subject" },
        {
            $project: {
                _id: 0,
                subjectId: "$_id",
                name: "$subject.name",
                code: "$subject.code",
                count: 1,
            },
        },
        { $sort: { name: 1 } },
    ]);
    return rows;
}

// GET /api/notes/assignments — the class+subject combos a teacher may post to.
async function getMyAssignments(req, res) {
    try {
        const teacher = await getTeacherProfile(req.user.id);
        if (!teacher) {
            return res.status(403).json({ error: "Teacher profile not found" });
        }

        const assignments = await getTeacherAssignments(teacher._id);

        res.status(200).json({
            message: "Assignments retrieved successfully",
            assignments: assignments.map((a) => ({
                classId: a.classId?._id,
                className: a.classId?.name,
                section: a.classId?.section,
                academicYear: a.classId?.academicYear,
                subjectId: a.subjectId?._id,
                subjectName: a.subjectId?.name,
                subjectCode: a.subjectId?.code,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve assignments", details: error.message });
    }
}

// POST /api/notes — share a note for an assigned class + subject (TEACHER only)
async function createNote(req, res) {
    const { title, description, classId, subjectId } = req.body;
    const schoolId = req.user.schoolId;

    if (
        !title ||
        !String(title).trim() ||
        !description ||
        !String(description).trim() ||
        !classId ||
        !subjectId
    ) {
        return res
            .status(400)
            .json({ message: "title, description, classId and subjectId are required" });
    }
    if (isInvalidId(classId) || isInvalidId(subjectId)) {
        return res.status(400).json({ message: "Invalid class or subject" });
    }

    // Tracks files already uploaded to ImageKit so they can be removed again
    // if a later step (the DB write) fails — prevents orphaned files.
    const uploadedFileIds = [];

    try {
        const teacher = await getTeacherProfile(req.user.id);
        if (!teacher) {
            return res.status(403).json({ error: "Teacher profile not found" });
        }

        // Teachers may only share notes for combos they're assigned to.
        const isAssigned = await classSubjectTeacherModel.exists({
            teacherId: teacher._id,
            classId,
            subjectId,
        });
        if (!isAssigned) {
            return res.status(403).json({
                error: "You can only share notes for the classes and subjects assigned to you",
            });
        }

        const file = await uploadFileIfPresent(req);
        if (file) uploadedFileIds.push(file.fileId);

        const note = await noteModel.create({
            schoolId,
            title,
            description,
            classId,
            subjectId,
            teacherId: teacher._id,
            fileUrl: file?.url,
            fileId: file?.fileId,
            fileName: req.file?.originalname || null,
        });

        const populated = await noteModel.findById(note._id).populate(NOTE_POPULATE);

        res.status(201).json({
            message: "Note shared successfully",
            note: formatNote(populated, { viewerTeacherId: teacher._id }),
        });
    } catch (error) {
        // Clean up files uploaded moments ago so they don't leak on ImageKit.
        await Promise.all(uploadedFileIds.map((id) => deleteFromImageKit(id)));

        if (error.code === "IMAGEKIT_NOT_CONFIGURED") {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ error: "Failed to share note", details: error.message });
    }
}

// GET /api/notes?subjectId= — list notes for the user's scope, newest first.
//   STUDENT: all notes of their own class (subjectId optional)
//   TEACHER: the whole "room" — all notes across the classes they're assigned
//            to (subjectId optional). canManage flags their own notes.
// Also returns `subjects` (for the dropdown) and `latestNote` (the most recent
// note in scope, independent of the subject filter — powers the latest card).
async function getNotes(req, res) {
    const schoolId = req.user.schoolId;
    const { subjectId } = req.query;

    try {
        const scope = { schoolId };
        let viewerTeacherId = null;

        if (req.user.role === "STUDENT") {
            const student = await getStudent(req.user.id);
            if (!student) {
                return res.status(403).json({ error: "Student profile not found" });
            }
            scope.classId = student.classId;
        } else {
            const teacher = await getTeacherProfile(req.user.id);
            if (!teacher) {
                return res.status(403).json({ error: "Teacher profile not found" });
            }

            // The teacher's room = every class they're assigned to (any subject).
            const assignedClassIds = await classSubjectTeacherModel.distinct("classId", {
                teacherId: teacher._id,
            });
            if (assignedClassIds.length === 0) {
                return res.status(200).json({
                    message: "Notes retrieved successfully",
                    count: 0,
                    notes: [],
                    subjects: [],
                    latestNote: null,
                });
            }
            scope.classId = { $in: assignedClassIds };
            viewerTeacherId = teacher._id;
        }

        if (subjectId && mongoose.isValidObjectId(subjectId)) {
            scope.subjectId = subjectId;
        }

        // latestNote uses the same class scope but ignores the subject filter.
        const latestScope = { schoolId, classId: scope.classId };

        const [notes, subjects, latestNote] = await Promise.all([
            noteModel
                .find(scope)
                .sort({ createdAt: -1 })
                .limit(200)
                .populate(NOTE_POPULATE),
            distinctSubjects(scope),
            noteModel.findOne(latestScope).sort({ createdAt: -1 }).populate(NOTE_POPULATE),
        ]);

        res.status(200).json({
            message: "Notes retrieved successfully",
            count: notes.length,
            notes: notes.map((n) => formatNote(n, { viewerTeacherId })),
            subjects,
            latestNote: latestNote ? formatNote(latestNote, { viewerTeacherId }) : null,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve notes", details: error.message });
    }
}

// GET /api/notes/:noteId — view a single note (scoped to class / own notes)
async function getNote(req, res) {
    const { noteId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(noteId)) {
        return res.status(404).json({ error: "Note not found" });
    }

    try {
        const note = await noteModel.findOne({ _id: noteId, schoolId }).populate(NOTE_POPULATE);
        if (!note) {
            return res.status(404).json({ error: "Note not found" });
        }

        let viewerTeacherId = null;

        if (req.user.role === "STUDENT") {
            const student = await getStudent(req.user.id);
            if (!student || !note.classId.equals(student.classId)) {
                return res.status(403).json({ error: "You don't have access to this note" });
            }
        } else {
            // Teachers may open any note in a class they're assigned to.
            const teacher = await getTeacherProfile(req.user.id);
            if (!teacher) {
                return res.status(403).json({ error: "Teacher profile not found" });
            }
            viewerTeacherId = teacher._id;
            const isOwn = note.teacherId.equals(teacher._id);
            if (!isOwn) {
                const isAssignedToClass = await classSubjectTeacherModel.exists({
                    teacherId: teacher._id,
                    classId: note.classId,
                });
                if (!isAssignedToClass) {
                    return res.status(403).json({ error: "You don't have access to this note" });
                }
            }
        }

        res.status(200).json({
            message: "Note retrieved successfully",
            note: formatNote(note, { viewerTeacherId }),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve note" });
    }
}

// PUT /api/notes/:noteId — edit your own note (TEACHER only)
async function updateNote(req, res) {
    const { noteId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(noteId)) {
        return res.status(404).json({ error: "Note not found" });
    }

    const updates = {};
    const uploadedFileIds = [];

    try {
        const teacher = await getTeacherProfile(req.user.id);
        if (!teacher) {
            return res.status(403).json({ error: "Teacher profile not found" });
        }

        const note = await noteModel.findOne({ _id: noteId, schoolId });
        if (!note) {
            return res.status(404).json({ error: "Note not found" });
        }
        if (!note.teacherId.equals(teacher._id)) {
            return res.status(403).json({ error: "You can only edit your own notes" });
        }

        for (const field of ["title", "description"]) {
            if (req.body[field] !== undefined) updates[field] = String(req.body[field]).trim();
        }

        // Changing class and/or subject must still resolve to an assigned combo.
        if (req.body.classId !== undefined || req.body.subjectId !== undefined) {
            const nextClassId = req.body.classId !== undefined ? req.body.classId : note.classId;
            const nextSubjectId =
                req.body.subjectId !== undefined ? req.body.subjectId : note.subjectId;

            if (isInvalidId(nextClassId) || isInvalidId(nextSubjectId)) {
                return res.status(400).json({ message: "Invalid class or subject" });
            }

            const isAssigned = await classSubjectTeacherModel.exists({
                teacherId: teacher._id,
                classId: nextClassId,
                subjectId: nextSubjectId,
            });
            if (!isAssigned) {
                return res.status(403).json({
                    error: "You can only share notes for the classes and subjects assigned to you",
                });
            }
            updates.classId = nextClassId;
            updates.subjectId = nextSubjectId;
        }

        // File handling: new file > cleared (empty/null) > unchanged.
        let fileReplaced = false;
        if (req.file) {
            const uploaded = await uploadFileIfPresent(req);
            uploadedFileIds.push(uploaded.fileId);
            updates.fileUrl = uploaded.url;
            updates.fileId = uploaded.fileId;
            updates.fileName = req.file.originalname;
            fileReplaced = true;
        } else if (isClearedValue(req.body.fileUrl)) {
            updates.fileUrl = null;
            updates.fileId = null;
            updates.fileName = null;
            fileReplaced = true;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const updated = await noteModel
            .findByIdAndUpdate(noteId, { $set: updates }, { new: true, runValidators: true })
            .populate(NOTE_POPULATE);

        // Remove the old remote file now that it's been replaced/cleared.
        if (fileReplaced && note.fileId) {
            await deleteFromImageKit(note.fileId);
        }

        res.status(200).json({
            message: "Note updated successfully",
            note: formatNote(updated, { viewerTeacherId: teacher._id }),
        });
    } catch (error) {
        await Promise.all(uploadedFileIds.map((id) => deleteFromImageKit(id)));

        if (error.code === "IMAGEKIT_NOT_CONFIGURED") {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ error: "Failed to update note", details: error.message });
    }
}

// DELETE /api/notes/:noteId — remove your own note (TEACHER only)
async function deleteNote(req, res) {
    const { noteId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(noteId)) {
        return res.status(404).json({ error: "Note not found" });
    }

    try {
        const teacher = await getTeacherProfile(req.user.id);
        if (!teacher) {
            return res.status(403).json({ error: "Teacher profile not found" });
        }

        const note = await noteModel.findOne({ _id: noteId, schoolId });
        if (!note) {
            return res.status(404).json({ error: "Note not found" });
        }
        if (!note.teacherId.equals(teacher._id)) {
            return res.status(403).json({ error: "You can only delete your own notes" });
        }

        await noteModel.deleteOne({ _id: note._id });

        // Best-effort cleanup of the attached file on ImageKit.
        await deleteFromImageKit(note.fileId);

        res.status(200).json({
            message: "Note deleted successfully",
            note: formatNote(note),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete note", details: error.message });
    }
}

function formatNote(note, { viewerTeacherId = null } = {}) {
    const teacherUser = note.teacherId?.userId;
    // note.teacherId may be a populated document or a plain ObjectId — normalize
    // before comparing (String() on a populated doc is not reliably the id hex).
    const noteTeacherId = note.teacherId?._id || note.teacherId;
    const isOwnNote =
        viewerTeacherId && noteTeacherId && String(noteTeacherId) === String(viewerTeacherId);
    return {
        noteId: note._id,
        title: note.title,
        description: note.description,
        classId: note.classId?._id || note.classId,
        className: note.classId?.name,
        section: note.classId?.section,
        academicYear: note.classId?.academicYear,
        subjectId: note.subjectId?._id || note.subjectId,
        subjectName: note.subjectId?.name,
        subjectCode: note.subjectId?.code,
        fileUrl: note.fileUrl || null,
        fileName: note.fileName || null,
        teacherId: note.teacherId?._id || note.teacherId,
        teacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null,
        // Only meaningful for teacher viewers (their own notes are editable).
        canManage: Boolean(isOwnNote),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
    };
}

export { getMyAssignments, createNote, getNotes, getNote, updateNote, deleteNote };
