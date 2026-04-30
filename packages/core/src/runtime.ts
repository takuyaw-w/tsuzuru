import type { ChoiceItem } from "./ast.js";
import { isCoreCommandName } from "./commands.js";
import { evaluateCondition } from "./condition.js";
import type { ChoiceInstruction, CommandInstruction, CompiledTzrDocument, IfInstruction, TzrInstruction } from "./ir.js";
import {
  getNamedNumber,
  getNamedRuntimeValue,
  getNamedString,
  getPositionalNumber,
  getPositionalString,
} from "./runtime-args.js";
import {
  advanceActiveBranchFrame,
  getActiveBranchFrame,
  popActiveBranchFrame,
  popFinishedBranchFrames,
  pushBranchFrame,
} from "./runtime-frames.js";
import type {
  ChoiceRuntimeEvent,
  RuntimeBlockReason,
  RuntimeChoiceItem,
  RuntimePendingChoice,
  RuntimePendingWait,
  RuntimeState,
  RuntimeStepOptions,
  RuntimeStepResult,
  WaitRuntimeEvent,
} from "./runtime-types.js";

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
      return stepIfInstruction(document, state, nextState, instruction, options);
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
  const item = state.pendingChoice?.items[itemIndex];
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

function stepCommandInstruction(
  document: CompiledTzrDocument,
  state: RuntimeState,
  nextState: RuntimeState,
  instruction: CommandInstruction,
  options: RuntimeStepOptions,
): RuntimeStepResult {
  const { name, args } = instruction;
  if (name === "waitClick") {
    return {
      state: {
        ...nextState,
        isWaitingForClick: true,
      },
      event: { type: "waitClick" },
    };
  }

  if (name === "page") {
    return {
      state: {
        ...nextState,
        isWaitingForClick: true,
      },
      event: { type: "page" },
    };
  }

  if (name === "wait") {
    const durationMs = getPositionalNumber(args, 0);
    if (durationMs === undefined) {
      return unsupportedCommand(nextState);
    }

    const pendingWait = { durationMs };
    return {
      state: {
        ...nextState,
        pendingWait,
      },
      event: waitEvent(pendingWait),
    };
  }

  if (name === "stop") {
    return {
      state: {
        ...nextState,
        isStopped: true,
      },
      event: { type: "stop" },
    };
  }

  if (name === "jump") {
    const jumpLabel = instruction.jumpTarget?.label;
    if (jumpLabel === undefined) {
      return unsupportedCommand(nextState);
    }

    const target = document.labels[jumpLabel];
    if (target === undefined) {
      return unsupportedCommand(nextState);
    }

    return {
      state: {
        ...state,
        branchFrames: [],
        pendingChoice: null,
        pendingWait: null,
        isWaitingForClick: false,
        pointer: {
          filePath: document.filePath,
          instructionIndex: target.statementIndex,
        },
      },
      event: {
        type: "jump",
        label: jumpLabel,
        instructionIndex: target.statementIndex,
      },
    };
  }

  if (name === "set") {
    const variableName = getNamedString(args, "name");
    const value = getNamedRuntimeValue(args, "value");
    if (variableName === undefined || value === undefined) {
      return unsupportedCommand(nextState);
    }
    return {
      state: {
        ...nextState,
        variables: {
          ...nextState.variables,
          [variableName]: value,
        },
      },
      event: { type: "state", command: "set", name: variableName, value },
    };
  }

  if (name === "inc" || name === "dec") {
    const variableName = getNamedString(args, "name");
    const by = getNamedNumber(args, "by");
    if (variableName === undefined || by === undefined) {
      return unsupportedCommand(nextState);
    }
    const current = nextState.variables[variableName];
    const currentNumber = typeof current === "number" ? current : 0;
    const value = name === "inc" ? currentNumber + by : currentNumber - by;
    return {
      state: {
        ...nextState,
        variables: {
          ...nextState.variables,
          [variableName]: value,
        },
      },
      event: { type: "state", command: name, name: variableName, value },
    };
  }

  if (name === "flag" || name === "unflag") {
    const flagName = getPositionalString(args, 0);
    if (flagName === undefined) {
      return unsupportedCommand(nextState);
    }
    const value = name === "flag";
    return {
      state: {
        ...nextState,
        flags: {
          ...nextState.flags,
          [flagName]: value,
        },
      },
      event: { type: "state", command: name, name: flagName, value },
    };
  }

  if (!isCoreCommandName(name)) {
    const handler = options.commandHandlers?.[name];
    if (handler !== undefined) {
      return handler(nextState, instruction);
    }
  }

  return unsupportedCommand(nextState);
}

function stepIfInstruction(
  document: CompiledTzrDocument,
  state: RuntimeState,
  nextState: RuntimeState,
  instruction: IfInstruction,
  options: RuntimeStepOptions,
): RuntimeStepResult {
  const result = evaluateCondition(instruction.conditionExpression, state);
  const branch = result ? instruction.thenBranch : instruction.elseBranch;
  const branchName = result ? "then" : branch === undefined ? "none" : "else";

  if (branch === undefined || branch.length === 0) {
    return {
      state: nextState,
      event: {
        type: "if",
        result,
        branch: branchName,
      },
    };
  }

  const branchState = pushBranchFrame(nextState, branch);
  const branchInstruction = branch[0];
  if (branchInstruction === undefined) {
    return {
      state: nextState,
      event: {
        type: "if",
        result,
        branch: branchName,
      },
    };
  }
  const branchResult = stepInstruction(document, branchState, branchInstruction, advanceActiveBranchFrame(branchState), options);

  return {
    state: branchResult.state,
    event: {
      type: "if",
      result,
      branch: branchName,
      event: branchResult.event,
    },
  };
}

function stepChoiceInstruction(state: RuntimeState, instruction: ChoiceInstruction): RuntimeStepResult {
  const pendingChoice = {
    question: instruction.question,
    items: instruction.items.map(choiceItemToRuntimeChoiceItem),
  };

  return {
    state: {
      ...state,
      pendingChoice,
    },
    event: choiceEvent(pendingChoice),
  };
}

function choiceItemToRuntimeChoiceItem(item: ChoiceItem): RuntimeChoiceItem {
  return {
    text: item.text,
    targetRaw: item.target.raw,
    ...(item.target.label === undefined ? {} : { targetLabel: item.target.label }),
  };
}

function choiceEvent(pendingChoice: RuntimePendingChoice): ChoiceRuntimeEvent {
  return {
    type: "choice",
    question: pendingChoice.question,
    items: pendingChoice.items,
  };
}

function waitEvent(pendingWait: RuntimePendingWait): WaitRuntimeEvent {
  return {
    type: "wait",
    durationMs: pendingWait.durationMs,
  };
}

function unsupportedCommand(state: RuntimeState): RuntimeStepResult {
  return unsupportedInstruction(state, "CommandInstruction");
}

function unsupportedInstruction(state: RuntimeState, instructionType: string): RuntimeStepResult {
  return {
    state,
    event: { type: "unsupported", instructionType },
  };
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
