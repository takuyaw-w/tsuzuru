import { describe, expect, it } from "vitest";
import { compileTzr, createInitialRuntimeState, parseTzr } from "@tsuzuru/core";
import { createStdVisualPlugin, getStdVisualState } from "../src/index.js";

describe("createStdVisualPlugin", () => {
  it("initializes runtimeState.plugins.stdVisual", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdVisualPlugin()],
    });

    expect(state.plugins.stdVisual).toEqual({
      background: null,
      sprites: {},
    });
    expect(getStdVisualState(state)).toEqual({
      background: null,
      sprites: {},
    });
  });

  it("throws when stdVisual state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdVisualState(state)).toThrow(
      "runtimeState.plugins.stdVisual is not initialized. Register createStdVisualPlugin().",
    );
  });
});

function createDocument() {
  const parsed = parseTzr("#scene(\"main\")\n", { filePath: "scenario/main.tzr" });
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
