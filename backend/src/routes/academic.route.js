//for managing users like student,teacher,parent ,class


import { Router } from "express";
import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";
import { addClass,viewAllClass,viewClass,updateClass,deleteClass} from "../controllers/academic.controller.js";


const academicRouter=Router();



academicRouter.post("/add-class",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),addClass);
academicRouter.get("/view-class",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),viewAllClass);
academicRouter.get("/view-class/:classId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),viewClass);
academicRouter.put("/update-class/:classId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),updateClass);
academicRouter.delete("/delete-class/:classId",authenticateUser,authorizeRoles('SCHOOL_ADMIN'),deleteClass);




export default academicRouter;