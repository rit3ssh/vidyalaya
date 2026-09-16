
import mongoose from "mongoose";
import classModel from "../models/class.model.js" ;
import subjectModel from "../models/subject.model.js" ;
import userModel from "../models/user.model.js" ;
import teacherModel from "../models/teacher.model.js";
import classSubjectTeacherModel from "../models/classSubjectTeacher.model.js";
import RoutinePeriod from "../models/routenePeriod.model.js" ;

function isInvalidId(id) {
    return !mongoose.isValidObjectId(id);
}

async function addClass (req, res){
    const { name, section, academicYear } = req.body;
    const schoolId = req.user.schoolId;

    try {
        const newClass = await classModel.create({
            schoolId,
            name,
            section,
            academicYear
        });
        res.status(201).json({ 
            message: "Class added successfully" ,
            class: {
                classId: newClass._id,
                name: newClass.name,
                section: newClass.section,
                academicYear: newClass.academicYear
            }
        });
    } catch (error) {
        res.status(500).json({ errorMessage: "Failed to add class",
            error: error.message
         });
    }
}


async function viewAllClass(req, res) {
    const schoolId = req.user.schoolId;

    try {
        const classes = await classModel.find({ schoolId });
        res.status(200).json({
            message: "Classes retrieved successfully",
            classes: classes.map(cls => ({
                classId: cls._id,
                name: cls.name,
                section: cls.section,
                academicYear: cls.academicYear,
                classTeacher: cls.classTeacher
            }))
        });
        } catch (error) {
            res.status(500).json({ error: "Failed to retrieve classes" });
        }
}

async function viewClass(req, res) {
    const classId = req.params.classId;
    const schoolId = req.user.schoolId;

    try {
        const cls = await classModel.findOne({ _id: classId, schoolId });

        if (!cls) {
            return res.status(404).json({ error: "Class not found" });
        }

        res.status(200).json({
            message: "Class retrieved successfully",
            class: {
                classId: cls._id,
                name: cls.name,
                section: cls.section,
                academicYear: cls.academicYear
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve class" });
    }
}



async function updateClass(req, res) {
    const classId = req.params.classId;
    try {
        const updatedClass = await classModel.findByIdAndUpdate(
            { _id: classId },
            { $set: req.body },
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({ error: "Class not found" });
        }

        res.status(200).json({
            message: "Class updated successfully",
            class: {
                classId: updatedClass._id,
                name: updatedClass.name,
                section: updatedClass.section,
                academicYear: updatedClass.academicYear
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to update class" });
    }
}


async function deleteClass(req, res) {
    const classId = req.params.classId;

    try {
        const deletedClass = await classModel.findByIdAndDelete(classId);
        if (!deletedClass) {
            return res.status(404).json({ error: "Class not found" });
        }
        res.status(200).json({ 
            message: "Class deleted successfully",
            class: {
                classId: deletedClass._id,
                name: deletedClass.name,
                section: deletedClass.section
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete class" });
    }
}


//routene (timetable) controller functions

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// POST body: { classId, subjectId, teacherId, academicYear, day, startTime, endTime }
async function addRoutinePeriod(req, res) {
    const { classId, subjectId, teacherId, academicYear, day, startTime, endTime } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !teacherId || !academicYear || !day || !startTime || !endTime) {
        return res.status(400).json({ message: "classId, subjectId, teacherId, academicYear, day, startTime and endTime are required" });
    }

    try {
        const period = await RoutinePeriod.create({
            schoolId,
            classId,
            subjectId,
            teacherId,
            academicYear,
            day,
            startTime,
            endTime
        });

        res.status(201).json({
            message: "Routine period added successfully",
            routinePeriod: {
                periodId: period._id,
                classId: period.classId,
                subjectId: period.subjectId,
                teacherId: period.teacherId,
                academicYear: period.academicYear,
                day: period.day,
                startTime: period.startTime,
                endTime: period.endTime
            }
        });
    } catch (error) {
        // 11000 = duplicate key (teacher or class already booked at this slot)
        if (error.code === 11000) {
            return res.status(409).json({ message: "Slot conflict: teacher or class is already booked at this day/time" });
        }
        res.status(500).json({ error: "Failed to add routine period", details: error.message });
    }
}

// GET /api/academics/view-routine?classId=...&day=Monday  (day optional)
async function viewRoutine(req, res) {
    const { classId, day } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId) {
        return res.status(400).json({ message: "classId query parameter is required" });
    }

    try {
        const query = { schoolId, classId };
        if (day) query.day = day;

        const periods = await RoutinePeriod.find(query)
            .populate('subjectId', 'name code')
            .populate('teacherId', 'firstName lastName');

        // Sort in calendar day order (not alphabetical), then by start time
        const routine = periods
            .map(p => ({
                periodId: p._id,
                classId: p.classId,
                academicYear: p.academicYear,
                subject: p.subjectId ? { subjectId: p.subjectId._id, name: p.subjectId.name, code: p.subjectId.code } : null,
                teacher: p.teacherId ? { teacherId: p.teacherId._id, name: `${p.teacherId.firstName} ${p.teacherId.lastName}` } : null,
                day: p.day,
                startTime: p.startTime,
                endTime: p.endTime
            }))
            .sort((a, b) =>
                DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
                a.startTime.localeCompare(b.startTime)
            );

        res.status(200).json({
            message: "Routine retrieved successfully",
            routine
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve routine", details: error.message });
    }
}

// PUT /api/academics/update-routine-period/:periodId
async function updateRoutinePeriod(req, res) {
    const periodId = req.params.periodId;

    try {
        const updated = await RoutinePeriod.findByIdAndUpdate(
            { _id: periodId, schoolId: req.user.schoolId },
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Routine period not found" });
        }

        res.status(200).json({ message: "Routine period updated successfully", routinePeriod: updated });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "Slot conflict: teacher or class is already booked at this day/time" });
        }
        res.status(500).json({ error: "Failed to update routine period", details: error.message });
    }
}

// DELETE /api/academics/delete-routine-period/:periodId
async function deleteRoutinePeriod(req, res) {
    const periodId = req.params.periodId;

    try {
        const deleted = await RoutinePeriod.findOneAndDelete({ _id: periodId, schoolId: req.user.schoolId });
        if (!deleted) {
            return res.status(404).json({ error: "Routine period not found" });
        }
        res.status(200).json({ message: "Routine period deleted successfully", routinePeriod: deleted });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete routine period", details: error.message });
    }
}

// GET /api/academics/my-routine?teacherId=  — a teacher's own weekly timetable.
// Teachers can only ever see their own periods (teacherId is forced from the
// token); admins may pass ?teacherId= to preview any teacher's schedule.
async function viewMyRoutine(req, res) {
    const schoolId = req.user.schoolId;

    let teacherId = req.query.teacherId;
    if (req.user.role === 'TEACHER') {
        teacherId = req.user.id; // ignore any passed teacherId — scope to self
    } else if (!teacherId) {
        return res.status(400).json({ error: "teacherId query parameter is required" });
    }

    try {
        const teacherUser = await userModel.findById(teacherId).select('firstName lastName').lean();
        const periods = await RoutinePeriod.find({ schoolId, teacherId })
            .populate('subjectId', 'name code')
            .populate('classId', 'name section')
            .sort({ startTime: 1 })
            .lean();

        const daysMap = new Map();
        for (const p of periods) {
            if (!daysMap.has(p.day)) daysMap.set(p.day, []);
            daysMap.get(p.day).push({
                periodId: p._id,
                day: p.day,
                academicYear: p.academicYear,
                subject: p.subjectId ? { subjectId: p.subjectId._id, name: p.subjectId.name, code: p.subjectId.code } : null,
                class: p.classId ? { classId: p.classId._id, name: p.classId.name, section: p.classId.section } : null,
                startTime: p.startTime,
                endTime: p.endTime
            });
        }

        const days = DAY_ORDER
            .filter(day => daysMap.has(day))
            .map(day => ({ day, periods: daysMap.get(day) }));

        res.status(200).json({
            message: "Teacher routine retrieved successfully",
            routine: {
                teacher: teacherUser ? { teacherId, name: `${teacherUser.firstName} ${teacherUser.lastName}` } : { teacherId },
                days
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve teacher routine", details: error.message });
    }
}

// GET /api/academics/view-class/:classId/routene  — full weekly timetable, grouped by day
async function viewClassRoutene(req, res) {
    const classId = req.params.classId;
    const schoolId = req.user.schoolId;

    try {
        const cls = await classModel.findOne({ _id: classId, schoolId });
        if (!cls) {
            return res.status(404).json({ error: "Class not found" });
        }

        const periods = await RoutinePeriod.find({ schoolId, classId })
            .populate('subjectId', 'name code')
            .populate('teacherId', 'firstName lastName')
            .sort({ startTime: 1 });

        // Group periods under each weekday, in calendar order
        const daysMap = new Map();
        for (const p of periods) {
            if (!daysMap.has(p.day)) daysMap.set(p.day, []);
            daysMap.get(p.day).push({
                periodId: p._id,
                day: p.day,
                academicYear: p.academicYear,
                subject: p.subjectId ? { subjectId: p.subjectId._id, name: p.subjectId.name, code: p.subjectId.code } : null,
                teacher: p.teacherId ? { teacherId: p.teacherId._id, name: `${p.teacherId.firstName} ${p.teacherId.lastName}` } : null,
                startTime: p.startTime,
                endTime: p.endTime
            });
        }

        const days = DAY_ORDER
            .filter(day => daysMap.has(day))
            .map(day => ({ day, periods: daysMap.get(day) }));

        res.status(200).json({
            message: "Class routine retrieved successfully",
            routine: { classId: cls._id, className: cls.name, section: cls.section, days }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve class routine", details: error.message });
    }
}







//controller functions for subjects addsubjects,view subjects,update subjects,delete subjects

async function addSubject(req, res) {
    // Implementation for adding a subject
    const { name, code} = req.body;
    const schoolId = req.user.schoolId;
    
    try {
        const newSubject = await subjectModel.create({
            schoolId,
            name,
            code
        });
        res.status(201).json({ 
            message: "Subject added successfully" ,
            subject: {
                subjectId: newSubject._id,
                name: newSubject.name,
                code: newSubject.code
            }
        });
    } catch (error) {
        res.status(500).json({ errorMessage: "Failed to add subject",
            error: error.message
         });
    }
}

async function viewSubjects(req, res) {
    // Implementation for viewing subjects
    const schoolId = req.user.schoolId;

    try {
        const subjects = await subjectModel.find({ schoolId });
        res.status(200).json({
            message: "Subjects retrieved successfully",
            subjects: subjects.map(sub => ({
                subjectId: sub._id,
                name: sub.name,
                code: sub.code
            }))
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve subjects" });
    }

}

async function updateSubject(req, res) {
    // Implementation for updating a subject
    const subjectId = req.params.subjectId;
    try {
        const updatedSubject = await subjectModel.findByIdAndUpdate(
            { _id: subjectId },
            { $set: req.body },
            { new: true }
        );

        if (!updatedSubject) {
            return res.status(404).json({ error: "Subject not found" });
        }

        res.status(200).json({
            message: "Subject updated successfully",
            subject: {
                subjectId: updatedSubject._id,
                name: updatedSubject.name,
                code: updatedSubject.code
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to update subject" });
    }
}

async function deleteSubject(req, res) {
    // Implementation for deleting a subject
    const subjectId = req.params.subjectId;
    
    try {
        const deletedSubject = await subjectModel.findByIdAndDelete(subjectId);
        if (!deletedSubject) {
            return res.status(404).json({ error: "Subject not found" });
        }
        res.status(200).json({ 
            message: "Subject deleted successfully",
            subject: {
                subjectId: deletedSubject._id,
                name: deletedSubject.name,
                code: deletedSubject.code
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete subject" });
    }
}   


// ---------- Class → Subject assignments (who teaches what in each class) -----
// These are the class+subject combos the exam grid offers and the notes room
// uses. Admin-only management; one subject per class.

// GET /api/academics/class-subject-assignments — every class with its assigned
// subjects (subject + teacher), so the admin can see the whole picture at once.
async function viewClassSubjectAssignments(req, res) {
    const schoolId = req.user.schoolId;

    try {
        const classes = await classModel.find({ schoolId }).sort({ name: 1, section: 1 });
        const assignments = await classSubjectTeacherModel
            .find({ classId: { $in: classes.map((c) => c._id) } })
            .populate("subjectId", "name code")
            .populate({
                path: "teacherId",
                populate: { path: "userId", select: "firstName lastName" },
            });

        const byClass = new Map(
            classes.map((c) => [
                c._id.toString(),
                {
                    classId: c._id,
                    name: c.name,
                    section: c.section,
                    academicYear: c.academicYear,
                    subjects: [],
                },
            ])
        );

        for (const a of assignments) {
            const entry = byClass.get(a.classId.toString());
            if (!entry || !a.subjectId) continue;
            const teacher = a.teacherId?.userId;
            entry.subjects.push({
                assignmentId: a._id,
                subjectId: a.subjectId._id,
                subjectName: a.subjectId.name,
                subjectCode: a.subjectId.code,
                teacherId: a.teacherId?._id || null,
                teacherName: teacher
                    ? `${teacher.firstName} ${teacher.lastName}`.trim()
                    : "Unknown",
            });
        }

        res.status(200).json({
            message: "Class-subject assignments retrieved successfully",
            classes: [...byClass.values()].map((c) => ({
                ...c,
                subjects: c.subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
            })),
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to retrieve class-subject assignments",
            details: error.message,
        });
    }
}

// POST /api/academics/class-subject-assignments — assign a subject (with its
// teacher) to a class. One subject per class; duplicates are rejected.
async function addClassSubjectAssignment(req, res) {
    const { classId, subjectId, teacherId } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !teacherId) {
        return res.status(400).json({ message: "classId, subjectId and teacherId are required" });
    }
    if (isInvalidId(classId) || isInvalidId(subjectId) || isInvalidId(teacherId)) {
        return res.status(400).json({ message: "Invalid class, subject or teacher" });
    }

    try {
        const cls = await classModel.findOne({ _id: classId, schoolId });
        if (!cls) {
            return res.status(400).json({ message: "Class not found in this school" });
        }

        const subject = await subjectModel.findOne({ _id: subjectId, schoolId });
        if (!subject) {
            return res.status(400).json({ message: "Subject not found in this school" });
        }

        const teacher = await teacherModel.findById(teacherId).populate("userId", "schoolId");
        if (!teacher || teacher.userId?.schoolId?.toString() !== schoolId) {
            return res.status(400).json({ message: "Teacher not found in this school" });
        }

        const assignment = await classSubjectTeacherModel.create({
            classId,
            subjectId,
            teacherId,
        });

        res.status(201).json({
            message: `${subject.name} assigned to ${cls.name}${cls.section ? ` ${cls.section}` : ""}`,
            assignment: {
                assignmentId: assignment._id,
                classId,
                subjectId,
                teacherId,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "This subject is already assigned to this class" });
        }
        res.status(500).json({ error: "Failed to assign subject", details: error.message });
    }
}

// POST /api/academics/class-subject-assignments/bulk — assign several subjects
// (each with its own teacher) to one class in a single request.
// Body: { classId, assignments: [{ subjectId, teacherId }, ...] }
// Every row is validated (class/subject/teacher belong to the school); rows
// that are already assigned (or repeated in the batch) are skipped, and the
// rest are written in one insertMany.
async function addClassSubjectAssignmentsBulk(req, res) {
    const { classId, assignments } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId) {
        return res.status(400).json({ message: "classId is required" });
    }
    if (isInvalidId(classId)) {
        return res.status(400).json({ message: "Invalid class" });
    }
    if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ message: "assignments must be a non-empty array" });
    }
    if (assignments.length > 100) {
        return res.status(400).json({ message: "Too many assignments (max 100)" });
    }

    try {
        const cls = await classModel.findOne({ _id: classId, schoolId });
        if (!cls) {
            return res.status(400).json({ message: "Class not found in this school" });
        }

        // Preload the school's subjects, in-school teachers and the class's
        // existing assignments so every row can be checked without N queries.
        const [schoolSubjects, schoolTeachers, existing] = await Promise.all([
            subjectModel.find({ schoolId }).select("_id"),
            teacherModel.find({}).populate("userId", "schoolId").select("_id"),
            classSubjectTeacherModel.find({ classId }).select("subjectId"),
        ]);
        const schoolSubjectIds = new Set(schoolSubjects.map((s) => s._id.toString()));
        const schoolTeacherIds = new Set(
            schoolTeachers
                .filter((t) => t.userId?.schoolId?.toString() === schoolId)
                .map((t) => t._id.toString())
        );
        const existingSubjectIds = new Set(existing.map((a) => a.subjectId.toString()));

        const seen = new Set();
        const docs = [];
        let skipped = 0;

        for (let i = 0; i < assignments.length; i++) {
            const row = assignments[i] || {};
            const rowNum = i + 1;
            const subjectId = row.subjectId;
            const teacherId = row.teacherId;

            if (!subjectId || !teacherId) {
                return res.status(400).json({ message: `Row ${rowNum}: subject and teacher are required` });
            }
            if (isInvalidId(subjectId) || isInvalidId(teacherId)) {
                return res.status(400).json({ message: `Row ${rowNum}: invalid subject or teacher` });
            }
            if (!schoolSubjectIds.has(subjectId.toString())) {
                return res.status(400).json({ message: `Row ${rowNum}: subject not found in this school` });
            }
            if (!schoolTeacherIds.has(teacherId.toString())) {
                return res.status(400).json({ message: `Row ${rowNum}: teacher not found in this school` });
            }

            // Rows already assigned to the class (or repeated in this batch)
            // are skipped rather than erroring the whole request.
            if (existingSubjectIds.has(subjectId.toString()) || seen.has(subjectId.toString())) {
                skipped++;
                continue;
            }
            seen.add(subjectId.toString());

            docs.push({ classId, subjectId, teacherId });
        }

        if (docs.length === 0) {
            return res.status(400).json({
                message: "These subjects are already assigned to this class",
                added: 0,
                skipped,
            });
        }

        // ordered:false writes every valid row and collects per-row failures
        // (e.g. a duplicate that appeared between our check and the write).
        let duplicateSkips = 0;
        try {
            await classSubjectTeacherModel.insertMany(docs, { ordered: false });
        } catch (insertErr) {
            // Duplicate-key rows surface as writeErrors; anything else is a
            // real failure and must not be reported as success.
            if (!insertErr.writeErrors) throw insertErr;
            duplicateSkips = insertErr.writeErrors.length;
        }

        const added = docs.length - duplicateSkips;
        const totalSkipped = skipped + duplicateSkips;

        res.status(201).json({
            message: `Assigned ${added} subject${added === 1 ? "" : "s"} to ${cls.name}${cls.section ? ` ${cls.section}` : ""}${totalSkipped ? ` (${totalSkipped} skipped as already assigned)` : ""}`,
            added,
            skipped: totalSkipped,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "One or more subjects are already assigned to this class" });
        }
        res.status(500).json({ error: "Failed to assign subjects", details: error.message });
    }
}

// DELETE /api/academics/class-subject-assignments/:assignmentId
async function deleteClassSubjectAssignment(req, res) {
    const assignmentId = req.params.assignmentId;
    const schoolId = req.user.schoolId;

    if (isInvalidId(assignmentId)) {
        return res.status(404).json({ error: "Assignment not found" });
    }

    try {
        // Scope to this school: only assignments on the school's own classes.
        const classIds = (await classModel.find({ schoolId }).select("_id")).map((c) => c._id);
        const deleted = await classSubjectTeacherModel.findOneAndDelete({
            _id: assignmentId,
            classId: { $in: classIds },
        });

        if (!deleted) {
            return res.status(404).json({ error: "Assignment not found" });
        }

        res.status(200).json({ message: "Assignment removed successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to remove assignment", details: error.message });
    }
}

export { addClass, viewAllClass,viewClass,updateClass, deleteClass ,viewClassRoutene, addSubject, viewSubjects, updateSubject, deleteSubject,
    addRoutinePeriod, viewRoutine, updateRoutinePeriod, deleteRoutinePeriod, viewMyRoutine,
    viewClassSubjectAssignments, addClassSubjectAssignment, addClassSubjectAssignmentsBulk, deleteClassSubjectAssignment};