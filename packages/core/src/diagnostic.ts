import type { SourceLocation } from "./ast.js";

export interface Diagnostic {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly sourceLine: string;
}

export type ParseDiagnostic = Diagnostic;

export function createDiagnostic(location: SourceLocation, message: string, sourceLine: string): Diagnostic {
  return {
    filePath: location.filePath,
    line: location.line,
    column: location.column,
    message,
    sourceLine,
  };
}
