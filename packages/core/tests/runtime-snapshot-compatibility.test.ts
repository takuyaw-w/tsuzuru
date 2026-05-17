import { describe, expect, it } from "vitest";
import {
  createInitialRuntimeState,
  createRuntimeSnapshot,
  type RuntimeDocument,
  type RuntimeSnapshot,
  restoreRuntimeState,
  stepRuntime,
} from "../src/index.js";

const document = {
  filePath: "scenario/snapshot-compatibility.tzr",
  instructions: [
    {
      type: "SceneInstruction",
      id: "start",
      loc: {
        start: { filePath: "scenario/snapshot-compatibility.tzr", line: 1, column: 1 },
        end: { filePath: "scenario/snapshot-compatibility.tzr", line: 1, column: 1 },
      },
    },
  ],
  scenes: {
    start: {
      id: "start",
      statementIndex: 0,
      loc: {
        start: { filePath: "scenario/snapshot-compatibility.tzr", line: 1, column: 1 },
        end: { filePath: "scenario/snapshot-compatibility.tzr", line: 1, column: 1 },
      },
    },
  },
} satisfies RuntimeDocument;

describe("RuntimeSnapshot compatibility", () => {
  it("restores a valid version 2 JSON snapshot", () => {
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const snapshot = jsonRoundTrip(createRuntimeSnapshot(scene.state));

    const restored = restoreRuntimeState(snapshot);

    expect(snapshot.version).toBe(2);
    expect(restored).toEqual(scene.state);
    expect(restored).not.toBe(scene.state);
  });

  it("rejects a missing snapshot version", () => {
    const snapshot = validSnapshot();
    const { version: _version, ...withoutVersion } = snapshot;

    expectInvalidSnapshot(withoutVersion, "version");
  });

  it("rejects unsupported old snapshot versions", () => {
    expectInvalidSnapshot({ ...validSnapshot(), version: 1 }, "unsupported old snapshot version");
  });

  it("rejects unsupported future snapshot versions", () => {
    expectInvalidSnapshot({ ...validSnapshot(), version: 3 }, "unsupported future snapshot version");
  });

  it("rejects non-number snapshot versions", () => {
    expectInvalidSnapshot({ ...validSnapshot(), version: "2" }, "version");
  });

  it("rejects a missing pointer", () => {
    const { pointer: _pointer, ...withoutPointer } = validSnapshot();

    expectInvalidSnapshot(withoutPointer, "pointer");
  });

  it("rejects malformed pointers", () => {
    expectInvalidSnapshot({ ...validSnapshot(), pointer: { filePath: 1, instructionIndex: 1 } }, "pointer.filePath");
    expectInvalidSnapshot(
      { ...validSnapshot(), pointer: { filePath: "scenario.tzr", instructionIndex: "1" } },
      "pointer.instructionIndex",
    );
  });

  it("rejects missing variables", () => {
    const { variables: _variables, ...withoutVariables } = validSnapshot();

    expectInvalidSnapshot(withoutVariables, "variables");
  });

  it("rejects malformed variables", () => {
    expectInvalidSnapshot({ ...validSnapshot(), variables: [] }, "variables");
    expectInvalidSnapshot({ ...validSnapshot(), variables: { "scenario.score": { value: 1 } } }, "variables");
  });

  it("rejects missing or malformed plugins", () => {
    const { plugins: _plugins, ...withoutPlugins } = validSnapshot();

    expectInvalidSnapshot(withoutPlugins, "plugins");
    expectInvalidSnapshot({ ...validSnapshot(), plugins: [] }, "plugins");
  });

  it("rejects malformed branch frames", () => {
    expectInvalidSnapshot({ ...validSnapshot(), branchFrames: {} }, "branchFrames");
    expectInvalidSnapshot(
      { ...validSnapshot(), branchFrames: [{ instructions: {}, instructionIndex: 0 }] },
      "branchFrames[0].instructions",
    );
    expectInvalidSnapshot(
      { ...validSnapshot(), branchFrames: [{ instructions: [], instructionIndex: -1 }] },
      "branchFrames[0].instructionIndex",
    );
  });

  it("rejects malformed pending choices", () => {
    expectInvalidSnapshot({ ...validSnapshot(), pendingChoice: {} }, "pendingChoice.kind");
    expectInvalidSnapshot(
      { ...validSnapshot(), pendingChoice: { kind: "body", question: "Choose", items: {} } },
      "pendingChoice.items",
    );
    expectInvalidSnapshot(
      {
        ...validSnapshot(),
        pendingChoice: { kind: "body", question: "Choose", items: [{ text: "Open", body: {} }] },
      },
      "pendingChoice.items[0].body",
    );
  });

  it("rejects malformed pending waits", () => {
    expectInvalidSnapshot({ ...validSnapshot(), pendingWait: {} }, "pendingWait.durationMs");
    expectInvalidSnapshot({ ...validSnapshot(), pendingWait: { durationMs: -1 } }, "pendingWait.durationMs");
  });

  it("rejects missing boolean flags", () => {
    const { isStopped: _isStopped, ...withoutIsStopped } = validSnapshot();
    const { isWaitingForClick: _isWaitingForClick, ...withoutIsWaitingForClick } = validSnapshot();

    expectInvalidSnapshot(withoutIsStopped, "isStopped");
    expectInvalidSnapshot(withoutIsWaitingForClick, "isWaitingForClick");
  });
});

function validSnapshot(): RuntimeSnapshot {
  const scene = stepRuntime(document, createInitialRuntimeState(document));
  return jsonRoundTrip(createRuntimeSnapshot(scene.state));
}

function expectInvalidSnapshot(value: unknown, message: string): void {
  expect(() => restoreRuntimeState(value as RuntimeSnapshot)).toThrow("Invalid RuntimeSnapshot:");
  expect(() => restoreRuntimeState(value as RuntimeSnapshot)).toThrow(message);
}

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
