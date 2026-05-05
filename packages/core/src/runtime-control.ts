import type { ChoiceItem } from "./ast.js";
import { evaluateCondition } from "./condition.js";
import type { BodyChoiceInstruction, BodyChoiceInstructionItem, ChoiceInstruction, IfInstruction, RuntimeDocument, TzrInstruction } from "./ir.js";
import { advanceActiveBranchFrame, pushBranchFrame } from "./runtime-frames.js";
import type {
  ChoiceRuntimeEvent,
  RuntimePendingBodyChoiceItem,
  RuntimeChoiceItem,
  RuntimePendingChoice,
  RuntimePendingWait,
  RuntimeState,
  RuntimeStepOptions,
  RuntimeStepResult,
  WaitRuntimeEvent,
} from "./runtime-types.js";

export type RuntimeInstructionStepper = (
  document: RuntimeDocument,
  state: RuntimeState,
  instruction: TzrInstruction,
  nextState: RuntimeState,
  options: RuntimeStepOptions,
) => RuntimeStepResult;

export function stepIfInstruction(
  document: RuntimeDocument,
  state: RuntimeState,
  nextState: RuntimeState,
  instruction: IfInstruction,
  options: RuntimeStepOptions,
  stepInstruction: RuntimeInstructionStepper,
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
  const branchResult = stepInstruction(
    document,
    branchState,
    branchInstruction,
    advanceActiveBranchFrame(branchState),
    options,
  );

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

export function stepChoiceInstruction(state: RuntimeState, instruction: ChoiceInstruction): RuntimeStepResult {
  const pendingChoice: RuntimePendingChoice = {
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

export function stepBodyChoiceInstruction(state: RuntimeState, instruction: BodyChoiceInstruction): RuntimeStepResult {
  const pendingChoice: RuntimePendingChoice = {
    kind: "body",
    question: instruction.question,
    items: instruction.items.map(bodyChoiceItemToRuntimePendingChoiceItem),
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

function bodyChoiceItemToRuntimePendingChoiceItem(item: BodyChoiceInstructionItem): RuntimePendingBodyChoiceItem {
  return {
    ...(item.id === undefined ? {} : { id: item.id }),
    text: item.label,
    body: item.body,
  };
}

export function choiceEvent(pendingChoice: RuntimePendingChoice): ChoiceRuntimeEvent {
  return {
    type: "choice",
    question: pendingChoice.question,
    items: pendingChoice.items.map(toChoiceEventItem),
  };
}

function toChoiceEventItem(item: RuntimeChoiceItem): RuntimeChoiceItem {
  return {
    ...(item.id === undefined ? {} : { id: item.id }),
    text: item.text,
    ...(item.targetRaw === undefined ? {} : { targetRaw: item.targetRaw }),
    ...(item.targetLabel === undefined ? {} : { targetLabel: item.targetLabel }),
  };
}

export function waitEvent(pendingWait: RuntimePendingWait): WaitRuntimeEvent {
  return {
    type: "wait",
    durationMs: pendingWait.durationMs,
  };
}
