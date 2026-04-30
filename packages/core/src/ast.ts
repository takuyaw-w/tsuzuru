export interface SourceLocation {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
}

export interface SourceRange {
  readonly start: SourceLocation;
  readonly end: SourceLocation;
}

export interface TzrDocument {
  readonly type: "Document";
  readonly filePath: string;
  readonly sourceLines: readonly string[];
  readonly body: readonly TzrStatement[];
}

export type TzrStatement =
  | SceneDeclaration
  | LabelDeclaration
  | NarrationBlock
  | SpeakerBlock
  | CommandStatement
  | MacroStatement
  | ChoiceBlock
  | IfBlock;

export interface SceneDeclaration {
  readonly type: "SceneDeclaration";
  readonly id: string;
  readonly loc: SourceRange;
}

export interface LabelDeclaration {
  readonly type: "LabelDeclaration";
  readonly id: string;
  readonly loc: SourceRange;
}

export interface NarrationBlock {
  readonly type: "NarrationBlock";
  readonly lines: readonly TextLine[];
  readonly loc: SourceRange;
}

export interface SpeakerBlock {
  readonly type: "SpeakerBlock";
  readonly speaker: string;
  readonly lines: readonly TextLine[];
  readonly loc: SourceRange;
}

export interface TextLine {
  readonly text: string;
  readonly loc: SourceRange;
}

export interface CommandStatement {
  readonly type: "CommandStatement";
  readonly name: string;
  readonly args: readonly TzrArgument[];
  readonly jumpTarget?: JumpTarget;
  readonly loc: SourceRange;
}

export interface MacroStatement {
  readonly type: "MacroStatement";
  readonly name: string;
  readonly args: readonly TzrArgument[];
  readonly loc: SourceRange;
}

export interface ChoiceBlock {
  readonly type: "ChoiceBlock";
  readonly question: string;
  readonly items: readonly ChoiceItem[];
  readonly loc: SourceRange;
}

export interface ChoiceItem {
  readonly text: string;
  readonly target: JumpTarget;
  readonly loc: SourceRange;
}

export interface IfBlock {
  readonly type: "IfBlock";
  readonly condition: string;
  readonly thenBranch: readonly TzrStatement[];
  readonly elseBranch?: readonly TzrStatement[];
  readonly loc: SourceRange;
}

export interface JumpTarget {
  readonly raw: string;
  readonly file?: string;
  readonly label?: string;
  readonly loc: SourceRange;
}

export type TzrArgument = PositionalArgument | NamedArgument;

export interface PositionalArgument {
  readonly type: "PositionalArgument";
  readonly value: TzrValue;
  readonly loc: SourceRange;
}

export interface NamedArgument {
  readonly type: "NamedArgument";
  readonly name: string;
  readonly value: TzrValue;
  readonly loc: SourceRange;
}

export type TzrValue = StringValue | NumberValue | BooleanValue | IdentifierValue;

export interface StringValue {
  readonly type: "StringValue";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface NumberValue {
  readonly type: "NumberValue";
  readonly value: number;
  readonly loc: SourceRange;
}

export interface BooleanValue {
  readonly type: "BooleanValue";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface IdentifierValue {
  readonly type: "IdentifierValue";
  readonly name: string;
  readonly loc: SourceRange;
}
