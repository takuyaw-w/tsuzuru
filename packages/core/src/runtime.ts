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
