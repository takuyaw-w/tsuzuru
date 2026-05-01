import type { TextLine } from "./ast.js";
import type { CommandInstruction, TzrInstruction } from "./ir.js";

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

export interface RuntimeSnapshot {
  readonly version: 1;
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

export interface RuntimeStepOptions {
  readonly commandHandlers?: Readonly<Record<string, RuntimePluginCommandHandler>>;
}

export type RuntimePluginCommandHandler = (
  state: RuntimeState,
  instruction: CommandInstruction,
) => RuntimeStepResult;

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
  | RuntimePluginCommandEvent
  | UnsupportedRuntimeEvent
  | RuntimeErrorEvent
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

export interface RuntimePluginCommandEvent {
  readonly type: "pluginCommand";
  readonly name: string;
}

export interface UnsupportedRuntimeEvent {
  readonly type: "unsupported";
  readonly instructionType: string;
}

export type RuntimeErrorCode = "choice_not_pending" | "choice_index_out_of_range";

export interface RuntimeErrorEvent {
  readonly type: "error";
  readonly code: RuntimeErrorCode;
  readonly message: string;
}

export interface EndRuntimeEvent {
  readonly type: "end";
}

export interface RuntimeStepResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent;
}
