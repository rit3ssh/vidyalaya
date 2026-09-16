import { Router } from "express";
import {registerController,loginController,logoutController} from "../controllers/auth.controller.js";


const authRouter = Router();


authRouter.post("/register", registerController);


authRouter.post("/login",loginController);


authRouter.get("/logout",logoutController);


export default authRouter;