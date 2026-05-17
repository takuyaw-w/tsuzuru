import { describe, expect, it } from "vitest";
import {
  createInitialRuntimeState,
  createRuntimeSnapshot,
  type RuntimeDocument,
  type RuntimeSaveSlot,
  type RuntimeSaveSlotContext,
  type RuntimeSnapshot,
  stepRuntime,
  validateRuntimeSaveSlot,
} from "../src/index.js";

const context = {
  scenarioId: "tsuzuru.test.scenario",
  scenarioVersion: "2026-05",
} satisfies RuntimeSaveSlotContext;

const document = {
  filePath: "scenario/runtime-save-slot.tzr",
  instructions: [
    {
      type: "SceneInstruction",
      id: "start",
      loc: {
        start: { filePath: "scenario/runtime-save-slot.tzr", line: 1, column: 1 },
        end: { filePath: "scenario/runtime-save-slot.tzr", line: 1, column: 1 },
      },
    },
  ],
  scenes: {
    start: {
      id: "start",
      statementIndex: 0,
      loc: {
        start: { filePath: "scenario/runtime-save-slot.tzr", line: 1, column: 1 },
        end: { filePath: "scenario/runtime-save-slot.tzr", line: 1, column: 1 },
      },
    },
  },
} satisfies RuntimeDocument;

describe("RuntimeSaveSlot validation", () => {
  it("accepts a valid save slot", () => {
    const slot = validSlot();

    expect(validateRuntimeSaveSlot(slot, context)).toEqual({ ok: true, slot });
  });

  it("rejects missing save slot versions", () => {
    const { version: _version, ...withoutVersion } = validSlot();

    expectInvalidSlot(withoutVersion, "unsupported_slot_version");
  });

  it("rejects unsupported old save slot versions", () => {
    expectInvalidSlot(validSlot({ version: 0 }), "unsupported_slot_version");
  });

  it("rejects unsupported future save slot versions", () => {
    expectInvalidSlot(validSlot({ version: 2 }), "unsupported_slot_version");
  });

  it("rejects missing scenario ids", () => {
    const { scenarioId: _scenarioId, ...withoutScenarioId } = validSlot();

    expectInvalidSlot(withoutScenarioId, "invalid_slot");
  });

  it("rejects scenario id mismatches", () => {
    expectInvalidSlot(validSlot({ scenarioId: "tsuzuru.other.scenario" }), "scenario_id_mismatch");
  });

  it("accepts matching scenario ids", () => {
    const slot = validSlot({ scenarioId: context.scenarioId });

    expect(validateRuntimeSaveSlot(slot, context)).toEqual({ ok: true, slot });
  });

  it("rejects scenario version mismatches when both versions are present", () => {
    expectInvalidSlot(validSlot({ scenarioVersion: "older" }), "scenario_version_mismatch");
  });

  it("accepts missing scenario versions when the context also has no scenario version", () => {
    const contextWithoutVersion = { scenarioId: context.scenarioId } satisfies RuntimeSaveSlotContext;
    const { scenarioVersion: _scenarioVersion, ...slotWithoutScenarioVersion } = validSlot();

    expect(validateRuntimeSaveSlot(slotWithoutScenarioVersion, contextWithoutVersion)).toEqual({
      ok: true,
      slot: slotWithoutScenarioVersion,
    });
  });

  it("accepts slot scenario versions when the context scenario version matches", () => {
    const slot = validSlot({ scenarioVersion: context.scenarioVersion });

    expect(validateRuntimeSaveSlot(slot, context)).toEqual({ ok: true, slot });
  });

  it("rejects invalid createdAt values", () => {
    expectInvalidSlot(validSlot({ createdAt: 1 }), "invalid_slot");
  });

  it("rejects missing snapshots as invalid snapshots", () => {
    const { snapshot: _snapshot, ...withoutSnapshot } = validSlot();

    expectInvalidSlot(withoutSnapshot, "invalid_snapshot");
  });

  it("rejects invalid snapshots as invalid snapshots", () => {
    const result = validateRuntimeSaveSlot(validSlot({ snapshot: { version: 3 } }), context);

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid_snapshot",
      message: expect.stringContaining("Invalid RuntimeSnapshot:"),
    });
  });

  it("accepts valid runtime snapshots", () => {
    const snapshot = validSnapshot();
    const slot = validSlot({ snapshot });

    expect(validateRuntimeSaveSlot(slot, context)).toEqual({ ok: true, slot });
  });

  it("rejects non-string labels", () => {
    expectInvalidSlot(validSlot({ label: 1 }), "invalid_slot");
  });

  it("rejects non-object metadata", () => {
    expectInvalidSlot(validSlot({ metadata: "metadata" }), "invalid_slot");
  });

  it("does not inspect metadata deep values", () => {
    const slot = validSlot({
      metadata: {
        nested: {
          value: ["host-defined", { preview: true }],
        },
      },
    });

    expect(validateRuntimeSaveSlot(slot, context)).toEqual({ ok: true, slot });
  });
});

function validSlot(overrides: Readonly<Record<string, unknown>> = {}): RuntimeSaveSlot {
  return {
    version: 1,
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    createdAt: "2026-05-17T00:00:00.000Z",
    snapshot: validSnapshot(),
    ...overrides,
  } as RuntimeSaveSlot;
}

function validSnapshot(): RuntimeSnapshot {
  const scene = stepRuntime(document, createInitialRuntimeState(document));
  return jsonRoundTrip(createRuntimeSnapshot(scene.state));
}

function expectInvalidSlot(
  value: unknown,
  reason: Exclude<ReturnType<typeof validateRuntimeSaveSlot>, { readonly ok: true }>["reason"],
): void {
  expect(validateRuntimeSaveSlot(value, context)).toMatchObject({ ok: false, reason });
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
