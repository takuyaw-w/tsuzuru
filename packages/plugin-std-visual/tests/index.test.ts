import { describe, expect, it } from "vitest";
import { compileTzr, createInitialRuntimeState, parseTzr, stepRuntime } from "@tsuzuru/core";
import {
  createStdVisualCommandHandlers,
  createStdVisualPlugin,
  getStdVisualState,
  stdVisualPluginCommands,
} from "../src/index.js";

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

describe("std-visual commands", () => {
  it("sets the background with @bg", () => {
    const result = runStdVisualScript('@bg("classroom")\n');

    expect(getStdVisualState(result.state).background).toEqual({ assetId: "classroom" });
  });

  it("overwrites the previous background when @bg runs again", () => {
    const result = runStdVisualScript(`@bg("classroom")
@bg("street")
`);

    expect(getStdVisualState(result.state).background).toEqual({ assetId: "street" });
  });

  it("shows a sprite at center by default", () => {
    const result = runStdVisualScript('@show("alice_smile")\n');

    expect(getStdVisualState(result.state).sprites.alice_smile).toEqual({ position: "center" });
  });

  it("shows a sprite at a named position", () => {
    const result = runStdVisualScript('@show("alice_smile", position="left")\n');

    expect(getStdVisualState(result.state).sprites.alice_smile).toEqual({ position: "left" });
  });

  it("updates an existing sprite when @show runs for the same asset", () => {
    const result = runStdVisualScript(`@show("alice_smile", position="left")
@show("alice_smile", position="right")
`);

    expect(getStdVisualState(result.state).sprites.alice_smile).toEqual({ position: "right" });
  });

  it("allows multiple sprites to share the same position", () => {
    const result = runStdVisualScript(`@show("alice_smile", position="left")
@show("yu_smile", position="left")
`);

    expect(getStdVisualState(result.state).sprites).toEqual({
      alice_smile: { position: "left" },
      yu_smile: { position: "left" },
    });
  });

  it("hides an existing sprite", () => {
    const result = runStdVisualScript(`@show("alice_smile")
@hide("alice_smile")
`);

    expect(getStdVisualState(result.state).sprites).toEqual({});
  });

  it("emits a runtime warning when hiding a missing sprite", () => {
    const result = runStdVisualScript('@hide("missing")\n');

    expect(getStdVisualState(result.state).sprites).toEqual({});
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        code: "plugin.stdVisual.hideTargetNotFound",
        message: 'Cannot hide "missing" because it is not visible.',
      },
    ]);
  });

  it("rejects empty asset ids", () => {
    const compiled = compileStdVisualScript(`@bg("")
@show("")
@hide("")
`);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors.map((error) => error.message)).toEqual([
      "@bg positional argument 1 must be a non-empty string.",
      "@show positional argument 1 must be a non-empty string.",
      "@hide positional argument 1 must be a non-empty string.",
    ]);
  });

  it("rejects invalid sprite positions", () => {
    const compiled = compileStdVisualScript('@show("alice", position="top")\n');

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors.map((error) => error.message)).toEqual([
      '@show argument "position" must be one of "left", "center", or "right".',
    ]);
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

function compileStdVisualScript(source: string) {
  const parsed = parseTzr(source, { filePath: "scenario/main.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  return compileTzr(parsed.document, {
    pluginCommands: stdVisualPluginCommands,
  });
}

function runStdVisualScript(source: string) {
  const compiled = compileStdVisualScript(source);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }

  const diagnostics: Array<{ readonly severity: "warning"; readonly code: string; readonly message: string }> = [];
  let state = createInitialRuntimeState(compiled.document, {
    plugins: [createStdVisualPlugin()],
  });

  for (let index = 0; index < compiled.document.instructions.length; index += 1) {
    const result = stepRuntime(compiled.document, state, {
      commandHandlers: createStdVisualCommandHandlers(),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    state = result.state;
  }

  return { state, diagnostics };
}
