import { describe, expect, it } from "vitest";
import type { CompiledTzrDocument } from "../src/index.js";
import { compileTzr, createInitialRuntimeState, parseTzr, stepRuntime } from "../src/index.js";

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

    const compiled = compileTzr(parsed.document);

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

    const compiled = compileTzr(parsed.document);
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

  it("returns unsupported for unimplemented CommandInstruction", () => {
    const document = compileScript('@wait(500)\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({
      type: "unsupported",
      instructionType: "CommandInstruction",
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
    expect(result.state.isStopped).toBe(false);
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

  it("returns unsupported for IfInstruction", () => {
    const document = compileScript('@if(flag("met_haruka"))\n@waitClick()\n@endif\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({
      type: "unsupported",
      instructionType: "IfInstruction",
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
  });

  it("returns unsupported for ChoiceInstruction", () => {
    const document = compileScript('? Choose\n- "Stay" -> #stay\n#label("stay")\n');
    const result = stepRuntime(document, createInitialRuntimeState(document));

    expect(result.event).toEqual({
      type: "unsupported",
      instructionType: "ChoiceInstruction",
    });
    expect(result.state.pointer.instructionIndex).toBe(1);
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
});
