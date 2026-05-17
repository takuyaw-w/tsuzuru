import {
  createRuntimeSnapshot,
  getRuntimeBlockReason,
  type RuntimeDocument,
  type RuntimeEvent,
  type RuntimeSnapshot,
  type RuntimeSnapshotPrepare,
  type RuntimeState,
  type RuntimeStepOptions,
  restoreRuntimeState,
  stepRuntime,
} from "@tsuzuru/core";

export interface RuntimeSaveData {
  readonly version: 2;
  readonly snapshot: RuntimeSnapshot;
  readonly event: RuntimeEvent | null;
}

export interface CreateRuntimeSaveDataFromStateOptions {
  readonly prepares?: readonly RuntimeSnapshotPrepare[];
}

export interface RestoreSnapshotResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
}

export function restoreRuntimeSnapshotForView(
  document: RuntimeDocument,
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

export function createRuntimeSaveData(snapshot: RuntimeSnapshot, event: RuntimeEvent | null): RuntimeSaveData {
  return {
    version: 2,
    snapshot,
    event,
  };
}

export function createRuntimeSaveDataFromState(
  state: RuntimeState,
  event: RuntimeEvent | null,
  options: CreateRuntimeSaveDataFromStateOptions = {},
): RuntimeSaveData {
  const preparedState = applyRuntimeSnapshotPrepares(state, options.prepares ?? []);
  return createRuntimeSaveData(createRuntimeSnapshot(preparedState), event);
}

export function isRuntimeSaveData(value: unknown): value is RuntimeSaveData {
  if (!isObjectRecord(value) || value.version !== 2 || !isObjectRecord(value.snapshot)) {
    return false;
  }

  const snapshot = value.snapshot;
  if (snapshot.version !== 2 || !isObjectRecord(snapshot.pointer)) {
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

function applyRuntimeSnapshotPrepares(state: RuntimeState, prepares: readonly RuntimeSnapshotPrepare[]): RuntimeState {
  return prepares.reduce((currentState, prepare) => prepare(currentState), state);
}
