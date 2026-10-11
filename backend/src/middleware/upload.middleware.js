// Multer middleware for notice file uploads.
// Files are kept in memory (Buffers) because they are immediately forwarded
// to ImageKit — nothing is written to the local disk.

import multer from "multer";

const storage = multer.memoryStorage();

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PDF_TYPES = ["application/pdf"];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

function fileFilter(req, file, cb) {
    const allowed = file.fieldname === "image" ? IMAGE_TYPES : PDF_TYPES;
    if (allowed.includes(file.mimetype)) {
        return cb(null, true);
    }
    cb(new Error(`Unsupported file type for "${file.fieldname}": ${file.mimetype}.`));
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_ATTACHMENT_SIZE }, // hard cap; per-field limit enforced below
});

// Expects at most one "image" file and one "attachment" file per request.
const uploadNoticeFiles = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "attachment", maxCount: 1 },
]);

// Wrapper that converts multer errors (wrong type, too large, etc.) into a
// clean 400 response instead of an unhandled exception, and enforces the
// smaller size cap for the "image" field.
function handleNoticeUpload(req, res, next) {
    uploadNoticeFiles(req, res, (err) => {
        if (err) {
            // Friendlier message when a file exceeds the overall size cap
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ message: "Files must be 10 MB or smaller." });
            }
            return res.status(400).json({ message: err.message });
        }
        const image = req.files?.image?.[0];
        if (image && image.size > MAX_IMAGE_SIZE) {
            return res.status(400).json({ message: "Image file must be 5 MB or smaller." });
        }
        next();
    });
}

// ─── Notes ─────────────────────────────────────────────────────────────────
// A note carries at most one optional file (a PDF or an image), uploaded via
// the single "file" field. Separate multer instance so its fileFilter accepts
// both PDFs and images (unlike the notice uploader's field-specific rules).

const NOTE_TYPES = [...PDF_TYPES, ...IMAGE_TYPES];
const MAX_NOTE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const noteUpload = multer({
    storage,
    fileFilter(req, file, cb) {
        if (NOTE_TYPES.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error(`Unsupported file type: ${file.mimetype}. Use a PDF or an image.`));
    },
    limits: { fileSize: MAX_NOTE_FILE_SIZE },
});

function handleNoteUpload(req, res, next) {
    noteUpload.single("file")(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ message: "Note file must be 10 MB or smaller." });
            }
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}

// ─── Chat ─────────────────────────────────────────────────────────────────
// A chat message carries optional text plus at most one file (shared via the
// single "file" field). Broader than notes: images, PDFs, office docs, plain
// text and zips — whatever a teacher/student/parent might want to share.

const CHAT_TYPES = [
    ...IMAGE_TYPES,
    ...PDF_TYPES,
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip-compressed",
];
const MAX_CHAT_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const chatUpload = multer({
    storage,
    fileFilter(req, file, cb) {
        if (CHAT_TYPES.includes(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error(`Unsupported file type: ${file.mimetype}.`));
    },
    limits: { fileSize: MAX_CHAT_FILE_SIZE },
});

function handleChatUpload(req, res, next) {
    chatUpload.single("file")(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ message: "Chat file must be 15 MB or smaller." });
            }
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}

export { handleNoticeUpload, handleNoteUpload, handleChatUpload };
