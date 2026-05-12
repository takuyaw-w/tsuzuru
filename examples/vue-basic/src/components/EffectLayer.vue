<script setup lang="ts">
import type { RuntimeState } from "@tsuzuru/core";
import { getStdEffectState, type StdEffectEvent } from "@tsuzuru/plugin-std-effect";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  readonly state: RuntimeState;
}>();

interface ActiveFlash {
  readonly sequence: number;
  readonly color: string;
  readonly durationMs: number;
}

type EffectTargetSelector = ".runtime-screen" | ".message-window" | ".visual-layer__sprites";

const effectState = computed(() => getStdEffectState(props.state));
const flashes = ref<readonly ActiveFlash[]>([]);
const timers = new Set<number>();
let lastConsumedSequence = 0;

watch(
  () => [effectState.value.events, effectState.value.nextSequence] as const,
  ([events, nextSequence]) => {
    if (events.length === 0 && nextSequence <= lastConsumedSequence) {
      lastConsumedSequence = nextSequence - 1;
    }

    for (const event of events) {
      if (event.sequence <= lastConsumedSequence) {
        continue;
      }
      lastConsumedSequence = event.sequence;
      if (event.type === "flash") {
        activateFlash(event);
      } else {
        activateElementEffect(event);
      }
    }
  },
  { flush: "post" },
);

onBeforeUnmount(() => {
  for (const timer of timers) {
    window.clearTimeout(timer);
  }
  timers.clear();
});

function activateFlash(event: Extract<StdEffectEvent, { readonly type: "flash" }>): void {
  flashes.value = [
    ...flashes.value,
    { sequence: event.sequence, color: event.color, durationMs: event.durationMs },
  ];
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    flashes.value = flashes.value.filter((flash) => flash.sequence !== event.sequence);
  }, Math.max(1, event.durationMs));
  timers.add(timer);
}

function activateElementEffect(event: Exclude<StdEffectEvent, { readonly type: "flash" }>): void {
  const element = document.querySelector<HTMLElement>(targetSelector(event.target));
  if (element === null) {
    return;
  }

  const className = effectClassName(event);
  element.style.setProperty("--tzr-effect-duration", `${event.durationMs}ms`);
  if (event.type === "blur") {
    element.style.setProperty("--tzr-effect-blur-amount", `${event.amount}px`);
  }
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);

  const timer = window.setTimeout(() => {
    timers.delete(timer);
    element.classList.remove(className);
    element.style.removeProperty("--tzr-effect-duration");
    if (event.type === "blur") {
      element.style.removeProperty("--tzr-effect-blur-amount");
    }
  }, Math.max(1, event.durationMs));
  timers.add(timer);
}

function targetSelector(target: Exclude<StdEffectEvent, { readonly type: "flash" }>["target"]): EffectTargetSelector {
  switch (target) {
    case "screen":
      return ".runtime-screen";
    case "message":
      return ".message-window";
    case "sprites":
      return ".visual-layer__sprites";
  }
}

function effectClassName(event: Exclude<StdEffectEvent, { readonly type: "flash" }>): string {
  switch (event.type) {
    case "shake":
      return `std-effect--shake-${event.intensity}`;
    case "pulse":
      return `std-effect--pulse-${event.intensity}`;
    case "blur":
      return "std-effect--blur";
  }
}
</script>

<template>
  <div class="effect-layer" aria-hidden="true">
    <span
      v-for="flash in flashes"
      :key="flash.sequence"
      class="effect-layer__flash"
      :style="{
        '--tzr-effect-duration': `${flash.durationMs}ms`,
        '--tzr-effect-flash-color': flash.color,
      }"
    />
  </div>
</template>
