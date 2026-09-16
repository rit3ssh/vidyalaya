//for school notices — admin publishes/edits/deletes, everyone in the school views

import { Router } from "express";
import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";
import { handleNoticeUpload } from "../middleware/upload.middleware.js";
import {
    createNotice,
    getNotices,
    getNotice,
    updateNotice,
    deleteNotice,
} from "../controllers/notice.controller.js";

const noticeRouter = Router();

// Every route below requires a valid token
noticeRouter.use(authenticateUser);

// Viewing is open to every member of the school
noticeRouter.get("/", authorizeRoles('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getNotices);
noticeRouter.get("/:noticeId", authorizeRoles('SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), getNotice);

// Publishing / editing / deleting is admin-only.
// The upload middleware parses multipart/form-data (text fields + image/attachment files).
noticeRouter.post("/", authorizeRoles('SCHOOL_ADMIN'), handleNoticeUpload, createNotice);
noticeRouter.put("/:noticeId", authorizeRoles('SCHOOL_ADMIN'), handleNoticeUpload, updateNotice);
noticeRouter.delete("/:noticeId", authorizeRoles('SCHOOL_ADMIN'), deleteNotice);

export default noticeRouter;
