import type { CompiledTzrDocument, TzrInstruction } from "./ir.js";
import { stepCommandInstruction, unsupportedInstruction } from "./runtime-commands.js";
import { choiceEvent, stepChoiceInstruction, stepIfInstruction, waitEvent } from "./runtime-control.js";
import {
  advanceActiveBranchFrame,
  getActiveBranchFrame,
  popActiveBranchFrame,
  popFinishedBranchFrames,
} from "./runtime-frames.js";
import type { RuntimeBlockReason, RuntimeErrorCode, RuntimeState, RuntimeStepOptions, RuntimeStepResult } from "./runtime-types.js";

export type * from "./runtime-types.js";
export { createRuntimeSnapshot, restoreRuntimeState } from "./runtime-snapshot.js";

export function createInitialRuntimeState(document: CompiledTzrDocument): RuntimeState {
  return {
    pointer: {
      filePath: document.filePath,
      instructionIndex: 0,
    },
    variables: {},
    flags: {},
    branchFrames: [],
    pendingChoice: null,
    pendingWait: null,
    isStopped: false,
    isWaitingForClick: false,
  };
}

export function stepRuntime(
  document: CompiledTzrDocument,
  state: RuntimeState,
  options: RuntimeStepOptions = {},
): RuntimeStepResult {
  if (state.pendingWait !== null) {
    return {
      state,
      event: waitEvent(state.pendingWait),
    };
  }

  if (state.pendingChoice !== null) {
    return {
      state,
      event: choiceEvent(state.pendingChoice),
    };
  }

  if (state.isWaitingForClick) {
    return {
      state,
      event: { type: "waitClick" },
    };
  }

  const normalizedState = popFinishedBranchFrames(state);
  const activeFrame = getActiveBranchFrame(normalizedState);
  if (activeFrame !== undefined) {
    const instruction = activeFrame.instructions[activeFrame.instructionIndex];
    if (instruction === undefined) {
      return stepRuntime(document, popActiveBranchFrame(normalizedState), options);
    }

    return stepInstruction(document, normalizedState, instruction, advanceActiveBranchFrame(normalizedState), options);
  }

  const instruction = document.instructions[normalizedState.pointer.instructionIndex];
  if (instruction === undefined) {
    return {
      state: {
        ...normalizedState,
        isStopped: true,
      },
      event: { type: "end" },
    };
  }

  return stepInstruction(document, normalizedState, instruction, advanceInstruction(document, normalizedState), options);
}

function stepInstruction(
  document: CompiledTzrDocument,
  state: RuntimeState,
  instruction: TzrInstruction,
  nextState: RuntimeState,
  options: RuntimeStepOptions,
): RuntimeStepResult {
  switch (instruction.type) {
    case "SceneInstruction":
      return {
        state: nextState,
        event: { type: "scene", id: instruction.id },
      };
    case "LabelInstruction":
      return {
        state: nextState,
        event: { type: "label", id: instruction.id },
      };
    case "NarrationInstruction":
      return {
        state: nextState,
        event: { type: "narration", lines: instruction.lines },
      };
    case "DialogueInstruction":
      return {
        state: nextState,
        event: { type: "dialogue", speaker: instruction.speaker, lines: instruction.lines },
      };
    case "CommandInstruction":
      return stepCommandInstruction(document, state, nextState, instruction, options);
    case "IfInstruction":
      return stepIfInstruction(document, state, nextState, instruction, options, stepInstruction);
    case "MacroInstruction":
      return {
        state: nextState,
        event: { type: "unsupported", instructionType: instruction.type },
      };
    case "ChoiceInstruction":
      return stepChoiceInstruction(nextState, instruction);
  }
}

export function resolveChoice(
  document: CompiledTzrDocument,
  state: RuntimeState,
  itemIndex: number,
): RuntimeStepResult {
  if (state.pendingChoice === null) {
    return runtimeError(state, "choice_not_pending", "Cannot resolve a choice because no choice is pending.");
  }

  const item = state.pendingChoice.items[itemIndex];
  if (item === undefined) {
    return runtimeError(
      state,
      "choice_index_out_of_range",
      `Choice index ${itemIndex} is out of range for ${state.pendingChoice.items.length} choice item(s).`,
    );
  }

  if (item?.targetLabel === undefined) {
    return unsupportedInstruction(state, "ChoiceInstruction");
  }

  const target = document.labels[item.targetLabel];
  if (target === undefined) {
    return unsupportedInstruction(state, "ChoiceInstruction");
  }

  return {
    state: {
      ...state,
      pointer: {
        filePath: document.filePath,
        instructionIndex: target.statementIndex,
      },
      branchFrames: [],
      pendingChoice: null,
    },
    event: {
      type: "jump",
      label: item.targetLabel,
      instructionIndex: target.statementIndex,
    },
  };
}

function runtimeError(state: RuntimeState, code: RuntimeErrorCode, message: string): RuntimeStepResult {
  return {
    state,
    event: { type: "error", code, message },
  };
}

export function clearWait(state: RuntimeState): RuntimeState {
  if (state.pendingWait === null) {
    return state;
  }

  return {
    ...state,
    pendingWait: null,
  };
}

export function clearClickWait(state: RuntimeState): RuntimeState {
  if (!state.isWaitingForClick) {
    return state;
  }

  return {
    ...state,
    isWaitingForClick: false,
  };
}

export function isRuntimeBlocked(state: RuntimeState): boolean {
  return getRuntimeBlockReason(state) !== null;
}

export function getRuntimeBlockReason(state: RuntimeState): RuntimeBlockReason | null {
  if (state.pendingWait !== null) {
    return "wait";
  }
  if (state.pendingChoice !== null) {
    return "choice";
  }
  if (state.isWaitingForClick) {
    return "click";
  }
  return null;
}

function advanceInstruction(document: CompiledTzrDocument, state: RuntimeState): RuntimeState {
  const instructionIndex = state.pointer.instructionIndex + 1;
  return {
    ...state,
    pointer: {
      filePath: document.filePath,
      instructionIndex,
    },
  };
}
