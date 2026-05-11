<script setup lang="ts">
defineProps<{
  readonly entries: readonly {
    readonly speaker: string | null;
    readonly text: string;
  }[];
}>();
const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <section class="screen screen--panel">
    <div class="screen__inner panel-screen">
      <h1>Backlog</h1>
      <ol v-if="entries.length > 0" class="backlog-list">
        <li v-for="(entry, index) in entries" :key="index" class="backlog-list__entry">
          <p v-if="entry.speaker !== null" class="backlog-list__speaker">{{ entry.speaker }}</p>
          <p>{{ entry.text }}</p>
        </li>
      </ol>
      <p v-else class="panel-screen__empty">No messages yet.</p>
      <button type="button" @click="emit('back')">Back</button>
    </div>
  </section>
</template>
