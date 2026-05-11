<script setup lang="ts">
import type { ChoiceRuntimeEvent } from "@tsuzuru/core";

defineProps<{
  readonly event: ChoiceRuntimeEvent | null;
}>();
const emit = defineEmits<{
  choose: [itemIndex: number];
}>();
</script>

<template>
  <section v-if="event !== null" class="choice-layer" aria-label="Choices">
    <p class="choice-layer__question">{{ event.question }}</p>
    <button
      v-for="(item, index) in event.items"
      :key="item.id ?? item.text"
      class="choice-layer__button"
      type="button"
      @click.stop="emit('choose', index)"
    >
      {{ item.text }}
    </button>
  </section>
</template>
