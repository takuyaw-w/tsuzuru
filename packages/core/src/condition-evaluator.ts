import type { RuntimeConditionResolver, RuntimeErrorCode, RuntimeState, RuntimeValue } from "./runtime-types.js";
import type {
  TzrConditionComparisonExpression,
  TzrConditionExpression,
  TzrConditionReference,
} from "./scenario-ast.js";

export type TzrConditionEvaluationResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly error: TzrConditionEvaluationError };

export interface TzrConditionEvaluationError {
  readonly code: RuntimeErrorCode;
  readonly message: string;
}

export interface TzrConditionEvaluationOptions {
  readonly conditionResolvers?: readonly RuntimeConditionResolver[];
}

type TzrConditionValue = RuntimeValue | null | undefined;

type ValueEvaluationResult =
  | { readonly ok: true; readonly value: TzrConditionValue }
  | { readonly ok: false; readonly error: TzrConditionEvaluationError };

export function evaluateTzrCondition(
  expression: TzrConditionExpression,
  state: RuntimeState,
  options: TzrConditionEvaluationOptions = {},
): TzrConditionEvaluationResult {
  return evaluateBooleanExpression(expression, state, options);
}

function evaluateBooleanExpression(
  expression: TzrConditionExpression,
  state: RuntimeState,
  options: TzrConditionEvaluationOptions,
): TzrConditionEvaluationResult {
  switch (expression.type) {
    case "ConditionBinaryExpression":
      return evaluateLogicalExpression(expression.operator, expression.left, expression.right, state, options);
    case "ConditionUnaryExpression": {
      const value = evaluateBooleanExpression(expression.expression, state, options);
      return value.ok ? { ok: true, value: !value.value } : value;
    }
    case "ConditionComparisonExpression":
      return evaluateComparisonExpression(expression, state, options);
    default: {
      const value = evaluateValueExpression(expression, state, options);
      return value.ok ? { ok: true, value: toConditionBoolean(value.value) } : value;
    }
  }
}

function evaluateLogicalExpression(
  operator: "and" | "or",
  leftExpression: TzrConditionExpression,
  rightExpression: TzrConditionExpression,
  state: RuntimeState,
  options: TzrConditionEvaluationOptions,
): TzrConditionEvaluationResult {
  const left = evaluateBooleanExpression(leftExpression, state, options);
  if (!left.ok) {
    return left;
  }

  if (operator === "and") {
    if (!left.value) {
      return { ok: true, value: false };
    }
    return evaluateBooleanExpression(rightExpression, state, options);
  }

  if (left.value) {
    return { ok: true, value: true };
  }
  return evaluateBooleanExpression(rightExpression, state, options);
}

function evaluateComparisonExpression(
  expression: TzrConditionComparisonExpression,
  state: RuntimeState,
  options: TzrConditionEvaluationOptions,
): TzrConditionEvaluationResult {
  const left = evaluateValueExpression(expression.left, state, options);
  if (!left.ok) {
    return left;
  }
  const right = evaluateValueExpression(expression.right, state, options);
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
  options: TzrConditionEvaluationOptions,
): ValueEvaluationResult {
  switch (expression.type) {
    case "ConditionReference":
      return evaluateReference(expression, state, options);
    case "ConditionStringLiteral":
    case "ConditionNumberLiteral":
    case "ConditionBooleanLiteral":
    case "ConditionNullLiteral":
      return { ok: true, value: expression.value };
    case "ConditionUnaryExpression":
    case "ConditionBinaryExpression":
    case "ConditionComparisonExpression": {
      const value = evaluateBooleanExpression(expression, state, options);
      return value.ok ? { ok: true, value: value.value } : value;
    }
  }
}

function evaluateReference(
  reference: TzrConditionReference,
  state: RuntimeState,
  options: TzrConditionEvaluationOptions,
): ValueEvaluationResult {
  if (reference.root === "scenario") {
    return { ok: true, value: state.variables[reference.path] };
  }

  const resolvers = (options.conditionResolvers ?? []).filter((resolver) => resolver.namespace === reference.root);
  if (resolvers.length === 0) {
    return {
      ok: false,
      error: {
        code: "condition_resolver_missing",
        message: `Cannot evaluate condition reference "${reference.path}" because condition resolver "${reference.root}" is not registered.`,
      },
    };
  }

  if (resolvers.length > 1) {
    return {
      ok: false,
      error: {
        code: "condition_resolver_duplicate",
        message: `Cannot evaluate condition reference "${reference.path}" because condition resolver "${reference.root}" is registered more than once.`,
      },
    };
  }

  const resolver = resolvers[0];
  if (resolver === undefined) {
    return {
      ok: false,
      error: {
        code: "condition_resolver_missing",
        message: `Cannot evaluate condition reference "${reference.path}" because condition resolver "${reference.root}" is not registered.`,
      },
    };
  }

  return resolver.resolve(reference.path.split(".").slice(1), state);
}

function toConditionBoolean(value: TzrConditionValue): boolean {
  return value === true;
}

function normalizeEqualityValue(value: TzrConditionValue): RuntimeValue | null {
  return value === undefined ? null : value;
}
