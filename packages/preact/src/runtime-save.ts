import {
  getRuntimeBlockReason,
  restoreRuntimeState,
  stepRuntime,
  type CompiledTzrDocument,
  type RuntimeEvent,
  type RuntimeSnapshot,
  type RuntimeState,
  type RuntimeStepOptions,
} from "@tsuzuru/core";

export interface RuntimeSaveData {
  readonly version: 1;
  readonly snapshot: RuntimeSnapshot;
  readonly event: RuntimeEvent | null;
}

export interface RestoreSnapshotResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
}

export function restoreRuntimeSnapshotForView(
  document: CompiledTzrDocument,
  snapshot: RuntimeSnapshot,
  stepOptions: RuntimeStepOptions = {},
): RestoreSnapshotResult {
  const restoredState = restoreRuntimeState(snapshot);
  if (getRuntimeBlockReason(restoredState) === null) {
    return {
      state: restoredState,
      event: null,
    };
  }

  const result = stepRuntime(document, restoredState, stepOptions);
  return {
    state: result.state,
    event: result.event,
  };
}

export function createRuntimeSaveData(
  snapshot: RuntimeSnapshot,
  event: RuntimeEvent | null,
): RuntimeSaveData {
  return {
    version: 1,
    snapshot,
    event,
  };
}

export function isRuntimeSaveData(value: unknown): value is RuntimeSaveData {
  if (!isObjectRecord(value) || value.version !== 1 || !isObjectRecord(value.snapshot)) {
    return false;
  }

  const snapshot = value.snapshot;
  if (snapshot.version !== 1 || !isObjectRecord(snapshot.pointer)) {
    return false;
  }

  const pointer = snapshot.pointer;
  if (typeof pointer.filePath !== "string" || typeof pointer.instructionIndex !== "number") {
    return false;
  }

  if (value.event === null) {
    return true;
  }

  return isObjectRecord(value.event) && typeof value.event.type === "string";
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
