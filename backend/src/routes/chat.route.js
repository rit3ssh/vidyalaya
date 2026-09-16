// 1:1 chat — every logged-in role (student, parent, teacher, admin) can chat
// within their role-based scope. Scope is enforced in the controller.

import { Router } from "express";
import { authenticateUser } from "../middleware/auth.middleware.js";
import { handleChatUpload } from "../middleware/upload.middleware.js";
import {
    getChatPeople,
    getMyConversations,
    getMessages,
    sendMessage,
    getOnlineUsers,
} from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.use(authenticateUser);

chatRouter.get("/people", getChatPeople);
chatRouter.get("/online", getOnlineUsers);
chatRouter.get("/conversations", getMyConversations);
chatRouter.get("/conversations/:otherUserId/messages", getMessages);
// Multipart: optional "text" field + optional "file" attachment.
chatRouter.post("/conversations/:otherUserId/messages", handleChatUpload, sendMessage);

export default chatRouter;
