import {
  evaluateTzrCondition,
  type TzrConditionEvaluationError,
  type TzrConditionEvaluationOptions,
} from "./condition-evaluator.js";
import type {
  BodyChoiceInstruction,
  BodyChoiceInstructionItem,
  IfInstruction,
  RuntimeDocument,
  TzrInstruction,
} from "./ir.js";
import { advanceActiveBranchFrame, pushBranchFrame } from "./runtime-frames.js";
import type {
  ChoiceRuntimeEvent,
  IfRuntimeEvent,
  RuntimeChoiceItem,
  RuntimePendingBodyChoiceItem,
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
  const selected = selectIfBranch(instruction, state, options);
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
      event: ifEvent(result, branch, branchIndex),
    };
  }

  const branchState = pushBranchFrame(nextState, instructions);
  const branchInstruction = instructions[0];
  if (branchInstruction === undefined) {
    return {
      state: nextState,
      event: ifEvent(result, branch, branchIndex),
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
      ...ifEvent(result, branch, branchIndex),
      event: branchResult.event,
    },
  };
}

export function stepBodyChoiceInstruction(
  state: RuntimeState,
  instruction: BodyChoiceInstruction,
  options: RuntimeStepOptions = {},
): RuntimeStepResult {
  const visibleItems = filterBodyChoiceItems(state, instruction, options);
  if (!visibleItems.ok) {
    return {
      state,
      event: {
        type: "error",
        code: visibleItems.error.code,
        message: visibleItems.error.message,
      },
    };
  }

  if (visibleItems.items.length === 0) {
    return {
      state,
      event: {
        type: "error",
        code: "choice_no_available_items",
        message: `Choice "${instruction.question}" has no available items.`,
      },
    };
  }

  const pendingChoice: RuntimePendingChoice = {
    kind: "body",
    question: instruction.question,
    items: visibleItems.items.map(bodyChoiceItemToRuntimePendingChoiceItem),
  };

  return {
    state: {
      ...state,
      pendingChoice,
    },
    event: choiceEvent(pendingChoice),
  };
}

function bodyChoiceItemToRuntimePendingChoiceItem(item: BodyChoiceInstructionItem): RuntimePendingBodyChoiceItem {
  return {
    ...(item.id === undefined ? {} : { id: item.id }),
    text: item.label,
    body: item.body,
  };
}

type BodyChoiceFilterResult =
  | {
      readonly ok: true;
      readonly items: readonly BodyChoiceInstructionItem[];
    }
  | {
      readonly ok: false;
      readonly error: TzrConditionEvaluationError;
    };

function filterBodyChoiceItems(
  state: RuntimeState,
  instruction: BodyChoiceInstruction,
  options: RuntimeStepOptions,
): BodyChoiceFilterResult {
  const items: BodyChoiceInstructionItem[] = [];

  for (const item of instruction.items) {
    if (item.condition === undefined) {
      items.push(item);
      continue;
    }

    const result = evaluateTzrCondition(item.condition, state, conditionEvaluationOptions(options));
    if (!result.ok) {
      return result;
    }
    if (result.value) {
      items.push(item);
    }
  }

  return { ok: true, items };
}

export function choiceEvent(pendingChoice: RuntimePendingChoice): ChoiceRuntimeEvent {
  return {
    type: "choice",
    question: pendingChoice.question,
    items: pendingChoice.items.map(toChoiceEventItem),
  };
}

function toChoiceEventItem(item: RuntimePendingBodyChoiceItem): RuntimeChoiceItem {
  return {
    ...(item.id === undefined ? {} : { id: item.id }),
    text: item.text,
  };
}

export function waitEvent(pendingWait: RuntimePendingWait): WaitRuntimeEvent {
  return {
    type: "wait",
    durationMs: pendingWait.durationMs,
  };
}

type IfBranchSelection =
  | {
      readonly ok: true;
      readonly result: boolean;
      readonly branch: IfRuntimeEvent["branch"];
      readonly branchIndex?: number;
      readonly instructions?: readonly TzrInstruction[];
    }
  | {
      readonly ok: false;
      readonly error: TzrConditionEvaluationError;
    };

function selectIfBranch(instruction: IfInstruction, state: RuntimeState, options: RuntimeStepOptions): IfBranchSelection {
  const thenResult = evaluateTzrCondition(instruction.condition, state, conditionEvaluationOptions(options));
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
    const elifResult = evaluateTzrCondition(branch.condition, state, conditionEvaluationOptions(options));
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

function conditionEvaluationOptions(options: RuntimeStepOptions): TzrConditionEvaluationOptions {
  return options.conditionResolvers === undefined ? {} : { conditionResolvers: options.conditionResolvers };
}

function ifEvent(result: boolean, branch: IfRuntimeEvent["branch"], branchIndex?: number): IfRuntimeEvent {
  return {
    type: "if",
    result,
    branch,
    ...(branchIndex === undefined ? {} : { branchIndex }),
  };
}
