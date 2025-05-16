import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const app = express();
const httpServer = createServer(app);
// WebSocket will be on the same server as http server
// and also provides fallback transports(polling for the server)

const db = await open({
  filename: "chat.db",
  driver: sqlite3.Database,
});

await db.exec(`CREATE TABLE IF NOT EXISTS messages(
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     client_offset TEXT UNIQUE,
     content TEXT
  
  );`);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  connectionStateRecovery: {},
});

io.on("connection", async (socket) => {
  console.log("Client is connected!", socket.id);
  socket.on("chat messages", async (msg, callback) => {
    let result;
    try {
      result = await db.run(`INSERT INTO messages (content) VALUES (?)`, msg);
    } catch (error) {
      return error;
    }

    callback({ status: "ok" });
    console.log("!socket.recovered---chat--one", !socket.recovered);
    console.log("result-lastID", result.lastID);
    io.emit("chat messages", msg, result.lastID);
  });

  console.log("socket", socket.handshake.auth);
  console.log("!socket.recovered--connection", !socket.recovered);
  if (!socket.recovered) {
    console.log("if--socket.recovered", !socket.recovered);
    try {
      //  await db.each('SELECT id, content FROM messages WHERE id > ?',
      await db.each(
        `SELECT id, content FROM messages WHERE id > ?`,
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {
          socket.emit("chat messages", row.content, row.id);
        }
      );
    } catch (error) {
      // Something went wrong
    }
  }
  socket.on("disconnect", () => {
    console.log("client is disconnected", socket.id);
  });
});

app.get("/", (req, res) => {
  res.status(200).send({ msg: "chat server" });
});

httpServer.listen(3000, () => {
  console.log("Server is running...");
});
