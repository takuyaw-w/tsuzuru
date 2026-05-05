import type { RuntimePendingChoice, RuntimeSnapshot, RuntimeState } from "./runtime-types.js";

export function createRuntimeSnapshot(state: RuntimeState): RuntimeSnapshot {
  return {
    version: 1,
    pointer: { ...state.pointer },
    variables: { ...state.variables },
    flags: { ...state.flags },
    plugins: clonePluginStates(state.plugins),
    branchFrames: state.branchFrames.map((frame) => ({
      instructions: frame.instructions,
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
      instructions: frame.instructions,
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

  if (pendingChoice.kind === "body") {
    return {
      kind: "body",
      question: pendingChoice.question,
      items: pendingChoice.items.map((item) => ({ ...item })),
    };
  }

  return {
    question: pendingChoice.question,
    items: pendingChoice.items.map((item) => ({ ...item })),
  };
}
