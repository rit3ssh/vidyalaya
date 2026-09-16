import mongoose from "mongoose";

const classSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" }, // homeroom teacher, optional
    name: { type: String, required: true, trim: true }, // e.g. "Grade 8"
    section: { type: String, trim: true }, // e.g. "A"
    academicYear: { type: String, trim: true }, // e.g. "2026"
  },
  {timestamps: true}
);

classSchema.index({ schoolId: 1, name: 1, section: 1, academicYear: 1 }, { unique: true });
const Class = mongoose.model("Class", classSchema);

export default Class;