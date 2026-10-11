import mongoose from "mongoose";


const studentParentSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
        },
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Parent',
            required: true,
        },
        relationType: {
            type: String,
            enum: ['Father', 'Mother', 'Guardian'],
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// A given student/parent pair should only ever be linked once.
studentParentSchema.index({ studentId: 1, parentId: 1 }, { unique: true });


const StudentParent = mongoose.model('StudentParent', studentParentSchema);

export default StudentParent;