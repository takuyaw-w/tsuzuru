<script setup lang="ts">
import type { RuntimeState } from "@tsuzuru/core";
import { getStdVisualState } from "@tsuzuru/plugin-std-visual";
import { computed } from "vue";
import { assets } from "../../assets.js";

const props = defineProps<{
  readonly state: RuntimeState;
}>();

const visualState = computed(() => getStdVisualState(props.state));
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
</script>

<template>
  <div class="visual-layer" aria-hidden="true">
    <img v-if="background !== null" class="visual-layer__background" :src="background.url" :alt="background.label" />
    <div v-else class="visual-layer__fallback">Vue Basic</div>
    <img
      v-for="sprite in sprites"
      :key="sprite.assetId"
      class="visual-layer__sprite"
      :class="`visual-layer__sprite--${sprite.position}`"
      :src="sprite.asset?.url"
      :alt="sprite.asset?.label ?? sprite.assetId"
    />
  </div>
</template>
