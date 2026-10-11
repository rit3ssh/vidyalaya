// Real-time chat push via Socket.IO.
//
// The socket shares the HTTP server (attached in server.js) and authenticates
// the same way the REST API does — the JWT stored in the `token` cookie is
// verified on handshake, and the connection is dropped if it's invalid.
//
// Each authenticated user joins a private room named `user:<id>`. When a
// message is created, chat.controller.js calls emitChatUpdate() with the two
// participant ids and a payload; the client reacts by refreshing its
// conversation list and, if the matching thread is open, the thread itself.

import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const FRONTEND_ORIGIN = "http://localhost:5173";

let io = null;

// Presence: userId -> number of open sockets (one user can have several tabs).
// A user is "online" while the count is above zero.
const onlineCounts = new Map();

function setOnline(userId, online) {
    if (!io) return;
    io.emit("chat:presence", { userId, online });
}

// Pull the JWT out of the handshake cookie header ("token=...").
function extractToken(handshake) {
    const cookie = handshake?.headers?.cookie || "";
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export function initChatSocket(server) {
    io = new Server(server, {
        cors: {
            origin: FRONTEND_ORIGIN,
            credentials: true,
        },
    });

    io.use((socket, next) => {
        const token = extractToken(socket.handshake);
        if (!token) {
            return next(new Error("Unauthorized: no token provided"));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
            if (!decoded?.id) {
                return next(new Error("Unauthorized: invalid token"));
            }
            socket.user = decoded;
            next();
        } catch {
            next(new Error("Unauthorized: error verifying token"));
        }
    });

    io.on("connection", (socket) => {
        // Personal room: every message addressed to this user is delivered here.
        socket.join(`user:${socket.user.id}`);

        // Presence: first socket for this user flips them to online.
        const userId = String(socket.user.id);
        const count = (onlineCounts.get(userId) || 0) + 1;
        onlineCounts.set(userId, count);
        if (count === 1) setOnline(userId, true);

        // Typing relay: forward to the recipient's room so their UI can show
        // "X is typing…". Payload: { toUserId, isTyping, conversationId? }.
        socket.on("chat:typing", (data = {}) => {
            const to = data.toUserId ? String(data.toUserId) : null;
            if (!to || to === userId) return;
            io.to(`user:${to}`).emit("chat:typing", {
                fromUserId: userId,
                conversationId: data.conversationId || null,
                isTyping: Boolean(data.isTyping),
            });
        });

        socket.on("disconnect", () => {
            // Rooms are cleaned up automatically; presence flips to offline when
            // the last socket for this user closes.
            const remaining = (onlineCounts.get(userId) || 1) - 1;
            if (remaining <= 0) {
                onlineCounts.delete(userId);
                setOnline(userId, false);
            } else {
                onlineCounts.set(userId, remaining);
            }
        });
    });

    return io;
}

// The ids of everyone currently connected (for GET /api/chats/online).
export function getOnlineUserIds() {
    return [...onlineCounts.keys()];
}

// Push a chat event to a list of user ids. Safe to call before any socket has
// connected (no-op) — the REST layer stays fully functional without sockets.
export function emitChatUpdate(userIds, event, payload) {
    if (!io) return;
    for (const userId of userIds) {
        io.to(`user:${userId}`).emit(event, payload);
    }
}
