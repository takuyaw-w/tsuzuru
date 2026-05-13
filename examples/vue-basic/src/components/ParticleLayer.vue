<script setup lang="ts">
import type { RuntimeState } from "@tsuzuru/core";
import { getStdParticleState } from "@tsuzuru/plugin-std-particle";
import { computed } from "vue";
import { getParticleSpecs, particleLayerClassName, particleStyleProperties } from "../particle-presentation.js";

const props = defineProps<{
  readonly state: RuntimeState;
}>();

const particleState = computed(() => getStdParticleState(props.state));
const current = computed(() => particleState.value.current);
const particles = computed(() =>
  current.value === null ? [] : getParticleSpecs(current.value.type, current.value.intensity),
);
const className = computed(() => (current.value === null ? "particle-layer" : particleLayerClassName(current.value)));
</script>

<template>
  <div v-if="current !== null" :class="className" aria-hidden="true">
    <span
      v-for="particle in particles"
      :key="particle.id"
      class="particle-layer__particle"
      :style="particleStyleProperties(particle)"
    />
  </div>
</template>
