import type { RuntimeSnapshot, RuntimeState } from "./runtime-types.js";

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
    pendingChoice:
      state.pendingChoice === null
        ? null
        : {
            question: state.pendingChoice.question,
            items: state.pendingChoice.items.map((item) => ({ ...item })),
          },
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
    pendingChoice:
      snapshot.pendingChoice === null
        ? null
        : {
            question: snapshot.pendingChoice.question,
            items: snapshot.pendingChoice.items.map((item) => ({ ...item })),
          },
    pendingWait: snapshot.pendingWait === null ? null : { ...snapshot.pendingWait },
    screen: {
      active: null,
      waitingForClose: false,
    },
    isStopped: snapshot.isStopped,
    isWaitingForClick: snapshot.isWaitingForClick,
  };
}

function clonePluginStates(plugins: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(plugins)) as Readonly<Record<string, unknown>>;
}
