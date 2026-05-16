import { describe, expect, it } from "vitest";
import {
  type CommandInstruction,
  type CompiledTzrDocument,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  type RuntimeDocument,
  type RuntimePluginCommandHandler,
  type RuntimeState,
  resolveChoice,
  restoreRuntimeState,
  stepRuntime,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/snapshot-regression.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/snapshot-regression.tzr", line: 1, column: 1 },
};

interface SnapshotPluginState {
  readonly durable: string | null;
  readonly events: readonly { readonly sequence: number; readonly name: string }[];
  readonly nextSequence: number;
}

function compileSource(source: string): CompiledTzrDocument {
  const parsed = parseTzr(source, { filePath: "scenario/snapshot-regression.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  const compiled = compileTzr(parsed.document);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }
  return compiled.document;
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
    filePath: "scenario/snapshot-regression.tzr",
    instructions,
    scenes: {},
  };
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getSnapshotPluginState(state: RuntimeState): SnapshotPluginState {
  return state.plugins.snapshotPlugin as SnapshotPluginState;
}

function prepareSnapshotPluginStateForSnapshot(state: RuntimeState): RuntimeState {
  const current = getSnapshotPluginState(state);
  return {
    ...state,
    plugins: {
      ...state.plugins,
      snapshotPlugin: {
        durable: current.durable,
        events: [],
        nextSequence: current.nextSequence,
      } satisfies SnapshotPluginState,
    },
  };
}

function createSnapshotPluginHandlers(calls: string[]): Readonly<Record<string, RuntimePluginCommandHandler>> {
  return {
    remember: (state, instruction) => {
      calls.push(instruction.name);
      const current = getSnapshotPluginState(state);
      return {
        state: {
          ...state,
          plugins: {
            ...state.plugins,
            snapshotPlugin: {
              ...current,
              durable: "remembered",
            } satisfies SnapshotPluginState,
          },
        },
        event: { type: "pluginCommand", name: instruction.name },
      };
    },
    emitOnce: (state, instruction) => {
      calls.push(instruction.name);
      const current = getSnapshotPluginState(state);
      return {
        state: {
          ...state,
          plugins: {
            ...state.plugins,
            snapshotPlugin: {
              ...current,
              events: [...current.events, { sequence: current.nextSequence, name: instruction.name }],
              nextSequence: current.nextSequence + 1,
            } satisfies SnapshotPluginState,
          },
        },
        event: { type: "pluginCommand", name: instruction.name },
      };
    },
  };
}

function createSnapshotPluginInitialState(): SnapshotPluginState {
  return {
    durable: null,
    events: [],
    nextSequence: 1,
  };
}

describe("runtime snapshot restore regressions", () => {
  it("restores scenario state and evaluates the next condition from restored variables", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  add scenario.score += 1
  set scenario.selectedItem = null
  if scenario.hasNotebook and scenario.score >= 1:
    narration:
      Ready.
  else:
    narration:
      Missing.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const hasNotebook = stepRuntime(document, scene.state);
    const score = stepRuntime(document, hasNotebook.state);
    const selectedItem = stepRuntime(document, score.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(selectedItem.state)));
    const branch = stepRuntime(document, restored);

    expect(restored.pointer).toEqual({ filePath: "scenario/snapshot-regression.tzr", instructionIndex: 4 });
    expect(restored.variables).toEqual({
      "scenario.hasNotebook": true,
      "scenario.score": 1,
      "scenario.selectedItem": null,
    });
    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "Ready." }] },
    });
  });

  it("restores instruction position without replaying the previous state mutation or skipping the next statement", () => {
    const document = compileSource(`scene start:
  add scenario.score += 1
  narration:
    After first add.
  add scenario.score += 10
  narration:
    Done.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const firstAdd = stepRuntime(document, scene.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(firstAdd.state)));
    const narration = stepRuntime(document, restored);
    const secondAdd = stepRuntime(document, narration.state);
    const done = stepRuntime(document, secondAdd.state);

    expect(restored.pointer.instructionIndex).toBe(2);
    expect(restored.variables).toEqual({ "scenario.score": 1 });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After first add." }],
    });
    expect(secondAdd.event).toEqual({ type: "state", command: "add", name: "scenario.score", value: 11 });
    expect(done.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Done." }],
    });
  });

  it("restores a pending conditional choice and jumps to the selected restored branch target", () => {
    const document = compileSource(`character mio name="Mio"
scene start:
  set scenario.hasNotebook = true
  set scenario.hasKey = false
  choice "Choose":
    "Open notebook" id=openNotebook if scenario.hasNotebook:
      jump notebook
    "Use key" id=useKey if scenario.hasKey:
      jump key
    "Leave" id=leave:
      jump leave
scene notebook:
  mio:
    Notebook.
  end
scene key:
  narration:
    Key.
  end
scene leave:
  narration:
    Leave.
  end
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const hasNotebook = stepRuntime(document, scene.state);
    const hasKey = stepRuntime(document, hasNotebook.state);
    const choice = stepRuntime(document, hasKey.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(choice.state)));
    const repeatedChoice = stepRuntime(document, restored);
    const resolved = resolveChoice(document, restored, 0);
    const jump = stepRuntime(document, resolved.state);
    const notebookScene = stepRuntime(document, jump.state);
    const dialogue = stepRuntime(document, notebookScene.state);

    expect(repeatedChoice.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [
        { id: "openNotebook", text: "Open notebook" },
        { id: "leave", text: "Leave" },
      ],
    });
    expect(resolved.event).toEqual({
      type: "choiceResolve",
      itemIndex: 0,
      id: "openNotebook",
      text: "Open notebook",
    });
    expect(jump.event).toEqual({
      type: "jump",
      sceneId: "notebook",
      instructionIndex: 4,
    });
    expect(notebookScene.event).toEqual({ type: "scene", id: "notebook" });
    expect(dialogue.event).toMatchObject({
      type: "dialogue",
      speaker: "mio",
      lines: [{ text: "Notebook." }],
    });
  });

  it("restores active choice branch position without replaying the previous branch instruction", () => {
    const document = compileSource(`scene start:
  choice "Score":
    "Score" id=score:
      add scenario.score += 1
      add scenario.score += 10
      jump done
  narration:
    After choice.
scene done:
  narration:
    Done.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const firstAdd = stepRuntime(document, resolved.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(firstAdd.state)));
    const secondAdd = stepRuntime(document, restored);
    const jump = stepRuntime(document, secondAdd.state);
    const doneScene = stepRuntime(document, jump.state);

    expect(restored.branchFrames).toMatchObject([{ instructionIndex: 1 }]);
    expect(restored.variables).toEqual({ "scenario.score": 1 });
    expect(secondAdd.event).toEqual({ type: "state", command: "add", name: "scenario.score", value: 11 });
    expect(jump.event).toEqual({
      type: "jump",
      sceneId: "done",
      instructionIndex: 3,
    });
    expect(doneScene.event).toEqual({ type: "scene", id: "done" });
  });

  it("keeps stopped snapshots stable after restore", () => {
    const document = compileSource(`scene start:
  end
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const stop = stepRuntime(document, scene.state);
    const end = stepRuntime(document, stop.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(end.state)));
    const repeatedEnd = stepRuntime(document, restored);

    expect(end.event).toEqual({ type: "end" });
    expect(restored.isStopped).toBe(true);
    expect(repeatedEnd.event).toEqual({ type: "end" });
    expect(repeatedEnd.state.isStopped).toBe(true);
  });

  it("restores plugin durable state without rerunning the plugin command", () => {
    const document = createDocument([command("remember"), command("emitOnce")]);
    const calls: string[] = [];
    const remember = stepRuntime(
      document,
      createInitialRuntimeState(document, {
        plugins: [{ name: "snapshotPlugin", createInitialState: createSnapshotPluginInitialState }],
      }),
      { commandHandlers: createSnapshotPluginHandlers(calls) },
    );
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(remember.state)));
    const emitOnce = stepRuntime(document, restored, { commandHandlers: createSnapshotPluginHandlers(calls) });

    expect(calls).toEqual(["remember", "emitOnce"]);
    expect(restored.pointer.instructionIndex).toBe(1);
    expect(getSnapshotPluginState(restored)).toEqual({
      durable: "remembered",
      events: [],
      nextSequence: 1,
    });
    expect(emitOnce.event).toEqual({ type: "pluginCommand", name: "emitOnce" });
    expect(getSnapshotPluginState(emitOnce.state)).toEqual({
      durable: "remembered",
      events: [{ sequence: 1, name: "emitOnce" }],
      nextSequence: 2,
    });
  });

  it("restores save-ready one-shot plugin state without refiring the one-shot command", () => {
    const document = createDocument([command("emitOnce"), command("remember")]);
    const calls: string[] = [];
    const emitOnce = stepRuntime(
      document,
      createInitialRuntimeState(document, {
        plugins: [{ name: "snapshotPlugin", createInitialState: createSnapshotPluginInitialState }],
      }),
      { commandHandlers: createSnapshotPluginHandlers(calls) },
    );
    const saveReadyState = prepareSnapshotPluginStateForSnapshot(emitOnce.state);
    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(saveReadyState)));
    const remember = stepRuntime(document, restored, { commandHandlers: createSnapshotPluginHandlers(calls) });

    expect(calls).toEqual(["emitOnce", "remember"]);
    expect(restored.pointer.instructionIndex).toBe(1);
    expect(getSnapshotPluginState(restored)).toEqual({
      durable: null,
      events: [],
      nextSequence: 2,
    });
    expect(remember.event).toEqual({ type: "pluginCommand", name: "remember" });
    expect(getSnapshotPluginState(remember.state)).toEqual({
      durable: "remembered",
      events: [],
      nextSequence: 2,
    });
  });
});
