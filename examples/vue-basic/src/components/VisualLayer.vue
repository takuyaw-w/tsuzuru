<script setup lang="ts">
import type { RuntimeState } from "@tsuzuru/core";
import { getStdCameraState, type StdCameraEasing } from "@tsuzuru/plugin-std-camera";
import { getStdVisualState, type StdVisualSpritePosition } from "@tsuzuru/plugin-std-visual";
import { computed } from "vue";
import { assets } from "../../assets.js";

const props = defineProps<{
  readonly state: RuntimeState;
}>();

const visualState = computed(() => getStdVisualState(props.state));
const cameraState = computed(() => getStdCameraState(props.state));
const background = computed(() => {
  const assetId = visualState.value.background?.assetId;
  return assetId === undefined ? null : (assets.visual.backgrounds[assetId as keyof typeof assets.visual.backgrounds] ?? null);
});
const sprites = computed(() =>
  Object.entries(visualState.value.sprites).map(([assetId, sprite]) => ({
    assetId,
    position: sprite.position,
    asset: assets.visual.sprites[assetId as keyof typeof assets.visual.sprites] ?? null,
  })),
);
const cameraStyle = computed(() => {
  const camera = cameraState.value;
  const focusOffsetX =
    camera.focusTarget === null ? 0 : cameraFocusOffsetX(visualState.value.sprites[camera.focusTarget]?.position);
  const transition = camera.transition;

  return {
    "--tzr-camera-x": `${camera.x + focusOffsetX}px`,
    "--tzr-camera-y": `${camera.y}px`,
    "--tzr-camera-zoom": String(camera.zoom),
    "--tzr-camera-duration": transition === null ? "0ms" : `${transition.durationMs}ms`,
    "--tzr-camera-easing": transition === null ? "ease" : toCssCameraEasing(transition.easing),
  };
});

function cameraFocusOffsetX(position: StdVisualSpritePosition | undefined): number {
  switch (position) {
    case "left":
      return 160;
    case "right":
      return -160;
    case "center":
    case undefined:
      return 0;
  }
}

function toCssCameraEasing(easing: StdCameraEasing): string {
  switch (easing) {
    case "linear":
      return "linear";
    case "easeIn":
      return "ease-in";
    case "easeOut":
      return "ease-out";
    case "ease":
      return "ease";
  }
}
</script>

<template>
  <div class="visual-layer" aria-hidden="true">
    <div class="visual-layer__camera" :style="cameraStyle">
      <img v-if="background !== null" class="visual-layer__background" :src="background.url" :alt="background.label" />
      <div v-else class="visual-layer__fallback">Vue Basic</div>
      <div class="visual-layer__sprites" aria-hidden="true">
        <img
          v-for="sprite in sprites"
          :key="sprite.assetId"
          class="visual-layer__sprite"
          :class="`visual-layer__sprite--${sprite.position}`"
          :src="sprite.asset?.url"
          :alt="sprite.asset?.label ?? sprite.assetId"
        />
      </div>
    </div>
  </div>
</template>
