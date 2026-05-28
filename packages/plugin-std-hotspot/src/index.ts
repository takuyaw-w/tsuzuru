import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_HOTSPOT_PLUGIN_NAME = "stdHotspot";

export type StdHotspotState = {
  readonly hotspots: StdHotspots;
  readonly waiting: boolean;
};

export type StdHotspots = Readonly<Record<string, StdHotspot>>;

export type StdHotspot = {
  readonly shape: StdHotspotRect;
  readonly action: StdHotspotAction;
};

export type StdHotspotRect = {
  readonly type: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type StdHotspotAction = {
  readonly type: "jump";
  readonly target: string;
};

export const stdHotspotPluginCommands = {
  hotspot: definePluginCommand("hotspot", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [
      { name: "x", type: "number", min: 0 },
      { name: "y", type: "number", min: 0 },
      { name: "width", type: "number", min: 0 },
      { name: "height", type: "number", min: 0 },
      { name: "target", type: "string", nonEmpty: true },
    ],
  }),
  waitHotspot: definePluginCommand("waitHotspot", { kind: "none" }),
  clearHotspots: definePluginCommand("clearHotspots", { kind: "none" }),
} satisfies PluginCommandMap;

export function createStdHotspotPlugin(): RuntimePluginDefinition<StdHotspotState> {
  return {
    name: STD_HOTSPOT_PLUGIN_NAME,
    commands: stdHotspotPluginCommands,
    createInitialState: createInitialStdHotspotState,
  };
}

export function createStdHotspotCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    hotspot: handleHotspot,
    waitHotspot: handleWaitHotspot,
    clearHotspots: handleClearHotspots,
  };
}

export function getStdHotspotState(runtimeState: RuntimeState): StdHotspotState {
  const state = runtimeState.plugins[STD_HOTSPOT_PLUGIN_NAME];
  if (!isStdHotspotState(state)) {
    throw new Error("runtimeState.plugins.stdHotspot is not initialized. Register createStdHotspotPlugin().");
  }

  return state;
}

export function resolveStdHotspotAction(
  runtimeState: RuntimeState,
  hotspotId: string,
): { readonly state: RuntimeState; readonly action: StdHotspotAction | null } {
  const current = getStdHotspotState(runtimeState);
  if (!current.waiting) {
    return { state: runtimeState, action: null };
  }

  const hotspot = current.hotspots[hotspotId];
  if (hotspot === undefined) {
    return { state: runtimeState, action: null };
  }

  return {
    state: withStdHotspotState(
      {
        ...runtimeState,
        isWaitingForClick: false,
      },
      {
        ...current,
        waiting: false,
      },
    ),
    action: hotspot.action,
  };
}

function handleHotspot(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  assertNoUnexpectedArguments(instruction, 1, ["x", "y", "width", "height", "target"]);
  const id = getRequiredString(instruction, 0);
  const x = getRequiredNumber(instruction, "x");
  const y = getRequiredNumber(instruction, "y");
  const width = getRequiredNumber(instruction, "width");
  const height = getRequiredNumber(instruction, "height");
  const target = getRequiredString(instruction, "target");

  if (id.length === 0 || target.length === 0 || x < 0 || y < 0 || width <= 0 || height <= 0) {
    throwInvalidRuntimeArguments(instruction);
  }

  const current = getStdHotspotState(state);
  return {
    state: withStdHotspotState(state, {
      ...current,
      hotspots: {
        ...current.hotspots,
        [id]: {
          shape: { type: "rect", x, y, width, height },
          action: { type: "jump", target },
        },
      },
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleWaitHotspot(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  assertNoUnexpectedArguments(instruction, 0, []);
  const current = getStdHotspotState(state);

  return {
    state: withStdHotspotState(
      {
        ...state,
        isWaitingForClick: true,
      },
      {
        ...current,
        waiting: true,
      },
    ),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleClearHotspots(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  assertNoUnexpectedArguments(instruction, 0, []);

  return {
    state: withStdHotspotState(
      {
        ...state,
        isWaitingForClick: false,
      },
      createInitialStdHotspotState(),
    ),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function createInitialStdHotspotState(): StdHotspotState {
  return {
    hotspots: {},
    waiting: false,
  };
}

function withStdHotspotState(state: RuntimeState, stdHotspot: StdHotspotState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_HOTSPOT_PLUGIN_NAME]: stdHotspot,
    },
  };
}

function getRequiredString(instruction: CommandInstruction, key: number | string): string {
  const argument =
    typeof key === "number"
      ? instruction.args.filter((arg) => arg.type === "PositionalArgument")[key]
      : instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === key);

  const value = argument?.value;
  if (value?.type !== "StringValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  return value.value;
}

function getRequiredNumber(instruction: CommandInstruction, name: string): number {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  const value = argument?.value;
  if (value?.type !== "NumberValue" || !Number.isFinite(value.value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value.value;
}

function assertNoUnexpectedArguments(
  instruction: CommandInstruction,
  positionalCount: number,
  namedNames: readonly string[],
): void {
  const positional = instruction.args.filter((arg) => arg.type === "PositionalArgument");
  const named = instruction.args.filter((arg) => arg.type === "NamedArgument");
  const seenNamed = new Set<string>();

  if (positional.length !== positionalCount) {
    throwInvalidRuntimeArguments(instruction);
  }

  for (const arg of named) {
    if (!namedNames.includes(arg.name) || seenNamed.has(arg.name)) {
      throwInvalidRuntimeArguments(instruction);
    }
    seenNamed.add(arg.name);
  }

  if (seenNamed.size !== namedNames.length) {
    throwInvalidRuntimeArguments(instruction);
  }
}

function throwInvalidRuntimeArguments(instruction: CommandInstruction): never {
  throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std hotspot command arguments.`);
}

function isStdHotspotState(value: unknown): value is StdHotspotState {
  return isObjectRecord(value) && isHotspotRecord(value.hotspots) && typeof value.waiting === "boolean";
}

function isHotspotRecord(value: unknown): value is StdHotspots {
  if (!isObjectRecord(value)) {
    return false;
  }
  return Object.values(value).every(isStdHotspot);
}

function isStdHotspot(value: unknown): value is StdHotspot {
  return isObjectRecord(value) && isStdHotspotRect(value.shape) && isStdHotspotAction(value.action);
}

function isStdHotspotRect(value: unknown): value is StdHotspotRect {
  return (
    isObjectRecord(value) &&
    value.type === "rect" &&
    isNonNegativeFiniteNumber(value.x) &&
    isNonNegativeFiniteNumber(value.y) &&
    isPositiveFiniteNumber(value.width) &&
    isPositiveFiniteNumber(value.height)
  );
}

function isStdHotspotAction(value: unknown): value is StdHotspotAction {
  return isObjectRecord(value) && value.type === "jump" && typeof value.target === "string" && value.target.length > 0;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
