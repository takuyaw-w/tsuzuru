import type { TextLine } from "./ast.js";
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
    case "MacroInstruction":
    case "ChoiceInstruction":
    case "IfInstruction":
      return {
        state: nextState,
        event: { type: "end" },
      };
  }
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
