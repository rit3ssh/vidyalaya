import express from "express";

import authRouter from "./routes/auth.route.js";
import schoolRouter from "./routes/school.route.js";
import academicRouter from "./routes/academic.route.js";
import userRouter from "./routes/user.route.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import admissionRouter from "./routes/admission.route.js";
import attendanceRouter from "./routes/attendance.route.js";
import noticeRouter from "./routes/notice.route.js";
import noteRouter from "./routes/note.route.js";
import examRouter from "./routes/exam.route.js";
import chatRouter from "./routes/chat.route.js";

import { authenticateUser, authorizeRoles } from "./middleware/auth.middleware.js";

const app = express();
app.use(cors({
    origin: "http://localhost:5174",
    credentials: true
}))
app.use(express.json());
app.use(cookieParser());




app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/admissions", admissionRouter);
// app.use("/api/school", schoolRouter);
app.use("/api/academics",academicRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/notices", noticeRouter);
app.use("/api/notes", noteRouter);
app.use("/api/exams", examRouter);
app.use("/api/chats", chatRouter);


app.get("/api/home",authenticateUser,(req,res)=>{
    res.status(200).json({message:"Welcome to the school management system"+"MR."+req.user.name});
});










export default app;