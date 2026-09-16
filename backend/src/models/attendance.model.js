import mongoose from "mongoose";

const studentAttendanceRecordSchema = new mongoose.Schema({
    studentProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    // PRESENT, ABSENT, LATE, LEAVE
    status: {
        type: String,
        enum: ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'],
        default: 'ABSENT' 
    },
    remarks: {
        type: String,
        trim: true
    }
});

const attendanceSchema = new mongoose.Schema(
    {
        schoolId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: true
        },
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            required: true
        },
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // The teacher tracking the attendance
            required: true
        },
        // Clean Date normalized to YYYY-MM-DD to avoid timezone time offsets matching issues
        date: {
            type: String, 
            required: true
        },
        // Optional slot metadata tracking (e.g., "10:00 AM - 11:00 AM" or "Period 1")
        timeSlot: {
            type: String,
            trim: true
        },
        records: [studentAttendanceRecordSchema]
    },
    { timestamps: true }
);

// 🟢 Compound Index: Prevents double sheets for the exact same subject, class, date, and period slot
attendanceSchema.index({ classId: 1, subjectId: 1, date: 1, timeSlot: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;