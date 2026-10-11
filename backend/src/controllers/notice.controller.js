// Controllers for school notices.
// Admins publish/edit/delete notices; every school member (teacher, student,
// parent, admin) can view them. Everything is scoped to the admin's school.
//
// Requests use multipart/form-data (handled by the upload middleware):
//   text fields:  title, description, noticeDate
//   optional files:  image (photo) and/or attachment (PDF)
//   optional URL fallback:  imageUrl, attachmentUrl (when no file is sent)
// Uploaded files are stored on ImageKit and only the returned URLs (plus the
// ImageKit fileIds for later cleanup) are persisted in MongoDB.

import mongoose from "mongoose";
import noticeModel from "../models/notice.model.js";
import { uploadToImageKit, deleteFromImageKit } from "../config/imagekit.js";

function parseNoticeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

// Returns a 404 response if :noticeId is not a valid MongoDB ObjectId
function isInvalidId(noticeId) {
    return !mongoose.isValidObjectId(noticeId);
}

// A file/url is treated as "cleared" when sent as empty string / null.
function isClearedValue(value) {
    return value === "" || value === null || value === "null";
}

// Upload one multer file (if present) to ImageKit. Returns null when absent.
async function uploadFileIfPresent(files, field) {
    const file = files?.[field]?.[0];
    if (!file) return null;
    return uploadToImageKit({
        buffer: file.buffer,
        originalName: file.originalname,
        folder: "/notices",
    });
}

// POST /api/notices — publish a new notice (SCHOOL_ADMIN only)
async function createNotice(req, res) {
    const { title, description, noticeDate } = req.body;
    const schoolId = req.user.schoolId;

    if (!title || !String(title).trim() || !description || !String(description).trim() || !noticeDate) {
        return res.status(400).json({
            message: "title, description and noticeDate are required",
        });
    }

    const parsedDate = parseNoticeDate(noticeDate);
    if (!parsedDate) {
        return res.status(400).json({ message: "noticeDate must be a valid date" });
    }

    // Tracks files already uploaded to ImageKit so they can be removed again
    // if a later step (the DB write) fails — prevents orphaned files.
    const uploadedFileIds = [];

    try {
        // Upload any attached files to ImageKit first, then store the URLs.
        const image = await uploadFileIfPresent(req.files, "image");
        if (image) uploadedFileIds.push(image.fileId);

        const attachment = await uploadFileIfPresent(req.files, "attachment");
        if (attachment) uploadedFileIds.push(attachment.fileId);

        // If no file was sent, fall back to a plain URL provided by the client.
        const imageUrl =
            image?.url ||
            (typeof req.body.imageUrl === "string" && req.body.imageUrl.trim()
                ? req.body.imageUrl.trim()
                : undefined);
        const attachmentUrl =
            attachment?.url ||
            (typeof req.body.attachmentUrl === "string" && req.body.attachmentUrl.trim()
                ? req.body.attachmentUrl.trim()
                : undefined);

        const notice = await noticeModel.create({
            schoolId,
            title,
            description,
            noticeDate: parsedDate,
            imageUrl,
            imageFileId: image?.fileId,
            attachmentUrl,
            attachmentFileId: attachment?.fileId,
            createdBy: req.user.id,
        });

        res.status(201).json({
            message: "Notice published successfully",
            notice: formatNotice(notice),
        });
    } catch (error) {
        // Clean up files uploaded moments ago so they don't leak on ImageKit.
        await Promise.all(uploadedFileIds.map((id) => deleteFromImageKit(id)));

        if (error.code === "IMAGEKIT_NOT_CONFIGURED") {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({
            error: "Failed to publish notice",
            details: error.message,
        });
    }
}

// GET /api/notices?limit=10 — list all notices for the user's school, newest first
async function getNotices(req, res) {
    const schoolId = req.user.schoolId;
    const limit = parseInt(req.query.limit, 10);
    const effectiveLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50;

    try {
        const notices = await noticeModel
            .find({ schoolId })
            .sort({ noticeDate: -1, createdAt: -1 })
            .limit(effectiveLimit);

        res.status(200).json({
            message: "Notices retrieved successfully",
            count: notices.length,
            notices: notices.map(formatNotice),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve notices" });
    }
}

// GET /api/notices/:noticeId — view a single notice (any school member)
async function getNotice(req, res) {
    const { noticeId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(noticeId)) {
        return res.status(404).json({ error: "Notice not found" });
    }

    try {
        const notice = await noticeModel.findOne({ _id: noticeId, schoolId });

        if (!notice) {
            return res.status(404).json({ error: "Notice not found" });
        }

        res.status(200).json({
            message: "Notice retrieved successfully",
            notice: formatNotice(notice),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve notice" });
    }
}

// PUT /api/notices/:noticeId — edit an existing notice (SCHOOL_ADMIN only)
async function updateNotice(req, res) {
    const { noticeId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(noticeId)) {
        return res.status(404).json({ error: "Notice not found" });
    }

    // Text fields that may be updated.
    const updates = {};
    for (const field of ["title", "description"]) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (req.body.noticeDate !== undefined) {
        const parsedDate = parseNoticeDate(req.body.noticeDate);
        if (!parsedDate) {
            return res.status(400).json({ message: "noticeDate must be a valid date" });
        }
        updates.noticeDate = parsedDate;
    }

    // Files uploaded during this request; removed again if the update fails.
    const uploadedFileIds = [];

    try {
        const notice = await noticeModel.findOne({ _id: noticeId, schoolId });
        if (!notice) {
            return res.status(404).json({ error: "Notice not found" });
        }

        // Image handling: new file > explicit URL > cleared (empty/null) > unchanged.
        let imageReplaced = false;
        const newImage = await uploadFileIfPresent(req.files, "image");
        if (newImage) {
            uploadedFileIds.push(newImage.fileId);
            updates.imageUrl = newImage.url;
            updates.imageFileId = newImage.fileId;
            imageReplaced = true;
        } else if (isClearedValue(req.body.imageUrl)) {
            updates.imageUrl = null;
            updates.imageFileId = null;
            imageReplaced = true;
        } else if (typeof req.body.imageUrl === "string" && req.body.imageUrl.trim()) {
            updates.imageUrl = req.body.imageUrl.trim();
            updates.imageFileId = null;
            imageReplaced = true;
        }

        // Attachment handling: same rules.
        let attachmentReplaced = false;
        const newAttachment = await uploadFileIfPresent(req.files, "attachment");
        if (newAttachment) {
            uploadedFileIds.push(newAttachment.fileId);
            updates.attachmentUrl = newAttachment.url;
            updates.attachmentFileId = newAttachment.fileId;
            attachmentReplaced = true;
        } else if (isClearedValue(req.body.attachmentUrl)) {
            updates.attachmentUrl = null;
            updates.attachmentFileId = null;
            attachmentReplaced = true;
        } else if (typeof req.body.attachmentUrl === "string" && req.body.attachmentUrl.trim()) {
            updates.attachmentUrl = req.body.attachmentUrl.trim();
            updates.attachmentFileId = null;
            attachmentReplaced = true;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        const updatedNotice = await noticeModel.findOneAndUpdate(
            { _id: noticeId, schoolId },
            { $set: updates },
            { new: true, runValidators: true }
        );

        // Remove the old files from ImageKit now that they've been replaced.
        if (imageReplaced && notice.imageFileId) {
            await deleteFromImageKit(notice.imageFileId);
        }
        if (attachmentReplaced && notice.attachmentFileId) {
            await deleteFromImageKit(notice.attachmentFileId);
        }

        res.status(200).json({
            message: "Notice updated successfully",
            notice: formatNotice(updatedNotice),
        });
    } catch (error) {
        // Remove files uploaded moments ago so a failed update doesn't leak them.
        await Promise.all(uploadedFileIds.map((id) => deleteFromImageKit(id)));

        if (error.code === "IMAGEKIT_NOT_CONFIGURED") {
            return res.status(500).json({ message: error.message });
        }
        res.status(500).json({ error: "Failed to update notice", details: error.message });
    }
}

// DELETE /api/notices/:noticeId — remove a notice (SCHOOL_ADMIN only)
async function deleteNotice(req, res) {
    const { noticeId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(noticeId)) {
        return res.status(404).json({ error: "Notice not found" });
    }

    try {
        const deleted = await noticeModel.findOneAndDelete({ _id: noticeId, schoolId });

        if (!deleted) {
            return res.status(404).json({ error: "Notice not found" });
        }

        // Best-effort cleanup of the uploaded files on ImageKit.
        await Promise.all([
            deleteFromImageKit(deleted.imageFileId),
            deleteFromImageKit(deleted.attachmentFileId),
        ]);

        res.status(200).json({
            message: "Notice deleted successfully",
            notice: formatNotice(deleted),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete notice" });
    }
}

function formatNotice(notice) {
    return {
        noticeId: notice._id,
        title: notice.title,
        description: notice.description,
        noticeDate: notice.noticeDate,
        imageUrl: notice.imageUrl || null,
        attachmentUrl: notice.attachmentUrl || null,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
    };
}

export { createNotice, getNotices, getNotice, updateNotice, deleteNotice };
