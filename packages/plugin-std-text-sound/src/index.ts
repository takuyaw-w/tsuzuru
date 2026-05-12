import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_TEXT_SOUND_PLUGIN_NAME = "stdTextSound";

export interface StdTextSoundCurrent {
  readonly assetId: string;
}

export interface StdTextSoundState {
  readonly current: StdTextSoundCurrent | null;
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

function handleTextSound(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);

  return {
    state: withStdTextSoundState(state, {
      current: { assetId },
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
      current: null,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function createInitialStdTextSoundState(): StdTextSoundState {
  return {
    current: null,
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
  return isObjectRecord(value) && (value.current === null || isStdTextSoundCurrent(value.current));
}

function isStdTextSoundCurrent(value: unknown): value is StdTextSoundCurrent {
  return isObjectRecord(value) && typeof value.assetId === "string";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
