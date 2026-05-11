<script setup lang="ts">
const props = defineProps<{
  readonly preferences: {
    readonly messageScale: number;
    readonly showAudioNotices: boolean;
  };
}>();
const emit = defineEmits<{
  change: [
    preferences: {
      readonly messageScale: number;
      readonly showAudioNotices: boolean;
    },
  ];
  back: [];
}>();

function updateMessageScale(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  emit("change", {
    ...props.preferences,
    messageScale: Number(input.value),
  });
}

function updateAudioNotices(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  emit("change", {
    ...props.preferences,
    showAudioNotices: input.checked,
  });
}
</script>

<template>
  <section class="screen screen--panel">
    <div class="screen__inner panel-screen">
      <h1>Settings</h1>
      <label class="settings-field">
        <span>Message size</span>
        <input
          type="range"
          min="0.9"
          max="1.3"
          step="0.05"
          :value="preferences.messageScale"
          @input="updateMessageScale"
        />
      </label>
      <label class="settings-field settings-field--inline">
        <span>Audio notices</span>
        <input type="checkbox" :checked="preferences.showAudioNotices" @change="updateAudioNotices" />
      </label>
      <button type="button" @click="emit('back')">Back</button>
    </div>
  </section>
</template>
