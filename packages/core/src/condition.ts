import type { ConditionExpression, TzrValue } from "./ast.js";
import type { RuntimeState, RuntimeValue } from "./runtime.js";

export function evaluateCondition(expression: ConditionExpression, state: RuntimeState): boolean {
  switch (expression.type) {
    case "FlagCondition":
      return state.flags[expression.name] === true;
    case "NotCondition":
      return !evaluateCondition(expression.expression, state);
    case "VariableComparisonCondition":
      return evaluateVariableComparison(expression.name, expression.operator, valueToRuntimeValue(expression.value), state);
  }
}

function evaluateVariableComparison(
  name: string,
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<",
  expected: RuntimeValue,
  state: RuntimeState,
): boolean {
  const actual = state.variables[name];
  if (actual === undefined || typeof actual !== typeof expected) {
    return false;
  }

  switch (operator) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case ">=":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "<":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "<=":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  }
}

function valueToRuntimeValue(value: TzrValue): RuntimeValue {
  switch (value.type) {
    case "StringValue":
    case "NumberValue":
    case "BooleanValue":
      return value.value;
    case "IdentifierValue":
      throw new Error("Identifier values are not valid condition comparison values.");
  }
}
