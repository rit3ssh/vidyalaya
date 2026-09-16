// Controllers for the upcoming exam routine.
//
// Only the school admin can add/update/delete entries; every member of the
// school (students, parents, teachers, admin) can view the full grid.
// Entries are keyed by className (all sections of a class sit the same exam
// on the same day), so the routine is a grid of class names × dates, where
// each cell lists the subject(s) for that class on that day.

import mongoose from "mongoose";
import examModel from "../models/exam.model.js";
import classModel from "../models/class.model.js";
import subjectModel from "../models/subject.model.js";
import studentModel from "../models/student.model.js";
import classSubjectTeacherModel from "../models/classSubjectTeacher.model.js";

function isInvalidId(id) {
    return !mongoose.isValidObjectId(id);
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

// yyyy-mm-dd key of a Date, used for in-batch duplicate detection.
function dateKey(date) {
    return date.toISOString().slice(0, 10);
}

// Shared fetch for the bulk-add flow: every class plus every class→subject
// assignment (any section). Both getClassSubjects and addExamsBulk build
// their class→subjects maps from this.
async function loadClassesAndAssignments(schoolId) {
    const classes = await classModel.find({ schoolId }).sort({ name: 1 });
    const classIds = classes.map((c) => c._id);
    const assignments = await classSubjectTeacherModel
        .find({ classId: { $in: classIds } })
        .populate("subjectId", "name code")
        .populate("classId", "name");
    return { classes, assignments };
}

// The subject ids assigned to a class name (across all its sections). Empty
// when the class has no assignments.
async function getClassAssignedSubjectIds(schoolId, className) {
    const classDocs = await classModel.find({ schoolId, name: className }).select("_id");
    if (classDocs.length === 0) return [];
    return classSubjectTeacherModel.distinct("subjectId", {
        classId: { $in: classDocs.map((c) => c._id) },
    });
}

// Shared rule used by the single and bulk add/edit paths: a class may only be
// scheduled with subjects actually assigned to it. Returns null when allowed,
// else an error message.
async function classSubjectError(schoolId, className, subjectId) {
    const assigned = await getClassAssignedSubjectIds(schoolId, className);
    if (assigned.length === 0) {
        return `"${className}" has no subjects assigned yet`;
    }
    if (!assigned.some((id) => id.toString() === String(subjectId))) {
        return `"${className}" does not offer this subject`;
    }
    return null;
}

// Times are stored as 24-hour "HH:mm" strings (same convention as routine
// periods).
const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(value) {
    return typeof value === "string" && TIME_FORMAT.test(value);
}

// POST /api/exams — add an exam entry (SCHOOL_ADMIN only)
async function addExam(req, res) {
    const { className, date, subjectId, startTime, endTime } = req.body;
    const schoolId = req.user.schoolId;

    const trimmedName = className ? String(className).trim() : "";
    if (!trimmedName || !date || !subjectId || !startTime || !endTime) {
        return res.status(400).json({
            message: "className, date, subjectId, startTime and endTime are required",
        });
    }
    if (isInvalidId(subjectId)) {
        return res.status(400).json({ message: "Invalid subject" });
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
        return res.status(400).json({ message: "startTime and endTime must be in HH:mm format" });
    }
    if (endTime <= startTime) {
        return res.status(400).json({ message: "endTime must be after startTime" });
    }

    const parsedDate = parseDate(date);
    if (!parsedDate) {
        return res.status(400).json({ message: "date must be a valid date" });
    }

    try {
        // Guard against phantom rows: the class name and subject must actually
        // exist in this school.
        const classExists = await classModel.exists({ schoolId, name: trimmedName });
        if (!classExists) {
            return res
                .status(400)
                .json({ message: `No class named "${trimmedName}" exists in this school` });
        }
        const subjectExists = await subjectModel.exists({ schoolId, _id: subjectId });
        if (!subjectExists) {
            return res.status(400).json({ message: "Subject not found in this school" });
        }

        // Same rule as the bulk path: a class may only be scheduled with its
        // own subjects.
        const subjectError = await classSubjectError(schoolId, trimmedName, subjectId);
        if (subjectError) {
            return res.status(400).json({ message: subjectError });
        }

        // One exam per class per day.
        const alreadyScheduled = await examModel.exists({
            schoolId,
            className: trimmedName,
            date: parsedDate,
        });
        if (alreadyScheduled) {
            return res.status(409).json({
                message: "An exam is already scheduled for this class on that date",
            });
        }

        const exam = await examModel.create({
            schoolId,
            className: trimmedName,
            date: parsedDate,
            subjectId,
            startTime,
            endTime,
            createdBy: req.user.id,
        });

        const populated = await examModel.findById(exam._id).populate("subjectId", "name code");

        res.status(201).json({
            message: "Exam added successfully",
            exam: formatExam(populated),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "An exam is already scheduled for this class on that date",
            });
        }
        res.status(500).json({ error: "Failed to add exam", details: error.message });
    }
}

// GET /api/exams/class-subjects — every class name with the subjects to offer
// in the bulk add-exams grid. Classes with assignments (via ClassSubjectTeacher,
// unioned across sections) list only those subjects; classes without any
// assignments fall back to the school's full subject list so the admin is never
// blocked (hasAssignedSubjects lets the UI explain the difference).
async function getClassSubjects(req, res) {
    const schoolId = req.user.schoolId;

    try {
        const { classes, assignments } = await loadClassesAndAssignments(schoolId);

        // className → map of subjectId → { subjectId, name, code } (deduped)
        const byName = new Map();
        for (const a of assignments) {
            const name = a.classId?.name;
            if (!name || !a.subjectId) continue;
            if (!byName.has(name)) byName.set(name, new Map());
            byName.get(name).set(a.subjectId._id.toString(), {
                subjectId: a.subjectId._id,
                name: a.subjectId.name,
                code: a.subjectId.code,
            });
        }

        // Only the subjects each class actually teaches — no school-wide
        // fallback, so the dropdown is always class-respective.
        const classesWithSubjects = [...new Set(classes.map((c) => c.name))]
            .sort()
            .map((name) => ({
                className: name,
                subjects: byName.has(name)
                    ? [...byName.get(name).values()].sort((a, b) => a.name.localeCompare(b.name))
                    : [],
            }));

        res.status(200).json({
            message: "Classes and their subjects retrieved successfully",
            classes: classesWithSubjects,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve classes and subjects", details: error.message });
    }
}

// POST /api/exams/bulk — add several exam entries in one go (SCHOOL_ADMIN only).
// Body: { entries: [{ className, date, subjectId, startTime, endTime }, ...] }
// Every row is validated (class exists, subject offered by that class, valid
// date, sane time range, no duplicates) before anything is written.
async function addExamsBulk(req, res) {
    const { entries } = req.body;
    const schoolId = req.user.schoolId;

    if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "entries must be a non-empty array" });
    }
    if (entries.length > 100) {
        return res.status(400).json({ message: "Too many entries (max 100)" });
    }

    try {
        // Preload: classes and every class→subject assignment (any section).
        const { classes, assignments } = await loadClassesAndAssignments(schoolId);

        // All class names that exist and the subjects each one actually offers
        // (empty for classes without assignments).
        const classesByName = new Set(classes.map((c) => c.name));
        const classSubjects = new Map();
        for (const a of assignments) {
            const name = a.classId?.name;
            if (!name || !a.subjectId) continue;
            if (!classSubjects.has(name)) classSubjects.set(name, new Set());
            classSubjects.get(name).add(a.subjectId._id.toString());
        }

        // One exam per class per day: pre-load existing combos to reject
        // conflicts before writing anything.
        const existingComboKeys = new Set(
            (await examModel.find({ schoolId }).select("className date")).map(
                (e) => `${e.className}|${dateKey(e.date)}`
            )
        );

        const seen = new Set();
        const docs = [];

        for (let i = 0; i < entries.length; i++) {
            const row = entries[i] || {};
            const rowNum = i + 1;
            const className = String(row.className || "").trim();
            const subjectId = row.subjectId;
            const startTime = row.startTime;
            const endTime = row.endTime;

            if (!className || !row.date || !subjectId || !startTime || !endTime) {
                return res.status(400).json({ message: `Row ${rowNum}: class, date, subject and times are required` });
            }
            if (!classesByName.has(className)) {
                return res.status(400).json({ message: `Row ${rowNum}: no class named "${className}" exists in this school` });
            }
            if (!isValidTime(startTime) || !isValidTime(endTime)) {
                return res.status(400).json({ message: `Row ${rowNum}: times must be in HH:mm format` });
            }
            if (endTime <= startTime) {
                return res.status(400).json({ message: `Row ${rowNum}: endTime must be after startTime` });
            }
            if (isInvalidId(subjectId)) {
                return res.status(400).json({ message: `Row ${rowNum}: invalid subject` });
            }
            if (!classSubjects.has(className)) {
                return res.status(400).json({ message: `Row ${rowNum}: "${className}" has no subjects assigned yet` });
            }
            if (!classSubjects.get(className).has(subjectId.toString())) {
                return res.status(400).json({ message: `Row ${rowNum}: "${className}" does not offer this subject` });
            }

            const parsedDate = parseDate(row.date);
            if (!parsedDate) {
                return res.status(400).json({ message: `Row ${rowNum}: date must be a valid date` });
            }

            // One exam per class per day — reject duplicates within the batch
            // and against entries that already exist.
            const key = `${className}|${dateKey(parsedDate)}`;
            if (existingComboKeys.has(key) || seen.has(key)) {
                return res.status(400).json({
                    message: `Row ${rowNum}: an exam is already scheduled for this class on that date`,
                });
            }
            seen.add(key);

            docs.push({
                schoolId,
                className,
                date: parsedDate,
                subjectId,
                startTime,
                endTime,
                createdBy: req.user.id,
            });
        }

        // ordered:false writes every valid row and collects per-row failures
        // (e.g. a duplicate that already exists in the database).
        let skipped = 0;
        try {
            await examModel.insertMany(docs, { ordered: false });
        } catch (insertErr) {
            // Duplicate-key rows surface as writeErrors; anything else is a
            // real failure and must not be reported as success.
            if (!insertErr.writeErrors) throw insertErr;
            skipped = insertErr.writeErrors.length;
        }

        res.status(201).json({
            message: `Added ${docs.length - skipped} exam${docs.length - skipped === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped as already scheduled)` : ""}`,
            added: docs.length - skipped,
            skipped,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to add exams", details: error.message });
    }
}

// GET /api/exams — the school's full exam routine, by date then class.
// For students, also returns myClassName so the frontend can highlight the
// row of the viewer's own class on the grid.
async function getExams(req, res) {
    const schoolId = req.user.schoolId;
    let myClassName = null;

    try {
        if (req.user.role === "STUDENT") {
            const student = await studentModel.findOne({ userId: req.user.id });
            if (student) {
                const cls = await classModel.findById(student.classId).select("name");
                myClassName = cls?.name || null;
            }
        }

        const exams = await examModel
            .find({ schoolId })
            .populate("subjectId", "name code")
            .sort({ date: 1, className: 1 });

        res.status(200).json({
            message: "Exam routine retrieved successfully",
            count: exams.length,
            exams: exams.map(formatExam),
            myClassName,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve exam routine" });
    }
}

// PUT /api/exams/:examId — edit an entry (SCHOOL_ADMIN only)
async function updateExam(req, res) {
    const { examId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(examId)) {
        return res.status(404).json({ error: "Exam entry not found" });
    }

    const updates = {};

    if (req.body.className !== undefined) {
        const trimmedName = String(req.body.className).trim();
        if (!trimmedName) {
            return res.status(400).json({ message: "className cannot be empty" });
        }
        updates.className = trimmedName;
    }

    if (req.body.date !== undefined) {
        const parsedDate = parseDate(req.body.date);
        if (!parsedDate) {
            return res.status(400).json({ message: "date must be a valid date" });
        }
        updates.date = parsedDate;
    }

    if (req.body.subjectId !== undefined) {
        if (isInvalidId(req.body.subjectId)) {
            return res.status(400).json({ message: "Invalid subject" });
        }
        updates.subjectId = req.body.subjectId;
    }

    for (const field of ["startTime", "endTime"]) {
        if (req.body[field] !== undefined) {
            if (!isValidTime(req.body[field])) {
                return res.status(400).json({ message: `${field} must be in HH:mm format` });
            }
            updates[field] = req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No fields provided to update" });
    }    try {
        // Same integrity guards as addExam: the changed class/subject must
        // actually belong to this school.
        if (updates.className) {
            const classExists = await classModel.exists({ schoolId, name: updates.className });
            if (!classExists) {
                return res.status(400).json({
                    message: `No class named "${updates.className}" exists in this school`,
                });
            }
        }
        if (updates.subjectId) {
            const subjectExists = await subjectModel.exists({ schoolId, _id: updates.subjectId });
            if (!subjectExists) {
                return res.status(400).json({ message: "Subject not found in this school" });
            }
        }

        const existing = await examModel.findOne({ _id: examId, schoolId });
        if (!existing) {
            return res.status(404).json({ error: "Exam entry not found" });
        }

        // Validate the time range against the merged values, so a partial
        // update (only startTime or only endTime) can't store an inverted range.
        const nextStart = updates.startTime ?? existing.startTime;
        const nextEnd = updates.endTime ?? existing.endTime;
        if ((updates.startTime || updates.endTime) && nextEnd <= nextStart) {
            return res.status(400).json({ message: "endTime must be after startTime" });
        }

        // Same rule as creation: the effective class may only use its own
        // subjects.
        if (updates.className || updates.subjectId) {
            const nextClassName = updates.className ?? existing.className;
            const nextSubjectId = updates.subjectId ?? existing.subjectId;
            const subjectError = await classSubjectError(schoolId, nextClassName, nextSubjectId);
            if (subjectError) {
                return res.status(400).json({ message: subjectError });
            }
        }

        // One exam per class per day — a move to a different class/date must
        // not collide with another entry.
        if (updates.className || updates.date) {
            const nextClassName = updates.className ?? existing.className;
            const nextDate = updates.date ?? existing.date;
            const conflict = await examModel.exists({
                _id: { $ne: examId },
                schoolId,
                className: nextClassName,
                date: nextDate,
            });
            if (conflict) {
                return res.status(409).json({
                    message: "An exam is already scheduled for this class on that date",
                });
            }
        }

        const updated = await examModel
            .findOneAndUpdate({ _id: examId, schoolId }, { $set: updates }, { new: true, runValidators: true })
            .populate("subjectId", "name code");

        res.status(200).json({
            message: "Exam updated successfully",
            exam: formatExam(updated),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "An exam is already scheduled for this class on that date",
            });
        }
        res.status(500).json({ error: "Failed to update exam", details: error.message });
    }
}

// DELETE /api/exams/:examId — remove an entry (SCHOOL_ADMIN only)
async function deleteExam(req, res) {
    const { examId } = req.params;
    const schoolId = req.user.schoolId;

    if (isInvalidId(examId)) {
        return res.status(404).json({ error: "Exam entry not found" });
    }

    try {
        const deleted = await examModel.findOneAndDelete({ _id: examId, schoolId });

        if (!deleted) {
            return res.status(404).json({ error: "Exam entry not found" });
        }

        res.status(200).json({
            message: "Exam deleted successfully",
            exam: formatExam(deleted),
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete exam" });
    }
}

function formatExam(exam) {
    return {
        examId: exam._id,
        className: exam.className,
        date: exam.date,
        subjectId: exam.subjectId?._id || exam.subjectId,
        subjectName: exam.subjectId?.name,
        subjectCode: exam.subjectId?.code,
        startTime: exam.startTime || null,
        endTime: exam.endTime || null,
    };
}

export { addExam, getExams, getClassSubjects, addExamsBulk, updateExam, deleteExam };
