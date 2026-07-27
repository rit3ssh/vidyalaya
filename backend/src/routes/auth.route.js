import { Router } from "express";
import {registerController,loginController,logoutController} from "../controllers/auth.controller.js";


const authRouter = Router();


authRouter.post("/login",loginController);


authRouter.post("/register-school", registerController);


authRouter.get("/logout",logoutController);


export default authRouter;