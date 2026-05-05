import type {
  TzrConditionComparisonExpression,
  TzrConditionExpression,
  TzrConditionReference,
} from "./scenario-ast.js";
import type { RuntimeErrorCode, RuntimeState, RuntimeValue } from "./runtime-types.js";

export type TzrConditionEvaluationResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly error: TzrConditionEvaluationError };

export interface TzrConditionEvaluationError {
  readonly code: RuntimeErrorCode;
  readonly message: string;
}

type TzrConditionValue = RuntimeValue | null | undefined;

type ValueEvaluationResult =
  | { readonly ok: true; readonly value: TzrConditionValue }
  | { readonly ok: false; readonly error: TzrConditionEvaluationError };

export function evaluateTzrCondition(
  expression: TzrConditionExpression,
  state: RuntimeState,
): TzrConditionEvaluationResult {
  return evaluateBooleanExpression(expression, state);
}

function evaluateBooleanExpression(
  expression: TzrConditionExpression,
  state: RuntimeState,
): TzrConditionEvaluationResult {
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
  leftExpression: TzrConditionExpression,
  rightExpression: TzrConditionExpression,
  state: RuntimeState,
): TzrConditionEvaluationResult {
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
  expression: TzrConditionComparisonExpression,
  state: RuntimeState,
): TzrConditionEvaluationResult {
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
  left: TzrConditionValue,
  right: TzrConditionValue,
): TzrConditionEvaluationResult {
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
  expression: TzrConditionExpression,
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

function evaluateReference(reference: TzrConditionReference, state: RuntimeState): ValueEvaluationResult {
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

function toConditionBoolean(value: TzrConditionValue): boolean {
  return value === true;
}

function normalizeEqualityValue(value: TzrConditionValue): RuntimeValue | null {
  return value === undefined ? null : value;
}
