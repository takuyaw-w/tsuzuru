import type { TzrArgument, TzrValue } from "./ast.js";
import type { RuntimeValue } from "./runtime-types.js";

function getNamedArgument(args: readonly TzrArgument[], name: string): TzrArgument | undefined {
  return args.find((arg) => arg.type === "NamedArgument" && arg.name === name);
}

export function getNamedString(args: readonly TzrArgument[], name: string): string | undefined {
  const argument = getNamedArgument(args, name);
  if (argument?.type !== "NamedArgument" || argument.value.type !== "StringValue") {
    return undefined;
  }
  return argument.value.value;
}

export function getNamedNumber(args: readonly TzrArgument[], name: string): number | undefined {
  const argument = getNamedArgument(args, name);
  if (argument?.type !== "NamedArgument" || argument.value.type !== "NumberValue") {
    return undefined;
  }
  return argument.value.value;
}

export function getPositionalNumber(args: readonly TzrArgument[], index: number): number | undefined {
  const argument = args[index];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "NumberValue") {
    return undefined;
  }
  return argument.value.value;
}

export function getNamedRuntimeValue(args: readonly TzrArgument[], name: string): RuntimeValue | undefined {
  const argument = getNamedArgument(args, name);
  if (argument?.type !== "NamedArgument") {
    return undefined;
  }
  return valueToRuntimeValue(argument.value);
}

export function getPositionalString(args: readonly TzrArgument[], index: number): string | undefined {
  const argument = args[index];
  if (argument?.type !== "PositionalArgument" || argument.value.type !== "StringValue") {
    return undefined;
  }
  return argument.value.value;
}

function valueToRuntimeValue(value: TzrValue): RuntimeValue | undefined {
  switch (value.type) {
    case "StringValue":
    case "NumberValue":
    case "BooleanValue":
      return value.value;
    case "NullValue":
      return null;
    case "IdentifierValue":
      return undefined;
  }
}
