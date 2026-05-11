<script setup lang="ts">
import type { RuntimeEvent, RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import { computed, ref, watch } from "vue";
import { assets } from "../../assets.js";

const props = defineProps<{
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
}>();
const emit = defineEmits<{
  notice: [message: string];
}>();

const audioState = computed(() => getStdAudioState(props.state));
const bgmElement = ref<HTMLAudioElement | null>(null);

watch(
  () => audioState.value.bgm?.assetId ?? null,
  (assetId) => {
    bgmElement.value?.pause();
    bgmElement.value = null;

    if (assetId === null) {
      return;
    }

    const url = assets.audio.bgm[assetId as keyof typeof assets.audio.bgm];
    if (url === undefined) {
      emit("notice", `Missing BGM asset: ${assetId}`);
      return;
    }

    playAudio(url, true, `BGM ${assetId}`);
  },
  { flush: "post" },
);

watch(
  () => audioState.value.seEvents.at(-1)?.sequence ?? 0,
  () => {
    const event = audioState.value.seEvents.at(-1);
    if (event === undefined) {
      return;
    }
    const url = assets.audio.se[event.assetId as keyof typeof assets.audio.se];
    if (url === undefined) {
      emit("notice", `Missing SE asset: ${event.assetId}`);
      return;
    }
    playAudio(url, false, `SE ${event.assetId}`);
  },
);

watch(
  () => audioState.value.voiceEvents.at(-1)?.sequence ?? 0,
  () => {
    const event = audioState.value.voiceEvents.at(-1);
    if (event === undefined) {
      return;
    }
    const url = assets.audio.voice[event.assetId as keyof typeof assets.audio.voice];
    if (url === undefined) {
      emit("notice", `Missing voice asset: ${event.assetId}`);
      return;
    }
    playAudio(url, false, `voice ${event.assetId}`);
  },
);

function playAudio(url: string, loop: boolean, label: string): void {
  if (typeof Audio === "undefined") {
    emit("notice", `${label} skipped because Audio is unavailable.`);
    return;
  }

  const audio = new Audio(url);
  audio.loop = loop;
  if (loop) {
    bgmElement.value = audio;
  }

  void audio.play().catch(() => {
    emit("notice", `${label} could not be played; continuing without audio.`);
  });
}
</script>

<template>
  <span class="audio-layer" aria-hidden="true" />
</template>
