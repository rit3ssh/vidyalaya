import mongoose from "mongoose";


const classSchema = new mongoose.Schema(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
        className: {
            type: String,
            required: true,
            trim: true,
        },
        classSection: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
    },
    {
        timestamps: true,
    }
);

// THIS LINE ENFORCES UNIQUNESS ACROSS MULTIPLE FIELDS
classSchema.index({ schoolId: 1, className: 1, classSection: 1 }, { unique: true });

const Class = mongoose.model('Class', classSchema);

export default Class;