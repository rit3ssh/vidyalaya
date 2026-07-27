//for adding student,teacher,parent
import { Router } from "express";

import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";

import { addStudent, viewAllStudents, viewStudent, updateStudent, deleteStudent,
        addParent, viewAllParent, viewParent, updateParent, deleteParent,
        addTeacher, viewAllTeachers, viewTeacher, updateTeacher, deleteTeacher
 } from "../controllers/user.controller.js";


const userRouter = Router();



userRouter.post("/add-student", authenticateUser, authorizeRoles('SCHOOL_ADMIN'),addStudent);
userRouter.get("/view-student", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), viewAllStudents);
userRouter.get("/view-student/:studentId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), viewStudent);
userRouter.put("/update-student/:studentId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), updateStudent);
userRouter.delete("/delete-student/:studentId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), deleteStudent);


userRouter.post("/add-parent", authenticateUser, authorizeRoles('SCHOOL_ADMIN'),addParent);
userRouter.get("/view-parent", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), viewAllParent);
userRouter.get("/view-parent/:parentId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), viewParent);
userRouter.put("/update-parent/:parentId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), updateParent);
userRouter.delete("/delete-parent/:parentId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), deleteParent);


userRouter.post("/add-teacher", authenticateUser, authorizeRoles('SCHOOL_ADMIN'),addTeacher);
userRouter.get("/view-teacher", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), viewAllTeachers);
userRouter.get("/view-teacher/:teacherId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), viewTeacher);
userRouter.put("/update-teacher/:teacherId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), updateTeacher);
userRouter.delete("/delete-teacher/:teacherId", authenticateUser, authorizeRoles('SCHOOL_ADMIN'), deleteTeacher);




export default userRouter;