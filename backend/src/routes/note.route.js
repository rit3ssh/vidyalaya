// The class "notes room" — teachers share notes for an assigned class+subject;
// students can only see the notes of their own class.

import { Router } from "express";
import { authenticateUser, authorizeRoles } from "../middleware/auth.middleware.js";
import { handleNoteUpload } from "../middleware/upload.middleware.js";
import {
    getMyAssignments,
    createNote,
    getNotes,
    getNote,
    updateNote,
    deleteNote,
} from "../controllers/note.controller.js";

const noteRouter = Router();

// Every route below requires a valid token
noteRouter.use(authenticateUser);

// Teachers manage their notes; students browse their own class's notes.
// Order matters: static segments before the :noteId parameter.
noteRouter.get("/", authorizeRoles("TEACHER", "STUDENT"), getNotes);
noteRouter.get("/assignments", authorizeRoles("TEACHER"), getMyAssignments);
noteRouter.get("/:noteId", authorizeRoles("TEACHER", "STUDENT"), getNote);

// Sharing / editing / deleting is teacher-only. The upload middleware parses
// multipart/form-data (text fields + an optional "file").
noteRouter.post("/", authorizeRoles("TEACHER"), handleNoteUpload, createNote);
noteRouter.put("/:noteId", authorizeRoles("TEACHER"), handleNoteUpload, updateNote);
noteRouter.delete("/:noteId", authorizeRoles("TEACHER"), deleteNote);

export default noteRouter;
