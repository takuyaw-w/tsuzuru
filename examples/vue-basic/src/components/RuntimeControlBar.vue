<script setup lang="ts">
defineProps<{
  readonly status: string;
  readonly canLoad: boolean;
}>();
const emit = defineEmits<{
  title: [];
  backlog: [];
  settings: [];
  gallery: [];
  save: [];
  load: [];
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
    <button type="button" @click.stop="emit('save')">Save</button>
    <button type="button" :disabled="!canLoad" @click.stop="emit('load')">Load</button>
    <button type="button" @click.stop="emit('step')">Step</button>
    <button type="button" @click.stop="emit('reset')">Reset</button>
    <output>{{ status }}</output>
  </nav>
</template>
