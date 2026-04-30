import { describe, expect, it } from "vitest";
import { compileTzr, createInitialRuntimeState, parseTzr } from "../src/index.js";

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
