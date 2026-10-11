//for managing users like student,teacher,parent ,class


import { Router } from "express";
import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";
import { addClass,viewAllClass,viewClass,updateClass,deleteClass,viewClassRoutene,
        addSubject, viewSubjects, updateSubject, deleteSubject,
        addRoutinePeriod, viewRoutine, updateRoutinePeriod, deleteRoutinePeriod, viewMyRoutine,
        viewClassSubjectAssignments, addClassSubjectAssignment, addClassSubjectAssignmentsBulk, deleteClassSubjectAssignment
} from "../controllers/academic.controller.js";


const academicRouter=Router();



academicRouter.post("/add-class",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),addClass);
academicRouter.get("/view-class",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),viewAllClass);
academicRouter.get("/view-class/:classId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),viewClass);
academicRouter.put("/update-class/:classId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),updateClass);
academicRouter.delete("/delete-class/:classId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),deleteClass);


// timetable / routine
academicRouter.post("/add-routine-period",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),addRoutinePeriod);
academicRouter.get("/my-routine",authenticateUser,authorizeRoles('TEACHER','SCHOOL_ADMIN'),viewMyRoutine);
academicRouter.get("/view-routine",authenticateUser,authorizeRoles('SCHOOL_ADMIN','TEACHER'),viewRoutine);
academicRouter.get("/view-class/:classId/routene",authenticateUser,authorizeRoles('SCHOOL_ADMIN','TEACHER'),viewClassRoutene);
academicRouter.put("/update-routine-period/:periodId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),updateRoutinePeriod);
academicRouter.delete("/delete-routine-period/:periodId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),deleteRoutinePeriod);


academicRouter.post("/add-subject",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),addSubject);
academicRouter.get("/view-subject",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),viewSubjects);
academicRouter.put("/update-subject/:subjectId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),updateSubject);
academicRouter.delete("/delete-subject/:subjectId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),deleteSubject);


// class → subject assignments (what each class teaches, and who teaches it)
academicRouter.get("/class-subject-assignments",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),viewClassSubjectAssignments);
academicRouter.post("/class-subject-assignments",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),addClassSubjectAssignment);
academicRouter.post("/class-subject-assignments/bulk",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),addClassSubjectAssignmentsBulk);
academicRouter.delete("/class-subject-assignments/:assignmentId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),deleteClassSubjectAssignment);


export default academicRouter;