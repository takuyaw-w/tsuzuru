import { describe, expect, it } from "vitest";
import type { CompiledTzrDocument, RuntimePluginCommandHandler } from "../src/index.js";
import {
  clearClickWait,
  clearWait,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  definePluginCommand,
  getRuntimeBlockReason,
  isRuntimeBlocked,
  parseTzr,
  resolveChoice,
  restoreRuntimeState,
  stepRuntime,
} from "../src/index.js";

describe("createInitialRuntimeState", () => {
  it("creates a JSON-serializable initial runtime state from a compiled document", () => {
    const parsed = parseTzr(
      `#scene("prologue")
The classroom was quiet.
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: definePluginCommand("bg"),
        shake: definePluginCommand("shake"),
      },
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }

    const state = createInitialRuntimeState(compiled.document);

    expect(state).toEqual({
      pointer: {
        filePath: "scenario/main.tzr",
        instructionIndex: 0,
      },
      variables: {},
      flags: {},
      branchFrames: [],
      pendingChoice: null,
      pendingWait: null,
      isStopped: false,
      isWaitingForClick: false,
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe("stepRuntime", () => {
  function compileScript(source: string) {
    const parsed = parseTzr(source, { filePath: "scenario/main.tzr" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: definePluginCommand("bg"),
        shake: definePluginCommand("shake"),
      },
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }

    return compiled.document;
  }

  it("steps SceneInstruction and advances instructionIndex", () => {
    const document = compileScript('#scene("prologue")\n');
    const initial = createInitialRuntimeState(document);

    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({ type: "scene", id: "prologue" });
    expect(result.state.pointer).toEqual({
      filePath: "scenario/main.tzr",
      instructionIndex: 1,
    });
  });

  it("steps LabelInstruction and advances instructionIndex", () => {
    const document = compileScript('#scene("prologue")\n#label("start")\n');
    const initial = {
      ...createInitialRuntimeState(document),
      pointer: { filePath: "scenario/main.tzr", instructionIndex: 1 },
    };

    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({ type: "label", id: "start" });
    expect(result.state.pointer.instructionIndex).toBe(2);
  });

  it("steps NarrationInstruction", () => {
    const document = compileScript("The classroom was quiet.\n");
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toMatchObject({
      type: "narration",
      lines: [{ text: "The classroom was quiet." }],
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
  });

  it("steps DialogueInstruction", () => {
    const document = compileScript(":: Haruka\nYou're late again.\n");
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toMatchObject({
      type: "dialogue",
      speaker: "Haruka",
      lines: [{ text: "You're late again." }],
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
  });

  it("does not mutate the input state", () => {
    const document = compileScript('#scene("prologue")\n');
    const initial = createInitialRuntimeState(document);
    const before = JSON.stringify(initial);

    stepRuntime(document, initial);

    expect(JSON.stringify(initial)).toBe(before);
  });

  it("handles @waitClick and advances instructionIndex", () => {
    const document = compileScript("@waitClick()\n");
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({ type: "waitClick" });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.isWaitingForClick).toBe(true);
  });

  it("does not advance while waiting for click", () => {
    const document = compileScript("@waitClick()\n@page()\n");
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);

    expect(second.event).toEqual({ type: "waitClick" });
    expect(second.state).toBe(first.state);
  });

  it("clears click wait with clearClickWait and continues execution", () => {
    const document = compileScript("@waitClick()\n@page()\n");
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const cleared = clearClickWait(first.state);
    const second = stepRuntime(document, cleared);

    expect(cleared.isWaitingForClick).toBe(false);
    expect(second.event).toEqual({ type: "page" });
    expect(second.state.pointer.instructionIndex).toBe(2);
  });

  it("does not mutate state when clearing click wait", () => {
    const document = compileScript("@waitClick()\n");
    const waited = stepRuntime(document, createInitialRuntimeState(document));
    const before = JSON.stringify(waited.state);

    clearClickWait(waited.state);

    expect(JSON.stringify(waited.state)).toBe(before);
  });

  it("handles @page and advances instructionIndex", () => {
    const document = compileScript("@page()\n");
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({ type: "page" });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.isWaitingForClick).toBe(true);
  });

  it("handles @stop and advances instructionIndex", () => {
    const document = compileScript("@stop()\n");
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({ type: "stop" });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.isStopped).toBe(true);
  });

  it("handles @wait by setting pendingWait and advancing instructionIndex", () => {
    const document = compileScript('@wait(500)\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({ type: "wait", durationMs: 500 });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.pendingWait).toEqual({ durationMs: 500 });
  });

  it("does not advance while pendingWait is set", () => {
    const document = compileScript('@wait(500)\n@page()\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);

    expect(second.event).toEqual({ type: "wait", durationMs: 500 });
    expect(second.state).toBe(first.state);
  });

  it("clears pendingWait with clearWait and continues execution", () => {
    const document = compileScript('@wait(500)\n@page()\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const cleared = clearWait(first.state);
    const second = stepRuntime(document, cleared);

    expect(cleared.pendingWait).toBeNull();
    expect(second.event).toEqual({ type: "page" });
    expect(second.state.pointer.instructionIndex).toBe(2);
  });

  it("keeps pendingWait JSON serializable", () => {
    const document = compileScript('@wait(500)\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.state.pendingWait).toEqual({ durationMs: 500 });
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  it("does not mutate state when executing and clearing @wait", () => {
    const document = compileScript('@wait(500)\n');
    const initial = createInitialRuntimeState(document);
    const beforeStep = JSON.stringify(initial);
    const waited = stepRuntime(document, initial);
    const beforeClear = JSON.stringify(waited.state);

    clearWait(waited.state);

    expect(JSON.stringify(initial)).toBe(beforeStep);
    expect(JSON.stringify(waited.state)).toBe(beforeClear);
  });

  it("returns unsupported for unimplemented CommandInstruction", () => {
    const document = compileScript('@bg("school")\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({
      type: "unsupported",
      instructionType: "CommandInstruction",
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.isStopped).toBe(false);
  });

  it("dispatches non-core CommandInstruction to a registered plugin handler", () => {
    const document = compileScript('@bg("school")\n');
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

  it("uses the plugin handler state and event as the RuntimeStepResult", () => {
    const document = compileScript('@shake(target="screen")\n');
    const initial = createInitialRuntimeState(document);
    const returnedState = {
      ...initial,
      pointer: {
        filePath: "scenario/main.tzr",
        instructionIndex: 1,
      },
      flags: { shook: true },
    };

    const result = stepRuntime(document, initial, {
      commandHandlers: {
        shake: () => ({
          state: returnedState,
          event: { type: "pluginCommand", name: "shake" },
        }),
      },
    });

    expect(result).toEqual({
      state: returnedState,
      event: { type: "pluginCommand", name: "shake" },
    });
  });

  it("keeps Core command handling ahead of plugin handlers", () => {
    const document = compileScript("@waitClick()\n");
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

  it("does not mutate RuntimeState when dispatching plugin handlers", () => {
    const document = compileScript('@bg("school")\n');
    const initial = createInitialRuntimeState(document);
    const before = JSON.stringify(initial);

    stepRuntime(document, initial, {
      commandHandlers: {
        bg: (state, instruction) => ({
          state: {
            ...state,
            variables: {
              ...state.variables,
              background: "school",
            },
          },
          event: { type: "pluginCommand", name: instruction.name },
        }),
      },
    });

    expect(JSON.stringify(initial)).toBe(before);
  });

  it("executes @jump by moving to the target label instructionIndex", () => {
    const document = compileScript('@jump("#target")\n#label("middle")\n#label("target")\n');
    const initial = createInitialRuntimeState(document);

    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({
      type: "jump",
      label: "target",
      instructionIndex: 2,
    });
    expect(result.state.pointer).toEqual({
      filePath: "scenario/main.tzr",
      instructionIndex: 2,
    });
  });

  it("steps the target LabelInstruction after @jump", () => {
    const document = compileScript('@jump("#target")\n#label("target")\n');
    const jumped = stepRuntime(document, createInitialRuntimeState(document));
    const label = stepRuntime(document, jumped.state);

    expect(label.event).toEqual({ type: "label", id: "target" });
    expect(label.state.pointer.instructionIndex).toBe(2);
  });

  it("returns unsupported when @jump target label is missing at runtime", () => {
    const document = compileScript('#label("start")\n');
    const loc = document.instructions[0]?.loc;
    if (loc === undefined) {
      throw new Error("Expected fixture document to contain a label instruction.");
    }
    const brokenDocument: CompiledTzrDocument = {
      ...document,
      instructions: [
        {
          type: "CommandInstruction",
          name: "jump",
          args: [],
          jumpTarget: {
            raw: "#missing",
            label: "missing",
            loc,
          },
          loc,
        },
      ],
    };
    const result = stepRuntime(brokenDocument, createInitialRuntimeState(brokenDocument));

    expect(result.event).toEqual({
      type: "unsupported",
      instructionType: "CommandInstruction",
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
  });

  it("does not mutate state when executing @jump", () => {
    const document = compileScript('@jump("#target")\n#label("target")\n');
    const initial = createInitialRuntimeState(document);
    const before = JSON.stringify(initial);

    stepRuntime(document, initial);

    expect(JSON.stringify(initial)).toBe(before);
  });

  it("executes @set with string, number, and boolean values", () => {
    const document = compileScript('@set(name="route", value="haruka")\n@set(name="score", value=10)\n@set(name="cleared", value=true)\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);
    const third = stepRuntime(document, second.state);

    expect(first.event).toEqual({ type: "state", command: "set", name: "route", value: "haruka" });
    expect(second.event).toEqual({ type: "state", command: "set", name: "score", value: 10 });
    expect(third.event).toEqual({ type: "state", command: "set", name: "cleared", value: true });
    expect(third.state.variables).toEqual({
      route: "haruka",
      score: 10,
      cleared: true,
    });
    expect(third.state.pointer.instructionIndex).toBe(3);
  });

  it("executes @inc using 0 for undefined variables", () => {
    const document = compileScript('@inc(name="affection", by=2)\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({ type: "state", command: "inc", name: "affection", value: 2 });
    expect(result.state.variables).toEqual({ affection: 2 });
    expect(result.state.pointer.instructionIndex).toBe(1);
  });

  it("executes @inc using an existing number variable", () => {
    const document = compileScript('@inc(name="affection", by=2)\n');
    const initial = {
      ...createInitialRuntimeState(document),
      variables: { affection: 3 },
    };
    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({ type: "state", command: "inc", name: "affection", value: 5 });
    expect(result.state.variables).toEqual({ affection: 5 });
  });

  it("executes @dec using 0 for undefined variables", () => {
    const document = compileScript('@dec(name="affection", by=2)\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({ type: "state", command: "dec", name: "affection", value: -2 });
    expect(result.state.variables).toEqual({ affection: -2 });
    expect(result.state.pointer.instructionIndex).toBe(1);
  });

  it("executes @dec using an existing number variable", () => {
    const document = compileScript('@dec(name="affection", by=2)\n');
    const initial = {
      ...createInitialRuntimeState(document),
      variables: { affection: 3 },
    };
    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({ type: "state", command: "dec", name: "affection", value: 1 });
    expect(result.state.variables).toEqual({ affection: 1 });
  });

  it("executes @flag and @unflag", () => {
    const document = compileScript('@flag("met_haruka")\n@unflag("met_haruka")\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);

    expect(first.event).toEqual({ type: "state", command: "flag", name: "met_haruka", value: true });
    expect(first.state.flags).toEqual({ met_haruka: true });
    expect(first.state.pointer.instructionIndex).toBe(1);
    expect(second.event).toEqual({ type: "state", command: "unflag", name: "met_haruka", value: false });
    expect(second.state.flags).toEqual({ met_haruka: false });
    expect(second.state.pointer.instructionIndex).toBe(2);
  });

  it("does not mutate state when executing state commands", () => {
    const document = compileScript('@set(name="route", value="haruka")\n');
    const initial = {
      ...createInitialRuntimeState(document),
      variables: { existing: 1 },
      flags: { met_haruka: true },
    };
    const before = JSON.stringify(initial);

    stepRuntime(document, initial);

    expect(JSON.stringify(initial)).toBe(before);
  });

  it("executes the first thenBranch instruction for a true IfInstruction", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@waitClick()\n@page()\n@else\n@stop()\n@endif\n@page()\n');
    const initial = {
      ...createInitialRuntimeState(document),
      flags: { met_haruka: true },
    };

    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "waitClick" },
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.branchFrames).toHaveLength(1);
    expect(result.state.branchFrames[0]?.instructionIndex).toBe(1);
    expect(result.state.isWaitingForClick).toBe(true);
  });

  it("executes the first elseBranch instruction for a false IfInstruction", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@waitClick()\n@else\n@page()\n@stop()\n@endif\n@stop()\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({
      type: "if",
      result: false,
      branch: "else",
      event: { type: "page" },
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.branchFrames).toHaveLength(1);
    expect(result.state.branchFrames[0]?.instructionIndex).toBe(1);
    expect(result.state.isWaitingForClick).toBe(true);
  });

  it("advances to the next top-level instruction for a false IfInstruction without elseBranch", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@waitClick()\n@endif\n@page()\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({
      type: "if",
      result: false,
      branch: "none",
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.branchFrames).toEqual([]);
    expect(result.state.isWaitingForClick).toBe(false);
  });

  it("preserves top-level pointer behavior after executing a branch instruction", () => {
    const document = compileScript('@if(var("affection") >= 1)\n@inc(name="affection", by=1)\n@endif\n@page()\n');
    const initial = {
      ...createInitialRuntimeState(document),
      variables: { affection: 1 },
    };
    const first = stepRuntime(document, initial);
    const second = stepRuntime(document, first.state);

    expect(first.event).toEqual({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "state", command: "inc", name: "affection", value: 2 },
    });
    expect(first.state.pointer.instructionIndex).toBe(1);
    expect(first.state.branchFrames).toHaveLength(1);
    expect(first.state.variables).toEqual({ affection: 2 });
    expect(second.event).toEqual({ type: "page" });
  });

  it("executes multiple thenBranch instructions across multiple steps", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@inc(name="affection", by=1)\n@flag("saw_branch")\n@endif\n@page()\n');
    const initial = {
      ...createInitialRuntimeState(document),
      flags: { met_haruka: true },
    };

    const first = stepRuntime(document, initial);
    const second = stepRuntime(document, first.state);

    expect(first.event).toEqual({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "state", command: "inc", name: "affection", value: 1 },
    });
    expect(first.state.branchFrames[0]?.instructionIndex).toBe(1);
    expect(second.event).toEqual({ type: "state", command: "flag", name: "saw_branch", value: true });
    expect(second.state.pointer.instructionIndex).toBe(1);
    expect(second.state.branchFrames[0]?.instructionIndex).toBe(2);
    expect(second.state.variables).toEqual({ affection: 1 });
    expect(second.state.flags).toEqual({ met_haruka: true, saw_branch: true });
  });

  it("executes multiple elseBranch instructions across multiple steps", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@waitClick()\n@else\n@set(name="route", value="common")\n@flag("used_else")\n@endif\n@page()\n');

    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);

    expect(first.event).toEqual({
      type: "if",
      result: false,
      branch: "else",
      event: { type: "state", command: "set", name: "route", value: "common" },
    });
    expect(second.event).toEqual({ type: "state", command: "flag", name: "used_else", value: true });
    expect(second.state.pointer.instructionIndex).toBe(1);
    expect(second.state.branchFrames[0]?.instructionIndex).toBe(2);
    expect(second.state.variables).toEqual({ route: "common" });
    expect(second.state.flags).toEqual({ used_else: true });
  });

  it("returns to the next top-level instruction after a branch frame finishes", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@inc(name="affection", by=1)\n@flag("done")\n@endif\n@page()\n');
    const initial = {
      ...createInitialRuntimeState(document),
      flags: { met_haruka: true },
    };

    const first = stepRuntime(document, initial);
    const second = stepRuntime(document, first.state);
    const third = stepRuntime(document, clearClickWait(second.state));

    expect(third.event).toEqual({ type: "page" });
    expect(third.state.pointer.instructionIndex).toBe(2);
    expect(third.state.branchFrames).toEqual([]);
    expect(third.state.variables).toEqual({ affection: 1 });
    expect(third.state.flags).toEqual({ met_haruka: true, done: true });
  });

  it("does not advance past a branch @jump target", () => {
    const document = compileScript('@if(flag("go"))\n@jump("#target")\n@endif\n@page()\n#label("target")\n');
    const initial = {
      ...createInitialRuntimeState(document),
      flags: { go: true },
    };

    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({
      type: "if",
      result: true,
      branch: "then",
      event: {
        type: "jump",
        label: "target",
        instructionIndex: 2,
      },
    });
    expect(result.state.pointer.instructionIndex).toBe(2);
    expect(result.state.branchFrames).toEqual([]);
  });

  it("keeps branch frames JSON serializable", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@inc(name="affection", by=1)\n@flag("saw_branch")\n@endif\n');
    const initial = {
      ...createInitialRuntimeState(document),
      flags: { met_haruka: true },
    };

    const result = stepRuntime(document, initial);

    expect(result.state.branchFrames).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  it("does not mutate state when executing IfInstruction", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@waitClick()\n@endif\n');
    const initial = {
      ...createInitialRuntimeState(document),
      flags: { met_haruka: true },
    };
    const before = JSON.stringify(initial);

    stepRuntime(document, initial);

    expect(JSON.stringify(initial)).toBe(before);
  });

  it("reports runtime block reasons", () => {
    const document = compileScript("@waitClick()\n");
    const initial = createInitialRuntimeState(document);
    const clickWait = stepRuntime(document, initial).state;
    const waitDocument = compileScript("@wait(500)\n");
    const wait = stepRuntime(waitDocument, createInitialRuntimeState(waitDocument)).state;
    const choiceDocument = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const choice = stepRuntime(choiceDocument, createInitialRuntimeState(choiceDocument)).state;

    expect(isRuntimeBlocked(initial)).toBe(false);
    expect(getRuntimeBlockReason(initial)).toBeNull();
    expect(isRuntimeBlocked(clickWait)).toBe(true);
    expect(getRuntimeBlockReason(clickWait)).toBe("click");
    expect(getRuntimeBlockReason(wait)).toBe("wait");
    expect(getRuntimeBlockReason(choice)).toBe("choice");
  });

  it("handles ChoiceInstruction by entering pending choice state", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n- "Go" -> #go\n#label("stay")\n#label("go")\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [
        { text: "Stay", targetRaw: "#stay", targetLabel: "stay" },
        { text: "Go", targetRaw: "#go", targetLabel: "go" },
      ],
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.pendingChoice).toEqual({
      question: "Choose",
      items: [
        { text: "Stay", targetRaw: "#stay", targetLabel: "stay" },
        { text: "Go", targetRaw: "#go", targetLabel: "go" },
      ],
    });
  });

  it("keeps pendingChoice JSON serializable", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.state.pendingChoice).toBeDefined();
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  it("does not advance while waiting for choice resolution", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);

    expect(second.event).toEqual(first.event);
    expect(second.state).toBe(first.state);
  });

  it("resolves a pending choice by moving to the selected target label", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n- "Go" -> #go\n#label("stay")\n#label("go")\n');
    const choice = stepRuntime(document, createInitialRuntimeState(document));

    const result = resolveChoice(document, choice.state, 1);

    expect(result.event).toEqual({
      type: "jump",
      label: "go",
      instructionIndex: 2,
    });
    expect(result.state.pointer).toEqual({
      filePath: "scenario/main.tzr",
      instructionIndex: 2,
    });
    expect(result.state.pendingChoice).toBeNull();
  });

  it("clears branch frames when resolving a choice", () => {
    const document = compileScript('@if(flag("met_haruka"))\n? Choose\n- "Stay" -> #stay\n@endif\n@page()\n#label("stay")\n');
    const initial = {
      ...createInitialRuntimeState(document),
      flags: { met_haruka: true },
    };
    const choice = stepRuntime(document, initial);

    const result = resolveChoice(document, choice.state, 0);

    expect(result.event).toEqual({
      type: "jump",
      label: "stay",
      instructionIndex: 2,
    });
    expect(result.state.branchFrames).toEqual([]);
    expect(result.state.pendingChoice).toBeNull();
  });

  it("returns unsupported when resolving without a pending choice or with an invalid index", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const initial = createInitialRuntimeState(document);
    const choice = stepRuntime(document, initial);

    expect(resolveChoice(document, initial, 0).event).toEqual({
      type: "unsupported",
      instructionType: "ChoiceInstruction",
    });
    expect(resolveChoice(document, choice.state, 1).event).toEqual({
      type: "unsupported",
      instructionType: "ChoiceInstruction",
    });
  });

  it("does not mutate state when executing and resolving ChoiceInstruction", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const initial = createInitialRuntimeState(document);
    const beforeStep = JSON.stringify(initial);
    const choice = stepRuntime(document, initial);
    const beforeResolve = JSON.stringify(choice.state);

    resolveChoice(document, choice.state, 0);

    expect(JSON.stringify(initial)).toBe(beforeStep);
    expect(JSON.stringify(choice.state)).toBe(beforeResolve);
  });

  it("steps the target label after resolving a choice", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const choice = stepRuntime(document, createInitialRuntimeState(document));
    const resolved = resolveChoice(document, choice.state, 0);
    const label = stepRuntime(document, resolved.state);

    expect(label.event).toEqual({ type: "label", id: "stay" });
    expect(label.state.pointer.instructionIndex).toBe(2);
  });

  it("returns end event and stopped state at script end", () => {
    const document = compileScript('#scene("prologue")\n');
    const initial = {
      ...createInitialRuntimeState(document),
      pointer: { filePath: "scenario/main.tzr", instructionIndex: document.instructions.length },
    };

    const result = stepRuntime(document, initial);

    expect(result.event).toEqual({ type: "end" });
    expect(result.state).toEqual({
      ...initial,
      isStopped: true,
    });
  });

  it("snapshots and restores initial state", () => {
    const document = compileScript('#scene("prologue")\n');
    const state = createInitialRuntimeState(document);

    const snapshot = createRuntimeSnapshot(state);
    const restored = restoreRuntimeState(snapshot);

    expect(snapshot.version).toBe(1);
    expect(restored).toEqual(state);
  });

  it("preserves variables and flags in snapshots", () => {
    const document = compileScript('@set(name="route", value="haruka")\n@flag("met_haruka")\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);

    const restored = restoreRuntimeState(createRuntimeSnapshot(second.state));

    expect(restored.variables).toEqual({ route: "haruka" });
    expect(restored.flags).toEqual({ met_haruka: true });
  });

  it("preserves pointer in snapshots", () => {
    const document = compileScript('#scene("prologue")\n#label("start")\n');
    const state = {
      ...createInitialRuntimeState(document),
      pointer: { filePath: "scenario/main.tzr", instructionIndex: 1 },
    };

    const restored = restoreRuntimeState(createRuntimeSnapshot(state));

    expect(restored.pointer).toEqual({ filePath: "scenario/main.tzr", instructionIndex: 1 });
  });

  it("preserves pendingChoice in snapshots", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const choice = stepRuntime(document, createInitialRuntimeState(document));

    const restored = restoreRuntimeState(createRuntimeSnapshot(choice.state));

    expect(restored.pendingChoice).toEqual(choice.state.pendingChoice);
  });

  it("preserves pendingWait in snapshots", () => {
    const document = compileScript("@wait(500)\n");
    const wait = stepRuntime(document, createInitialRuntimeState(document));

    const restored = restoreRuntimeState(createRuntimeSnapshot(wait.state));

    expect(restored.pendingWait).toEqual({ durationMs: 500 });
  });

  it("preserves isWaitingForClick in snapshots", () => {
    const document = compileScript("@waitClick()\n");
    const waitClick = stepRuntime(document, createInitialRuntimeState(document));

    const restored = restoreRuntimeState(createRuntimeSnapshot(waitClick.state));

    expect(restored.isWaitingForClick).toBe(true);
  });

  it("preserves branchFrames in snapshots", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@inc(name="affection", by=1)\n@flag("done")\n@endif\n@page()\n');
    const state = stepRuntime(document, {
      ...createInitialRuntimeState(document),
      flags: { met_haruka: true },
    }).state;

    const restored = restoreRuntimeState(createRuntimeSnapshot(state));

    expect(restored.branchFrames).toEqual(state.branchFrames);
    expect(restored.branchFrames[0]?.instructionIndex).toBe(1);
  });

  it("continues execution with stepRuntime after restore", () => {
    const document = compileScript('#scene("prologue")\n:: Haruka\nHello.\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const restored = restoreRuntimeState(createRuntimeSnapshot(first.state));

    const second = stepRuntime(document, restored);

    expect(second.event).toMatchObject({
      type: "dialogue",
      speaker: "Haruka",
    });
    expect(second.state.pointer.instructionIndex).toBe(2);
  });

  it("creates JSON serializable snapshots", () => {
    const document = compileScript('@set(name="route", value="haruka")\n@wait(500)\n');
    const first = stepRuntime(document, createInitialRuntimeState(document));
    const second = stepRuntime(document, first.state);
    const snapshot = createRuntimeSnapshot(second.state);

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
