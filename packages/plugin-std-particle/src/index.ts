import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_PARTICLE_PLUGIN_NAME = "stdParticle";
const STD_PARTICLE_TYPES = ["rain", "snow", "sakura", "dust"] as const satisfies readonly StdParticleType[];
const STD_PARTICLE_INTENSITIES = ["light", "normal", "strong"] as const satisfies readonly StdParticleIntensity[];

export type StdParticleType = "rain" | "snow" | "sakura" | "dust";
export type StdParticleIntensity = "light" | "normal" | "strong";

export interface StdParticleCurrent {
  readonly type: StdParticleType;
  readonly intensity: StdParticleIntensity;
}

export interface StdParticleState {
  readonly current: StdParticleCurrent | null;
}

export const stdParticlePluginCommands = {
  particle: definePluginCommand("particle", {
    kind: "mixed",
    positional: [{ type: "string", values: STD_PARTICLE_TYPES }],
    named: [{ name: "intensity", type: "string", optional: true, values: STD_PARTICLE_INTENSITIES }],
  }),
  stopParticle: definePluginCommand("stopParticle", { kind: "none" }),
} satisfies PluginCommandMap;

export function createStdParticlePlugin(): RuntimePluginDefinition<StdParticleState> {
  return {
    name: STD_PARTICLE_PLUGIN_NAME,
    commands: stdParticlePluginCommands,
    createInitialState: createInitialStdParticleState,
  };
}

export function createStdParticleCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    particle: handleParticle,
    stopParticle: handleStopParticle,
  };
}

export function getStdParticleState(runtimeState: RuntimeState): StdParticleState {
  const state = runtimeState.plugins[STD_PARTICLE_PLUGIN_NAME];
  if (!isStdParticleState(state)) {
    throw new Error("runtimeState.plugins.stdParticle is not initialized. Register createStdParticlePlugin().");
  }

  return state;
}

function handleParticle(state: RuntimeState, instruction: CommandInstruction): ReturnType<RuntimePluginCommandHandler> {
  assertNoUnexpectedArguments(instruction, 1, ["intensity"]);
  const type = getRequiredParticleType(instruction);
  const intensity = getOptionalIntensity(instruction) ?? "normal";

  return {
    state: withStdParticleState(state, {
      current: { type, intensity },
    }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function handleStopParticle(
  state: RuntimeState,
  instruction: CommandInstruction,
): ReturnType<RuntimePluginCommandHandler> {
  assertNoUnexpectedArguments(instruction, 0, []);

  return {
    state: withStdParticleState(state, { current: null }),
    event: { type: "pluginCommand", name: instruction.name },
  };
}

function createInitialStdParticleState(): StdParticleState {
  return {
    current: null,
  };
}

function withStdParticleState(state: RuntimeState, stdParticle: StdParticleState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_PARTICLE_PLUGIN_NAME]: stdParticle,
    },
  };
}

function getRequiredParticleType(instruction: CommandInstruction): StdParticleType {
  const argument = instruction.args[0];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "StringValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  if (!isStdParticleType(argument.value.value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
}

function getOptionalIntensity(instruction: CommandInstruction): StdParticleIntensity | undefined {
  const argument = instruction.args.find((arg) => arg.type === "NamedArgument" && arg.name === "intensity");
  if (argument === undefined) {
    return undefined;
  }
  if (argument.type !== "NamedArgument" || argument.value.type !== "StringValue") {
    throwInvalidRuntimeArguments(instruction);
  }
  if (!isStdParticleIntensity(argument.value.value)) {
    throwInvalidRuntimeArguments(instruction);
  }
  return argument.value.value;
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
}

function throwInvalidRuntimeArguments(instruction: CommandInstruction): never {
  throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std particle command arguments.`);
}

function isStdParticleState(value: unknown): value is StdParticleState {
  return isObjectRecord(value) && (value.current === null || isStdParticleCurrent(value.current));
}

function isStdParticleCurrent(value: unknown): value is StdParticleCurrent {
  return isObjectRecord(value) && isStdParticleType(value.type) && isStdParticleIntensity(value.intensity);
}

function isStdParticleType(value: unknown): value is StdParticleType {
  return value === "rain" || value === "snow" || value === "sakura" || value === "dust";
}

function isStdParticleIntensity(value: unknown): value is StdParticleIntensity {
  return value === "light" || value === "normal" || value === "strong";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
