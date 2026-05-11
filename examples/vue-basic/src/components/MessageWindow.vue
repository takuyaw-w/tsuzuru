<script setup lang="ts">
import type { RuntimeEvent } from "@tsuzuru/core";
import { computed } from "vue";

const props = defineProps<{
  readonly event: RuntimeEvent | null;
  readonly messageScale: number;
}>();
const emit = defineEmits<{
  advance: [];
}>();

const messageStyle = computed(() => ({
  fontSize: `${props.messageScale}rem`,
}));
const lines = computed(() => {
  if (props.event?.type !== "narration" && props.event?.type !== "dialogue") {
    return [];
  }
  return props.event.lines;
});
const speaker = computed(() => (props.event?.type === "dialogue" ? props.event.speaker : null));
const status = computed(() => {
  switch (props.event?.type) {
    case "wait":
      return `Waiting ${props.event.durationMs}ms`;
    case "waitClick":
      return "Waiting for click";
    case "page":
      return "Page break";
    case "end":
      return "End";
    case "stop":
      return "Stopped";
    case "error":
      return props.event.message;
    case "unsupported":
      return `Unsupported instruction: ${props.event.instructionType}`;
    default:
      return null;
  }
});
</script>

<template>
  <section class="message-window" :style="messageStyle" @click.stop="emit('advance')">
    <template v-if="event?.type === 'narration' || event?.type === 'dialogue'">
      <p v-if="speaker !== null" class="message-window__speaker">{{ speaker }}</p>
      <p v-for="(line, index) in lines" :key="index" class="message-window__line">{{ line.text }}</p>
      <p class="message-window__hint">Click</p>
    </template>
    <p v-else-if="status !== null" class="message-window__status">{{ status }}</p>
    <p v-else class="message-window__status">Ready</p>
  </section>
</template>
