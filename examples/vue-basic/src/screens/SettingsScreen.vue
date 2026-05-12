<script setup lang="ts">
import type { ExamplePreferences, TextSpeedCharactersPerSecond } from "../preferences.js";
import { TEXT_SPEED_OPTIONS } from "../preferences.js";

const props = defineProps<{
  readonly preferences: ExamplePreferences;
}>();
const emit = defineEmits<{
  change: [preferences: ExamplePreferences];
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

function updateTextReveal(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  emit("change", {
    ...props.preferences,
    textRevealEnabled: input.checked,
  });
}

function updateTextSpeed(event: Event): void {
  const input = event.currentTarget as HTMLSelectElement;
  emit("change", {
    ...props.preferences,
    textSpeedCharactersPerSecond: parseTextSpeedCharactersPerSecond(input.value),
  });
}

function updateTextSound(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  emit("change", {
    ...props.preferences,
    textSoundEnabled: input.checked,
  });
}

function updateTextSoundVolume(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  emit("change", {
    ...props.preferences,
    textSoundVolume: Number(input.value),
  });
}

function parseTextSpeedCharactersPerSecond(value: string): TextSpeedCharactersPerSecond {
  const parsedValue = Number(value);
  return TEXT_SPEED_OPTIONS.includes(parsedValue as TextSpeedCharactersPerSecond)
    ? (parsedValue as TextSpeedCharactersPerSecond)
    : 60;
}

function formatTextSpeedLabel(charactersPerSecond: TextSpeedCharactersPerSecond): string {
  if (charactersPerSecond === 30) {
    return "Slow";
  }
  if (charactersPerSecond === 120) {
    return "Fast";
  }
  return "Normal";
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
        <span>Text reveal</span>
        <input type="checkbox" :checked="preferences.textRevealEnabled" @change="updateTextReveal" />
      </label>
      <label class="settings-field">
        <span>Text speed</span>
        <select :value="preferences.textSpeedCharactersPerSecond" @change="updateTextSpeed">
          <option v-for="value in TEXT_SPEED_OPTIONS" :key="value" :value="value">
            {{ formatTextSpeedLabel(value) }}
          </option>
        </select>
      </label>
      <label class="settings-field settings-field--inline">
        <span>Text sound</span>
        <input type="checkbox" :checked="preferences.textSoundEnabled" @change="updateTextSound" />
      </label>
      <label class="settings-field">
        <span>Text sound volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="preferences.textSoundVolume"
          @input="updateTextSoundVolume"
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
