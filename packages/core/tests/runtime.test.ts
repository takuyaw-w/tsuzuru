import { describe, expect, it } from "vitest";
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
