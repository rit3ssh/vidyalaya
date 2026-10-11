// dotenv must load BEFORE the app module graph is evaluated: ESM evaluates all
// imports (including src/config/imagekit.js, which reads env at module load)
// before this module's body runs, so a call to dotenv.config() here would be
// too late and ImageKit would silently be "not configured".
import "dotenv/config";
import { createServer } from "http";
import app from "./src/app.js";
import connectDB from "./src/db/database.js";
import { initChatSocket } from "./src/sockets/chat.socket.js";


const PORT = process.env.PORT || 5000;


connectDB();


// Socket.IO shares the HTTP server so chat pushes ride the same port.
const server = createServer(app);
initChatSocket(server);


server.listen(PORT, () => {
  console.log(`Server is running on  http://localhost:${PORT}`);
});