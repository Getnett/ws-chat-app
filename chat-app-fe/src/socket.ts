import { reactive, ref } from "vue";
import { io } from "socket.io-client";

export const state = reactive({
  connected: false,
  messages: [],
});

const SOCKET_IO_SERVER_URL = "http://localhost:3000";

export const socket = io(SOCKET_IO_SERVER_URL, {
  autoConnect: false,
  auth: {
    serverOffset: 0,
  },
  // ackTimeout: 1000,
  // retries: 3,
});

socket.on("connect", () => {
  state.connected = true;
});

socket.on("disconnect", () => {
  state.connected = false;
});
