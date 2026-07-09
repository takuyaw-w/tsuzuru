export const CORE_COMMAND_NAMES = ["waitClick", "page", "stop", "wait", "set"] as const;

export const DSL_ADD_COMMAND_NAME = "__tsuzuru_add";
export const DSL_SET_REFERENCE_COMMAND_NAME = "__tsuzuru_set_reference";

export type CoreCommandName = (typeof CORE_COMMAND_NAMES)[number];

export interface CoreCommandDefinition {
  readonly name: CoreCommandName;
  readonly category: "flow" | "state" | "text";
}

export const CORE_COMMANDS: readonly CoreCommandDefinition[] = [
  { name: "waitClick", category: "text" },
  { name: "page", category: "text" },
  { name: "stop", category: "flow" },
  { name: "wait", category: "flow" },
  { name: "set", category: "state" },
];

const coreCommandNames = new Set<string>(CORE_COMMAND_NAMES);

export function isCoreCommandName(name: string): name is CoreCommandName {
  return coreCommandNames.has(name);
}
