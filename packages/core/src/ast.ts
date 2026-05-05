export interface SourceLocation {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
}

export interface SourceRange {
  readonly start: SourceLocation;
  readonly end: SourceLocation;
}

export interface TextLine {
  readonly text: string;
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
