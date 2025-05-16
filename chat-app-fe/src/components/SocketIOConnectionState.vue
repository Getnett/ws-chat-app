<template>
  <div class="text-gray-500 font-base font-light">
    <div v-if="connectionState" class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-green-500" />
      In chat
    </div>
    <div v-if="!connectionState" class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-gray-500" />
      Idle
    </div>
  </div>
</template>

<script setup>
import { state } from "@/socket";
import { computed } from "vue";

const connectionState = computed(() => {
  return state.connected;
});
</script>
