import {
  type CompiledTzrDocument,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  restoreRuntimeState,
  stepRuntime,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import { createStdParticleCommandHandlers, createStdParticlePlugin, getStdParticleState } from "../src/index.js";

const filePath = "scenario/std-particle-save-load.tzr";

describe("std particle save/load integration", () => {
  it("keeps durable particle state across snapshot restore and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  particle rain intensity=strong
  narration:
    Snow next.
  particle snow
  narration:
    After snow.
  stopParticle
  narration:
    Done.
`);
    const commandHandlers = createStdParticleCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdParticlePlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const rain = stepRuntime(document, scene.state, { commandHandlers });

    expect(getStdParticleState(rain.state)).toEqual({
      current: { type: "rain", intensity: "strong" },
    });

    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(rain.state)));

    expect(restored.pointer).toEqual({ filePath, instructionIndex: 2 });
    expect(getStdParticleState(restored)).toEqual({
      current: { type: "rain", intensity: "strong" },
    });

    const snowNext = stepRuntime(document, restored, { commandHandlers });
    expect(snowNext.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Snow next." }],
    });
    expect(getStdParticleState(snowNext.state)).toEqual(getStdParticleState(restored));

    const snow = stepRuntime(document, snowNext.state, { commandHandlers });
    expect(getStdParticleState(snow.state)).toEqual({
      current: { type: "snow", intensity: "normal" },
    });

    const afterSnow = stepRuntime(document, snow.state, { commandHandlers });
    expect(afterSnow.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After snow." }],
    });

    const stopParticle = stepRuntime(document, afterSnow.state, { commandHandlers });
    expect(getStdParticleState(stopParticle.state)).toEqual({ current: null });

    const done = stepRuntime(document, stopParticle.state, { commandHandlers });
    expect(done.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Done." }],
    });
  });
});

function compileSource(source: string): CompiledTzrDocument {
  const parsed = parseTzr(source, { filePath });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  const compiled = compileTzr(parsed.document, {
    plugins: [createStdParticlePlugin()],
  });
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }
  return compiled.document;
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
