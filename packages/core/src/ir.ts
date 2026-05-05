import type {
  ChoiceItem,
  ConditionExpression,
  JumpTarget,
  SourceRange,
  TextLine,
  TzrArgument,
  TzrStatement,
} from "./ast.js";
import type { TzrV2ConditionExpression } from "./dsl-v2/ast.js";

export type TzrInstruction =
  | SceneInstruction
  | LabelInstruction
  | SceneJumpInstruction
  | NarrationInstruction
  | DialogueInstruction
  | CommandInstruction
  | MacroInstruction
  | ChoiceInstruction
  | BodyChoiceInstruction
  | IfInstruction
  | V2IfInstruction;

export interface SceneInstruction {
  readonly type: "SceneInstruction";
  readonly id: string;
  readonly loc: SourceRange;
}

export interface LabelInstruction {
  readonly type: "LabelInstruction";
  readonly id: string;
  readonly loc: SourceRange;
}

export interface SceneJumpInstruction {
  readonly type: "SceneJumpInstruction";
  readonly sceneId: string;
  readonly loc: SourceRange;
}

export interface NarrationInstruction {
  readonly type: "NarrationInstruction";
  readonly lines: readonly TextLine[];
  readonly loc: SourceRange;
}

export interface DialogueInstruction {
  readonly type: "DialogueInstruction";
  readonly speaker: string;
  readonly lines: readonly TextLine[];
  readonly loc: SourceRange;
}

export interface CommandInstruction {
  readonly type: "CommandInstruction";
  readonly name: string;
  readonly args: readonly TzrArgument[];
  readonly jumpTarget?: JumpTarget;
  readonly loc: SourceRange;
}

export interface MacroInstruction {
  readonly type: "MacroInstruction";
  readonly name: string;
  readonly args: readonly TzrArgument[];
  readonly loc: SourceRange;
}

export interface ChoiceInstruction {
  readonly type: "ChoiceInstruction";
  readonly question: string;
  readonly items: readonly ChoiceItem[];
  readonly loc: SourceRange;
}

export interface BodyChoiceInstruction {
  readonly type: "BodyChoiceInstruction";
  readonly question: string;
  readonly items: readonly BodyChoiceInstructionItem[];
  readonly loc: SourceRange;
}

export interface BodyChoiceInstructionItem {
  readonly label: string;
  readonly id?: string;
  readonly body: readonly TzrInstruction[];
  readonly loc: SourceRange;
}

export interface IfInstruction {
  readonly type: "IfInstruction";
  readonly condition: string;
  readonly conditionExpression: ConditionExpression;
  readonly thenBranch: readonly TzrInstruction[];
  readonly elseBranch?: readonly TzrInstruction[];
  readonly loc: SourceRange;
}

export interface V2IfInstruction {
  readonly type: "V2IfInstruction";
  readonly condition: TzrV2ConditionExpression;
  readonly thenBranch: readonly TzrInstruction[];
  readonly elifBranches: readonly V2ElifInstructionBranch[];
  readonly elseBranch?: readonly TzrInstruction[];
  readonly loc: SourceRange;
}

export interface V2ElifInstructionBranch {
  readonly condition: TzrV2ConditionExpression;
  readonly body: readonly TzrInstruction[];
  readonly loc: SourceRange;
}

export interface DeclarationIndexEntry {
  readonly id: string;
  readonly statementIndex: number;
  readonly loc: SourceRange;
}

export interface RuntimeDocument {
  readonly filePath: string;
  readonly instructions: readonly TzrInstruction[];
  readonly labels: Readonly<Record<string, DeclarationIndexEntry>>;
  readonly scenes?: Readonly<Record<string, DeclarationIndexEntry>>;
}

export interface CompiledTzrDocument extends RuntimeDocument {
  readonly type: "CompiledTzrDocument";
  readonly body: readonly TzrStatement[];
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
}
