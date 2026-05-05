export const CORE_COMMAND_NAMES = [
  "waitClick",
  "page",
  "stop",
  "wait",
  "set",
  "inc",
  "dec",
  "flag",
  "unflag",
] as const;

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
  { name: "inc", category: "state" },
  { name: "dec", category: "state" },
  { name: "flag", category: "state" },
  { name: "unflag", category: "state" },
];

const coreCommandNames = new Set<string>(CORE_COMMAND_NAMES);

export function isCoreCommandName(name: string): name is CoreCommandName {
  return coreCommandNames.has(name);
}
