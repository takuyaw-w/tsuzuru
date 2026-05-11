<script setup lang="ts">
defineProps<{
  readonly status: string;
}>();
const emit = defineEmits<{
  title: [];
  backlog: [];
  settings: [];
  gallery: [];
  step: [];
  reset: [];
}>();
</script>

<template>
  <nav class="runtime-control-bar" aria-label="Runtime controls">
    <button type="button" @click.stop="emit('title')">Title</button>
    <button type="button" @click.stop="emit('backlog')">Backlog</button>
    <button type="button" @click.stop="emit('settings')">Settings</button>
    <button type="button" @click.stop="emit('gallery')">Gallery</button>
    <button type="button" @click.stop="emit('step')">Step</button>
    <button type="button" @click.stop="emit('reset')">Reset</button>
    <output>{{ status }}</output>
  </nav>
</template>
