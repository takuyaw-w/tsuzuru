import type { SourceLocation, TzrArgument, TzrValue } from "./ast.js";

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
  readonly integer?: boolean;
  readonly min?: number;
  readonly requiredWith?: readonly string[];
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
      readonly allowExtraPositional?: boolean;
      readonly allowExtraNamed?: boolean;
    }
  | {
      readonly kind: "positional";
      readonly arguments: readonly PluginCommandPositionalArgumentDefinition[];
      readonly allowExtraPositional?: boolean;
      readonly allowExtraNamed?: boolean;
    }
  | {
      readonly kind: "mixed";
      readonly positional: readonly PluginCommandPositionalArgumentDefinition[];
      readonly named: readonly PluginCommandNamedArgumentDefinition[];
      readonly allowExtraPositional?: boolean;
      readonly allowExtraNamed?: boolean;
    }
  | {
      readonly kind: "named";
      readonly arguments: readonly PluginCommandNamedArgumentDefinition[];
      readonly allowExtraPositional?: boolean;
      readonly allowExtraNamed?: boolean;
    };

export function definePluginCommand(name: string, args?: PluginCommandArgumentSchema): PluginCommandDefinition {
  return args === undefined ? { name } : { name, args };
}

export interface PluginCommandValidationDiagnostic {
  readonly location: SourceLocation;
  readonly message: string;
}

export function validatePluginCommandArguments(
  command: PluginCommandDefinition,
  args: readonly TzrArgument[],
  location: SourceLocation,
): readonly PluginCommandValidationDiagnostic[] {
  if (command.args === undefined) {
    return [];
  }

  const schema = command.args;
  const positional = args.filter((arg) => arg.type === "PositionalArgument");
  const named = args.filter((arg) => arg.type === "NamedArgument");
  const diagnostics: PluginCommandValidationDiagnostic[] = [];

  switch (schema.kind) {
    case "none":
      diagnostics.push(
        ...validatePositionalArguments(command.name, [], positional, schema.allowExtraPositional ?? false, location),
        ...validateNamedArguments(command.name, [], named, schema.allowExtraNamed ?? false, location),
      );
      break;
    case "positional":
      diagnostics.push(
        ...validatePositionalArguments(
          command.name,
          schema.arguments,
          positional,
          schema.allowExtraPositional ?? false,
          location,
        ),
        ...validateNamedArguments(command.name, [], named, schema.allowExtraNamed ?? false, location),
      );
      break;
    case "mixed":
      diagnostics.push(
        ...validatePositionalArguments(
          command.name,
          schema.positional,
          positional,
          schema.allowExtraPositional ?? false,
          location,
        ),
        ...validateNamedArguments(command.name, schema.named, named, schema.allowExtraNamed ?? false, location),
      );
      break;
    case "named":
      diagnostics.push(
        ...validatePositionalArguments(command.name, [], positional, schema.allowExtraPositional ?? false, location),
        ...validateNamedArguments(command.name, schema.arguments, named, schema.allowExtraNamed ?? false, location),
      );
      break;
  }

  return diagnostics;
}

function validatePositionalArguments(
  commandName: string,
  definitions: readonly PluginCommandPositionalArgumentDefinition[],
  args: readonly Extract<TzrArgument, { readonly type: "PositionalArgument" }>[],
  allowExtra: boolean,
  location: SourceLocation,
): readonly PluginCommandValidationDiagnostic[] {
  const diagnostics: PluginCommandValidationDiagnostic[] = [];

  for (const [index, definition] of definitions.entries()) {
    const arg = args[index];
    if (arg === undefined) {
      if (definition.optional !== true) {
        diagnostics.push({
          location,
          message: `Plugin command "${commandName}" is missing required positional argument ${index + 1}.`,
        });
      }
      continue;
    }
    diagnostics.push(
      ...validateValue(commandName, positionalArgumentLabel(index), definition, arg.value, arg.loc.start),
    );
  }

  if (!allowExtra && args.length > definitions.length) {
    const extra = args[definitions.length];
    diagnostics.push({
      location: extra?.loc.start ?? location,
      message: `Plugin command "${commandName}" expects at most ${definitions.length} positional argument${
        definitions.length === 1 ? "" : "s"
      } but received ${args.length}.`,
    });
  }

  return diagnostics;
}

function validateNamedArguments(
  commandName: string,
  definitions: readonly PluginCommandNamedArgumentDefinition[],
  args: readonly Extract<TzrArgument, { readonly type: "NamedArgument" }>[],
  allowExtra: boolean,
  location: SourceLocation,
): readonly PluginCommandValidationDiagnostic[] {
  const diagnostics: PluginCommandValidationDiagnostic[] = [];
  const definitionsByName = new Map(definitions.map((definition) => [definition.name, definition]));
  const seen = new Set<string>();

  for (const arg of args) {
    if (seen.has(arg.name)) {
      diagnostics.push({
        location: arg.loc.start,
        message: `Plugin command "${commandName}" received duplicate named argument "${arg.name}".`,
      });
      continue;
    }
    seen.add(arg.name);

    const definition = definitionsByName.get(arg.name);
    if (definition === undefined) {
      if (!allowExtra) {
        diagnostics.push({
          location: arg.loc.start,
          message: `Plugin command "${commandName}" does not support named argument "${arg.name}".`,
        });
      }
      continue;
    }

    diagnostics.push(
      ...validateValue(commandName, `named argument "${arg.name}"`, definition, arg.value, arg.loc.start),
    );
  }

  for (const definition of definitions) {
    if (definition.optional !== true && !seen.has(definition.name)) {
      diagnostics.push({
        location,
        message: `Plugin command "${commandName}" is missing required named argument "${definition.name}".`,
      });
    }
  }

  for (const definition of definitions) {
    if (!seen.has(definition.name)) {
      continue;
    }

    for (const requiredName of definition.requiredWith ?? []) {
      if (seen.has(requiredName)) {
        continue;
      }

      const arg = args.find((candidate) => candidate.name === definition.name);
      diagnostics.push({
        location: arg?.loc.start ?? location,
        message: `Plugin command "${commandName}" named argument "${definition.name}" requires named argument "${requiredName}".`,
      });
    }
  }

  return diagnostics;
}

function validateValue(
  commandName: string,
  argumentLabel: string,
  definition: PluginCommandArgumentDefinition,
  value: TzrValue,
  location: SourceLocation,
): readonly PluginCommandValidationDiagnostic[] {
  const diagnostics: PluginCommandValidationDiagnostic[] = [];
  const expectedTypes = Array.isArray(definition.type) ? definition.type : [definition.type];
  const actualType = pluginCommandValueType(value);

  if (!isPluginCommandValueType(actualType) || !expectedTypes.includes(actualType)) {
    diagnostics.push({
      location,
      message: `Plugin command "${commandName}" ${argumentLabel} must be ${formatExpectedTypes(expectedTypes)}.`,
    });
    return diagnostics;
  }

  if (definition.nonEmpty === true && value.type === "StringValue" && value.value.length === 0) {
    diagnostics.push({
      location,
      message: `Plugin command "${commandName}" ${argumentLabel} must not be empty.`,
    });
  }

  if (value.type === "NumberValue") {
    const shouldValidateNumberRange = definition.integer === true || definition.min !== undefined;
    if (shouldValidateNumberRange && !Number.isFinite(value.value)) {
      diagnostics.push({
        location,
        message: `Plugin command "${commandName}" ${argumentLabel} must be finite.`,
      });
      return diagnostics;
    }

    if (definition.integer === true && !Number.isInteger(value.value)) {
      diagnostics.push({
        location,
        message: `Plugin command "${commandName}" ${argumentLabel} must be an integer.`,
      });
    }

    if (definition.min !== undefined && value.value < definition.min) {
      diagnostics.push({
        location,
        message: `Plugin command "${commandName}" ${argumentLabel} must be at least ${definition.min}.`,
      });
    }
  }

  if (
    definition.values !== undefined &&
    (value.type === "StringValue" || value.type === "IdentifierValue") &&
    !definition.values.includes(value.type === "StringValue" ? value.value : value.name)
  ) {
    diagnostics.push({
      location,
      message: `Plugin command "${commandName}" ${argumentLabel} must be one of ${definition.values
        .map((allowed) => `"${allowed}"`)
        .join(", ")}.`,
    });
  }

  return diagnostics;
}

function pluginCommandValueType(value: TzrValue): PluginCommandValueType | "null" {
  switch (value.type) {
    case "StringValue":
      return "string";
    case "NumberValue":
      return "number";
    case "BooleanValue":
      return "boolean";
    case "IdentifierValue":
      return "identifier";
    case "NullValue":
      return "null";
  }
}

function isPluginCommandValueType(value: PluginCommandValueType | "null"): value is PluginCommandValueType {
  return value !== "null";
}

function positionalArgumentLabel(index: number): string {
  return `positional argument ${index + 1}`;
}

function formatExpectedTypes(types: readonly PluginCommandValueType[]): string {
  if (types.length === 1) {
    return `a ${types[0]}`;
  }

  return types.map((type) => `a ${type}`).join(" or ");
}
