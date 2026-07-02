import {
  type CommandInstruction,
  definePluginCommand,
  type PluginCommandMap,
  type RuntimeConditionResolver,
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

export type StdSystemPluginDefinition = RuntimePluginDefinition<StdSystemState> & {
  readonly conditionNamespaces: readonly ["system"];
};

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

export function createStdSystemPlugin(): StdSystemPluginDefinition {
  return {
    name: STD_SYSTEM_PLUGIN_NAME,
    conditionNamespaces: ["system"],
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
  const state = tryGetStdSystemState(runtimeState);
  if (state === undefined) {
    throw new Error("runtimeState.plugins.stdSystem is not initialized. Register createStdSystemPlugin().");
  }

  return state;
}

export function tryGetStdSystemState(runtimeState: RuntimeState): StdSystemState | undefined {
  const state = runtimeState.plugins[STD_SYSTEM_PLUGIN_NAME];
  return isStdSystemState(state) ? state : undefined;
}

export function createStdSystemConditionResolver(): RuntimeConditionResolver {
  return {
    namespace: "system",
    resolve: (path, runtimeState) => {
      const supportedPath = getSupportedSystemConditionPath(path);
      if (supportedPath === undefined) {
        return unsupportedSystemConditionPath(path);
      }

      const state = tryGetStdSystemState(runtimeState);
      if (state === undefined) {
        return {
          ok: false,
          error: {
            code: "condition_system_state_missing",
            message: "runtimeState.plugins.stdSystem is not initialized. Register createStdSystemPlugin().",
          },
        };
      }

      const [collectionName, id] = supportedPath;
      if (collectionName === "endings") {
        return { ok: true, value: isEndingUnlocked(state, id) };
      }
      if (collectionName === "cgs") {
        return { ok: true, value: isCgUnlocked(state, id) };
      }
      if (collectionName === "achievements") {
        return { ok: true, value: isAchievementUnlocked(state, id) };
      }

      return unsupportedSystemConditionPath(path);
    },
  };
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

function getSupportedSystemConditionPath(path: readonly string[]): readonly [keyof StdSystemState, string] | undefined {
  if (path.length !== 3 || path[1] === undefined || path[2] !== "unlocked") {
    return undefined;
  }

  const collectionName = path[0];
  if (collectionName !== "endings" && collectionName !== "cgs" && collectionName !== "achievements") {
    return undefined;
  }

  return [collectionName, path[1]];
}

function unsupportedSystemConditionPath(path: readonly string[]): ReturnType<RuntimeConditionResolver["resolve"]> {
  return {
    ok: false,
    error: {
      code: "condition_system_path_unsupported",
      message: `Unsupported system condition path "system.${path.join(".")}".`,
    },
  };
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
