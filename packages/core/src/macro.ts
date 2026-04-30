import type { MacroInstruction, TzrInstruction } from "./ir.js";

export interface MacroContext {
  readonly filePath: string;
}

export type MacroExpandFunction = (
  call: MacroInstruction,
  context: MacroContext,
) => readonly TzrInstruction[];

export interface MacroDefinition {
  readonly expand: MacroExpandFunction;
}

export type MacroEntry = MacroDefinition | MacroExpandFunction;

export type MacroMap = Readonly<Record<string, MacroEntry>>;

export function expandMacro(
  entry: MacroEntry,
  call: MacroInstruction,
  context: MacroContext,
): readonly TzrInstruction[] {
  if (typeof entry === "function") {
    return entry(call, context);
  }

  return entry.expand(call, context);
}
