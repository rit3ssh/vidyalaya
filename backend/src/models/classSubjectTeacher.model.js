import mongoose from "mongoose";

const classSubjectTeacherSchema = new mongoose.Schema(
    {
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
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Teacher',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// A class can only have each subject assigned once — backs both the exam grid
// (class → subjects) and the notes room (teacher may post for assigned combos).
classSubjectTeacherSchema.index({ classId: 1, subjectId: 1 }, { unique: true });

const ClassSubjectTeacher = mongoose.model('ClassSubjectTeacher', classSubjectTeacherSchema);

export default ClassSubjectTeacher;