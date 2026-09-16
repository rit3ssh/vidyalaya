// Upcoming exam routine — the school admin adds/edits/removes entries; every
// member of the school (students, parents, teachers, admin) can view it.

import { Router } from "express";
import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";
import {
    addExam,
    getExams,
    getClassSubjects,
    addExamsBulk,
    updateExam,
    deleteExam,
} from "../controllers/exam.controller.js";

const examRouter = Router();

// Every route below requires a valid token
examRouter.use(authenticateUser);

// Viewing the routine is open to every school member
examRouter.get("/", authorizeRoles("SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"), getExams);

// Admin-only helpers + management
examRouter.get("/class-subjects", authorizeRoles("SCHOOL_ADMIN"), getClassSubjects);
examRouter.post("/bulk", authorizeRoles("SCHOOL_ADMIN"), addExamsBulk);
examRouter.post("/", authorizeRoles("SCHOOL_ADMIN"), addExam);
examRouter.put("/:examId", authorizeRoles("SCHOOL_ADMIN"), updateExam);
examRouter.delete("/:examId", authorizeRoles("SCHOOL_ADMIN"), deleteExam);

export default examRouter;
