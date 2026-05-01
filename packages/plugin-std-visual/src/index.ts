import {
  definePluginCommand,
  type CommandInstruction,
  type PluginCommandMap,
  type RuntimePluginCommandContext,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_VISUAL_PLUGIN_NAME = "stdVisual";
const HIDE_TARGET_NOT_FOUND_WARNING_CODE = "plugin.stdVisual.hideTargetNotFound";

export type StdVisualSpritePosition = "left" | "center" | "right";

export interface StdVisualBackground {
  readonly assetId: string;
}

export interface StdVisualSprite {
  readonly position: StdVisualSpritePosition;
}

export type StdVisualSprites = Readonly<Record<string, StdVisualSprite>>;

export interface StdVisualState {
  readonly background: StdVisualBackground | null;
  readonly sprites: StdVisualSprites;
}

export const stdVisualPluginCommands = {
  bg: definePluginCommand("bg", {
    kind: "positional",
    arguments: [{ type: "string", nonEmpty: true }],
  }),
  show: definePluginCommand("show", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [{ name: "position", type: "string", optional: true, values: ["left", "center", "right"] }],
  }),
  hide: definePluginCommand("hide", {
    kind: "positional",
    arguments: [{ type: "string", nonEmpty: true }],
  }),
} satisfies PluginCommandMap;

export function createStdVisualPlugin(): RuntimePluginDefinition<StdVisualState> {
  return {
    name: STD_VISUAL_PLUGIN_NAME,
    createInitialState: createInitialStdVisualState,
  };
}

export function createStdVisualCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    bg: handleBg,
    show: handleShow,
    hide: handleHide,
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
  const current = getStdVisualState(state);

  return {
    state: withStdVisualState(state, {
      ...current,
      background: { assetId },
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleShow(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  const assetId = getRequiredPositionalString(instruction, 0);
  const position = getNamedSpritePosition(instruction, "position") ?? "center";
  const current = getStdVisualState(state);

  return {
    state: withStdVisualState(state, {
      ...current,
      sprites: {
        ...current.sprites,
        [assetId]: { position },
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
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "StringValue" || argument.value.value.length === 0) {
    throw new Error(`Invalid @${instruction.name} runtime arguments. Compile with stdVisualPluginCommands first.`);
  }
  return argument.value.value;
}

function getNamedSpritePosition(instruction: CommandInstruction, name: string): StdVisualSpritePosition | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument?.type !== "NamedArgument") {
    return undefined;
  }
  if (argument.value.type !== "StringValue" || !isStdVisualSpritePosition(argument.value.value)) {
    throw new Error(`Invalid @${instruction.name} runtime arguments. Compile with stdVisualPluginCommands first.`);
  }
  return argument.value.value;
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
  return isObjectRecord(value) && typeof value.assetId === "string";
}

function isStdVisualSprite(value: unknown): value is StdVisualSprite {
  return isObjectRecord(value) && isStdVisualSpritePosition(value.position);
}

function isStdVisualSpritePosition(value: unknown): value is StdVisualSpritePosition {
  return value === "left" || value === "center" || value === "right";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
