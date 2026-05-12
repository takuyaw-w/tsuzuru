<script setup lang="ts">
import type { RuntimeState } from "@tsuzuru/core";
import { getStdParticleState } from "@tsuzuru/plugin-std-particle";
import { computed } from "vue";

const props = defineProps<{
  readonly state: RuntimeState;
}>();

const particleState = computed(() => getStdParticleState(props.state));
const current = computed(() => particleState.value.current);
</script>

<template>
  <div
    v-if="current !== null"
    class="particle-layer"
    :class="[`particle-layer--${current.type}`, `particle-layer--${current.intensity}`]"
    aria-hidden="true"
  />
</template>
