import mongoose from "mongoose";

const teacherPermissionSchema = new mongoose.Schema(
    {
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Teacher',
            required: true,
        },
        permissionType: {
            type: String,
            enum: ['READ', 'WRITE', 'ADMIN'],
            required: true,
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: true,
        },
        grantedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        grantedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const TeacherPermission = mongoose.model('TeacherPermission', teacherPermissionSchema);

export default TeacherPermission;