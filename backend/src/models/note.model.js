import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: true,
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Class",
            required: true,
        },
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
            required: true,
        },
        // Optional file uploaded to ImageKit — only the URL (plus the ImageKit
        // fileId for later cleanup) is stored here.
        fileUrl: {
            type: String,
            trim: true,
        },
        fileId: {
            type: String,
            trim: true,
        },
        fileName: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Fast lookups for the notes room: all notes of a class+subject, newest first.
noteSchema.index({ classId: 1, subjectId: 1, createdAt: -1 });

const Note = mongoose.model("Note", noteSchema);

export default Note;
