export const CORE_COMMAND_NAMES = [
  "jump",
  "waitClick",
  "page",
  "stop",
  "wait",
  "openScreen",
  "closeScreen",
  "waitScreenClose",
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
  { name: "jump", category: "flow" },
  { name: "waitClick", category: "text" },
  { name: "page", category: "text" },
  { name: "stop", category: "flow" },
  { name: "wait", category: "flow" },
  { name: "openScreen", category: "flow" },
  { name: "closeScreen", category: "flow" },
  { name: "waitScreenClose", category: "flow" },
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
