import express from "express";
import { authenticateUser,authorizeRoles } from "../middleware/auth.middleware.js";
import { admitStudent ,updateStudentAdmission,deleteStudentAdmission} from "../controllers/admission.controller.js";
 
const admissionRouter = express.Router();
 
admissionRouter.use(authenticateUser);
admissionRouter.post("/", authorizeRoles("SCHOOL_ADMIN"), admitStudent);
admissionRouter.put("/:studentId", authorizeRoles("SCHOOL_ADMIN"), updateStudentAdmission);
admissionRouter.delete("/:studentId", authorizeRoles("SCHOOL_ADMIN"), deleteStudentAdmission);

export default admissionRouter;
 
