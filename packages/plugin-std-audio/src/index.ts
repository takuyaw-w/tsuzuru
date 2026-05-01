import type { RuntimePluginDefinition, RuntimeState } from "@tsuzuru/core";

const STD_AUDIO_PLUGIN_NAME = "stdAudio";
declare const STD_AUDIO_SE_EVENT_BRAND: unique symbol;
declare const STD_AUDIO_VOICE_EVENT_BRAND: unique symbol;

export interface StdAudioBgm {
  readonly assetId: string;
}

export type StdAudioSeEvent = {
  readonly assetId: string;
  readonly sequence: number;
  readonly [STD_AUDIO_SE_EVENT_BRAND]: "StdAudioSeEvent";
};

export type StdAudioVoiceEvent = {
  readonly assetId: string;
  readonly sequence: number;
  readonly [STD_AUDIO_VOICE_EVENT_BRAND]: "StdAudioVoiceEvent";
};

export interface StdAudioState {
  readonly bgm: StdAudioBgm | null;
  readonly seEvents: readonly StdAudioSeEvent[];
  readonly voiceEvents: readonly StdAudioVoiceEvent[];
  readonly nextSeSequence: number;
  readonly nextVoiceSequence: number;
}

export function createStdAudioPlugin(): RuntimePluginDefinition<StdAudioState> {
  return {
    name: STD_AUDIO_PLUGIN_NAME,
    createInitialState: createInitialStdAudioState,
  };
}

export function getStdAudioState(runtimeState: RuntimeState): StdAudioState {
  const state = runtimeState.plugins[STD_AUDIO_PLUGIN_NAME];
  if (!isStdAudioState(state)) {
    throw new Error("runtimeState.plugins.stdAudio is not initialized. Register createStdAudioPlugin().");
  }

  return state;
}

function createInitialStdAudioState(): StdAudioState {
  return {
    bgm: null,
    seEvents: [],
    voiceEvents: [],
    nextSeSequence: 1,
    nextVoiceSequence: 1,
  };
}

function isStdAudioState(value: unknown): value is StdAudioState {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (value.bgm !== null && !isStdAudioBgm(value.bgm)) {
    return false;
  }

  if (!Array.isArray(value.seEvents) || !value.seEvents.every(isStdAudioEvent)) {
    return false;
  }

  if (!Array.isArray(value.voiceEvents) || !value.voiceEvents.every(isStdAudioEvent)) {
    return false;
  }

  return typeof value.nextSeSequence === "number" && typeof value.nextVoiceSequence === "number";
}

function isStdAudioBgm(value: unknown): value is StdAudioBgm {
  return isObjectRecord(value) && typeof value.assetId === "string";
}

function isStdAudioEvent(value: unknown): value is StdAudioSeEvent | StdAudioVoiceEvent {
  return isObjectRecord(value) && typeof value.assetId === "string" && typeof value.sequence === "number";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
