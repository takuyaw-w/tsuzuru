import { evaluateTzrV2Condition, type TzrV2ConditionEvaluationError } from "./condition-evaluator.js";
import type {
  BodyChoiceInstruction,
  BodyChoiceInstructionItem,
  RuntimeDocument,
  TzrInstruction,
  V2IfInstruction,
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

export function stepBodyChoiceInstruction(state: RuntimeState, instruction: BodyChoiceInstruction): RuntimeStepResult {
  const visibleItems = filterBodyChoiceItems(state, instruction);
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
      readonly error: TzrV2ConditionEvaluationError;
    };

function filterBodyChoiceItems(state: RuntimeState, instruction: BodyChoiceInstruction): BodyChoiceFilterResult {
  const items: BodyChoiceInstructionItem[] = [];

  for (const item of instruction.items) {
    if (item.condition === undefined) {
      items.push(item);
      continue;
    }

    const result = evaluateTzrV2Condition(item.condition, state);
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
