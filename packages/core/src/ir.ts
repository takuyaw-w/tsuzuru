import type { SourceRange, TextLine, TzrArgument } from "./ast.js";
import type { TzrConditionExpression } from "./scenario-ast.js";

export type TzrInstruction =
  | SceneInstruction
  | SceneJumpInstruction
  | LabelJumpInstruction
  | NarrationInstruction
  | DialogueInstruction
  | CommandInstruction
  | BodyChoiceInstruction
  | IfInstruction;

export interface SceneInstruction {
  readonly type: "SceneInstruction";
  readonly id: string;
  readonly loc: SourceRange;
}

export interface SceneJumpInstruction {
  readonly type: "SceneJumpInstruction";
  readonly sceneId: string;
  readonly loc: SourceRange;
}

export interface LabelJumpInstruction {
  readonly type: "LabelJumpInstruction";
  readonly labelId: string;
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
  readonly condition?: TzrConditionExpression;
  readonly body: readonly TzrInstruction[];
  readonly loc: SourceRange;
}

export interface IfInstruction {
  readonly type: "IfInstruction";
  readonly condition: TzrConditionExpression;
  readonly thenBranch: readonly TzrInstruction[];
  readonly elifBranches: readonly ElifInstructionBranch[];
  readonly elseBranch?: readonly TzrInstruction[];
  readonly loc: SourceRange;
}

export interface ElifInstructionBranch {
  readonly condition: TzrConditionExpression;
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
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
  readonly labels?: Readonly<Record<string, DeclarationIndexEntry>>;
}
