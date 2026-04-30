import type { TzrInstruction } from "./ir.js";
import type { RuntimeBranchFrame, RuntimeState } from "./runtime-types.js";

export function getActiveBranchFrame(state: RuntimeState): RuntimeBranchFrame | undefined {
  return state.branchFrames[state.branchFrames.length - 1];
}

export function popFinishedBranchFrames(state: RuntimeState): RuntimeState {
  let branchFrames = state.branchFrames;
  while (branchFrames.length > 0) {
    const activeFrame = branchFrames[branchFrames.length - 1];
    if (activeFrame === undefined || activeFrame.instructionIndex < activeFrame.instructions.length) {
      break;
    }
    branchFrames = branchFrames.slice(0, -1);
  }

  if (branchFrames === state.branchFrames) {
    return state;
  }

  return {
    ...state,
    branchFrames,
  };
}

export function popActiveBranchFrame(state: RuntimeState): RuntimeState {
  return {
    ...state,
    branchFrames: state.branchFrames.slice(0, -1),
  };
}

export function pushBranchFrame(state: RuntimeState, instructions: readonly TzrInstruction[]): RuntimeState {
  return {
    ...state,
    branchFrames: [
      ...state.branchFrames,
      {
        instructions,
        instructionIndex: 0,
      },
    ],
  };
}

export function advanceActiveBranchFrame(state: RuntimeState): RuntimeState {
  const activeFrame = getActiveBranchFrame(state);
  if (activeFrame === undefined) {
    return state;
  }

  return {
    ...state,
    branchFrames: [
      ...state.branchFrames.slice(0, -1),
      {
        ...activeFrame,
        instructionIndex: activeFrame.instructionIndex + 1,
      },
    ],
  };
}
