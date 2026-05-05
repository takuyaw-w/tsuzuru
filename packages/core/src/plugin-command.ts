export interface PluginCommandDefinition {
  readonly name: string;
  readonly args?: PluginCommandArgumentSchema;
}

export type PluginCommandMap = Readonly<Record<string, PluginCommandDefinition>>;

export type PluginCommandValueType = "string" | "number" | "boolean" | "identifier";

export interface PluginCommandArgumentDefinition {
  readonly type: PluginCommandValueType | readonly PluginCommandValueType[];
  readonly optional?: boolean;
  readonly nonEmpty?: boolean;
  readonly values?: readonly string[];
}

export interface PluginCommandPositionalArgumentDefinition extends PluginCommandArgumentDefinition {
  readonly name?: string;
}

export interface PluginCommandNamedArgumentDefinition extends PluginCommandArgumentDefinition {
  readonly name: string;
}

export type PluginCommandArgumentSchema =
  | {
      readonly kind: "none";
    }
  | {
      readonly kind: "positional";
      readonly arguments: readonly PluginCommandPositionalArgumentDefinition[];
    }
  | {
      readonly kind: "mixed";
      readonly positional: readonly PluginCommandPositionalArgumentDefinition[];
      readonly named: readonly PluginCommandNamedArgumentDefinition[];
    }
  | {
      readonly kind: "named";
      readonly arguments: readonly PluginCommandNamedArgumentDefinition[];
    };

export function definePluginCommand(
  name: string,
  args?: PluginCommandArgumentSchema,
): PluginCommandDefinition {
  return args === undefined ? { name } : { name, args };
}
