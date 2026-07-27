import express from "express";

import authRouter from "./routes/auth.route.js";
import schoolRouter from "./routes/school.route.js";
import academicRouter from "./routes/academic.route.js";
import userRouter from "./routes/user.route.js";
import cookieParser from "cookie-parser";



const app = express();

app.use(express.json());
app.use(cookieParser());




app.use("/api/auth", authRouter);
app.use("/api/school", schoolRouter);
app.use("/api/academics",academicRouter);
app.use("/api/users", userRouter);










export default app;