import type { SourceRange } from "../ast.js";
import type { ParseDiagnostic } from "../diagnostic.js";

export type TzrV2ParseResult =
  | { readonly ok: true; readonly document: TzrV2Document; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly ParseDiagnostic[] };

export interface TzrV2ParseOptions {
  readonly filePath?: string;
}

export interface TzrV2Document {
  readonly type: "TzrV2Document";
  readonly filePath: string;
  readonly sourceLines: readonly string[];
  readonly declarations: readonly TzrV2TopLevelDeclaration[];
}

export type TzrV2TopLevelDeclaration =
  | TzrV2TitleDeclaration
  | TzrV2CharacterDeclaration
  | TzrV2SceneDeclaration;

export interface TzrV2TitleDeclaration {
  readonly type: "TitleDeclaration";
  readonly title: string;
  readonly loc: SourceRange;
}

export interface TzrV2CharacterDeclaration {
  readonly type: "CharacterDeclaration";
  readonly id: string;
  readonly name: string;
  readonly loc: SourceRange;
}

export interface TzrV2SceneDeclaration {
  readonly type: "SceneDeclaration";
  readonly id: string;
  readonly title?: string;
  readonly body: readonly TzrV2SceneStatement[];
  readonly loc: SourceRange;
}

export type TzrV2SceneStatement =
  | TzrV2NarrationStatement
  | TzrV2DialogueStatement
  | TzrV2JumpStatement
  | TzrV2EndStatement;

export interface TzrV2NarrationStatement {
  readonly type: "NarrationStatement";
  readonly lines: readonly TzrV2TextLine[];
  readonly loc: SourceRange;
}

export interface TzrV2DialogueStatement {
  readonly type: "DialogueStatement";
  readonly speaker: string;
  readonly lines: readonly TzrV2TextLine[];
  readonly explicit: boolean;
  readonly loc: SourceRange;
}

export interface TzrV2JumpStatement {
  readonly type: "JumpStatement";
  readonly target: string;
  readonly loc: SourceRange;
}

export interface TzrV2EndStatement {
  readonly type: "EndStatement";
  readonly loc: SourceRange;
}

export interface TzrV2TextLine {
  readonly type: "TextLine";
  readonly text: string;
  readonly loc: SourceRange;
}
