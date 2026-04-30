import type { SourceLocation } from "./ast.js";

export interface ParseDiagnostic {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly sourceLine: string;
}

export function createDiagnostic(
  location: SourceLocation,
  message: string,
  sourceLine: string,
): ParseDiagnostic {
  return {
    filePath: location.filePath,
    line: location.line,
    column: location.column,
    message,
    sourceLine,
  };
}
