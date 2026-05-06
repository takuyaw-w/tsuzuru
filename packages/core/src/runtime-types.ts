import type { TextLine } from "./ast.js";
import type { CommandInstruction, TzrInstruction } from "./ir.js";
import type { PluginCommandMap } from "./plugin-command.js";

export interface RuntimePointer {
  readonly filePath: string;
  readonly instructionIndex: number;
}

export interface RuntimeBranchFrame {
  readonly instructions: readonly TzrInstruction[];
  readonly instructionIndex: number;
}

export type RuntimeValue = string | number | boolean | null;

export type RuntimeVariables = Readonly<Record<string, RuntimeValue>>;

export type RuntimePluginStates = Readonly<Record<string, unknown>>;

export interface RuntimePluginDefinition<TState = unknown> {
  readonly name: string;
  readonly commands?: PluginCommandMap;
  readonly createInitialState: () => TState;
}

export interface RuntimeInitialStateOptions {
  readonly plugins?: readonly RuntimePluginDefinition[];
}

export interface RuntimeChoiceItem {
  readonly id?: string;
  readonly text: string;
}

export type RuntimePendingChoice = RuntimePendingBodyChoice;

export interface RuntimePendingBodyChoice {
  readonly kind: "body";
  readonly question: string;
  readonly items: readonly RuntimePendingBodyChoiceItem[];
}

export interface RuntimePendingBodyChoiceItem extends RuntimeChoiceItem {
  readonly body: readonly TzrInstruction[];
}

export interface RuntimePendingWait {
  readonly durationMs: number;
}

export interface RuntimeState {
  readonly pointer: RuntimePointer;
  readonly variables: RuntimeVariables;
  readonly plugins: RuntimePluginStates;
  readonly branchFrames: readonly RuntimeBranchFrame[];
  readonly pendingChoice: RuntimePendingChoice | null;
  readonly pendingWait: RuntimePendingWait | null;
  readonly isStopped: boolean;
  readonly isWaitingForClick: boolean;
}

export interface RuntimeSnapshot {
  readonly version: 2;
  readonly pointer: RuntimePointer;
  readonly variables: RuntimeVariables;
  readonly plugins: RuntimePluginStates;
  readonly branchFrames: readonly RuntimeBranchFrame[];
  readonly pendingChoice: RuntimePendingChoice | null;
  readonly pendingWait: RuntimePendingWait | null;
  readonly isStopped: boolean;
  readonly isWaitingForClick: boolean;
}

export type RuntimeBlockReason = "wait" | "choice" | "click";

export interface RuntimeStepOptions {
  readonly commandHandlers?: Readonly<Record<string, RuntimePluginCommandHandler>>;
  readonly onDiagnostic?: RuntimeDiagnosticReporter;
}

export type RuntimePluginCommandHandler = (
  state: RuntimeState,
  instruction: CommandInstruction,
  context: RuntimePluginCommandContext,
) => RuntimeStepResult;

export type RuntimeDiagnosticSeverity = "warning";

export interface RuntimeDiagnostic {
  readonly severity: RuntimeDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
}

export type RuntimeDiagnosticReporter = (diagnostic: RuntimeDiagnostic) => void;

export interface RuntimePluginCommandContext {
  readonly warn: (code: string, message: string) => void;
}

export type RuntimeEvent =
  | SceneRuntimeEvent
  | NarrationRuntimeEvent
  | DialogueRuntimeEvent
  | WaitClickRuntimeEvent
  | PageRuntimeEvent
  | StopRuntimeEvent
  | StateRuntimeEvent
  | JumpRuntimeEvent
  | ChoiceResolveRuntimeEvent
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

export type StateCommandName = "set" | "add";

export interface StateRuntimeEvent {
  readonly type: "state";
  readonly command: StateCommandName;
  readonly name: string;
  readonly value: RuntimeValue;
}

export type JumpRuntimeEvent = SceneJumpRuntimeEvent;

export interface SceneJumpRuntimeEvent {
  readonly type: "jump";
  readonly sceneId: string;
  readonly instructionIndex: number;
}

export interface ChoiceResolveRuntimeEvent {
  readonly type: "choiceResolve";
  readonly itemIndex: number;
  readonly text: string;
  readonly id?: string;
}

export interface IfRuntimeEvent {
  readonly type: "if";
  readonly result: boolean;
  readonly branch: "then" | "elif" | "else" | "none";
  readonly branchIndex?: number;
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

export type RuntimeErrorCode =
  | "choice_not_pending"
  | "choice_index_out_of_range"
  | "choice_no_available_items"
  | "state_add_non_number"
  | "state_reference_missing"
  | "condition_invalid_numeric_comparison"
  | "condition_system_reference_unsupported";

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
