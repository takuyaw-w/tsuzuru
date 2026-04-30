import type { SourceRange, TzrStatement } from "./ast.js";

export interface DeclarationIndexEntry {
  readonly id: string;
  readonly statementIndex: number;
  readonly loc: SourceRange;
}

export interface CompiledTzrDocument {
  readonly type: "CompiledTzrDocument";
  readonly filePath: string;
  readonly body: readonly TzrStatement[];
  readonly labels: Readonly<Record<string, DeclarationIndexEntry>>;
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
}
