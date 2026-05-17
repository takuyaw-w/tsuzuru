<script setup lang="ts">
import type { RuntimeEvent } from "@tsuzuru/core";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  readonly event: RuntimeEvent | null;
  readonly messageScale: number;
  readonly revealEnabled: boolean;
  readonly charactersPerSecond: number;
}>();
const emit = defineEmits<{
  advance: [];
  characterReveal: [event: { readonly character: string; readonly index: number; readonly text: string }];
}>();

let revealTimer: ReturnType<typeof setTimeout> | null = null;
const visibleCharacterCount = ref(0);
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
const fullText = computed(() => lines.value.map((line) => line.text).join("\n"));
const shouldRevealOverTime = computed(
  () =>
    props.revealEnabled &&
    props.charactersPerSecond > 0 &&
    (props.event?.type === "narration" || props.event?.type === "dialogue"),
);
const isRevealComplete = computed(() => visibleCharacterCount.value >= fullText.value.length);
const visibleLines = computed(() => splitVisibleLines(lines.value, fullText.value.slice(0, visibleCharacterCount.value)));
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

watch(
  [fullText, shouldRevealOverTime],
  () => {
    clearRevealTimer();
    visibleCharacterCount.value = shouldRevealOverTime.value ? 0 : fullText.value.length;
  },
  { immediate: true },
);

watch(
  [fullText, shouldRevealOverTime, visibleCharacterCount],
  (_value, _oldValue, onCleanup) => {
    if (!shouldRevealOverTime.value || visibleCharacterCount.value >= fullText.value.length) {
      return;
    }

    const delayMs = 1000 / props.charactersPerSecond;
    const timer = setTimeout(() => {
      const nextIndex = visibleCharacterCount.value;
      emit("characterReveal", {
        character: fullText.value.charAt(nextIndex),
        index: nextIndex,
        text: fullText.value,
      });
      visibleCharacterCount.value = Math.min(fullText.value.length, visibleCharacterCount.value + 1);
    }, delayMs);
    revealTimer = timer;
    onCleanup(() => {
      if (revealTimer === timer) {
        revealTimer = null;
      }
      clearTimeout(timer);
    });
  },
  { immediate: true },
);

onBeforeUnmount(clearRevealTimer);

function handleClick(): void {
  if ((props.event?.type === "narration" || props.event?.type === "dialogue") && !isRevealComplete.value) {
    clearRevealTimer();
    visibleCharacterCount.value = fullText.value.length;
    return;
  }

  emit("advance");
}

function clearRevealTimer(): void {
  if (revealTimer === null) {
    return;
  }
  clearTimeout(revealTimer);
  revealTimer = null;
}

function splitVisibleLines(
  sourceLines: readonly { readonly text: string }[],
  visibleText: string,
): readonly string[] {
  const result: string[] = [];
  let start = 0;
  for (const line of sourceLines) {
    const end = start + line.text.length;
    result.push(visibleText.slice(start, Math.min(end, visibleText.length)));
    start = end + 1;
  }
  return result;
}
</script>

<template>
  <section class="message-window" :style="messageStyle" @click.stop="handleClick">
    <template v-if="event?.type === 'narration' || event?.type === 'dialogue'">
      <p v-if="speaker !== null" class="message-window__speaker">{{ speaker }}</p>
      <div class="message-window__lines">
        <p v-for="(_line, index) in lines" :key="index" class="message-window__line">
          {{ visibleLines[index] ?? "" }}
        </p>
      </div>
      <p class="message-window__hint">Click</p>
    </template>
    <p v-else-if="status !== null" class="message-window__status">{{ status }}</p>
    <p v-else class="message-window__status">Ready</p>
  </section>
</template>
