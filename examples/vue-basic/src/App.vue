<script setup lang="ts">
import type { CompiledTzrDocument, RuntimeDiagnostic, RuntimeEvent, RuntimePluginDefinition } from "@tsuzuru/core";
import { createStdAudioCommandHandlers, createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { useRuntime } from "@tsuzuru/vue";
import { computed, ref, watch } from "vue";
import AudioLayer from "./components/AudioLayer.vue";
import ChoiceLayer from "./components/ChoiceLayer.vue";
import MessageWindow from "./components/MessageWindow.vue";
import RuntimeControlBar from "./components/RuntimeControlBar.vue";
import VisualLayer from "./components/VisualLayer.vue";
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

interface BacklogEntry {
  readonly speaker: string | null;
  readonly text: string;
}

interface Preferences {
  readonly messageScale: number;
  readonly showAudioNotices: boolean;
}

const documentResult: DocumentResult = scenarioProject.ok
  ? { ok: true, document: scenarioProject.document }
  : { ok: false, message: formatDiagnostics(scenarioProject.errors) };
const screen = ref<AppScreen>("title");
const preferences = ref<Preferences>({
  messageScale: 1,
  showAudioNotices: true,
});
const diagnostics = ref<readonly RuntimeDiagnostic[]>([]);
const audioNotices = ref<readonly string[]>([]);
const backlog = ref<readonly BacklogEntry[]>([]);

const plugins: readonly RuntimePluginDefinition[] = [createStdVisualPlugin(), createStdAudioPlugin()];
const commandHandlers = {
  ...createStdVisualCommandHandlers(),
  ...createStdAudioCommandHandlers(),
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

function updatePreferences(nextPreferences: Preferences): void {
  preferences.value = nextPreferences;
}

function addAudioNotice(message: string): void {
  audioNotices.value = [...audioNotices.value.slice(-4), message];
}

function formatDiagnostics(errors: readonly { readonly message: string }[]): string {
  return errors.map((error) => error.message).join("\n");
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
      <AudioLayer
        v-if="runtime !== null"
        :state="runtime.state.value"
        :event="runtime.event.value"
        @notice="addAudioNotice"
      />
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
        @advance="advanceRuntime"
      />
      <ChoiceLayer :event="choiceEvent" @choose="chooseRuntimeItem" />
    </section>
  </main>
</template>
