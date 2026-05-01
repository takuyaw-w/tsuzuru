import {
  definePluginCommand,
  type CommandInstruction,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

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

export const stdAudioPluginCommands = {
  startBgm: definePluginCommand("startBgm", {
    kind: "positional",
    arguments: [{ type: "string", nonEmpty: true }],
  }),
  stopBgm: definePluginCommand("stopBgm", { kind: "none" }),
  se: definePluginCommand("se", {
    kind: "positional",
    arguments: [{ type: "string", nonEmpty: true }],
  }),
  voice: definePluginCommand("voice", {
    kind: "positional",
    arguments: [{ type: "string", nonEmpty: true }],
  }),
} satisfies PluginCommandMap;

export function createStdAudioPlugin(): RuntimePluginDefinition<StdAudioState> {
  return {
    name: STD_AUDIO_PLUGIN_NAME,
    createInitialState: createInitialStdAudioState,
  };
}

export function createStdAudioCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    startBgm: handleStartBgm,
    stopBgm: handleStopBgm,
    se: handleSe,
    voice: handleVoice,
  };
}

export function getStdAudioState(runtimeState: RuntimeState): StdAudioState {
  const state = runtimeState.plugins[STD_AUDIO_PLUGIN_NAME];
  if (!isStdAudioState(state)) {
    throw new Error("runtimeState.plugins.stdAudio is not initialized. Register createStdAudioPlugin().");
  }

  return state;
}

function handleStartBgm(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);
  const current = getStdAudioState(state);

  return {
    state: withStdAudioState(state, {
      ...current,
      bgm: { assetId },
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleStopBgm(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  assertNoArguments(instruction);
  const current = getStdAudioState(state);

  return {
    state: withStdAudioState(state, {
      ...current,
      bgm: null,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleSe(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);
  const current = getStdAudioState(state);

  return {
    state: withStdAudioState(state, {
      ...current,
      seEvents: [...current.seEvents, createStdAudioSeEvent(assetId, current.nextSeSequence)],
      nextSeSequence: current.nextSeSequence + 1,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleVoice(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);
  const current = getStdAudioState(state);

  return {
    state: withStdAudioState(state, {
      ...current,
      voiceEvents: [...current.voiceEvents, createStdAudioVoiceEvent(assetId, current.nextVoiceSequence)],
      nextVoiceSequence: current.nextVoiceSequence + 1,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
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

function createStdAudioSeEvent(assetId: string, sequence: number): StdAudioSeEvent {
  return { assetId, sequence } as StdAudioSeEvent;
}

function createStdAudioVoiceEvent(assetId: string, sequence: number): StdAudioVoiceEvent {
  return { assetId, sequence } as StdAudioVoiceEvent;
}

function withStdAudioState(state: RuntimeState, stdAudio: StdAudioState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_AUDIO_PLUGIN_NAME]: stdAudio,
    },
  };
}

function getRequiredPositionalString(instruction: CommandInstruction, index: number): string {
  const argument = instruction.args[index];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "StringValue" || argument.value.value.length === 0) {
    throw new Error(`Invalid @${instruction.name} runtime arguments. Compile with stdAudioPluginCommands first.`);
  }
  return argument.value.value;
}

function assertNoArguments(instruction: CommandInstruction): void {
  if (instruction.args.length > 0) {
    throw new Error(`Invalid @${instruction.name} runtime arguments. Compile with stdAudioPluginCommands first.`);
  }
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
