import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";

const STD_SYSTEM_PLUGIN_NAME = "stdSystem";

export interface StdSystemUnlockEntry {
  readonly unlocked: boolean;
}

export interface StdSystemState {
  readonly endings: Readonly<Record<string, StdSystemUnlockEntry>>;
  readonly cgs: Readonly<Record<string, StdSystemUnlockEntry>>;
  readonly achievements: Readonly<Record<string, StdSystemUnlockEntry>>;
}

const STD_SYSTEM_UNLOCK_ARGS = [{ name: "id", type: ["string", "identifier"], nonEmpty: true }] as const;

export const stdSystemPluginCommands = {
  "system.unlockEnding": definePluginCommand("system.unlockEnding", {
    kind: "named",
    arguments: STD_SYSTEM_UNLOCK_ARGS,
  }),
  "system.unlockCg": definePluginCommand("system.unlockCg", {
    kind: "named",
    arguments: STD_SYSTEM_UNLOCK_ARGS,
  }),
  "system.unlockAchievement": definePluginCommand("system.unlockAchievement", {
    kind: "named",
    arguments: STD_SYSTEM_UNLOCK_ARGS,
  }),
} satisfies PluginCommandMap;

export function createStdSystemPlugin(): RuntimePluginDefinition<StdSystemState> {
  return {
    name: STD_SYSTEM_PLUGIN_NAME,
    commands: stdSystemPluginCommands,
    createInitialState: createInitialStdSystemState,
  };
}

export function createStdSystemCommandHandlers(): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    "system.unlockEnding": createUnlockHandler("endings"),
    "system.unlockCg": createUnlockHandler("cgs"),
    "system.unlockAchievement": createUnlockHandler("achievements"),
  };
}

export function getStdSystemState(runtimeState: RuntimeState): StdSystemState {
  const state = runtimeState.plugins[STD_SYSTEM_PLUGIN_NAME];
  if (!isStdSystemState(state)) {
    throw new Error("runtimeState.plugins.stdSystem is not initialized. Register createStdSystemPlugin().");
  }

  return state;
}

export function isStdSystemState(value: unknown): value is StdSystemState {
  return (
    isObjectRecord(value) &&
    isUnlockEntryRecord(value.endings) &&
    isUnlockEntryRecord(value.cgs) &&
    isUnlockEntryRecord(value.achievements)
  );
}

export function isEndingUnlocked(state: StdSystemState, id: string): boolean {
  return state.endings[id]?.unlocked === true;
}

export function isCgUnlocked(state: StdSystemState, id: string): boolean {
  return state.cgs[id]?.unlocked === true;
}

export function isAchievementUnlocked(state: StdSystemState, id: string): boolean {
  return state.achievements[id]?.unlocked === true;
}

function createInitialStdSystemState(): StdSystemState {
  return {
    endings: {},
    cgs: {},
    achievements: {},
  };
}

function createUnlockHandler(
  collectionName: keyof StdSystemState,
): (state: RuntimeState, instruction: CommandInstruction) => ReturnType<RuntimePluginCommandHandler> {
  return (state, instruction) => {
    const id = getRequiredUnlockId(instruction);
    const current = getStdSystemState(state);
    const collection = current[collectionName];

    return {
      state: withStdSystemState(state, {
        ...current,
        [collectionName]: {
          ...collection,
          [id]: { unlocked: true },
        },
      }),
      event: { type: "pluginCommand", name: instruction.name },
    };
  };
}

function withStdSystemState(state: RuntimeState, stdSystem: StdSystemState): RuntimeState {
  return {
    ...state,
    plugins: {
      ...state.plugins,
      [STD_SYSTEM_PLUGIN_NAME]: stdSystem,
    },
  };
}

function getRequiredUnlockId(instruction: CommandInstruction): string {
  const positional = instruction.args.filter((arg) => arg.type === "PositionalArgument");
  const named = instruction.args.filter((arg) => arg.type === "NamedArgument");

  if (positional.length > 0 || named.length !== 1 || named[0]?.name !== "id") {
    throwInvalidRuntimeArguments(instruction);
  }

  const value = named[0].value;
  if (value.type === "StringValue" && value.value.length > 0) {
    return value.value;
  }
  if (value.type === "IdentifierValue" && value.name.length > 0) {
    return value.name;
  }

  throwInvalidRuntimeArguments(instruction);
}

function throwInvalidRuntimeArguments(instruction: CommandInstruction): never {
  throw new Error(`Invalid @${instruction.name} runtime arguments. Expected validated std system command arguments.`);
}

function isUnlockEntryRecord(value: unknown): value is Readonly<Record<string, StdSystemUnlockEntry>> {
  if (!isObjectRecord(value)) {
    return false;
  }

  return Object.values(value).every(isUnlockEntry);
}

function isUnlockEntry(value: unknown): value is StdSystemUnlockEntry {
  return isObjectRecord(value) && typeof value.unlocked === "boolean";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
