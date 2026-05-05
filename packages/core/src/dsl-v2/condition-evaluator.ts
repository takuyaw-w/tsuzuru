import type {
  TzrV2ConditionComparisonExpression,
  TzrV2ConditionExpression,
  TzrV2ConditionReference,
} from "./ast.js";
import type { RuntimeErrorCode, RuntimeState, RuntimeValue } from "../runtime-types.js";

export type TzrV2ConditionEvaluationResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly error: TzrV2ConditionEvaluationError };

export interface TzrV2ConditionEvaluationError {
  readonly code: RuntimeErrorCode;
  readonly message: string;
}

type TzrV2ConditionValue = RuntimeValue | null | undefined;

type ValueEvaluationResult =
  | { readonly ok: true; readonly value: TzrV2ConditionValue }
  | { readonly ok: false; readonly error: TzrV2ConditionEvaluationError };

export function evaluateTzrV2Condition(
  expression: TzrV2ConditionExpression,
  state: RuntimeState,
): TzrV2ConditionEvaluationResult {
  return evaluateBooleanExpression(expression, state);
}

function evaluateBooleanExpression(
  expression: TzrV2ConditionExpression,
  state: RuntimeState,
): TzrV2ConditionEvaluationResult {
  switch (expression.type) {
    case "ConditionBinaryExpression":
      return evaluateLogicalExpression(expression.operator, expression.left, expression.right, state);
    case "ConditionUnaryExpression": {
      const value = evaluateBooleanExpression(expression.expression, state);
      return value.ok ? { ok: true, value: !value.value } : value;
    }
    case "ConditionComparisonExpression":
      return evaluateComparisonExpression(expression, state);
    default: {
      const value = evaluateValueExpression(expression, state);
      return value.ok ? { ok: true, value: toConditionBoolean(value.value) } : value;
    }
  }
}

function evaluateLogicalExpression(
  operator: "and" | "or",
  leftExpression: TzrV2ConditionExpression,
  rightExpression: TzrV2ConditionExpression,
  state: RuntimeState,
): TzrV2ConditionEvaluationResult {
  const left = evaluateBooleanExpression(leftExpression, state);
  if (!left.ok) {
    return left;
  }

  if (operator === "and") {
    if (!left.value) {
      return { ok: true, value: false };
    }
    return evaluateBooleanExpression(rightExpression, state);
  }

  if (left.value) {
    return { ok: true, value: true };
  }
  return evaluateBooleanExpression(rightExpression, state);
}

function evaluateComparisonExpression(
  expression: TzrV2ConditionComparisonExpression,
  state: RuntimeState,
): TzrV2ConditionEvaluationResult {
  const left = evaluateValueExpression(expression.left, state);
  if (!left.ok) {
    return left;
  }
  const right = evaluateValueExpression(expression.right, state);
  if (!right.ok) {
    return right;
  }

  switch (expression.operator) {
    case "==":
      return { ok: true, value: normalizeEqualityValue(left.value) === normalizeEqualityValue(right.value) };
    case "!=":
      return { ok: true, value: normalizeEqualityValue(left.value) !== normalizeEqualityValue(right.value) };
    case ">":
    case ">=":
    case "<":
    case "<=":
      return evaluateNumericComparison(expression.operator, left.value, right.value);
  }
}

function evaluateNumericComparison(
  operator: ">" | ">=" | "<" | "<=",
  left: TzrV2ConditionValue,
  right: TzrV2ConditionValue,
): TzrV2ConditionEvaluationResult {
  if (typeof left !== "number" || typeof right !== "number") {
    return {
      ok: false,
      error: {
        code: "condition_invalid_numeric_comparison",
        message: `Cannot evaluate condition operator "${operator}" because both operands must be numbers.`,
      },
    };
  }

  switch (operator) {
    case ">":
      return { ok: true, value: left > right };
    case ">=":
      return { ok: true, value: left >= right };
    case "<":
      return { ok: true, value: left < right };
    case "<=":
      return { ok: true, value: left <= right };
  }
}

function evaluateValueExpression(
  expression: TzrV2ConditionExpression,
  state: RuntimeState,
): ValueEvaluationResult {
  switch (expression.type) {
    case "ConditionReference":
      return evaluateReference(expression, state);
    case "ConditionStringLiteral":
    case "ConditionNumberLiteral":
    case "ConditionBooleanLiteral":
    case "ConditionNullLiteral":
      return { ok: true, value: expression.value };
    case "ConditionUnaryExpression":
    case "ConditionBinaryExpression":
    case "ConditionComparisonExpression": {
      const value = evaluateBooleanExpression(expression, state);
      return value.ok ? { ok: true, value: value.value } : value;
    }
  }
}

function evaluateReference(reference: TzrV2ConditionReference, state: RuntimeState): ValueEvaluationResult {
  if (reference.root === "system") {
    return {
      ok: false,
      error: {
        code: "condition_system_reference_unsupported",
        message: `Cannot evaluate system condition reference "${reference.path}" because system state is not supported yet.`,
      },
    };
  }

  return { ok: true, value: state.variables[reference.path] };
}

function toConditionBoolean(value: TzrV2ConditionValue): boolean {
  return value === true;
}

function normalizeEqualityValue(value: TzrV2ConditionValue): RuntimeValue | null {
  return value === undefined ? null : value;
}
