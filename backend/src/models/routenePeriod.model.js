import mongoose from "mongoose";

const routinePeriodSchema = new mongoose.Schema(
    {
        schoolId: { // Crucial for multi-tenant isolation
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: true,
        },
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            required: true,
        },
        // ref: 'User' (not 'Teacher') so it matches Attendance.teacherId,
        // which stores req.user._id. Keeps routine <-> attendance joins trivial.
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        academicYear: {
            type: String,
            required: true, // e.g., "2026"
        },
        day: {
            type: String,
            enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            required: true,
        },
        // Store time in "HH:MM" 24-hour format (e.g., "09:30", "14:15") so MongoDB can sort/compare strings easily
        startTime: {
            type: String,
            required: true,
        },
        endTime: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// CRITICAL STEP: Prevent double booking using a database-level compound index
// This rule says: A teacher cannot be assigned to two different classes at the same day/time slot.
routinePeriodSchema.index({ teacherId: 1, day: 1, startTime: 1 }, { unique: true });

// This rule says: A class cannot have two different subjects/teachers at the same day/time slot.
routinePeriodSchema.index({ classId: 1, day: 1, startTime: 1 }, { unique: true });

const RoutinePeriod = mongoose.model('RoutinePeriod', routinePeriodSchema);
export default RoutinePeriod;