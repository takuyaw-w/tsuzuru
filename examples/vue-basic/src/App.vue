<script setup lang="ts">
import type {
  CompiledTzrDocument,
  RuntimeDiagnostic,
  RuntimeEvent,
  RuntimePluginDefinition,
  RuntimeState,
} from "@tsuzuru/core";
import { createStdAudioCommandHandlers, createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdCameraCommandHandlers, createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";
import { createStdEffectCommandHandlers, createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdParticleCommandHandlers, createStdParticlePlugin } from "@tsuzuru/plugin-std-particle";
import { createStdSystemCommandHandlers, createStdSystemPlugin } from "@tsuzuru/plugin-std-system";
import {
  createStdTextSoundCommandHandlers,
  createStdTextSoundPlugin,
  getStdTextSoundState,
  resolveStdTextSoundProfile,
  shouldPlayStdTextSoundCharacter,
  type ResolveStdTextSoundProfileContext,
  type StdTextSoundState,
} from "@tsuzuru/plugin-std-text-sound";
import { createStdTextSoundPlayer } from "@tsuzuru/plugin-std-text-sound/browser";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { useRuntime } from "@tsuzuru/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { assets } from "../assets.js";
import AudioLayer from "./components/AudioLayer.vue";
import ChoiceLayer from "./components/ChoiceLayer.vue";
import EffectLayer from "./components/EffectLayer.vue";
import MessageWindow from "./components/MessageWindow.vue";
import ParticleLayer from "./components/ParticleLayer.vue";
import RuntimeControlBar from "./components/RuntimeControlBar.vue";
import VisualLayer from "./components/VisualLayer.vue";
import { type ExamplePreferences, loadPreferences, savePreferences } from "./preferences.js";
import { scenarioProject } from "./scenario.js";
import BacklogScreen from "./screens/BacklogScreen.vue";
import GalleryScreen from "./screens/GalleryScreen.vue";
import SettingsScreen from "./screens/SettingsScreen.vue";
import TitleScreen from "./screens/TitleScreen.vue";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };
type AppScreen = "title" | "runtime" | "backlog" | "settings" | "gallery";
type MessageEvent = Extract<RuntimeEvent, { type: "narration" | "dialogue" }>;
interface TextSoundCharacterEvent {
  readonly character: string;
  readonly index: number;
  readonly text: string;
}

interface BacklogEntry {
  readonly speaker: string | null;
  readonly text: string;
}

const documentResult: DocumentResult = scenarioProject.ok
  ? { ok: true, document: scenarioProject.document }
  : { ok: false, message: formatDiagnostics(scenarioProject.errors) };
const screen = ref<AppScreen>("title");
const preferences = ref<ExamplePreferences>(loadPreferences());
const diagnostics = ref<readonly RuntimeDiagnostic[]>([]);
const audioNotices = ref<readonly string[]>([]);
const backlog = ref<readonly BacklogEntry[]>([]);
let textSoundPlaybackNoticeShown = false;

const plugins: readonly RuntimePluginDefinition[] = [
  createStdVisualPlugin(),
  createStdAudioPlugin(),
  createStdTextSoundPlugin(),
  createStdEffectPlugin(),
  createStdCameraPlugin(),
  createStdParticlePlugin(),
  createStdSystemPlugin(),
];
const commandHandlers = {
  ...createStdVisualCommandHandlers(),
  ...createStdAudioCommandHandlers(),
  ...createStdTextSoundCommandHandlers(),
  ...createStdEffectCommandHandlers(),
  ...createStdCameraCommandHandlers(),
  ...createStdParticleCommandHandlers(),
  ...createStdSystemCommandHandlers(),
};
const runtime = documentResult.ok
  ? useRuntime(documentResult.document, {
      plugins,
      commandHandlers,
      autoClearWait: true,
      autoStepTransientEvents: true,
      onDiagnostic: (diagnostic) => {
        diagnostics.value = [...diagnostics.value, diagnostic];
      },
    })
  : null;

const visibleEvent = computed(() => runtime?.visibleEvent.value ?? null);
const choiceEvent = computed(() => (visibleEvent.value?.type === "choice" ? visibleEvent.value : null));
const messageEvent = computed<MessageEvent | null>(() =>
  visibleEvent.value?.type === "narration" || visibleEvent.value?.type === "dialogue" ? visibleEvent.value : null,
);
const runtimeStatus = computed(() => {
  if (runtime === null) {
    return "Scenario unavailable";
  }
  if (runtime.autoStepError.value !== null) {
    return runtime.autoStepError.value;
  }
  if (runtime.blockReason.value !== null) {
    return `Blocked: ${runtime.blockReason.value}`;
  }
  if (runtime.state.value.isStopped) {
    return "Stopped";
  }
  return runtime.event.value === null ? "Ready" : `Event: ${runtime.event.value.type}`;
});
const textSoundPlayer = createStdTextSoundPlayer({
  defaultMinIntervalMs: 45,
  onError: (error) => {
    if (!textSoundPlaybackNoticeShown) {
      textSoundPlaybackNoticeShown = true;
      addAudioNotice("Text sound playback was blocked or failed.");
    }
    console.warn("Text sound playback was blocked or failed.", error);
  },
});

onBeforeUnmount(() => {
  textSoundPlayer.destroy();
});

watch(
  messageEvent,
  (event) => {
    if (event === null) {
      return;
    }

    backlog.value = [
      ...backlog.value,
      {
        speaker: event.type === "dialogue" ? event.speaker : null,
        text: event.lines.map((line) => line.text).join("\n"),
      },
    ];
  },
  { flush: "sync" },
);

function startRuntime(): void {
  if (runtime === null) {
    return;
  }

  backlog.value = [];
  diagnostics.value = [];
  audioNotices.value = [];
  runtime.reset();
  screen.value = "runtime";
  runtime.step();
}

function advanceRuntime(): void {
  const event = visibleEvent.value;
  if (runtime === null || event === null) {
    return;
  }

  switch (event.type) {
    case "narration":
    case "dialogue":
    case "page":
      runtime.step();
      return;
    case "waitClick":
      runtime.continueClick();
      return;
    case "choice":
    case "wait":
    case "end":
    case "stop":
    case "unsupported":
    case "error":
      return;
    default:
      runtime.step();
  }
}

function chooseRuntimeItem(itemIndex: number): void {
  runtime?.choose(itemIndex);
}

function updatePreferences(nextPreferences: ExamplePreferences): void {
  preferences.value = savePreferences(nextPreferences);
}

function addAudioNotice(message: string): void {
  audioNotices.value = [...audioNotices.value.slice(-4), message];
}

function handleTextSoundCharacterReveal(event: TextSoundCharacterEvent): void {
  if (runtime === null || !preferences.value.textRevealEnabled || !preferences.value.textSoundEnabled) {
    return;
  }
  if (!shouldPlayStdTextSoundCharacter(event.character)) {
    return;
  }

  const context = getExampleTextSoundContext(visibleEvent.value);
  if (context === null) {
    return;
  }

  const profile = resolveStdTextSoundProfile(
    assets.textSound,
    getExampleTextSoundState(runtime.state.value),
    context,
  );
  if (profile === null) {
    return;
  }

  textSoundPlayer.play(profile, {
    minIntervalMs: 45,
    volume: preferences.value.textSoundVolume,
  });
}

function formatDiagnostics(errors: readonly { readonly message: string }[]): string {
  return errors.map((error) => error.message).join("\n");
}

function getExampleTextSoundState(runtimeState: RuntimeState): StdTextSoundState {
  try {
    return getStdTextSoundState(runtimeState);
  } catch {
    return { overrideProfileId: null };
  }
}

function getExampleTextSoundContext(event: RuntimeEvent | null): ResolveStdTextSoundProfileContext | null {
  if (event?.type === "narration") {
    return { kind: "narration" };
  }
  if (event?.type === "dialogue") {
    return { kind: "dialogue", speakerId: event.speaker };
  }
  return null;
}
</script>

<template>
  <main class="app">
    <pre v-if="!documentResult.ok" class="app__error">{{ documentResult.message }}</pre>

    <TitleScreen
      v-else-if="screen === 'title'"
      :can-open-backlog="backlog.length > 0"
      @start="startRuntime"
      @backlog="screen = 'backlog'"
      @settings="screen = 'settings'"
      @gallery="screen = 'gallery'"
    />

    <BacklogScreen
      v-else-if="screen === 'backlog'"
      :entries="backlog"
      @back="screen = runtime === null || runtime.event.value === null ? 'title' : 'runtime'"
    />

    <SettingsScreen
      v-else-if="screen === 'settings'"
      :preferences="preferences"
      @change="updatePreferences"
      @back="screen = runtime === null || runtime.event.value === null ? 'title' : 'runtime'"
    />

    <GalleryScreen v-else-if="screen === 'gallery'" @back="screen = 'title'" />

    <section v-else class="runtime-screen" @click.self="advanceRuntime">
      <VisualLayer v-if="runtime !== null" :state="runtime.state.value" />
      <ParticleLayer v-if="runtime !== null" :state="runtime.state.value" />
      <AudioLayer
        v-if="runtime !== null"
        :state="runtime.state.value"
        :event="runtime.event.value"
        @notice="addAudioNotice"
      />
      <EffectLayer v-if="runtime !== null" :state="runtime.state.value" />
      <RuntimeControlBar
        :status="runtimeStatus"
        @title="screen = 'title'"
        @backlog="screen = 'backlog'"
        @settings="screen = 'settings'"
        @gallery="screen = 'gallery'"
        @step="advanceRuntime"
        @reset="startRuntime"
      />
      <div class="runtime-screen__diagnostics" v-if="diagnostics.length > 0">
        <p v-for="diagnostic in diagnostics" :key="`${diagnostic.code}:${diagnostic.message}`">
          {{ diagnostic.message }}
        </p>
      </div>
      <div class="runtime-screen__audio-notices" v-if="preferences.showAudioNotices && audioNotices.length > 0">
        <p v-for="notice in audioNotices" :key="notice">{{ notice }}</p>
      </div>
      <MessageWindow
        :event="visibleEvent"
        :message-scale="preferences.messageScale"
        :reveal-enabled="preferences.textRevealEnabled"
        :characters-per-second="preferences.textSpeedCharactersPerSecond"
        @advance="advanceRuntime"
        @character-reveal="handleTextSoundCharacterReveal"
      />
      <ChoiceLayer :event="choiceEvent" @choose="chooseRuntimeItem" />
    </section>
  </main>
</template>
