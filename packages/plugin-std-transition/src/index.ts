import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_TRANSITION_PLUGIN_NAME = "stdTransition";
const STD_TRANSITION_EFFECTS = [
  "fade",
  "wipe",
  "flash",
  "pageTurn",
  "blurFade",
  "slide",
] as const satisfies readonly StdTransitionEffect[];
const STD_TRANSITION_DIRECTIONS = ["left", "right", "up", "down"] as const satisfies readonly StdTransitionDirection[];

export type StdTransitionEffect = "fade" | "wipe" | "flash" | "pageTurn" | "blurFade" | "slide";

export type StdTransitionDirection = "left" | "right" | "up" | "down";

export type StdTransitionEvent = {
  readonly sequence: number;
  readonly effect: StdTransitionEffect;
  readonly durationMs: number;
  readonly direction?: StdTransitionDirection;
  readonly color?: string;
};

export type StdTransitionState = {
  readonly events: readonly StdTransitionEvent[];
  readonly nextSequence: number;
};

export const stdTransitionPluginCommands = {
  transition: definePluginCommand("transition", {
    kind: "mixed",
    positional: [{ type: "string", values: STD_TRANSITION_EFFECTS }],
    named: [
      { name: "duration", type: "number", integer: true, min: 1 },
      { name: "direction", type: "string", optional: true, values: STD_TRANSITION_DIRECTIONS },
      { name: "color", type: "string", optional: true },
    ],
  }),
} satisfies PluginCommandMap;

export function createStdTransitionPlugin(): RuntimePluginDefinition<StdTransitionState> {
  return {
    name: STD_TRANSITION_PLUGIN_NAME,
    commands: stdTransitionPluginCommands,
    createInitialState: createInitialStdTransitionState,
  };
}

export function createStdTransitionCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    transition: handleTransition,
  };
}

export function getStdTransitionState(runtimeState: RuntimeState): StdTransitionState {
  const state = runtimeState.plugins[STD_TRANSITION_PLUGIN_NAME];
  if (!isStdTransitionState(state)) {
    throw new Error("runtimeState.plugins.stdTransition is not initialized. Register createStdTransitionPlugin().");
  }

  return state;
}

export function prepareStdTransitionStateForSnapshot(runtimeState: RuntimeState): RuntimeState {
  const current = getStdTransitionState(runtimeState);

  return withStdTransitionState(runtimeState, {
    events: [],
    nextSequence: current.nextSequence,
  });
}

function handleTransition(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  const current = getStdTransitionState(state);
  assertSupportedArguments(instruction);
  const effect = getRequiredEffect(instruction);
  const durationMs = getRequiredDuration(instruction);
  const direction = getOptionalDirection(instruction);
  const color = getOptionalColor(instruction);

  return appendStdTransitionEvent(state, current, {
    sequence: current.nextSequence,
    effect,
    durationMs,
    ...(direction === undefined ? {} : { direction }),
    ...(color === undefined ? {} : { color }),
  });
}

function assertSupportedArguments(instruction: CommandInstruction): void {
  const seenNamedArgs = new Set<string>();
  for (const [index, arg] of instruction.args.entries()) {
    if (arg.type === "PositionalArgument") {
      if (index !== 0) {
        throwInvalidRuntimeArguments(instruction);
      }
      continue;
    }

    if (arg.name !== "duration" && arg.name !== "direction" && arg.name !== "color") {
      throwInvalidRuntimeArguments(instruction);
    }
    if (seenNamedArgs.has(arg.name)) {
      throwInvalidRuntimeArguments(instruction);
    }
    seenNamedArgs.add(arg.name);
  }
}

function appendStdTransitionEvent(
  state: RuntimeState,
  current: StdTransitionState,
  event: StdTransitionEvent,
): ReturnType<RuntimePluginCommandHandler> {
  return {
    state: withStdTransitionState(state, {
      events: [...current.events, event],
      nextSequence: current.nextSequence + 1,
    }),
    event: { type: "pluginCommand", name: "transition" },
  };
}

function createInitialStdTransitionState(): StdTransitionState {
  return {
    events: [],
    nextSequence: 1,
  };
}

function withStdTransitionState(state: RuntimeState, stdTransition: StdTransitionState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_TRANSITION_PLUGIN_NAME]: stdTransition,
    },
  };
}

function getRequiredEffect(instruction: CommandInstruction): StdTransitionEffect {
  const value = getRequiredPositionalString(instruction, 0);
  if (!isStdTransitionEffect(value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getRequiredDuration(instruction: CommandInstruction): number {
  const value = getRequiredNamedNumber(instruction, "duration");
  if (!Number.isInteger(value) || value <= 0) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getOptionalDirection(instruction: CommandInstruction): StdTransitionDirection | undefined {
  const value = getOptionalNamedString(instruction, "direction");
  if (value === undefined) {
    return undefined;
  }
  if (!isStdTransitionDirection(value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return value;
}

function getOptionalColor(instruction: CommandInstruction): string | undefined {
  return getOptionalNamedString(instruction, "color");
}

function getRequiredPositionalString(instruction: CommandInstruction, index: number): string {
  const argument = instruction.args[index];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "StringValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function getOptionalNamedString(instruction: CommandInstruction, name: string): string | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument === undefined) {
    return undefined;
  }
  if (argument.type !== "NamedArgument" || argument.value.type !== "StringValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function getRequiredNamedNumber(instruction: CommandInstruction, name: string): number {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
  if (argument?.type !== "NamedArgument" || argument.value.type !== "NumberValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function throwInvalidRuntimeArguments(instruction: CommandInstruction): never {
  throw new Error(
    `Invalid @${instruction.name} runtime arguments. Expected validated std transition command arguments.`,
  );
}

function isStdTransitionState(value: unknown): value is StdTransitionState {
  return (
    isObjectRecord(value) &&
    Array.isArray(value.events) &&
    value.events.every(isStdTransitionEvent) &&
    typeof value.nextSequence === "number"
  );
}

function isStdTransitionEvent(value: unknown): value is StdTransitionEvent {
  return (
    isObjectRecord(value) &&
    typeof value.sequence === "number" &&
    isStdTransitionEffect(value.effect) &&
    typeof value.durationMs === "number" &&
    (value.direction === undefined || isStdTransitionDirection(value.direction)) &&
    (value.color === undefined || typeof value.color === "string")
  );
}

function isStdTransitionEffect(value: unknown): value is StdTransitionEffect {
  return (
    value === "fade" ||
    value === "wipe" ||
    value === "flash" ||
    value === "pageTurn" ||
    value === "blurFade" ||
    value === "slide"
  );
}

function isStdTransitionDirection(value: unknown): value is StdTransitionDirection {
  return value === "left" || value === "right" || value === "up" || value === "down";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
