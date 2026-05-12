import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_TEXT_SOUND_PLUGIN_NAME = "stdTextSound";
const STD_TEXT_SOUND_DURATION_MS = {
  short: 24,
  normal: 32,
  long: 48,
} as const satisfies Record<StdTextSoundDuration, number>;
const STD_TEXT_SOUND_SKIPPED_CHARACTERS = new Set("。、，．,.!?！？;；:：…・\"'「」『』（）()[]【】");
const NOTE_SEMITONES = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
} as const;

export const STD_TEXT_SOUND_NOTES = [
  "C3",
  "C#3",
  "D3",
  "D#3",
  "E3",
  "F3",
  "F#3",
  "G3",
  "G#3",
  "A3",
  "A#3",
  "B3",
  "C4",
  "C#4",
  "D4",
  "D#4",
  "E4",
  "F4",
  "F#4",
  "G4",
  "G#4",
  "A4",
  "A#4",
  "B4",
  "C5",
  "C#5",
  "D5",
  "D#5",
  "E5",
  "F5",
  "F#5",
  "G5",
  "G#5",
  "A5",
  "A#5",
  "B5",
  "C6",
  "C#6",
  "D6",
  "D#6",
  "E6",
  "F6",
  "F#6",
  "G6",
  "G#6",
  "A6",
  "A#6",
  "B6",
] as const;

export type StdTextSoundNote = (typeof STD_TEXT_SOUND_NOTES)[number];
export type StdTextSoundDuration = "short" | "normal" | "long";
export type StdTextSoundWaveform = "sine" | "square" | "triangle";
export type StdTextSoundNoiseColor = "white" | "pink";

export interface StdTextSoundToneProfile {
  readonly type: "tone";
  readonly note: StdTextSoundNote;
  readonly waveform?: StdTextSoundWaveform;
  readonly duration?: StdTextSoundDuration;
  readonly volume?: number;
}

export interface StdTextSoundNoiseProfile {
  readonly type: "noise";
  readonly color?: StdTextSoundNoiseColor;
  readonly duration?: StdTextSoundDuration;
  readonly volume?: number;
}

export type StdTextSoundToneLayer = Omit<StdTextSoundToneProfile, "duration">;
export type StdTextSoundNoiseLayer = Omit<StdTextSoundNoiseProfile, "duration">;

export interface StdTextSoundMixProfile {
  readonly type: "mix";
  readonly duration?: StdTextSoundDuration;
  readonly volume?: number;
  readonly layers: readonly (StdTextSoundToneLayer | StdTextSoundNoiseLayer)[];
}

export type StdTextSoundProfile = StdTextSoundToneProfile | StdTextSoundNoiseProfile | StdTextSoundMixProfile;

export interface StdTextSoundConfig {
  readonly profiles: Readonly<Record<string, StdTextSoundProfile>>;
  readonly defaults?: {
    readonly narration?: string;
    readonly dialogue?: string;
    readonly characters?: Readonly<Record<string, string>>;
  };
}

export interface ResolveStdTextSoundProfileContext {
  readonly kind: "narration" | "dialogue";
  readonly speakerId?: string;
}

export interface StdTextSoundState {
  readonly overrideProfileId: string | null;
}

export const stdTextSoundPluginCommands = {
  textSound: definePluginCommand("textSound", {
    kind: "positional",
    arguments: [{ type: "string", nonEmpty: true }],
  }),
  stopTextSound: definePluginCommand("stopTextSound", { kind: "none" }),
} satisfies PluginCommandMap;

export function createStdTextSoundPlugin(): RuntimePluginDefinition<StdTextSoundState> {
  return {
    name: STD_TEXT_SOUND_PLUGIN_NAME,
    commands: stdTextSoundPluginCommands,
    createInitialState: createInitialStdTextSoundState,
  };
}

export function createStdTextSoundCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    textSound: handleTextSound,
    stopTextSound: handleStopTextSound,
  };
}

export function getStdTextSoundState(runtimeState: RuntimeState): StdTextSoundState {
  const state = runtimeState.plugins[STD_TEXT_SOUND_PLUGIN_NAME];
  if (!isStdTextSoundState(state)) {
    throw new Error("runtimeState.plugins.stdTextSound is not initialized. Register createStdTextSoundPlugin().");
  }

  return state;
}

export function resolveStdTextSoundDurationMs(duration: StdTextSoundDuration | undefined): number {
  return STD_TEXT_SOUND_DURATION_MS[duration ?? "normal"];
}

export function noteToFrequencyHz(note: StdTextSoundNote): number {
  const match = /^([A-G]#?)([3-6])$/.exec(note);
  if (match === null) {
    throw new Error(`Invalid std text sound note "${note}".`);
  }

  const noteName = match[1] as keyof typeof NOTE_SEMITONES;
  const octave = Number(match[2]);
  const midiNumber = (octave + 1) * 12 + NOTE_SEMITONES[noteName];
  return 440 * 2 ** ((midiNumber - 69) / 12);
}

export function shouldPlayStdTextSoundCharacter(character: string): boolean {
  return character.length > 0 && character.trim().length > 0 && !STD_TEXT_SOUND_SKIPPED_CHARACTERS.has(character);
}

export function resolveStdTextSoundProfile(
  config: StdTextSoundConfig,
  state: StdTextSoundState,
  context: ResolveStdTextSoundProfileContext,
): StdTextSoundProfile | null {
  if (state.overrideProfileId !== null) {
    return config.profiles[state.overrideProfileId] ?? null;
  }

  if (context.kind === "dialogue" && context.speakerId !== undefined) {
    const characterProfileId = config.defaults?.characters?.[context.speakerId];
    if (characterProfileId !== undefined) {
      return config.profiles[characterProfileId] ?? null;
    }
  }

  if (context.kind === "dialogue") {
    const dialogueProfileId = config.defaults?.dialogue;
    return dialogueProfileId === undefined ? null : (config.profiles[dialogueProfileId] ?? null);
  }

  const narrationProfileId = config.defaults?.narration;
  return narrationProfileId === undefined ? null : (config.profiles[narrationProfileId] ?? null);
}

function handleTextSound(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  const overrideProfileId = getRequiredPositionalString(instruction, 0);

  return {
    state: withStdTextSoundState(state, {
      overrideProfileId,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleStopTextSound(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  assertNoArguments(instruction);

  return {
    state: withStdTextSoundState(state, {
      overrideProfileId: null,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function createInitialStdTextSoundState(): StdTextSoundState {
  return {
    overrideProfileId: null,
  };
}

function withStdTextSoundState(state: RuntimeState, stdTextSound: StdTextSoundState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_TEXT_SOUND_PLUGIN_NAME]: stdTextSound,
    },
  };
}

function getRequiredPositionalString(instruction: CommandInstruction, index: number): string {
  const argument = instruction.args[index];
  if (
    argument?.type !== "PositionalArgument" ||
    argument.value.type !== "StringValue" ||
    argument.value.value.length === 0
  ) {
    throw new Error(
      `Invalid @${instruction.name} runtime arguments. Expected validated std text sound command arguments.`,
    );
  }
  return argument.value.value;
}

function assertNoArguments(instruction: CommandInstruction): void {
  if (instruction.args.length > 0) {
    throw new Error(
      `Invalid @${instruction.name} runtime arguments. Expected validated std text sound command arguments.`,
    );
  }
}

function isStdTextSoundState(value: unknown): value is StdTextSoundState {
  return isObjectRecord(value) && (value.overrideProfileId === null || typeof value.overrideProfileId === "string");
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
