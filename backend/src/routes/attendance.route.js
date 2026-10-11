import {Router} from "express";
import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";
import { getAttendanceSheet, saveAttendanceSheet, subjectAttendanceSummary, dailyRegister, exportAnnualAttendance } from "../controllers/attendance.controller.js";

const attendanceRouter = Router();

// Teachers need GET too — they load the sheet to display/mark it, admins manage it
attendanceRouter.get("/", authenticateUser, authorizeRoles('SCHOOL_ADMIN','TEACHER'), getAttendanceSheet);
attendanceRouter.get("/subject-summary", authenticateUser, authorizeRoles('SCHOOL_ADMIN','TEACHER'), subjectAttendanceSummary);
attendanceRouter.get("/register", authenticateUser, authorizeRoles('SCHOOL_ADMIN','TEACHER'), dailyRegister);
attendanceRouter.get("/export", authenticateUser, authorizeRoles('SCHOOL_ADMIN','TEACHER'), exportAnnualAttendance);
attendanceRouter.post("/mark-attendance", authenticateUser, authorizeRoles('TEACHER','SCHOOL_ADMIN'), saveAttendanceSheet);
// attendanceRouter.get("/view-student-attendance/:studentId", authenticateUser, authorizeRoles('TEACHER', 'STUDENT', 'PARENT'), viewStudentAttendance);

export default attendanceRouter;