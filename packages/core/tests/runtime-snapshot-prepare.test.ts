import { describe, expect, it } from "vitest";
import {
  type CommandInstruction,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  prepareRuntimeStateForSnapshot,
  type RuntimeDocument,
  type RuntimePluginCommandHandler,
  type RuntimePluginDefinition,
  type RuntimeSnapshotPrepare,
  type RuntimeState,
  restoreRuntimeState,
  stepRuntime,
} from "../src/index.js";

const filePath = "scenario/runtime-snapshot-prepare.tzr";

const loc = {
  start: { filePath, line: 1, column: 1 },
  end: { filePath, line: 1, column: 1 },
};

interface PreparePluginState {
  readonly durable: string | null;
  readonly events: readonly { readonly sequence: number; readonly name: string }[];
  readonly nextSequence: number;
}

const preparePlugin: RuntimePluginDefinition<PreparePluginState> = {
  name: "preparePlugin",
  createInitialState: () => ({
    durable: null,
    events: [],
    nextSequence: 1,
  }),
};

function getPreparePluginState(state: RuntimeState): PreparePluginState {
  return state.plugins.preparePlugin as PreparePluginState;
}

function preparePluginStateForSnapshot(state: RuntimeState): RuntimeState {
  const current = getPreparePluginState(state);
  return {
    ...state,
    plugins: {
      ...state.plugins,
      preparePlugin: {
        durable: current.durable,
        events: [],
        nextSequence: current.nextSequence,
      } satisfies PreparePluginState,
    },
  };
}

function createPreparePluginHandlers(calls: string[]): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    remember: (state, instruction) => {
      calls.push(instruction.name);
      const current = getPreparePluginState(state);
      return {
        state: {
          ...state,
          plugins: {
            ...state.plugins,
            preparePlugin: {
              ...current,
              durable: "remembered",
            } satisfies PreparePluginState,
          },
        },
        event: { type: "pluginCommand", name: instruction.name },
      };
    },
    emitOnce: (state, instruction) => {
      calls.push(instruction.name);
      const current = getPreparePluginState(state);
      return {
        state: {
          ...state,
          plugins: {
            ...state.plugins,
            preparePlugin: {
              ...current,
              events: [...current.events, { sequence: current.nextSequence, name: instruction.name }],
              nextSequence: current.nextSequence + 1,
            } satisfies PreparePluginState,
          },
        },
        event: { type: "pluginCommand", name: instruction.name },
      };
    },
    afterRestore: (state, instruction) => {
      calls.push(instruction.name);
      return {
        state,
        event: { type: "pluginCommand", name: instruction.name },
      };
    },
  };
}

function command(name: string): CommandInstruction {
  return {
    type: "CommandInstruction",
    name,
    args: [],
    loc,
  };
}

function createDocument(instructions: readonly CommandInstruction[]): RuntimeDocument {
  return {
    filePath,
    instructions,
    scenes: {},
  };
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("prepareRuntimeStateForSnapshot", () => {
  it("returns the original state when no prepare functions are provided", () => {
    const document = createDocument([]);
    const state = createInitialRuntimeState(document);

    expect(prepareRuntimeStateForSnapshot(state)).toBe(state);
  });

  it("applies prepare functions in order", () => {
    const document = createDocument([]);
    const state = createInitialRuntimeState(document);
    const calls: string[] = [];
    const first: RuntimeSnapshotPrepare = (current) => {
      calls.push("first");
      return {
        ...current,
        variables: {
          ...current.variables,
          "scenario.order": "first",
        },
      };
    };
    const second: RuntimeSnapshotPrepare = (current) => {
      calls.push("second");
      return {
        ...current,
        variables: {
          ...current.variables,
          "scenario.order": `${current.variables["scenario.order"]}:second`,
        },
      };
    };

    const prepared = prepareRuntimeStateForSnapshot(state, [first, second]);

    expect(calls).toEqual(["first", "second"]);
    expect(prepared.variables).toEqual({ "scenario.order": "first:second" });
  });

  it("composes host-provided plugin prepare functions before snapshot creation", () => {
    const document = createDocument([command("remember"), command("emitOnce"), command("afterRestore")]);
    const commandCalls: string[] = [];
    const commandHandlers = createPreparePluginHandlers(commandCalls);
    const initialState = createInitialRuntimeState(document, { plugins: [preparePlugin] });
    const remembered = stepRuntime(document, initialState, { commandHandlers });
    const emitted = stepRuntime(document, remembered.state, { commandHandlers });

    expect(getPreparePluginState(emitted.state)).toEqual({
      durable: "remembered",
      events: [{ sequence: 1, name: "emitOnce" }],
      nextSequence: 2,
    });

    const saveReadyState = prepareRuntimeStateForSnapshot(emitted.state, [preparePluginStateForSnapshot]);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(saveReadyState)));

    expect(getPreparePluginState(saveReadyState)).toEqual({
      durable: "remembered",
      events: [],
      nextSequence: 2,
    });
    expect(restored.pointer).toEqual({ filePath, instructionIndex: 2 });
    expect(getPreparePluginState(restored)).toEqual({
      durable: "remembered",
      events: [],
      nextSequence: 2,
    });

    const afterRestore = stepRuntime(document, restored, { commandHandlers });

    expect(afterRestore.event).toEqual({ type: "pluginCommand", name: "afterRestore" });
    expect(commandCalls).toEqual(["remember", "emitOnce", "afterRestore"]);
  });
});
