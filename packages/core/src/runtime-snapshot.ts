import type { TzrInstruction } from "./ir.js";
import type { RuntimePendingChoice, RuntimeSnapshot, RuntimeState } from "./runtime-types.js";

export function createRuntimeSnapshot(state: RuntimeState): RuntimeSnapshot {
  return {
    version: 1,
    pointer: { ...state.pointer },
    variables: { ...state.variables },
    flags: { ...state.flags },
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
  return {
    pointer: { ...snapshot.pointer },
    variables: { ...snapshot.variables },
    flags: { ...snapshot.flags },
    plugins: clonePluginStates(snapshot.plugins ?? {}),
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
  return typeof value === "object" && value !== null;
}
