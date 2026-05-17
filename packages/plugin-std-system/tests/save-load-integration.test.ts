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
import {
  createStdSystemCommandHandlers,
  createStdSystemPlugin,
  getStdSystemState,
  isAchievementUnlocked,
  isCgUnlocked,
  isEndingUnlocked,
} from "../src/index.js";

const filePath = "scenario/std-system-save-load.tzr";

describe("std system save/load integration", () => {
  it("keeps durable unlock state across snapshot restore and resumes without replaying commands", () => {
    const document = compileSource(`scene start:
  call system.unlockEnding(id=trueEnd)
  call system.unlockCg(id="gallery-main")
  call system.unlockAchievement(id=firstClear)
  narration:
    After unlocks.
`);
    const commandHandlers = createStdSystemCommandHandlers();
    const initialState = createInitialRuntimeState(document, {
      plugins: [createStdSystemPlugin()],
    });

    const scene = stepRuntime(document, initialState, { commandHandlers });
    const ending = stepRuntime(document, scene.state, { commandHandlers });
    const cg = stepRuntime(document, ending.state, { commandHandlers });
    const achievement = stepRuntime(document, cg.state, { commandHandlers });

    expect(getStdSystemState(achievement.state)).toEqual({
      endings: { trueEnd: { unlocked: true } },
      cgs: { "gallery-main": { unlocked: true } },
      achievements: { firstClear: { unlocked: true } },
    });

    const restored = restoreRuntimeState(jsonRoundTrip(createRuntimeSnapshot(achievement.state)));
    const restoredSystem = getStdSystemState(restored);

    expect(restored.pointer).toEqual({ filePath, instructionIndex: 4 });
    expect(isEndingUnlocked(restoredSystem, "trueEnd")).toBe(true);
    expect(isCgUnlocked(restoredSystem, "gallery-main")).toBe(true);
    expect(isAchievementUnlocked(restoredSystem, "firstClear")).toBe(true);
    expect(getStdSystemState(restored)).toEqual(getStdSystemState(achievement.state));

    const afterUnlocks = stepRuntime(document, restored, { commandHandlers });
    expect(afterUnlocks.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After unlocks." }],
    });
    expect(getStdSystemState(afterUnlocks.state)).toEqual(getStdSystemState(restored));
  });
});

function compileSource(source: string): CompiledTzrDocument {
  const parsed = parseTzr(source, { filePath });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }

  const compiled = compileTzr(parsed.document, {
    plugins: [createStdSystemPlugin()],
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
