//for adding student,teacher,parent
import { Router } from "express";

import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";
import { getMe, updateMe, adminListUsers,adminCreateUser,adminDeleteUser,adminUpdateUser} from "../controllers/user.controller.js";

const userRouter = Router();



userRouter.use(authenticateUser); // every route below requires a valid token
 
// Self-service routes MUST be declared before "/:id" so "me" isn't parsed as an id.
userRouter.get('/me', getMe);
userRouter.put('/me', updateMe);

// Admin-only management of any user in their school
userRouter.post('/', authorizeRoles('SCHOOL_ADMIN'), adminCreateUser);
userRouter.get('/', authorizeRoles('SCHOOL_ADMIN'), adminListUsers);
userRouter.put('/:id', authorizeRoles('SCHOOL_ADMIN'), adminUpdateUser);
userRouter.delete('/:id', authorizeRoles('SCHOOL_ADMIN'), adminDeleteUser);


export default userRouter;