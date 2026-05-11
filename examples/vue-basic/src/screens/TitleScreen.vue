<script setup lang="ts">
defineProps<{
  readonly canOpenBacklog: boolean;
}>();
const emit = defineEmits<{
  start: [];
  backlog: [];
  settings: [];
  gallery: [];
}>();
</script>

<template>
  <section class="screen screen--title">
    <div class="screen__inner title-screen">
      <p class="screen__eyebrow">Tsuzuru example</p>
      <h1>Tsuzuru Vue Basic</h1>
      <p class="title-screen__copy">Vue SFC と Composition API で core runtime を再生する最小構成。</p>
      <nav class="title-screen__menu" aria-label="Title menu">
        <button type="button" @click="emit('start')">Start</button>
        <button type="button" :disabled="!canOpenBacklog" @click="emit('backlog')">Backlog</button>
        <button type="button" @click="emit('settings')">Settings</button>
        <button type="button" @click="emit('gallery')">Gallery</button>
      </nav>
    </div>
  </section>
</template>
