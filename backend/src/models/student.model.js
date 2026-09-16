import mongoose from "mongoose";
import User from "./user.model.js";

const studentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: true,
        },
        rollNumber: {
            type: String,
            required: true,
            trim: true,
        },
        admissionNumber: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        admissionDate: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

studentSchema.index({classId: 1, rollNumber: 1}, {unique: true});

const Student = mongoose.model('Student', studentSchema);

export default Student;