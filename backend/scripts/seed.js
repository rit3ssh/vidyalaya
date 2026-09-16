/**
 * Seed script — populates the database with a full, realistic test school so
 * every feature can be exercised:
 *
 *   1 School, 1 Admin, 4 Classes (Grade 8 A/B + Grade 9 A/B),
 *   4 Teachers, 5 Subjects + full class→subject→teacher assignments,
 *   8 Students, 7 Parents + StudentParent links, 5 notices,
 *   10 class notes, an 8-entry upcoming exam routine, a complete weekly
 *   timetable (routine periods) for every class, and a month of attendance
 *   sheets for the current month (so registers/summaries/Excel have data).
 *
 * Run with:          npm run seed
 * Wipe + reseed with: npm run seed -- --fresh
 *
 * All seeded accounts use the SAME password (see SEED_PASSWORD below) so you
 * can log in as any of them by email during manual testing. A copy of every
 * email/password lives in credentials.md at the project root.
 * This script is for local/test databases only — never point it at production.
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import schoolModel from "../src/models/school.model.js";
import userModel from "../src/models/user.model.js";
import teacherModel from "../src/models/teacher.model.js";
import studentModel from "../src/models/student.model.js";
import parentModel from "../src/models/parent.model.js";
import studentParentModel from "../src/models/studentParent.model.js";
import classModel from "../src/models/class.model.js";
import noticeModel from "../src/models/notice.model.js";
import subjectModel from "../src/models/subject.model.js";
import classSubjectTeacherModel from "../src/models/classSubjectTeacher.model.js";
import noteModel from "../src/models/note.model.js";
import examModel from "../src/models/exam.model.js";
import attendanceModel from "../src/models/attendance.model.js";
import routinePeriodModel from "../src/models/routenePeriod.model.js";
import teacherPermissionModel from "../src/models/teacherPermission.model.js";

const SEED_PASSWORD = "Test@1234";
const WIPE_FIRST = process.argv.includes("--fresh");
const SEED_SCHOOL_EMAIL = "info@greenvalley.test";

// School week runs Sunday → Friday (Saturday is off), matching the app.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
// Five 45-minute periods a day.
const SLOTS = [
  { startTime: "09:00", endTime: "09:45" },
  { startTime: "10:00", endTime: "10:45" },
  { startTime: "11:00", endTime: "11:45" },
  { startTime: "12:00", endTime: "12:45" },
  { startTime: "13:00", endTime: "13:45" },
];

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNameOf = (d) => d.toLocaleDateString("en-US", { weekday: "long" });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB:", mongoose.connection.name);

  if (WIPE_FIRST) {
    console.log("--fresh flag set: wiping existing collections...");
    await Promise.all([
      schoolModel.deleteMany({}),
      userModel.deleteMany({}),
      teacherModel.deleteMany({}),
      studentModel.deleteMany({}),
      parentModel.deleteMany({}),
      studentParentModel.deleteMany({}),
      classModel.deleteMany({}),
      noticeModel.deleteMany({}),
      subjectModel.deleteMany({}),
      classSubjectTeacherModel.deleteMany({}),
      noteModel.deleteMany({}),
      examModel.deleteMany({}),
      attendanceModel.deleteMany({}),
      routinePeriodModel.deleteMany({}),
      teacherPermissionModel.deleteMany({}),
    ]);
  } else {
    // Fail fast with a clear message if this seed has already been run,
    // instead of dying partway through with a raw duplicate-key error.
    const existing = await schoolModel.findOne({ schoolEmail: SEED_SCHOOL_EMAIL });
    if (existing) {
      console.log(`Seed data already exists ("${existing.schoolName}" found).`);
      console.log("Run again with --fresh to wipe and reseed: npm run seed -- --fresh");
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // 1. School --------------------------------------------------------------
  const school = await schoolModel.create({
    schoolName: "Green Valley School",
    schoolAddress: "123 Test Lane, Kathmandu",
    schoolEmail: SEED_SCHOOL_EMAIL,
    schoolPhoneNumber: "9800000000",
  });
  console.log("Created school:", school.schoolName, school._id.toString());

  // 2. Admin ---------------------------------------------------------------
  const admin = await userModel.create({
    schoolId: school._id,
    email: "admin@greenvalley.test",
    passwordHash,
    firstName: "Asha",
    lastName: "Karki",
    phoneNumber: "9812345678",
    role: "SCHOOL_ADMIN",
  });

  // 3. Sample school notices (published by the admin) ----------------------
  await noticeModel.create([
    {
      schoolId: school._id,
      title: "Mid-Term Exam Schedule Released",
      description:
        "The mid-term examination timetable has been published on the Exams page. Exams begin 10 November — please prepare accordingly.",
      noticeDate: new Date("2026-08-01"),
      createdBy: admin._id,
    },
    {
      schoolId: school._id,
      title: "New Library Books Arrived",
      description:
        "Over 200 new titles have been added to the school library, including Nepali literature, science encyclopedias and English classics. Students may borrow from next week.",
      noticeDate: new Date("2026-08-05"),
      createdBy: admin._id,
    },
    {
      schoolId: school._id,
      title: "School Closed — Dashain Holiday",
      description:
        "The school will remain closed from 15 to 20 October for the Dashain festival. Classes resume on 21 October.",
      noticeDate: new Date("2026-10-10"),
      createdBy: admin._id,
    },
    {
      schoolId: school._id,
      title: "Parent-Teacher Meeting",
      description:
        "A parent-teacher meeting will be held on 12 November at 10 AM in the school hall. Attendance is expected for all parents of Grade 8 and 9.",
      noticeDate: new Date("2026-11-05"),
      imageUrl: "https://example.com/notices/ptm-2026.png",
      createdBy: admin._id,
    },
    {
      schoolId: school._id,
      title: "Annual Sports Day — Registration",
      description:
        "Registration for the Annual Sports Day is open until 1 December. The original circular is attached.",
      noticeDate: new Date("2026-11-20"),
      attachmentUrl: "https://example.com/notices/sports-day-circular.pdf",
      createdBy: admin._id,
    },
  ]);
  console.log("Created 5 sample school notices");

  // 4. Classes (two sections each, so className grouping is exercised) -----
  const classSeeds = [
    { name: "Grade 8", section: "A", academicYear: "2026" },
    { name: "Grade 8", section: "B", academicYear: "2026" },
    { name: "Grade 9", section: "A", academicYear: "2026" },
    { name: "Grade 9", section: "B", academicYear: "2026" },
  ];
  const classes = [];
  for (const c of classSeeds) {
    classes.push(
      await classModel.create({
        schoolId: school._id,
        name: c.name,
        section: c.section,
        academicYear: c.academicYear,
      })
    );
  }
  const classIdxByName = Object.fromEntries(
    classes.map((c, i) => [`${c.name} ${c.section}`, i])
  );

  // 5. Teachers (each with a User login + Teacher profile) -----------------
  // teacherSeeds: [name, email, qualification, designation]
  // Index 0..3 → Ram(English), Sita(Math), Hari(Science), Gita(Social/Nepali)
  const teacherSeeds = [
    { firstName: "Ram", lastName: "Shrestha", email: "teacher1@greenvalley.test", qualification: "M.Ed", designation: "English Teacher" },
    { firstName: "Sita", lastName: "Gurung", email: "teacher2@greenvalley.test", qualification: "B.Ed", designation: "Mathematics Teacher" },
    { firstName: "Hari", lastName: "Thapa", email: "teacher3@greenvalley.test", qualification: "M.Sc", designation: "Science Teacher" },
    { firstName: "Gita", lastName: "Sharma", email: "teacher4@greenvalley.test", qualification: "M.A.", designation: "Social Studies Teacher" },
  ];
  const teachers = []; // { user, profile }
  for (let i = 0; i < teacherSeeds.length; i++) {
    const t = teacherSeeds[i];
    const user = await userModel.create({
      schoolId: school._id,
      email: t.email,
      passwordHash,
      firstName: t.firstName,
      lastName: t.lastName,
      phoneNumber: `980000000${i + 1}`,
      role: "TEACHER",
    });
    const profile = await teacherModel.create({
      userId: user._id,
      qualification: t.qualification,
      designation: t.designation,
      joiningDate: new Date("2023-06-01"),
    });
    teachers.push({ user, profile });
  }

  // 6. Subjects ------------------------------------------------------------
  const subjects = await subjectModel.create([
    { schoolId: school._id, name: "English", code: "ENG" },
    { schoolId: school._id, name: "Mathematics", code: "MATH" },
    { schoolId: school._id, name: "Science", code: "SCI" },
    { schoolId: school._id, name: "Social Studies", code: "SOC" },
    { schoolId: school._id, name: "Nepali", code: "NEP" },
  ]);
  const subjectIdxByName = Object.fromEntries(subjects.map((s, i) => [s.name, i]));

  // 7. Class → subject → teacher assignments ------------------------------
  // Grade 8 teaches English/Math/Science/Social Studies; Grade 9 swaps
  // Social Studies for Nepali — so the exam grid and notes dropdowns differ
  // between the two classes (tests the class-respective-subject rule).
  // Teacher index by subject: 0 English, 1 Math, 2 Science, 3 Social/Nepali.
  const SUBJECT_TEACHER_IDX = { English: 0, Mathematics: 1, Science: 2, "Social Studies": 3, Nepali: 3 };
  const gradeSubjects = {
    "Grade 8": ["English", "Mathematics", "Science", "Social Studies"],
    "Grade 9": ["English", "Mathematics", "Science", "Nepali"],
  };

  // teacherProfileByClassSubject: `${classId}|${subjectId}` -> Teacher profile id
  // teacherUserByClassSubject:    `${classId}|${subjectId}` -> User id (routine/attendance)
  const teacherProfileByClassSubject = new Map();
  const teacherUserByClassSubject = new Map();
  const subjectIdsByClass = new Map(); // classId -> [subjectId, ...]

  for (const cls of classes) {
    for (const subjName of gradeSubjects[cls.name]) {
      const teacher = teachers[SUBJECT_TEACHER_IDX[subjName]];
      const subject = subjects[subjectIdxByName[subjName]];
      await classSubjectTeacherModel.create({
        classId: cls._id,
        subjectId: subject._id,
        teacherId: teacher.profile._id,
      });
      teacherProfileByClassSubject.set(`${cls._id}|${subject._id}`, teacher.profile._id);
      teacherUserByClassSubject.set(`${cls._id}|${subject._id}`, teacher.user._id);
      if (!subjectIdsByClass.has(String(cls._id))) subjectIdsByClass.set(String(cls._id), []);
      subjectIdsByClass.get(String(cls._id)).push(subject._id);
    }
  }
  // Homeroom teachers
  classes[classIdxByName["Grade 8 A"]].classTeacher = teachers[0].profile._id;
  classes[classIdxByName["Grade 9 A"]].classTeacher = teachers[2].profile._id;
  await Promise.all(classes.map((c) => c.save()));
  console.log("Created 5 subjects and", classes.length * 4, "class→subject→teacher assignments");

  // 8. Weekly timetable (routine periods) ----------------------------------
  // Rotate teachers across classes so no teacher or class is double-booked at
  // the same (day, startTime): class i gets teacher (i + day + slot) % 4.
  const periods = [];
  for (let dayIdx = 0; dayIdx < WEEKDAYS.length; dayIdx++) {
    for (let slotIdx = 0; slotIdx < SLOTS.length; slotIdx++) {
      for (let classIdx = 0; classIdx < classes.length; classIdx++) {
        const cls = classes[classIdx];
        const teacherIdx = (classIdx + dayIdx + slotIdx) % teachers.length;
        // Gita (idx 3) teaches Social Studies to Grade 8 and Nepali to Grade 9.
        const subjName =
          teacherIdx === 3 ? (cls.name === "Grade 8" ? "Social Studies" : "Nepali") : ["English", "Mathematics", "Science"][teacherIdx];
        const subject = subjects[subjectIdxByName[subjName]];
        periods.push({
          schoolId: school._id,
          classId: cls._id,
          subjectId: subject._id,
          teacherId: teachers[teacherIdx].user._id, // routine stores the User id
          academicYear: "2026",
          day: WEEKDAYS[dayIdx],
          startTime: SLOTS[slotIdx].startTime,
          endTime: SLOTS[slotIdx].endTime,
        });
      }
    }
  }
  await routinePeriodModel.create(periods);
  console.log(`Created ${periods.length} routine periods (weekly timetable for ${classes.length} classes)`);

  // 9. Class notes (for the notes room) ------------------------------------
  const class8A = classes[classIdxByName["Grade 8 A"]];
  const class8B = classes[classIdxByName["Grade 8 B"]];
  const class9A = classes[classIdxByName["Grade 9 A"]];
  const class9B = classes[classIdxByName["Grade 9 B"]];
  const [english, math, science, social, nepali] = subjects;

  await noteModel.create([
    {
      schoolId: school._id,
      title: "Essay Writing — Structure",
      description:
        "How to structure a five-paragraph essay: introduction, three body paragraphs and a conclusion. Includes topic-sentence starters for each paragraph.",
      classId: class8A._id,
      subjectId: english._id,
      teacherId: teachers[0].profile._id,
    },
    {
      schoolId: school._id,
      title: "Algebra: Linear Equations",
      description:
        "Solving linear equations in one variable — worked examples, the balance method and practice problems with answers.",
      classId: class8A._id,
      subjectId: math._id,
      teacherId: teachers[1].profile._id,
    },
    {
      schoolId: school._id,
      title: "Chapter 4: The Atom",
      description:
        "Protons, neutrons and electrons — atomic structure diagrams, the periodic table layout and key revision points for the chapter test.",
      classId: class8A._id,
      subjectId: science._id,
      teacherId: teachers[2].profile._id,
    },
    {
      schoolId: school._id,
      title: "Map Skills — Provinces of Nepal",
      description:
        "Locating all seven provinces on a blank map, plus key rivers and mountain ranges. Worksheet attached.",
      classId: class8A._id,
      subjectId: social._id,
      teacherId: teachers[3].profile._id,
    },
    {
      schoolId: school._id,
      title: "Grammar: Tenses Review",
      description:
        "Quick revision of the 12 English tenses with example sentences — past, present and future, simple through perfect continuous.",
      classId: class8B._id,
      subjectId: english._id,
      teacherId: teachers[0].profile._id,
      fileUrl: "https://example.com/notes/tenses-review.pdf",
    },
    {
      schoolId: school._id,
      title: "Poetry Analysis — 'The Lake Isle of Innisfree'",
      description:
        "Line-by-line analysis of the poem with themes, imagery and literary devices, plus exam-style questions to try.",
      classId: class9A._id,
      subjectId: english._id,
      teacherId: teachers[0].profile._id,
    },
    {
      schoolId: school._id,
      title: "Chemical Reactions and Equations",
      description:
        "Balancing chemical equations, types of reactions (combination, decomposition, displacement) with colour-coded worked examples.",
      classId: class9A._id,
      subjectId: science._id,
      teacherId: teachers[2].profile._id,
    },
    {
      schoolId: school._id,
      title: "कविता विश्लेषण — 'बाली'",
      description:
        "कविताको भाव, शैली र प्रतीकहरूको विश्लेषण, साथै परीक्षामा आउने प्रश्नहरूको अभ्यास।",
      classId: class9A._id,
      subjectId: nepali._id,
      teacherId: teachers[3].profile._id,
    },
    {
      schoolId: school._id,
      title: "Quadratic Equations",
      description:
        "Factorisation and the quadratic formula — step-by-step solutions to common exam problems, with a practice set.",
      classId: class9B._id,
      subjectId: math._id,
      teacherId: teachers[1].profile._id,
    },
    {
      schoolId: school._id,
      title: "Nepali Grammar: Karak",
      description:
        "कारक चिन्हहरूको प्रयोग — विभिन्न उदाहरणहरूसहित अभ्यास र उत्तरहरू।",
      classId: class9B._id,
      subjectId: nepali._id,
      teacherId: teachers[3].profile._id,
    },
  ]);
  console.log("Created 10 sample class notes");

  // 10. Upcoming exam routine (keyed by className — sections sit together) --
  await examModel.create([
    { schoolId: school._id, className: "Grade 8", date: new Date("2026-11-10"), subjectId: math._id, startTime: "09:00", endTime: "11:00", createdBy: admin._id },
    { schoolId: school._id, className: "Grade 8", date: new Date("2026-11-12"), subjectId: english._id, startTime: "09:00", endTime: "11:00", createdBy: admin._id },
    { schoolId: school._id, className: "Grade 8", date: new Date("2026-11-14"), subjectId: science._id, startTime: "11:30", endTime: "13:30", createdBy: admin._id },
    { schoolId: school._id, className: "Grade 8", date: new Date("2026-11-17"), subjectId: social._id, startTime: "09:00", endTime: "11:00", createdBy: admin._id },
    { schoolId: school._id, className: "Grade 9", date: new Date("2026-11-10"), subjectId: math._id, startTime: "09:00", endTime: "11:00", createdBy: admin._id },
    { schoolId: school._id, className: "Grade 9", date: new Date("2026-11-12"), subjectId: english._id, startTime: "09:00", endTime: "11:00", createdBy: admin._id },
    { schoolId: school._id, className: "Grade 9", date: new Date("2026-11-14"), subjectId: science._id, startTime: "11:30", endTime: "13:30", createdBy: admin._id },
    { schoolId: school._id, className: "Grade 9", date: new Date("2026-11-17"), subjectId: nepali._id, startTime: "09:00", endTime: "11:00", createdBy: admin._id },
  ]);
  console.log("Created 8 exam routine entries");

  // 11. Parents -------------------------------------------------------------
  const parentSeeds = [
    { firstName: "Bina", lastName: "Adhikari", email: "parent1@greenvalley.test", occupation: "Nurse" },
    { firstName: "Kiran", lastName: "Adhikari", email: "parent2@greenvalley.test", occupation: "Engineer" },
    { firstName: "Maya", lastName: "Basnet", email: "parent3@greenvalley.test", occupation: "Teacher" },
    { firstName: "Kamala", lastName: "Magar", email: "parent4@greenvalley.test", occupation: "Homemaker" },
    { firstName: "Suresh", lastName: "Rai", email: "parent5@greenvalley.test", occupation: "Business" },
    { firstName: "Rina", lastName: "Karki", email: "parent6@greenvalley.test", occupation: "Shopkeeper" },
    { firstName: "Sunita", lastName: "Shrestha", email: "parent7@greenvalley.test", occupation: "Accountant" },
  ];
  const parents = [];
  for (let i = 0; i < parentSeeds.length; i++) {
    const p = parentSeeds[i];
    const user = await userModel.create({
      schoolId: school._id,
      email: p.email,
      passwordHash,
      firstName: p.firstName,
      lastName: p.lastName,
      phoneNumber: `981000000${i + 1}`,
      role: "PARENT",
    });
    const profile = await parentModel.create({ userId: user._id, occupation: p.occupation });
    parents.push({ user, profile });
  }

  // 12. Students ------------------------------------------------------------
  // Roll numbers are unique per class; admission numbers unique globally.
  const studentSeeds = [
    { firstName: "Aayush", lastName: "Adhikari", classKey: "Grade 8 A", rollNumber: "S001", admissionNumber: "ADM-2026-001" },
    { firstName: "Anjali", lastName: "Adhikari", classKey: "Grade 8 A", rollNumber: "S002", admissionNumber: "ADM-2026-002" },
    { firstName: "Bibek", lastName: "Basnet", classKey: "Grade 8 B", rollNumber: "S001", admissionNumber: "ADM-2026-003" },
    { firstName: "Deepak", lastName: "Magar", classKey: "Grade 8 B", rollNumber: "S002", admissionNumber: "ADM-2026-004" },
    { firstName: "Sabin", lastName: "Rai", classKey: "Grade 9 A", rollNumber: "S001", admissionNumber: "ADM-2026-005" },
    { firstName: "Nisha", lastName: "Rai", classKey: "Grade 9 A", rollNumber: "S002", admissionNumber: "ADM-2026-006" },
    { firstName: "Pooja", lastName: "Karki", classKey: "Grade 9 B", rollNumber: "S001", admissionNumber: "ADM-2026-007" },
    { firstName: "Ramesh", lastName: "Shrestha", classKey: "Grade 9 B", rollNumber: "S002", admissionNumber: "ADM-2026-008" },
  ];
  const students = []; // { user, profile, classKey }
  for (let i = 0; i < studentSeeds.length; i++) {
    const s = studentSeeds[i];
    const user = await userModel.create({
      schoolId: school._id,
      email: `student${i + 1}@greenvalley.test`,
      passwordHash,
      firstName: s.firstName,
      lastName: s.lastName,
      phoneNumber: `982000000${i + 1}`,
      role: "STUDENT",
    });
    const profile = await studentModel.create({
      userId: user._id,
      classId: classes[classIdxByName[s.classKey]]._id,
      rollNumber: s.rollNumber,
      admissionNumber: s.admissionNumber,
      dateOfBirth: new Date(`2013-0${(i % 9) + 1}-15`),
      admissionDate: new Date("2026-01-10"),
    });
    students.push({ user, profile, classKey: s.classKey });
  }

  // 13. StudentParent links ------------------------------------------------
  // Aayush & Anjali -> Bina + Kiran Adhikari; Bibek -> Maya;
  // Deepak -> Kamala; Sabin & Nisha -> Suresh; Pooja -> Rina; Ramesh -> Sunita
  const links = [
    [0, 0, "Mother"],
    [0, 1, "Father"],
    [1, 0, "Mother"],
    [1, 1, "Father"],
    [2, 2, "Mother"],
    [3, 3, "Mother"],
    [4, 4, "Father"],
    [5, 4, "Father"],
    [6, 5, "Mother"],
    [7, 6, "Mother"],
  ];
  for (const [studentIdx, parentIdx, relationType] of links) {
    await studentParentModel.create({
      studentId: students[studentIdx].profile._id,
      parentId: parents[parentIdx].profile._id,
      relationType,
    });
  }

  // 14. Attendance sheets (current month, weekdays up to today) -------------
  // Sheets for Grade 8 A (English + Math) and Grade 9 A (Science + English)
  // so the daily register, monthly summary and Excel export all have data.
  const attendanceTargets = [
    { classKey: "Grade 8 A", subject: english },
    { classKey: "Grade 8 A", subject: math },
    { classKey: "Grade 9 A", subject: science },
    { classKey: "Grade 9 A", subject: english },
  ];
  const statusCycle = ["PRESENT", "PRESENT", "PRESENT", "ABSENT", "PRESENT", "LATE", "PRESENT", "LEAVE"];
  let attendanceCount = 0;

  // All weekdays in the current month up to today (skip Saturdays).
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthDates = [];
  for (let d = new Date(firstOfMonth); d <= now; d.setDate(d.getDate() + 1)) {
    const name = dayNameOf(d);
    if (name !== "Saturday") monthDates.push(new Date(d));
  }

  for (const target of attendanceTargets) {
    const cls = classes[classIdxByName[target.classKey]];
    const subject = target.subject;
    const teacherUser = teacherUserByClassSubject.get(`${cls._id}|${subject._id}`);
    const classStudents = students.filter((s) => s.classKey === target.classKey);
    if (!teacherUser || classStudents.length === 0) continue;

    for (let dayIdx = 0; dayIdx < monthDates.length; dayIdx++) {
      const date = monthDates[dayIdx];
      const dateStr = fmtDate(date);
      const dayName = dayNameOf(date);
      const dayNum = WEEKDAYS.indexOf(dayName);

      // Which period slot does this subject occupy on that weekday?
      let slotIdx = -1;
      for (let s = 0; s < SLOTS.length; s++) {
        const tIdx = (classIdxByName[target.classKey] + dayNum + s) % teachers.length;
        const subjName =
          tIdx === 3 ? (cls.name === "Grade 8" ? "Social Studies" : "Nepali") : ["English", "Mathematics", "Science"][tIdx];
        if (subjName === subject.name) {
          slotIdx = s;
          break;
        }
      }
      if (slotIdx === -1) continue;

      const records = classStudents.map((st, i) => ({
        studentProfileId: st.profile._id,
        status: statusCycle[(dayIdx + i) % statusCycle.length],
        remarks: "",
      }));

      await attendanceModel.create({
        schoolId: school._id,
        classId: cls._id,
        subjectId: subject._id,
        teacherId: teacherUser,
        date: dateStr,
        timeSlot: `Period${slotIdx + 1}`,
        records,
      });
      attendanceCount++;
    }
  }
  console.log(`Created ${attendanceCount} attendance sheets for ${monthDates.length} school days in the current month`);

  // Summary printout for manual testing ------------------------------------
  console.log("\n=== SEED COMPLETE ===");
  console.log(`All accounts use password: ${SEED_PASSWORD}\n`);
  console.log("Admin:      admin@greenvalley.test");
  teachers.forEach((t, i) => console.log(`Teacher ${i + 1}:  teacher${i + 1}@greenvalley.test (${t.user.firstName} ${t.user.lastName})`));
  parents.forEach((p, i) => console.log(`Parent ${i + 1}:   parent${i + 1}@greenvalley.test (${p.user.firstName} ${p.user.lastName})`));
  students.forEach((s, i) => console.log(`Student ${i + 1}:  student${i + 1}@greenvalley.test (${s.user.firstName} ${s.user.lastName}, ${s.classKey})`));

  await mongoose.disconnect();
  console.log("\nDisconnected. Done.");
}

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
