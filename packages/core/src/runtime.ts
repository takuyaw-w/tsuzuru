import type { TextLine, TzrArgument, TzrValue } from "./ast.js";
import type { CompiledTzrDocument } from "./ir.js";

export interface RuntimePointer {
  readonly filePath: string;
  readonly instructionIndex: number;
}

export type RuntimeValue = string | number | boolean;

export type RuntimeVariables = Readonly<Record<string, RuntimeValue>>;

export type RuntimeFlags = Readonly<Record<string, boolean>>;

export interface RuntimeState {
  readonly pointer: RuntimePointer;
  readonly variables: RuntimeVariables;
  readonly flags: RuntimeFlags;
  readonly isStopped: boolean;
  readonly isWaitingForClick: boolean;
}

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
    isStopped: false,
    isWaitingForClick: false,
  };
}

export function stepRuntime(document: CompiledTzrDocument, state: RuntimeState): RuntimeStepResult {
  const instruction = document.instructions[state.pointer.instructionIndex];
  if (instruction === undefined) {
    return {
      state: {
        ...state,
        isStopped: true,
      },
      event: { type: "end" },
    };
  }

  const nextState = advanceInstruction(document, state);

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
      return stepCommandInstruction(document, state, instruction.name, instruction.args, instruction.jumpTarget?.label);
    case "MacroInstruction":
    case "ChoiceInstruction":
    case "IfInstruction":
      return {
        state: nextState,
        event: { type: "unsupported", instructionType: instruction.type },
      };
  }
}

function stepCommandInstruction(
  document: CompiledTzrDocument,
  state: RuntimeState,
  name: string,
  args: readonly TzrArgument[],
  jumpLabel: string | undefined,
): RuntimeStepResult {
  const nextState = advanceInstruction(document, state);

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

function unsupportedCommand(state: RuntimeState): RuntimeStepResult {
  return {
    state,
    event: { type: "unsupported", instructionType: "CommandInstruction" },
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
