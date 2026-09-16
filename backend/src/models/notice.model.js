import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
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
        noticeDate: {
            type: Date,
            required: true,
        },
        // Optional image (e.g. a photo of the printed notice) — URL on ImageKit.
        imageUrl: {
            type: String,
            trim: true,
        },
        // Optional attachment (e.g. the original notice as a PDF) — URL on ImageKit.
        attachmentUrl: {
            type: String,
            trim: true,
        },
        // ImageKit file IDs so the files can be removed from ImageKit when the
        // notice is deleted or the file is replaced. Not exposed via the API.
        imageFileId: {
            type: String,
            trim: true,
        },
        attachmentFileId: {
            type: String,
            trim: true,
        },
        // Which user published the notice (school admin).
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Teachers/students/parents will most often fetch the latest notices,
// so keep them indexed by school and date.
noticeSchema.index({ schoolId: 1, noticeDate: -1 });

const Notice = mongoose.model('Notice', noticeSchema);

export default Notice;
