import { describe, expect, it } from "vitest";
import {
  type CommandInstruction,
  clearClickWait,
  clearWait,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  definePluginCommand,
  getRuntimeBlockReason,
  isRuntimeBlocked,
  parseTzr,
  type RuntimeDocument,
  type RuntimePluginCommandHandler,
  restoreRuntimeState,
  stepRuntime,
  type TzrArgument,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/runtime.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/runtime.tzr", line: 1, column: 1 },
};

function compileSource(source: string): RuntimeDocument {
  const parsed = parseTzr(source, { filePath: "scenario/runtime.tzr" });
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

function command(name: string, args: readonly TzrArgument[] = []): CommandInstruction {
  return {
    type: "CommandInstruction",
    name,
    args,
    loc,
  };
}

function positionalNumber(value: number): TzrArgument {
  return {
    type: "PositionalArgument",
    value: { type: "NumberValue", value, loc },
    loc,
  };
}

function positionalString(value: string): TzrArgument {
  return {
    type: "PositionalArgument",
    value: { type: "StringValue", value, loc },
    loc,
  };
}

function namedString(name: string, value: string): TzrArgument {
  return {
    type: "NamedArgument",
    name,
    value: { type: "StringValue", value, loc },
    loc,
  };
}

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/runtime.tzr",
    instructions,
    labels: {},
    scenes: {},
  };
}

describe("createInitialRuntimeState", () => {
  it("creates a JSON-serializable initial runtime state from a DSL v2 document", () => {
    const document = compileSource(`scene start:
  narration:
    The classroom was quiet.
`);

    const state = createInitialRuntimeState(document);

    expect(state).toEqual({
      pointer: {
        filePath: "scenario/runtime.tzr",
        instructionIndex: 0,
      },
      variables: {},
      flags: {},
      plugins: {},
      branchFrames: [],
      pendingChoice: null,
      pendingWait: null,
      isStopped: false,
      isWaitingForClick: false,
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("initializes registered runtime plugin state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [
        {
          name: "example",
          createInitialState: () => ({ value: 1 }),
        },
      ],
    });

    expect(state.plugins).toEqual({ example: { value: 1 } });
  });
});

describe("stepRuntime", () => {
  it("runs scene, narration, dialogue, and stop from a DSL v2 document", () => {
    const document = compileSource(`character haruka name="Haruka"
scene start:
  narration:
    The classroom was quiet.
  haruka:
    You're late.
  end
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const narration = stepRuntime(document, scene.state);
    const dialogue = stepRuntime(document, narration.state);
    const stop = stepRuntime(document, dialogue.state);

    expect(scene.event).toEqual({ type: "scene", id: "start" });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "The classroom was quiet." }],
    });
    expect(dialogue.event).toMatchObject({
      type: "dialogue",
      speaker: "haruka",
      lines: [{ text: "You're late." }],
    });
    expect(stop.event).toEqual({ type: "stop" });
    expect(stop.state.isStopped).toBe(true);
  });

  it("runs wait, waitClick, page, and stop with explicit unblock calls", () => {
    const document = createDocument([
      command("wait", [positionalNumber(100)]),
      command("waitClick"),
      command("page"),
      command("stop"),
    ]);
    const wait = stepRuntime(document, createInitialRuntimeState(document));
    const repeatedWait = stepRuntime(document, wait.state);
    const waitClick = stepRuntime(document, clearWait(wait.state));
    const repeatedClick = stepRuntime(document, waitClick.state);
    const page = stepRuntime(document, clearClickWait(waitClick.state));
    const repeatedPageClick = stepRuntime(document, page.state);
    const stop = stepRuntime(document, clearClickWait(page.state));

    expect(wait.event).toEqual({ type: "wait", durationMs: 100 });
    expect(getRuntimeBlockReason(wait.state)).toBe("wait");
    expect(repeatedWait.state).toBe(wait.state);
    expect(waitClick.event).toEqual({ type: "waitClick" });
    expect(getRuntimeBlockReason(waitClick.state)).toBe("click");
    expect(repeatedClick.state).toBe(waitClick.state);
    expect(page.event).toEqual({ type: "page" });
    expect(getRuntimeBlockReason(page.state)).toBe("click");
    expect(repeatedPageClick.event).toEqual({ type: "waitClick" });
    expect(repeatedPageClick.state).toBe(page.state);
    expect(stop.event).toEqual({ type: "stop" });
    expect(stop.state.isStopped).toBe(true);
  });

  it("dispatches non-core CommandInstruction to a registered plugin handler", () => {
    const document = createDocument([command("bg", [positionalString("school")])]);
    let called = 0;
    const handler: RuntimePluginCommandHandler = (state, instruction) => {
      called += 1;
      expect(instruction.name).toBe("bg");
      return {
        state: {
          ...state,
          variables: {
            ...state.variables,
            background: "school",
          },
        },
        event: { type: "pluginCommand", name: instruction.name },
      };
    };

    const result = stepRuntime(document, createInitialRuntimeState(document), {
      commandHandlers: { bg: handler },
    });

    expect(called).toBe(1);
    expect(result.event).toEqual({ type: "pluginCommand", name: "bg" });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.variables).toEqual({ background: "school" });
  });

  it("keeps core command handling ahead of plugin handlers", () => {
    const document = createDocument([command("waitClick")]);
    let called = false;

    const result = stepRuntime(document, createInitialRuntimeState(document), {
      commandHandlers: {
        waitClick: () => {
          called = true;
          return {
            state: createInitialRuntimeState(document),
            event: { type: "pluginCommand", name: "waitClick" },
          };
        },
      },
    });

    expect(called).toBe(false);
    expect(result.event).toEqual({ type: "waitClick" });
    expect(result.state.isWaitingForClick).toBe(true);
  });

  it("updates runtime variables through DSL v2 set and add commands", () => {
    const document = compileSource(`scene start:
  set scenario.score = 2
  add scenario.score += 3
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const add = stepRuntime(document, set.state);

    expect(set.event).toEqual({ type: "state", command: "set", name: "scenario.score", value: 2 });
    expect(add.event).toEqual({ type: "state", command: "add", name: "scenario.score", value: 5 });
    expect(add.state.variables).toEqual({ "scenario.score": 5 });
  });

  it("still supports retained runtime state helper commands without legacy parser/compiler", () => {
    const document = createDocument([
      command("set", [namedString("name", "route"), namedString("value", "mio")]),
      command("flag", [positionalString("met_mio")]),
    ]);
    const set = stepRuntime(document, createInitialRuntimeState(document));
    const flag = stepRuntime(document, set.state);

    expect(set.event).toEqual({ type: "state", command: "set", name: "route", value: "mio" });
    expect(flag.event).toEqual({ type: "state", command: "flag", name: "met_mio", value: true });
  });

  it("ends when the instruction pointer is past the document", () => {
    const document = createDocument();
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({ type: "end" });
    expect(result.state.isStopped).toBe(true);
  });
});

describe("runtime blocking and snapshots", () => {
  it("reports runtime block reasons", () => {
    const document = createDocument([command("wait", [positionalNumber(500)])]);
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(isRuntimeBlocked(result.state)).toBe(true);
    expect(getRuntimeBlockReason(result.state)).toBe("wait");
    expect(isRuntimeBlocked(clearWait(result.state))).toBe(false);
  });

  it("round-trips runtime snapshots", () => {
    const document = createDocument([command("wait", [positionalNumber(500)])]);
    const result = stepRuntime(document, createInitialRuntimeState(document));
    const snapshot = createRuntimeSnapshot(result.state);
    const restored = restoreRuntimeState(snapshot);

    expect(restored).toEqual(result.state);
    expect(restored).not.toBe(result.state);
  });
});

describe("plugin command metadata", () => {
  it("keeps plugin command definitions available without the legacy compiler validation path", () => {
    expect(
      definePluginCommand("bg", {
        kind: "positional",
        arguments: [{ type: "string", nonEmpty: true }],
      }),
    ).toEqual({
      name: "bg",
      args: {
        kind: "positional",
        arguments: [{ type: "string", nonEmpty: true }],
      },
    });
  });
});
