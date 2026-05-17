import type { TzrInstruction } from "./ir.js";
import type { RuntimePendingChoice, RuntimeSnapshot, RuntimeState } from "./runtime-types.js";

export function createRuntimeSnapshot(state: RuntimeState): RuntimeSnapshot {
  return {
    version: 2,
    pointer: { ...state.pointer },
    variables: { ...state.variables },
    plugins: clonePluginStates(state.plugins),
    branchFrames: state.branchFrames.map((frame) => ({
      instructions: cloneInstructions(frame.instructions),
      instructionIndex: frame.instructionIndex,
    })),
    pendingChoice: clonePendingChoice(state.pendingChoice),
    pendingWait: state.pendingWait === null ? null : { ...state.pendingWait },
    isStopped: state.isStopped,
    isWaitingForClick: state.isWaitingForClick,
  };
}

export function restoreRuntimeState(snapshot: RuntimeSnapshot): RuntimeState {
  assertRuntimeSnapshot(snapshot);

  return {
    pointer: { ...snapshot.pointer },
    variables: { ...snapshot.variables },
    plugins: clonePluginStates(snapshot.plugins),
    branchFrames: snapshot.branchFrames.map((frame) => ({
      instructions: cloneInstructions(frame.instructions),
      instructionIndex: frame.instructionIndex,
    })),
    pendingChoice: clonePendingChoice(snapshot.pendingChoice),
    pendingWait: snapshot.pendingWait === null ? null : { ...snapshot.pendingWait },
    isStopped: snapshot.isStopped,
    isWaitingForClick: snapshot.isWaitingForClick,
  };
}

function assertRuntimeSnapshot(value: unknown): asserts value is RuntimeSnapshot {
  if (!isObjectRecord(value)) {
    invalidRuntimeSnapshot("snapshot must be an object.");
  }

  assertSnapshotVersion(value.version);
  assertRuntimePointer(value.pointer, "pointer");
  assertRuntimeVariables(value.variables);
  assertPluginStates(value.plugins);
  assertBranchFrames(value.branchFrames);
  assertPendingChoice(value.pendingChoice);
  assertPendingWait(value.pendingWait);

  if (typeof value.isStopped !== "boolean") {
    invalidRuntimeSnapshot("isStopped must be a boolean.");
  }
  if (typeof value.isWaitingForClick !== "boolean") {
    invalidRuntimeSnapshot("isWaitingForClick must be a boolean.");
  }
}

function assertSnapshotVersion(version: unknown): void {
  if (typeof version !== "number" || !Number.isFinite(version)) {
    invalidRuntimeSnapshot("version must be 2.");
  }
  if (version < 2) {
    invalidRuntimeSnapshot(`unsupported old snapshot version ${version}; expected version 2.`);
  }
  if (version > 2) {
    invalidRuntimeSnapshot(`unsupported future snapshot version ${version}; expected version 2.`);
  }
  if (version !== 2) {
    invalidRuntimeSnapshot("version must be 2.");
  }
}

function assertRuntimePointer(value: unknown, path: string): void {
  if (!isObjectRecord(value)) {
    invalidRuntimeSnapshot(`${path} must be an object.`);
  }
  if (typeof value.filePath !== "string") {
    invalidRuntimeSnapshot(`${path}.filePath must be a string.`);
  }
  assertNonNegativeInteger(value.instructionIndex, `${path}.instructionIndex`);
}

function assertRuntimeVariables(value: unknown): void {
  if (!isObjectRecord(value)) {
    invalidRuntimeSnapshot("variables must be an object.");
  }

  for (const [name, variable] of Object.entries(value)) {
    if (!isRuntimeValue(variable)) {
      invalidRuntimeSnapshot(`variables.${name} must be a string, number, boolean, or null.`);
    }
  }
}

function assertPluginStates(value: unknown): void {
  if (!isObjectRecord(value)) {
    invalidRuntimeSnapshot("plugins must be an object.");
  }
}

function assertBranchFrames(value: unknown): void {
  if (!Array.isArray(value)) {
    invalidRuntimeSnapshot("branchFrames must be an array.");
  }

  value.forEach((frame, index) => {
    const path = `branchFrames[${index}]`;
    if (!isObjectRecord(frame)) {
      invalidRuntimeSnapshot(`${path} must be an object.`);
    }
    if (!Array.isArray(frame.instructions)) {
      invalidRuntimeSnapshot(`${path}.instructions must be an array.`);
    }
    assertNonNegativeInteger(frame.instructionIndex, `${path}.instructionIndex`);
  });
}

function assertPendingChoice(value: unknown): void {
  if (value === null) {
    return;
  }
  if (!isObjectRecord(value)) {
    invalidRuntimeSnapshot("pendingChoice must be null or an object.");
  }
  if (value.kind !== "body") {
    invalidRuntimeSnapshot('pendingChoice.kind must be "body".');
  }
  if (typeof value.question !== "string") {
    invalidRuntimeSnapshot("pendingChoice.question must be a string.");
  }
  if (!Array.isArray(value.items)) {
    invalidRuntimeSnapshot("pendingChoice.items must be an array.");
  }

  value.items.forEach((item, index) => {
    const path = `pendingChoice.items[${index}]`;
    if (!isObjectRecord(item)) {
      invalidRuntimeSnapshot(`${path} must be an object.`);
    }
    if (item.id !== undefined && typeof item.id !== "string") {
      invalidRuntimeSnapshot(`${path}.id must be a string when present.`);
    }
    if (typeof item.text !== "string") {
      invalidRuntimeSnapshot(`${path}.text must be a string.`);
    }
    if (!Array.isArray(item.body)) {
      invalidRuntimeSnapshot(`${path}.body must be an array.`);
    }
  });
}

function assertPendingWait(value: unknown): void {
  if (value === null) {
    return;
  }
  if (!isObjectRecord(value)) {
    invalidRuntimeSnapshot("pendingWait must be null or an object.");
  }
  if (typeof value.durationMs !== "number" || !Number.isFinite(value.durationMs) || value.durationMs < 0) {
    invalidRuntimeSnapshot("pendingWait.durationMs must be a non-negative number.");
  }
}

function assertNonNegativeInteger(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalidRuntimeSnapshot(`${path} must be a non-negative integer.`);
  }
}

function isRuntimeValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function invalidRuntimeSnapshot(message: string): never {
  throw new Error(`Invalid RuntimeSnapshot: ${message}`);
}

function clonePluginStates(plugins: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(plugins)) as Readonly<Record<string, unknown>>;
}

function clonePendingChoice(pendingChoice: RuntimePendingChoice | null): RuntimePendingChoice | null {
  if (pendingChoice === null) {
    return null;
  }

  return {
    kind: "body",
    question: pendingChoice.question,
    items: pendingChoice.items.map((item) => ({ ...item, body: cloneInstructions(item.body) })),
  };
}

function cloneInstructions(instructions: readonly TzrInstruction[]): readonly TzrInstruction[] {
  return clonePlainData(instructions);
}

function clonePlainData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainData(item)) as T;
  }

  if (isObjectRecord(value)) {
    const cloned: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) {
        cloned[key] = clonePlainData(child);
      }
    }
    return cloned as T;
  }

  return value;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
