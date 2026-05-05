import type { ChoiceItem } from "./ast.js";
import { evaluateCondition } from "./condition.js";
import { evaluateTzrV2Condition, type TzrV2ConditionEvaluationError } from "./dsl-v2/condition-evaluator.js";
import type {
  BodyChoiceInstruction,
  BodyChoiceInstructionItem,
  ChoiceInstruction,
  IfInstruction,
  RuntimeDocument,
  TzrInstruction,
  V2IfInstruction,
} from "./ir.js";
import { advanceActiveBranchFrame, pushBranchFrame } from "./runtime-frames.js";
import type {
  ChoiceRuntimeEvent,
  IfRuntimeEvent,
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

export function stepV2IfInstruction(
  document: RuntimeDocument,
  state: RuntimeState,
  nextState: RuntimeState,
  instruction: V2IfInstruction,
  options: RuntimeStepOptions,
  stepInstruction: RuntimeInstructionStepper,
): RuntimeStepResult {
  const selected = selectV2IfBranch(instruction, state);
  if (!selected.ok) {
    return {
      state: nextState,
      event: {
        type: "error",
        code: selected.error.code,
        message: selected.error.message,
      },
    };
  }

  const { branch, branchIndex, instructions, result } = selected;
  if (instructions === undefined || instructions.length === 0) {
    return {
      state: nextState,
      event: v2IfEvent(result, branch, branchIndex),
    };
  }

  const branchState = pushBranchFrame(nextState, instructions);
  const branchInstruction = instructions[0];
  if (branchInstruction === undefined) {
    return {
      state: nextState,
      event: v2IfEvent(result, branch, branchIndex),
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
      ...v2IfEvent(result, branch, branchIndex),
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

type V2IfBranchSelection =
  | {
      readonly ok: true;
      readonly result: boolean;
      readonly branch: IfRuntimeEvent["branch"];
      readonly branchIndex?: number;
      readonly instructions?: readonly TzrInstruction[];
    }
  | {
      readonly ok: false;
      readonly error: TzrV2ConditionEvaluationError;
    };

function selectV2IfBranch(instruction: V2IfInstruction, state: RuntimeState): V2IfBranchSelection {
  const thenResult = evaluateTzrV2Condition(instruction.condition, state);
  if (!thenResult.ok) {
    return thenResult;
  }
  if (thenResult.value) {
    return {
      ok: true,
      result: true,
      branch: "then",
      instructions: instruction.thenBranch,
    };
  }

  for (const [branchIndex, branch] of instruction.elifBranches.entries()) {
    const elifResult = evaluateTzrV2Condition(branch.condition, state);
    if (!elifResult.ok) {
      return elifResult;
    }
    if (elifResult.value) {
      return {
        ok: true,
        result: true,
        branch: "elif",
        branchIndex,
        instructions: branch.body,
      };
    }
  }

  if (instruction.elseBranch !== undefined) {
    return {
      ok: true,
      result: false,
      branch: "else",
      instructions: instruction.elseBranch,
    };
  }

  return {
    ok: true,
    result: false,
    branch: "none",
  };
}

function v2IfEvent(result: boolean, branch: IfRuntimeEvent["branch"], branchIndex?: number): IfRuntimeEvent {
  return {
    type: "if",
    result,
    branch,
    ...(branchIndex === undefined ? {} : { branchIndex }),
  };
}
