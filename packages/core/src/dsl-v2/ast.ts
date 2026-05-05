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
  readonly body: readonly TzrV2SceneBodyLine[];
  readonly loc: SourceRange;
}

export interface TzrV2SceneBodyLine {
  readonly type: "SceneBodyLine";
  readonly text: string;
  readonly indentLevel: number;
  readonly loc: SourceRange;
}
