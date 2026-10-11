// Singleton Socket.IO client for live chat push.
//
// Connects to the same backend the REST API uses (api.js baseURL) and sends
// the httpOnly `token` cookie with the handshake so the server can
// authenticate the connection. One connection per browser tab.

import { io } from "socket.io-client";

const BACKEND_URL = "http://localhost:4000";

const socket = io(BACKEND_URL, {
    withCredentials: true,
    // Never connect before the user is logged in: the server authenticates the
    // handshake with the httpOnly token cookie, which only exists after login.
    // App.jsx calls socket.connect() once the user is set (and disconnect() on
    // logout). Connecting earlier gets stuck in a rejected-handshake loop.
    autoConnect: false,
    // Reconnect automatically when the server restarts or the network drops.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

export default socket;
