import mongoose from "mongoose";

// One entry = one subject exam for a class on a date. The routine is keyed by
// className (e.g. "Grade 8") rather than by class+section, because every
// section of a class sits the same exam on the same day — so the grid shows
// one row per class name.
const examSchema = new mongoose.Schema(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true,
            index: true,
        },
        className: {
            type: String,
            required: true,
            trim: true,
        },
        date: {
            type: Date,
            required: true,
        },
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: true,
        },
        // Exam window for this entry, as 24-hour "HH:mm" strings (matches the
        // routine periods convention).
        startTime: {
            type: String,
            required: true,
            trim: true,
        },
        endTime: {
            type: String,
            required: true,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

// Backs the per-row dedupe; one exam per class per day is enforced by the
// controllers (a class sits exactly one exam on a given date).
examSchema.index({ schoolId: 1, className: 1, date: 1, subjectId: 1 }, { unique: true });

const Exam = mongoose.model("Exam", examSchema);

export default Exam;
