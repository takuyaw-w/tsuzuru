import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandContext,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_VISUAL_PLUGIN_NAME = "stdVisual";
const HIDE_TARGET_NOT_FOUND_WARNING_CODE = "plugin.stdVisual.hideTargetNotFound";

export type StdVisualSpritePosition = "left" | "center" | "right";

export interface StdVisualTransition {
  readonly type: string;
  readonly durationMs: number;
}

export interface StdVisualBackground {
  readonly assetId: string;
  readonly transition?: StdVisualTransition;
}

export interface StdVisualSprite {
  readonly position: StdVisualSpritePosition;
  readonly transition?: StdVisualTransition;
}

export type StdVisualSprites = Readonly<Record<string, StdVisualSprite>>;

export interface StdVisualState {
  readonly background: StdVisualBackground | null;
  readonly sprites: StdVisualSprites;
}

const STD_VISUAL_TRANSITION_TYPES = ["fade", "dissolve"] as const;

const STD_VISUAL_TRANSITION_NAMED_ARGS = [
  {
    name: "transition",
    type: "string",
    optional: true,
    values: STD_VISUAL_TRANSITION_TYPES,
    requiredWith: ["duration"],
  },
  {
    name: "duration",
    type: "number",
    optional: true,
    integer: true,
    min: 0,
    requiredWith: ["transition"],
  },
] as const;

export const stdVisualPluginCommands = {
  bg: definePluginCommand("bg", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: STD_VISUAL_TRANSITION_NAMED_ARGS,
  }),
  show: definePluginCommand("show", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [
      { name: "position", type: "string", optional: true, values: ["left", "center", "right"] },
      ...STD_VISUAL_TRANSITION_NAMED_ARGS,
    ],
  }),
  hide: definePluginCommand("hide", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: STD_VISUAL_TRANSITION_NAMED_ARGS,
  }),
  clearBg: definePluginCommand("clearBg", {
    kind: "named",
    arguments: STD_VISUAL_TRANSITION_NAMED_ARGS,
  }),
  clearSprites: definePluginCommand("clearSprites", {
    kind: "named",
    arguments: STD_VISUAL_TRANSITION_NAMED_ARGS,
  }),
} satisfies PluginCommandMap;

export function createStdVisualPlugin(): RuntimePluginDefinition<StdVisualState> {
  return {
    name: STD_VISUAL_PLUGIN_NAME,
    commands: stdVisualPluginCommands,
    createInitialState: createInitialStdVisualState,
  };
}

export function createStdVisualCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    bg: handleBg,
    show: handleShow,
    hide: handleHide,
    clearBg: handleClearBg,
    clearSprites: handleClearSprites,
  };
}

export function getStdVisualState(runtimeState: RuntimeState): StdVisualState {
  const state = runtimeState.plugins[STD_VISUAL_PLUGIN_NAME];
  if (!isStdVisualState(state)) {
    throw new Error("runtimeState.plugins.stdVisual is not initialized. Register createStdVisualPlugin().");
  }

  return state;
}

function handleBg(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);
  const transition = getOptionalTransition(instruction);
  const current = getStdVisualState(state);

  return {
    state: withStdVisualState(state, {
      ...current,
      background: {
        assetId,
        ...(transition === undefined ? {} : { transition }),
      },
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleShow(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);
  const position = getNamedSpritePosition(instruction, "position") ?? "center";
  const transition = getOptionalTransition(instruction);
  const current = getStdVisualState(state);

  return {
    state: withStdVisualState(state, {
      ...current,
      sprites: {
        ...current.sprites,
        [assetId]: {
          position,
          ...(transition === undefined ? {} : { transition }),
        },
      },
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleHide(
  state: RuntimeState,
  instruction: CommandInstruction,
  context: RuntimePluginCommandContext,
): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);
  getOptionalTransition(instruction);
  const current = getStdVisualState(state);

  if (current.sprites[assetId] === undefined) {
    context.warn(HIDE_TARGET_NOT_FOUND_WARNING_CODE, `Cannot hide "${assetId}" because it is not visible.`);
    return {
      state,
      event: { type: "pluginCommand", name: instruction.name },
    };
  }

  const { [assetId]: _removed, ...sprites } = current.sprites;
  return {
    state: withStdVisualState(state, {
      ...current,
      sprites,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleClearBg(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  getOptionalTransition(instruction);
  const current = getStdVisualState(state);

  return {
    state: withStdVisualState(state, {
      ...current,
      background: null,
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleClearSprites(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  getOptionalTransition(instruction);
  const current = getStdVisualState(state);

  return {
    state: withStdVisualState(state, {
      ...current,
      sprites: {},
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function createInitialStdVisualState(): StdVisualState {
  return {
    background: null,
    sprites: {},
  };
}

function withStdVisualState(state: RuntimeState, stdVisual: StdVisualState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_VISUAL_PLUGIN_NAME]: stdVisual,
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
    throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std visual command arguments.`);
  }
  return argument.value.value;
}

function getNamedSpritePosition(instruction: CommandInstruction, name: string): StdVisualSpritePosition | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument?.type !== "NamedArgument") {
    return undefined;
  }
  if (argument.value.type !== "StringValue" || !isStdVisualSpritePosition(argument.value.value)) {
    throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std visual command arguments.`);
  }
  return argument.value.value;
}

function getOptionalTransition(instruction: CommandInstruction): StdVisualTransition | undefined {
  const type = getNamedTransitionType(instruction, "transition");
  const durationMs = getNamedTransitionDuration(instruction, "duration");

  if (type === undefined && durationMs === undefined) {
    return undefined;
  }
  if (type === undefined || durationMs === undefined) {
    throwInvalidRuntimeArguments(instruction);
  }

  return { type, durationMs };
}

function getNamedTransitionType(instruction: CommandInstruction, name: string): string | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument?.type !== "NamedArgument") {
    return undefined;
  }
  if (argument.value.type !== "StringValue" || !isStdVisualTransitionType(argument.value.value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function getNamedTransitionDuration(instruction: CommandInstruction, name: string): number | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument?.type !== "NamedArgument") {
    return undefined;
  }
  if (
    argument.value.type !== "NumberValue" ||
    !Number.isFinite(argument.value.value) ||
    !Number.isInteger(argument.value.value) ||
    argument.value.value < 0
  ) {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function throwInvalidRuntimeArguments(instruction: CommandInstruction): never {
  throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std visual command arguments.`);
}

function isStdVisualState(value: unknown): value is StdVisualState {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (value.background !== null && !isStdVisualBackground(value.background)) {
    return false;
  }

  if (!isObjectRecord(value.sprites)) {
    return false;
  }

  return Object.values(value.sprites).every(isStdVisualSprite);
}

function isStdVisualBackground(value: unknown): value is StdVisualBackground {
  return (
    isObjectRecord(value) &&
    typeof value.assetId === "string" &&
    (value.transition === undefined || isStdVisualTransition(value.transition))
  );
}

function isStdVisualSprite(value: unknown): value is StdVisualSprite {
  return (
    isObjectRecord(value) &&
    isStdVisualSpritePosition(value.position) &&
    (value.transition === undefined || isStdVisualTransition(value.transition))
  );
}

function isStdVisualSpritePosition(value: unknown): value is StdVisualSpritePosition {
  return value === "left" || value === "center" || value === "right";
}

function isStdVisualTransition(value: unknown): value is StdVisualTransition {
  return (
    isObjectRecord(value) &&
    typeof value.type === "string" &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs) &&
    Number.isInteger(value.durationMs) &&
    value.durationMs >= 0
  );
}

function isStdVisualTransitionType(value: unknown): value is (typeof STD_VISUAL_TRANSITION_TYPES)[number] {
  return STD_VISUAL_TRANSITION_TYPES.some((type) => type === value);
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
