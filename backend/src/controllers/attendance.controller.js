import ExcelJS from "exceljs";
import Attendance from "../models/attendance.model.js";
import Student from "../models/student.model.js";
import Subject from "../models/subject.model.js";
import Class from "../models/class.model.js";
import School from "../models/school.model.js";
import RoutinePeriod from "../models/routenePeriod.model.js";
import teacherModel from "../models/teacher.model.js";
import classSubjectTeacherModel from "../models/classSubjectTeacher.model.js";

// Teachers may only access attendance for the classes (and subjects) they are
// assigned to via ClassSubjectTeacher (which stores the Teacher profile id).
// Admins pass through unrestricted. Returns true when access is allowed; when
// false, a 403 response has already been sent.
async function assertTeacherScopedAccess(req, res, { classId, subjectId }) {
  if (req.user.role !== "TEACHER") return true;

  const teacher = await teacherModel.findOne({ userId: req.user.id });
  if (!teacher) {
    res.status(403).json({ message: "Teacher profile not found" });
    return false;
  }

  const query = { teacherId: teacher._id, classId };
  if (subjectId) query.subjectId = subjectId;

  const allowed = await classSubjectTeacherModel.exists(query);
  if (!allowed) {
    res.status(403).json({
      message: "You can only access attendance for the classes and subjects assigned to you",
    });
    return false;
  }
  return true;
}

const pad = (n) => String(n).padStart(2, '0');
const ALL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
// Worst status wins when a student has multiple sheets on the same date.
const SEVERITY = { PRESENT: 1, LATE: 2, LEAVE: 3, ABSENT: 4 };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * 1. GET /api/attendance?classId=X&subjectId=Y&date=2026-07-31&timeSlot=Period1
 * Fetches existing attendance sheet OR generates an active template containing all active class students.
 */
async function getAttendanceSheet(req, res) {
  console.log("Fetching attendance sheet with query params:", req.query);
  try {
    const { classId, subjectId, date, timeSlot } = req.query;

    if (!classId || !subjectId || !date) {
      return res.status(400).json({ message: "Missing required query parameters." });
    }
    if (!(await assertTeacherScopedAccess(req, res, { classId, subjectId }))) return;

    // A. Check if sheet already exists
    let sheet = await Attendance.findOne({
      classId,
      subjectId,
      date,
      timeSlot: timeSlot || ""
    }).populate({
      path: 'records.studentProfileId',
      populate: { path: 'userId', select: 'firstName lastName' }
    });

    if (sheet) {
      return res.status(200).json({ isNewSheet: false, data: sheet });
    }

    // B. If sheet doesn't exist yet, get all active students in this class to generate an on-the-fly sheet
    const studentsInClass = await Student.find({ classId })
      .populate('userId', 'firstName lastName');

    // C. Format them into a default clean status matrix
    const temporaryRecords = studentsInClass.map(student => ({
      studentProfileId: student._id,
      status: 'ABSENT', // Or default to 'PRESENT' based on policy preference
      studentDetails: {
        firstName: student.userId?.firstName,
        lastName: student.userId?.lastName,
        rollNumber: student.rollNumber
      }
    }));

    return res.status(200).json({
      isNewSheet: true,
      data: {
        classId,
        subjectId,
        date,
        timeSlot: timeSlot || "",
        records: temporaryRecords
      }
    });

  } catch (error) {
    return res.status(500).json({ message: "Failed to load sheet", error: error.message });
  }
}

/**
 * 2. POST /api/attendance/save
 * Handles bulk changes (Marking and Unmarking status values completely).
 */
async function saveAttendanceSheet(req, res) {
  try {
    const { classId, subjectId, date, timeSlot, records } = req.body;
    const teacherId = req.user._id; // Extracted from auth middleware
    const schoolId = req.user.schoolId;

    console.log("Saving attendance sheet with payload:", req.body);
    if (!classId || !subjectId || !date || !Array.isArray(records)) {
      return res.status(400).json({ message: "Invalid payload details." });
    }
    if (!(await assertTeacherScopedAccess(req, res, { classId, subjectId }))) return;

    // Format the payload collection explicitly to filter unneeded UI mutations
    const formattedRecords = records.map(r => ({
      studentProfileId: r.studentProfileId,
      status: r.status,
      remarks: r.remarks || ""
    }));

    // Find existing document or create a new instance container automatically
    const updatedSheet = await Attendance.findOneAndUpdate(
      { classId, subjectId, date, timeSlot: timeSlot || "" },
      {
        schoolId,
        classId,
        subjectId,
        date,
        timeSlot: timeSlot || "",
        teacherId,
        records: formattedRecords
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({ 
      message: "Attendance records registered cleanly.", 
      data: updatedSheet 
    });

  } catch (error) {
    return res.status(500).json({ message: "Failed to register logs", error: error.message });
  }
}

/**
 * Shared pivot: builds the students × dates matrix for one class+subject+month.
 * Used by subjectAttendanceSummary (JSON API) and exportAnnualAttendance (Excel).
 * Returns { dates, studentRows, scheduledDates, unmarkedSheets }.
 * Cells are PRESENT/ABSENT/LATE/LEAVE when marked, NO_CLASS when the routine
 * has no period that day, or UNMARKED when class was scheduled but no sheet.
 */
async function buildMonthlyMatrix({ schoolId, classId, subjectId, year, month, scheduledWeekdays }) {
  const m = Number(month);
  const y = Number(year);
  const startDate = `${y}-${pad(m)}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const endDate = `${y}-${pad(m)}-${pad(daysInMonth)}`;

  // Weekdays the subject actually runs for this class (fallback: all weekdays
  // if the timetable isn't built yet, so the view still works).
  // Callers building many months at once can hoist this query and pass it in.
  if (!scheduledWeekdays) {
    const routinePeriods = await RoutinePeriod.find({ schoolId, classId, subjectId }).select('day').lean();
    scheduledWeekdays = routinePeriods.length
      ? new Set(routinePeriods.map(p => p.day))
      : new Set(ALL_WEEKDAYS);
  }

  const sheets = await Attendance.find({ schoolId, classId, subjectId, date: { $gte: startDate, $lte: endDate } })
    .select('date records')
    .lean();

  const students = await Student.find({ classId })
    .populate('userId', 'firstName lastName')
    .sort({ rollNumber: 1 })
    .lean();

  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${pad(m)}-${pad(d)}`;
    const dayName = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
    dates.push({ date: dateStr, day: dayName, scheduled: scheduledWeekdays.has(dayName) });
  }

  const studentRows = students.map(s => ({
    studentId: s._id,
    rollNumber: s.rollNumber,
    name: `${s.userId?.firstName || ''} ${s.userId?.lastName || ''}`.trim(),
    days: {},          // { "YYYY-MM-DD": status | "NO_CLASS" | "UNMARKED" }
    present: 0, late: 0, absent: 0, leave: 0
  }));
  const rowByStudent = new Map(studentRows.map(r => [String(r.studentId), r]));

  // A subject can have MULTIPLE sheets on one date (e.g. Math P1 + P4), so
  // collapse per (student, date) with "worst status wins": ABSENT > LEAVE > LATE > PRESENT.
  const dayStatusByStudent = new Map(); // studentId -> Map<date, status>
  for (const sheet of sheets) {
    for (const rec of sheet.records) {
      const key = String(rec.studentProfileId);
      if (!rowByStudent.has(key)) continue; // record belongs to a student who left the class
      if (!dayStatusByStudent.has(key)) dayStatusByStudent.set(key, new Map());
      const perDay = dayStatusByStudent.get(key);
      const existing = perDay.get(sheet.date);
      if (!existing || SEVERITY[rec.status] > SEVERITY[existing]) {
        perDay.set(sheet.date, rec.status);
      }
    }
  }

  for (const row of studentRows) {
    const perDay = dayStatusByStudent.get(String(row.studentId)) || new Map();
    for (const [date, status] of perDay) {
      row.days[date] = status;
      if (status === 'PRESENT') row.present++;
      else if (status === 'LATE') row.late++;
      else if (status === 'ABSENT') row.absent++;
      else if (status === 'LEAVE') row.leave++;
    }
  }

  const scheduledDates = dates.filter(d => d.scheduled).map(d => d.date);
  for (const row of studentRows) {
    for (const d of dates) {
      if (row.days[d.date] === undefined) {
        row.days[d.date] = d.scheduled ? 'UNMARKED' : 'NO_CLASS';
      }
    }
    row.scheduledDays = scheduledDates.length;
    row.percentage = scheduledDates.length > 0
      ? Math.round(((row.present + row.late) / scheduledDates.length) * 100)
      : null;
  }

  return {
    dates,
    studentRows,
    scheduledDates,
    unmarkedSheets: scheduledDates.filter(date => !sheets.some(s => s.date === date))
  };
}

/**
 * 3. GET /api/attendance/subject-summary?classId=X&subjectId=Y&month=8&year=2026
 * The classic subject-wise monthly register (JSON).
 */
async function subjectAttendanceSummary(req, res) {
  try {
    const { classId, subjectId, month, year } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !month || !year) {
      return res.status(400).json({ message: "classId, subjectId, month and year are required query parameters." });
    }
    if (!(await assertTeacherScopedAccess(req, res, { classId, subjectId }))) return;
    const m = Number(month);
    const y = Number(year);
    if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000 || y > 2100) {
      return res.status(400).json({ message: "month must be 1-12 and year must be a valid 4-digit year." });
    }

    const matrix = await buildMonthlyMatrix({ schoolId, classId, subjectId, year: y, month: m });
    const percentages = matrix.studentRows.map(r => r.percentage).filter(p => p !== null);
    const subject = await Subject.findOne({ _id: subjectId, schoolId }).select('name code').lean();
    const cls = await Class.findOne({ _id: classId, schoolId }).select('name section').lean();

    res.status(200).json({
      message: "Subject attendance summary retrieved successfully",
      summary: {
        class: cls ? { classId: cls._id, name: cls.name, section: cls.section } : { classId },
        subject: subject ? { subjectId: subject._id, name: subject.name, code: subject.code } : { subjectId },
        month: m,
        year: y,
        dates: matrix.dates,
        students: matrix.studentRows,
        classStats: {
          totalStudents: matrix.studentRows.length,
          averagePercentage: percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null,
          unmarkedSheets: matrix.unmarkedSheets.length,
          unmarkedDates: matrix.unmarkedSheets
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to build subject summary", error: error.message });
  }
}


/**
 * 4. GET /api/attendance/register?classId=X&date=2026-08-10
 * The daily register (whole day at a glance):
 *   rows = students, columns = periods of that day pulled from the ROUTINE,
 *   cells = the student's status for the period's attendance sheet.
 * Attendance sheets are matched to routine periods by subject (a subject's
 * sheets are assigned to its periods in chronological order). A period with
 * no sheet is returned as marked:false so the UI can flag it "UNMARKED".
 */
async function dailyRegister(req, res) {
  try {
    const { classId, date } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "classId and a valid YYYY-MM-DD date are required query parameters." });
    }
    if (!(await assertTeacherScopedAccess(req, res, { classId }))) return;

    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date value provided." });
    }
    const dayName = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const cls = await Class.findOne({ _id: classId, schoolId }).select('name section').lean();

    // 1. The routine decides what periods SHOULD happen today
    const periods = await RoutinePeriod.find({ schoolId, classId, day: dayName })
      .populate('subjectId', 'name code')
      .populate('teacherId', 'firstName lastName')
      .sort({ startTime: 1 })
      .lean();

    if (periods.length === 0) {
      return res.status(200).json({
        message: "No classes scheduled for this day",
        register: {
          class: cls ? { classId: cls._id, name: cls.name, section: cls.section } : { classId },
          date,
          day: dayName,
          periods: [],
          students: [],
          stats: { totalPeriods: 0, markedPeriods: 0, unmarkedPeriods: 0, totalStudents: 0 }
        }
      });
    }

    // 2. The attendance sheets fill in the cells
    const sheets = await Attendance.find({ schoolId, classId, date }).sort({ timeSlot: 1 }).lean();

    const sheetsBySubject = new Map(); // subjectId -> sheets (already sorted by timeSlot)
    for (const sheet of sheets) {
      const key = String(sheet.subjectId);
      if (!sheetsBySubject.has(key)) sheetsBySubject.set(key, []);
      sheetsBySubject.get(key).push(sheet);
    }

    // Match sheets to periods in two phases:
    //  1. Exact timeSlot label match (the marking UI sends "PeriodN", and a
    //     period's periodNumber is its 1-based slot in the day) — this keeps
    //     multi-period subjects (Math P1 + P4) attributed correctly.
    //  2. Positional fallback for legacy sheets with no/unlabeled timeSlot.
    const isPeriodLabel = (slot) => typeof slot === 'string' && /^Period\d+$/.test(slot);
    const assigned = new Array(periods.length).fill(null);
    const usedSheetIds = new Set();

    for (let i = 0; i < periods.length; i++) {
      const key = String(periods[i].subjectId?._id || periods[i].subjectId);
      const subjectSheets = sheetsBySubject.get(key) || [];
      const expectedSlot = `Period${i + 1}`;
      const sheet = subjectSheets.find(s => s.timeSlot === expectedSlot && !usedSheetIds.has(String(s._id)));
      if (sheet) { assigned[i] = sheet; usedSheetIds.add(String(sheet._id)); }
    }
    for (let i = 0; i < periods.length; i++) {
      if (assigned[i]) continue;
      const key = String(periods[i].subjectId?._id || periods[i].subjectId);
      const subjectSheets = sheetsBySubject.get(key) || [];
      const sheet = subjectSheets.find(s => !usedSheetIds.has(String(s._id)) && !isPeriodLabel(s.timeSlot));
      if (sheet) { assigned[i] = sheet; usedSheetIds.add(String(sheet._id)); }
    }

    const periodSheets = new Map(); // periodId -> sheet | null
    const registerPeriods = periods.map((p, idx) => {
      const sheet = assigned[idx] || null;
      periodSheets.set(String(p._id), sheet);

      return {
        periodId: p._id,
        periodNumber: idx + 1,
        subject: p.subjectId ? { subjectId: p.subjectId._id, name: p.subjectId.name, code: p.subjectId.code } : null,
        teacher: p.teacherId ? { teacherId: p.teacherId._id, name: `${p.teacherId.firstName} ${p.teacherId.lastName}` } : null,
        startTime: p.startTime,
        endTime: p.endTime,
        marked: !!sheet,
        sheetId: sheet ? sheet._id : null
      };
    });

    // 3. Students -> rows with a status cell per period
    const students = await Student.find({ classId })
      .populate('userId', 'firstName lastName')
      .sort({ rollNumber: 1 })
      .lean();

    const studentRows = students.map((s) => {
      const cells = {};
      for (const rp of registerPeriods) {
        const sheet = periodSheets.get(String(rp.periodId));
        if (!sheet) { cells[rp.periodId] = null; continue; }
        const rec = sheet.records.find(r => String(r.studentProfileId) === String(s._id));
        cells[rp.periodId] = rec ? rec.status : null; // null = not on that sheet (e.g. joined later)
      }
      return {
        studentId: s._id,
        rollNumber: s.rollNumber,
        name: `${s.userId?.firstName || ''} ${s.userId?.lastName || ''}`.trim(),
        cells
      };
    });

    const markedPeriods = registerPeriods.filter(p => p.marked).length;

    res.status(200).json({
      message: "Daily register retrieved successfully",
      register: {
        class: cls ? { classId: cls._id, name: cls.name, section: cls.section } : { classId },
        date,
        day: dayName,
        periods: registerPeriods,
        students: studentRows,
        stats: {
          totalPeriods: registerPeriods.length,
          markedPeriods,
          unmarkedPeriods: registerPeriods.length - markedPeriods,
          totalStudents: studentRows.length
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to build daily register", error: error.message });
  }
}


/* ─────────────────────────── Excel export helpers ─────────────────────────── */

const THIN_BORDER = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
};

// Matches the UI color coding: P green, A red, L amber, E blue.
const STATUS_CELL = {
  PRESENT: { value: 'P', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }, font: { color: { argb: 'FF006100' }, bold: true } },
  ABSENT:  { value: 'A', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } },
  LATE:    { value: 'L', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } }, font: { color: { argb: 'FF9C6500' }, bold: true } },
  LEAVE:   { value: 'E', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } }, font: { color: { argb: 'FF1F4E79' }, bold: true } },
  NO_CLASS: { value: '', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }, font: { color: { argb: 'FFBFBFBF' } } },
  UNMARKED: { value: '', fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } }, font: { color: { argb: 'FFC55A11' } } }
};

const pctFill = (pct) => {
  if (pct === null || pct === undefined) return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  if (pct >= 75) return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
  if (pct >= 60) return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
};

const styleHeaderCell = (cell, value, wrap = false) => {
  cell.value = value;
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: wrap };
  cell.font = { bold: true, color: { argb: 'FF1F4E79' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
  cell.border = THIN_BORDER;
};

const writePercentCell = (cell, pct, { bold = false } = {}) => {
  cell.value = pct === null || pct === undefined ? '–' : pct / 100;
  if (pct !== null && pct !== undefined) cell.numFmt = '0%';
  cell.fill = pctFill(pct);
  cell.font = { bold };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = THIN_BORDER;
};

/** One monthly register worksheet: title + legend + student×days grid. */
function buildMonthlyWorksheet(ws, { title, matrix, month }) {
  const { dates, studentRows } = matrix;
  const daysInMonth = dates.length;
  const lastCol = 2 + daysInMonth + 5; // Roll, Name, days, P, L, A, E, %

  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF1F4E79' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  const legendCell = ws.getCell(2, 1);
  legendCell.value = 'P = Present   A = Absent   L = Late   E = Leave   (light cells = no class / not marked)';
  legendCell.font = { italic: true, size: 9, color: { argb: 'FF7F7F7F' } };
  legendCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(2).height = 16;

  styleHeaderCell(ws.getCell(3, 1), 'Roll No.');
  styleHeaderCell(ws.getCell(3, 2), 'Student Name');
  dates.forEach((d, i) => {
    styleHeaderCell(ws.getCell(3, 3 + i), `${Number(d.date.slice(-2))}\n${d.day.slice(0, 3)}`, true);
  });
  styleHeaderCell(ws.getCell(3, 3 + daysInMonth), 'P');
  styleHeaderCell(ws.getCell(3, 4 + daysInMonth), 'L');
  styleHeaderCell(ws.getCell(3, 5 + daysInMonth), 'A');
  styleHeaderCell(ws.getCell(3, 6 + daysInMonth), 'E');
  styleHeaderCell(ws.getCell(3, 7 + daysInMonth), '%');
  ws.getRow(3).height = 26;

  let r = 4;
  for (const student of studentRows) {
    const rollCell = ws.getCell(r, 1);
    rollCell.value = student.rollNumber;
    rollCell.alignment = { horizontal: 'center', vertical: 'middle' };
    rollCell.border = THIN_BORDER;

    const nameCell = ws.getCell(r, 2);
    nameCell.value = student.name;
    nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
    nameCell.border = THIN_BORDER;

    dates.forEach((d, i) => {
      const cell = ws.getCell(r, 3 + i);
      const style = STATUS_CELL[student.days[d.date]] || STATUS_CELL.NO_CLASS;
      cell.value = style.value;
      cell.fill = style.fill;
      cell.font = style.font;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    });

    const counts = [student.present, student.late, student.absent, student.leave];
    counts.forEach((v, i) => {
      const cell = ws.getCell(r, 3 + daysInMonth + i);
      cell.value = v;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    });

    writePercentCell(ws.getCell(r, 7 + daysInMonth), student.percentage);
    r++;
  }

  // Class average row
  const avgPcts = studentRows.map(s => s.percentage).filter(p => p !== null && p !== undefined);
  const avg = avgPcts.length ? Math.round(avgPcts.reduce((a, b) => a + b, 0) / avgPcts.length) : null;
  ws.mergeCells(r, 2, r, 6 + daysInMonth);
  const avgLabel = ws.getCell(r, 2);
  avgLabel.value = `Class Average (${month})`;
  avgLabel.font = { bold: true };
  avgLabel.alignment = { horizontal: 'right', vertical: 'middle' };
  avgLabel.border = THIN_BORDER;
  writePercentCell(ws.getCell(r, 7 + daysInMonth), avg, { bold: true });

  ws.getColumn(1).width = 9;
  ws.getColumn(2).width = 30;
  for (let i = 3; i < 3 + daysInMonth; i++) ws.getColumn(i).width = 4.5;
  ws.getColumn(3 + daysInMonth).width = 5;
  ws.getColumn(4 + daysInMonth).width = 5;
  ws.getColumn(5 + daysInMonth).width = 5;
  ws.getColumn(6 + daysInMonth).width = 5;
  ws.getColumn(7 + daysInMonth).width = 7;
}

/** Yearly summary worksheet: student × month percentages + year %. */
function buildSummaryWorksheet(ws, { title, monthMatrices }) {
  const lastCol = 15; // Roll, Name, 12 months, Year %
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF1F4E79' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, lastCol);
  ws.getCell(2, 1).value = 'Monthly attendance percentage per student. Color: green ≥ 75%, amber ≥ 60%, red < 60%.';
  ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF7F7F7F' } };
  ws.getRow(2).height = 16;

  styleHeaderCell(ws.getCell(3, 1), 'Roll No.');
  styleHeaderCell(ws.getCell(3, 2), 'Student Name');
  MONTH_SHORT.forEach((m, i) => styleHeaderCell(ws.getCell(3, 3 + i), m));
  styleHeaderCell(ws.getCell(3, lastCol), 'Year %');

  // Union students across months (handles late admissions)
  const studentMap = new Map();
  for (const matrix of monthMatrices) {
    for (const s of matrix.studentRows) {
      const key = String(s.studentId);
      if (!studentMap.has(key)) {
        studentMap.set(key, { rollNumber: s.rollNumber, name: s.name, present: 0, late: 0, scheduledDays: 0, monthPcts: [] });
      }
      const agg = studentMap.get(key);
      agg.present += s.present;
      agg.late += s.late;
      agg.scheduledDays += s.scheduledDays;
      agg.monthPcts.push(s.percentage);
    }
  }

  let r = 4;
  for (const [, agg] of studentMap) {
    const rollCell = ws.getCell(r, 1);
    rollCell.value = agg.rollNumber;
    rollCell.alignment = { horizontal: 'center', vertical: 'middle' };
    rollCell.border = THIN_BORDER;
    const nameCell = ws.getCell(r, 2);
    nameCell.value = agg.name;
    nameCell.border = THIN_BORDER;
    MONTH_SHORT.forEach((_, i) => writePercentCell(ws.getCell(r, 3 + i), agg.monthPcts[i]));
    const yearPct = agg.scheduledDays > 0 ? Math.round(((agg.present + agg.late) / agg.scheduledDays) * 100) : null;
    writePercentCell(ws.getCell(r, lastCol), yearPct, { bold: true });
    r++;
  }

  // Class average row
  const avgLabel = ws.getCell(r, 2);
  avgLabel.value = 'Class Average';
  avgLabel.font = { bold: true };
  MONTH_SHORT.forEach((_, i) => {
    const pcts = monthMatrices[i].studentRows.map(s => s.percentage).filter(p => p !== null && p !== undefined);
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
    writePercentCell(ws.getCell(r, 3 + i), avg, { bold: true });
  });
  const allPcts = [];
  for (const [, agg] of studentMap) {
    const yp = agg.scheduledDays > 0 ? ((agg.present + agg.late) / agg.scheduledDays) * 100 : null;
    if (yp !== null) allPcts.push(yp);
  }
  const yearAvg = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : null;
  writePercentCell(ws.getCell(r, lastCol), yearAvg, { bold: true });

  ws.getColumn(1).width = 9;
  ws.getColumn(2).width = 30;
  for (let i = 3; i <= lastCol; i++) ws.getColumn(i).width = 8;
}

const sanitizeFilename = (s) => String(s || 'Export').replace(/[^\w\-]+/g, '_');

/**
 * 5. GET /api/attendance/export?classId=X&subjectId=Y&year=2026
 * Downloads an .xlsx annual register for one subject:
 *   - "Summary" worksheet: per-student % for each month + year overall
 *   - 12 monthly worksheets: students × days grid, color-coded, printable
 */
async function exportAnnualAttendance(req, res) {
  try {
    const { classId, subjectId, year } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !year) {
      return res.status(400).json({ message: "classId, subjectId and year are required query parameters." });
    }
    if (!(await assertTeacherScopedAccess(req, res, { classId, subjectId }))) return;
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return res.status(400).json({ message: "year must be a valid 4-digit year." });
    }

    const [school, cls, subject] = await Promise.all([
      School.findOne({ _id: schoolId }).lean(),
      Class.findOne({ _id: classId, schoolId }).select('name section').lean(),
      Subject.findOne({ _id: subjectId, schoolId }).select('name code').lean()
    ]);

    // Pre-compute all 12 monthly matrices once (shared by Summary + monthly sheets).
    // The routine weekday list is identical for every month, so fetch it once and
    // build the 12 months in parallel.
    const routinePeriods = await RoutinePeriod.find({ schoolId, classId, subjectId }).select('day').lean();
    const scheduledWeekdays = routinePeriods.length
      ? new Set(routinePeriods.map(p => p.day))
      : new Set(ALL_WEEKDAYS);
    const monthMatrices = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        buildMonthlyMatrix({ schoolId, classId, subjectId, year: y, month: i + 1, scheduledWeekdays })
      )
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Vidyalaya School Management System';
    workbook.created = new Date();

    const schoolName = school?.schoolName || 'School';
    const className = cls ? `${cls.name}${cls.section ? ` ${cls.section}` : ''}` : 'Class';
    const subjectName = subject?.name || 'Subject';

    buildSummaryWorksheet(workbook.addWorksheet('Summary'), {
      title: `${schoolName}  •  ${className}  •  ${subjectName}  •  Yearly Attendance Summary (${y})`,
      monthMatrices
    });

    for (let m = 1; m <= 12; m++) {
      buildMonthlyWorksheet(workbook.addWorksheet(MONTH_SHORT[m - 1]), {
        title: `${schoolName}  •  ${className}  •  ${subjectName}  •  ${MONTH_NAMES[m - 1]} ${y}`,
        matrix: monthMatrices[m - 1],
        month: MONTH_NAMES[m - 1]
      });
    }

    const filename = `${sanitizeFilename(className)}_${sanitizeFilename(subjectName)}_${y}_Attendance.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    // Once the xlsx headers are flushed we can't switch to a JSON error response.
    if (res.headersSent) {
      return res.end();
    }
    return res.status(500).json({ message: "Failed to export attendance", error: error.message });
  }
}



export { getAttendanceSheet, saveAttendanceSheet, subjectAttendanceSummary, dailyRegister, exportAnnualAttendance };