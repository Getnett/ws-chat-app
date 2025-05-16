// chatApp.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import amqp from "amqplib";
import redis from "redis";

/**
 * RabbitMQManager handles connection to RabbitMQ,
 * publishing and consuming messages.
 */
class RabbitMQManager {
  constructor(url) {
    this.url = url;
    this.channel = null;
  }

  async connect() {
    try {
      const connection = await amqp.connect(this.url);
      this.channel = await connection.createChannel();
      await this.channel.assertQueue("chat_messages", { durable: false });
      console.log("Connected to RabbitMQ");
    } catch (err) {
      console.error("RabbitMQ connection error:", err);
    }
  }

  sendMessage(message) {
    if (this.channel) {
      this.channel.sendToQueue(
        "chat_messages",
        Buffer.from(JSON.stringify(message))
      );
    } else {
      console.error("RabbitMQ channel not available");
    }
  }

  consumeMessages(callback) {
    if (!this.channel) return;
    this.channel.consume("chat_messages", (msg) => {
      if (msg !== null) {
        try {
          const payload = JSON.parse(msg.content.toString());
          callback(payload);
          this.channel.ack(msg);
        } catch (err) {
          console.error("Error processing message:", err);
          this.channel.nack(msg);
        }
      }
    });
  }
}

/**
 * ChatPairManager is responsible for pairing two users and cleaning up pairings.
 */
class ChatPairManager {
  constructor(sockets) {
    this.waitingSocket = null;
    this.pairings = {}; // mapping: socket.id => partnerSocket
    this.socketsConnected = [];
    console.log("this.socketsConnected", this.socketsConnected);
  }

  pairSocket(socket) {
    console.log("this.socketsConnected-pairSocket", this.socketsConnected);
    console.log("waiting", this.waitingSocket);
    // console.log(
    //   "finsing",
    //   this.socketsConnected.find(
    //     (socketP) => socketP.connected && this.waitingSocket.id !== socketP.id
    //   )
    // );
    if (this.waitingSocket && this.waitingSocket.id !== socket.id) {
      console.log("pair-Socket");
      // Pair the waiting socket with the current one.
      this.pairings[this.waitingSocket.id] = socket;
      this.pairings[socket.id] = this.waitingSocket;
      const partnerSocket = this.waitingSocket;
      this.waitingSocket = null;
      // console.log("pairings", this.pairings);
      // console.log("pairSocket()", { paired: true, partner: partnerSocket });
      // console.log("partnerSocket", partnerSocket);
      return { paired: true, partner: partnerSocket };
    } else if (
      !this.waitingSocket &&
      this.socketsConnected.find(
        (socketP) => socketP.connected && socketP.id !== socket.id
      )
    ) {
      console.log("Second logic");
      const socketToPair = this.socketsConnected.find(
        (socketP) => socketP.connected && socketP.id !== socket.id
      );
      this.waitingSocket = socket;
      this.pairings[this.waitingSocket.id] = socketToPair;
      this.pairings[socketToPair.id] = this.waitingSocket;
      const partnerSocket = this.waitingSocket;
      this.waitingSocket = null;
      // console.log("pairings", this.pairings);
      // console.log("pairSocket()", { paired: true, partner: partnerSocket });
      // console.log("partnerSocket", partnerSocket);
      return { paired: true, partner: partnerSocket };
    } else {
      console.log("Mark it as waiting");
      // No partner yet; mark as waiting.
      this.waitingSocket = socket;
      return { paired: false };
    }
  }

  removeSocket(socket) {
    // If socket was waiting, clear it.
    if (this.waitingSocket && this.waitingSocket.id === socket.id) {
      this.waitingSocket = null;
    }
    // If socket had a pairing, remove the pairing.
    const partner = this.pairings[socket.id];
    if (partner) {
      delete this.pairings[partner.id];
      delete this.pairings[socket.id];
      return partner;
    }
    return null;
  }

  getPartner(socketId) {
    return this.pairings[socketId];
  }

  setSockets(socket) {
    console.dir("sockets before", this.socketsConnected);
    console.log("new socket added", socket);

    this.socketsConnected.push(socket);
  }
}

/**
 * ChatServer acts as a Facade to orchestrate Socket.IO, RabbitMQ, and Redis.
 */
class ChatServer {
  constructor(port, rabbitUrl, redisPort) {
    this.port = port || 3000;
    this.app = express();
    this.server = createServer(this.app);

    this.io = new Server(this.server, {
      cors: {
        origin: "*",
      },
    });
    this.rabbitManager = new RabbitMQManager(rabbitUrl);
    this.pairManager = new ChatPairManager();
  }

  async start() {
    await this.rabbitManager.connect();
    this.rabbitManager.consumeMessages((payload) =>
      this.handleRabbitMessage(payload)
    );

    this.io.on("connection", (socket) => {
      console.dir(socket.handshake.headers);
      console.dir(`User connected: ${socket.handshake.headers}`);

      this.pairManager.setSockets(socket);
      this.handleConnection(socket);
    });

    this.server.listen(this.port, () => {
      console.log(`Chat server running on port ${this.port}`);
    });
  }

  handleConnection(socket) {
    // Pair the user.
    const pairing = this.pairManager.pairSocket(socket);
    if (pairing.paired) {
      socket.emit("paired", { partner: pairing.partner.id });
      pairing.partner.emit("paired", { partner: socket.id });
    } else {
      socket.emit("waiting", { message: "Waiting for a partner..." });
    }

    // Listen for chat messages.
    socket.on("chatMessage", (msg) => {
      console.log("msg", msg);
      const partner = this.pairManager.getPartner(socket.id);
      if (!partner) {
        socket.emit("error", { message: "No partner connected." });
        return;
      }
      const payload = {
        from: socket.id,
        to: partner.id,
        message: msg,
        timestamp: Date.now(),
      };
      this.rabbitManager.sendMessage(payload);
    });

    // On disconnect, clean up and notify the partner.
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);

      const partner = this.pairManager.removeSocket(socket);

      if (partner) {
        partner.emit("partnerDisconnected", {
          message: "Your partner has disconnected.",
        });
      }
    });
  }

  handleRabbitMessage(payload) {
    // Deliver message in real time if recipient is connected.
    const recipientSocket = this.io.sockets.sockets.get(payload.to);
    if (recipientSocket) {
      recipientSocket.emit("chatMessage", payload);
    }
  }
}

// Instantiate and start the chat server.
const chatServer = new ChatServer(3000, "amqp://localhost", 6379);
chatServer.start();
