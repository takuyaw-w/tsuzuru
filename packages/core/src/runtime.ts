import type { ChoiceItem, TextLine, TzrArgument, TzrValue } from "./ast.js";
import { evaluateCondition } from "./condition.js";
import type { ChoiceInstruction, CompiledTzrDocument, IfInstruction, TzrInstruction } from "./ir.js";

export interface RuntimePointer {
  readonly filePath: string;
  readonly instructionIndex: number;
}

export interface RuntimeBranchFrame {
  readonly instructions: readonly TzrInstruction[];
  readonly instructionIndex: number;
}

export type RuntimeValue = string | number | boolean;

export type RuntimeVariables = Readonly<Record<string, RuntimeValue>>;

export type RuntimeFlags = Readonly<Record<string, boolean>>;

export interface RuntimeChoiceItem {
  readonly text: string;
  readonly targetRaw: string;
  readonly targetLabel?: string;
}

export interface RuntimePendingChoice {
  readonly question: string;
  readonly items: readonly RuntimeChoiceItem[];
}

export interface RuntimePendingWait {
  readonly durationMs: number;
}

export interface RuntimeState {
  readonly pointer: RuntimePointer;
  readonly variables: RuntimeVariables;
  readonly flags: RuntimeFlags;
  readonly branchFrames: readonly RuntimeBranchFrame[];
  readonly pendingChoice: RuntimePendingChoice | null;
  readonly pendingWait: RuntimePendingWait | null;
  readonly isStopped: boolean;
  readonly isWaitingForClick: boolean;
}

export type RuntimeBlockReason = "wait" | "choice" | "click";

export type RuntimeEvent =
  | SceneRuntimeEvent
  | LabelRuntimeEvent
  | NarrationRuntimeEvent
  | DialogueRuntimeEvent
  | WaitClickRuntimeEvent
  | PageRuntimeEvent
  | StopRuntimeEvent
  | StateRuntimeEvent
  | JumpRuntimeEvent
  | IfRuntimeEvent
  | ChoiceRuntimeEvent
  | WaitRuntimeEvent
  | UnsupportedRuntimeEvent
  | EndRuntimeEvent;

export interface SceneRuntimeEvent {
  readonly type: "scene";
  readonly id: string;
}

export interface LabelRuntimeEvent {
  readonly type: "label";
  readonly id: string;
}

export interface NarrationRuntimeEvent {
  readonly type: "narration";
  readonly lines: readonly TextLine[];
}

export interface DialogueRuntimeEvent {
  readonly type: "dialogue";
  readonly speaker: string;
  readonly lines: readonly TextLine[];
}

export interface WaitClickRuntimeEvent {
  readonly type: "waitClick";
}

export interface PageRuntimeEvent {
  readonly type: "page";
}

export interface StopRuntimeEvent {
  readonly type: "stop";
}

export type StateCommandName = "set" | "inc" | "dec" | "flag" | "unflag";

export interface StateRuntimeEvent {
  readonly type: "state";
  readonly command: StateCommandName;
  readonly name: string;
  readonly value: RuntimeValue;
}

export interface JumpRuntimeEvent {
  readonly type: "jump";
  readonly label: string;
  readonly instructionIndex: number;
}

export interface IfRuntimeEvent {
  readonly type: "if";
  readonly result: boolean;
  readonly branch: "then" | "else" | "none";
  readonly event?: RuntimeEvent;
}

export interface ChoiceRuntimeEvent {
  readonly type: "choice";
  readonly question: string;
  readonly items: readonly RuntimeChoiceItem[];
}

export interface WaitRuntimeEvent {
  readonly type: "wait";
  readonly durationMs: number;
}

export interface UnsupportedRuntimeEvent {
  readonly type: "unsupported";
  readonly instructionType: string;
}

export interface EndRuntimeEvent {
  readonly type: "end";
}

export interface RuntimeStepResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent;
}

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

export function stepRuntime(document: CompiledTzrDocument, state: RuntimeState): RuntimeStepResult {
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
      return stepRuntime(document, popActiveBranchFrame(normalizedState));
    }

    return stepInstruction(document, normalizedState, instruction, advanceActiveBranchFrame(normalizedState));
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

  return stepInstruction(document, normalizedState, instruction, advanceInstruction(document, normalizedState));
}

function stepInstruction(
  document: CompiledTzrDocument,
  state: RuntimeState,
  instruction: TzrInstruction,
  nextState: RuntimeState,
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
      return stepCommandInstruction(document, state, nextState, instruction.name, instruction.args, instruction.jumpTarget?.label);
    case "IfInstruction":
      return stepIfInstruction(document, state, nextState, instruction);
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
  name: string,
  args: readonly TzrArgument[],
  jumpLabel: string | undefined,
): RuntimeStepResult {
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

  return unsupportedCommand(nextState);
}

function stepIfInstruction(
  document: CompiledTzrDocument,
  state: RuntimeState,
  nextState: RuntimeState,
  instruction: IfInstruction,
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
  const branchResult = stepInstruction(document, branchState, branchInstruction, advanceActiveBranchFrame(branchState));

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

function getActiveBranchFrame(state: RuntimeState): RuntimeBranchFrame | undefined {
  return state.branchFrames[state.branchFrames.length - 1];
}

function popFinishedBranchFrames(state: RuntimeState): RuntimeState {
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

function popActiveBranchFrame(state: RuntimeState): RuntimeState {
  return {
    ...state,
    branchFrames: state.branchFrames.slice(0, -1),
  };
}

function pushBranchFrame(state: RuntimeState, instructions: readonly TzrInstruction[]): RuntimeState {
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

function advanceActiveBranchFrame(state: RuntimeState): RuntimeState {
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

function getNamedArgument(args: readonly TzrArgument[], name: string): TzrArgument | undefined {
  return args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
}

function getNamedString(args: readonly TzrArgument[], name: string): string | undefined {
  const argument = getNamedArgument(args, name);
  if (argument?.type !== "NamedArgument" || argument.value.type !== "StringValue") {
    return undefined;
  }
  return argument.value.value;
}

function getNamedNumber(args: readonly TzrArgument[], name: string): number | undefined {
  const argument = getNamedArgument(args, name);
  if (argument?.type !== "NamedArgument" || argument.value.type !== "NumberValue") {
    return undefined;
  }
  return argument.value.value;
}

function getPositionalNumber(args: readonly TzrArgument[], index: number): number | undefined {
  const argument = args[index];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "NumberValue") {
    return undefined;
  }
  return argument.value.value;
}

function getNamedRuntimeValue(args: readonly TzrArgument[], name: string): RuntimeValue | undefined {
  const argument = getNamedArgument(args, name);
  if (argument?.type !== "NamedArgument") {
    return undefined;
  }
  return valueToRuntimeValue(argument.value);
}

function getPositionalString(args: readonly TzrArgument[], index: number): string | undefined {
  const argument = args[index];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "StringValue") {
    return undefined;
  }
  return argument.value.value;
}

function valueToRuntimeValue(value: TzrValue): RuntimeValue | undefined {
  switch (value.type) {
    case "StringValue":
    case "NumberValue":
    case "BooleanValue":
      return value.value;
    case "IdentifierValue":
      return undefined;
  }
}
