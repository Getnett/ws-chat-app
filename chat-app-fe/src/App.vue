<template>
  <div class="h-full py-4 px-4">
    <main
      class="h-full shadow-lg bg-white flex flex-col pb-4 border-1 border-gray-100"
    >
      <div
        class="px-2 shadow-md py-4 flex gap-10 items-center border-b-1 border-gray-50"
      >
        <h3 class="font-bold text-3xl text-orange-400 italic font-sans">
          Talk to strangers
        </h3>
        <SocketIOConnectionState />
      </div>

      <div class="flex-1 px-4">
        <ul class="py-4" ref="messageContainer"></ul>
      </div>

      <div
        class="border-t-2 border-gray-100 flex justify-between gap-2 pt-2 px-2"
      >
        <button
          @click.prevent="handleConnectionToServer"
          class="py-1 px-2 md:py-4 md:px-8 border-2 bg-green-500 text-white uppercase text-sm md:text-2xl cursor-pointer rounded-md"
        >
          start
        </button>
        <div class="flex-1 flex items-center" id="input-wrapper">
          <input
            class="border-2 border-gray-100 flex-1 h-full placeholder:text-sm md:placeholder:text-base px-2 md:px-4 text-base md:text-xl text-gray-500 focus:outline-0"
            type="text"
            name="input-chat"
            v-model="message"
            id="chat-input"
            placeholder="Type a message here"
          />
        </div>
        <button
          @click.prevent="sendMessageToRandomUser"
          class="py-1 px-2 md:py-4 md:px-8 border-2 bg-blue-400 text-white uppercase text-sm md:text-2xl cursor-pointer rounded-md"
        >
          send
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
// client.js
import { ref, watch } from "vue";
import { socket, state } from "./socket";
import SocketIOConnectionState from "./components/SocketIOConnectionState.vue";
import { useToast } from "vue-toast-notification";
import "vue-toast-notification/dist/theme-sugar.css";

const message = ref("");
const messageContainer = ref(null);
let counter = 0;
const toast = useToast();

function handleConnectionToServer() {
  socket.connect();
}

function sendEventManually(socketArg, event, arg) {
  socketArg.timeout(5000).emit("chat messages", message.value, (err) => {
    if (err) {
      sendEventManually(socket, event, arg);
    }
  });
}

function sendMessageToRandomUser() {
  // const clientOffset = `${socket.id}-${counter++}`;
  // console.log("clientOffset", "");
  // sendEventManually(socket, "chat messages", message.value);
  // socket.timeout(5000).emit("chat messages", message.value, (err) => {});
  // console.log("Proof of uniqueness", clientOffset);

  if (message.value) {
    const listItem = document.createElement("li");
    listItem.textContent = `You : ${message.value}`;
    messageContainer.value.appendChild(listItem);
  }
  socket.emit("chatMessage", message.value);

  message.value = "";
}

watch(state, () => {
  console.log("state", state.messages);
});

socket.on("chatMessage", (msg) => {
  console.log("msg : ", msg);
  // console.log("svOffset", svOffset);
  // // @ts-ignore
  // socket.auth.serverOffset = svOffset;

  // const payload = {
  //       from: socket.id,
  //       to: partner.id,
  //       message: msg,
  //       timestamp: Date.now(),
  //     };

  if (messageContainer.value) {
    const listItem = document.createElement("li");
    listItem.textContent = `Stranger : ${msg.message}`;
    messageContainer.value.appendChild(listItem);
  }

  console.log(" socket.auth.serverOffset", socket.auth.serverOffset);
});

socket.on("partnerDisconnected", (msg) => {
  toast.warning(`${msg.message}`);
});

socket.on("paired", (msg) => {
  toast.success("You have a match ,you can start to talk");
});

socket.on("waiting", (msg) => {
  toast.info(msg.message);
});
socket.on("error", (msg) => {
  toast.info(`${msg.message}`);
});

//  socket.emit("paired", { partner: pairing.partner.id });
</script>

<style scoped></style>
