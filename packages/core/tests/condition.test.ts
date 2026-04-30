import { describe, expect, it } from "vitest";
import type { ConditionExpression, SourceRange } from "../src/index.js";
import { evaluateCondition, type RuntimeState } from "../src/index.js";

const loc: SourceRange = {
  start: { filePath: "scenario/main.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/main.tzr", line: 1, column: 1 },
};

const baseState: RuntimeState = {
  pointer: {
    filePath: "scenario/main.tzr",
    instructionIndex: 0,
  },
  variables: {},
  flags: {},
  branchFrames: [],
  pendingChoice: null,
  isStopped: false,
  isWaitingForClick: false,
};

function state(overrides: Partial<Pick<RuntimeState, "variables" | "flags">>): RuntimeState {
  return {
    ...baseState,
    ...overrides,
  };
}

function flag(name: string): ConditionExpression {
  return { type: "FlagCondition", name, loc };
}

function variable(
  name: string,
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<",
  value: string | number | boolean,
): ConditionExpression {
  const conditionValue =
    typeof value === "string"
      ? { type: "StringValue" as const, value, loc }
      : typeof value === "number"
        ? { type: "NumberValue" as const, value, loc }
        : { type: "BooleanValue" as const, value, loc };

  return {
    type: "VariableComparisonCondition",
    name,
    operator,
    value: conditionValue,
    loc,
  };
}

describe("evaluateCondition", () => {
  it("evaluates true and undefined flags", () => {
    expect(evaluateCondition(flag("met_haruka"), state({ flags: { met_haruka: true } }))).toBe(true);
    expect(evaluateCondition(flag("met_haruka"), state({ flags: {} }))).toBe(false);
  });

  it("evaluates NotCondition by inverting a flag condition", () => {
    const expression: ConditionExpression = {
      type: "NotCondition",
      expression: flag("met_haruka"),
      loc,
    };

    expect(evaluateCondition(expression, state({ flags: { met_haruka: true } }))).toBe(false);
    expect(evaluateCondition(expression, state({ flags: {} }))).toBe(true);
  });

  it("evaluates string variable equality and inequality", () => {
    const runtimeState = state({ variables: { route: "haruka" } });

    expect(evaluateCondition(variable("route", "==", "haruka"), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("route", "!=", "yui"), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("route", "==", "yui"), runtimeState)).toBe(false);
    expect(evaluateCondition(variable("route", "!=", "haruka"), runtimeState)).toBe(false);
  });

  it("evaluates number variable comparisons", () => {
    const runtimeState = state({ variables: { score: 3 } });

    expect(evaluateCondition(variable("score", ">", 2), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("score", ">=", 3), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("score", "<", 4), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("score", "<=", 3), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("score", ">", 3), runtimeState)).toBe(false);
    expect(evaluateCondition(variable("score", "<", 3), runtimeState)).toBe(false);
  });

  it("evaluates boolean variable equality and inequality", () => {
    const runtimeState = state({ variables: { cleared: true } });

    expect(evaluateCondition(variable("cleared", "==", true), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("cleared", "!=", false), runtimeState)).toBe(true);
    expect(evaluateCondition(variable("cleared", "==", false), runtimeState)).toBe(false);
    expect(evaluateCondition(variable("cleared", "!=", true), runtimeState)).toBe(false);
  });

  it("returns false for undefined variables and mismatched value types", () => {
    const runtimeState = state({ variables: { score: 3, route: "haruka" } });

    expect(evaluateCondition(variable("missing", "==", "value"), runtimeState)).toBe(false);
    expect(evaluateCondition(variable("score", "==", "3"), runtimeState)).toBe(false);
    expect(evaluateCondition(variable("route", ">", 1), runtimeState)).toBe(false);
  });

  it("does not mutate RuntimeState", () => {
    const runtimeState = state({
      variables: { score: 3 },
      flags: { met_haruka: true },
    });
    const before = JSON.stringify(runtimeState);

    evaluateCondition(variable("score", ">=", 3), runtimeState);
    evaluateCondition(flag("met_haruka"), runtimeState);

    expect(JSON.stringify(runtimeState)).toBe(before);
  });
});
