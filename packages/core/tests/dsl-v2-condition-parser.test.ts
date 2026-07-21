import { describe, expect, it } from "vitest";
import {
  parseTzrConditionExpression,
  type TzrConditionExpression,
  type TzrConditionParseResult,
} from "../src/index.js";

function parseCondition(source: string): TzrConditionExpression {
  const result = parseTzrConditionExpression(source, { filePath: "scenario/condition.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }
  return result.expression;
}

function expectConditionFailure(source: string): string[] {
  const result: TzrConditionParseResult = parseTzrConditionExpression(source, {
    filePath: "scenario/condition.tzr",
  });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzrConditionExpression", () => {
  it("parses scenario boolean references", () => {
    expect(parseCondition("scenario.inventory.hasNotebook")).toMatchObject({
      type: "ConditionReference",
      root: "scenario",
      path: "scenario.inventory.hasNotebook",
    });
  });

  it("parses system boolean references", () => {
    expect(parseCondition("system.endings.trueEnd.unlocked")).toMatchObject({
      type: "ConditionReference",
      root: "system",
      path: "system.endings.trueEnd.unlocked",
    });
  });

  it("parses custom namespace boolean references", () => {
    expect(parseCondition("inventory.hasNotebook")).toMatchObject({
      type: "ConditionReference",
      root: "inventory",
      path: "inventory.hasNotebook",
    });
  });

  it("parses string comparisons", () => {
    expect(parseCondition('scenario.route.current == "common"')).toMatchObject({
      type: "ConditionComparisonExpression",
      operator: "==",
      left: { type: "ConditionReference", path: "scenario.route.current" },
      right: { type: "ConditionStringLiteral", value: "common" },
    });
  });

  it("parses number comparisons", () => {
    expect(parseCondition("scenario.score >= -1.5")).toMatchObject({
      type: "ConditionComparisonExpression",
      operator: ">=",
      left: { type: "ConditionReference", path: "scenario.score" },
      right: { type: "ConditionNumberLiteral", value: -1.5 },
    });
  });

  it("rejects unsafe and non-finite condition number literals", () => {
    expect(expectConditionFailure("scenario.score == 9007199254740992")).toContain(
      'Number literal "9007199254740992" is outside the safe integer range.',
    );
    const overflow = "9".repeat(400);
    expect(expectConditionFailure(`scenario.score == ${overflow}`)).toContain(
      `Number literal "${overflow}" must be finite.`,
    );
    expect(parseCondition("scenario.zoom == 1.25")).toMatchObject({ right: { value: 1.25 } });
  });

  it("parses boolean and null comparisons", () => {
    expect(parseCondition("scenario.inventory.hasNotebook == true")).toMatchObject({
      type: "ConditionComparisonExpression",
      operator: "==",
      right: { type: "ConditionBooleanLiteral", value: true },
    });
    expect(parseCondition("scenario.selectedRoute == null")).toMatchObject({
      type: "ConditionComparisonExpression",
      operator: "==",
      right: { type: "ConditionNullLiteral", value: null },
    });
  });

  it("parses all comparison operators", () => {
    expect(parseCondition("scenario.a == 1")).toMatchObject({ type: "ConditionComparisonExpression", operator: "==" });
    expect(parseCondition("scenario.a != 1")).toMatchObject({ type: "ConditionComparisonExpression", operator: "!=" });
    expect(parseCondition("scenario.a >= 1")).toMatchObject({ type: "ConditionComparisonExpression", operator: ">=" });
    expect(parseCondition("scenario.a <= 1")).toMatchObject({ type: "ConditionComparisonExpression", operator: "<=" });
    expect(parseCondition("scenario.a > 1")).toMatchObject({ type: "ConditionComparisonExpression", operator: ">" });
    expect(parseCondition("scenario.a < 1")).toMatchObject({ type: "ConditionComparisonExpression", operator: "<" });
  });

  it("parses literal-to-literal comparisons", () => {
    expect(parseCondition("1 == 1")).toMatchObject({
      type: "ConditionComparisonExpression",
      left: { type: "ConditionNumberLiteral", value: 1 },
      right: { type: "ConditionNumberLiteral", value: 1 },
    });
  });

  it("parses not expressions", () => {
    expect(parseCondition("not scenario.inventory.hasNotebook")).toMatchObject({
      type: "ConditionUnaryExpression",
      operator: "not",
      expression: { type: "ConditionReference", path: "scenario.inventory.hasNotebook" },
    });
  });

  it("parses and expressions", () => {
    expect(parseCondition("scenario.a and scenario.b")).toMatchObject({
      type: "ConditionBinaryExpression",
      operator: "and",
      left: { type: "ConditionReference", path: "scenario.a" },
      right: { type: "ConditionReference", path: "scenario.b" },
    });
  });

  it("parses or expressions", () => {
    expect(parseCondition("scenario.a or scenario.b")).toMatchObject({
      type: "ConditionBinaryExpression",
      operator: "or",
      left: { type: "ConditionReference", path: "scenario.a" },
      right: { type: "ConditionReference", path: "scenario.b" },
    });
  });

  it("respects and before or precedence", () => {
    expect(parseCondition("scenario.a or scenario.b and scenario.c")).toMatchObject({
      type: "ConditionBinaryExpression",
      operator: "or",
      left: { type: "ConditionReference", path: "scenario.a" },
      right: {
        type: "ConditionBinaryExpression",
        operator: "and",
        left: { type: "ConditionReference", path: "scenario.b" },
        right: { type: "ConditionReference", path: "scenario.c" },
      },
    });
  });

  it("respects parentheses", () => {
    expect(parseCondition("(scenario.a or scenario.b) and scenario.c")).toMatchObject({
      type: "ConditionBinaryExpression",
      operator: "and",
      left: {
        type: "ConditionBinaryExpression",
        operator: "or",
        left: { type: "ConditionReference", path: "scenario.a" },
        right: { type: "ConditionReference", path: "scenario.b" },
      },
      right: { type: "ConditionReference", path: "scenario.c" },
    });
  });

  it("parses nested not expressions", () => {
    expect(parseCondition("not (scenario.a and scenario.b)")).toMatchObject({
      type: "ConditionUnaryExpression",
      operator: "not",
      expression: {
        type: "ConditionBinaryExpression",
        operator: "and",
        left: { type: "ConditionReference", path: "scenario.a" },
        right: { type: "ConditionReference", path: "scenario.b" },
      },
    });
  });

  it("rejects empty expressions", () => {
    expect(expectConditionFailure("")).toContain("Condition expression must not be empty.");
  });

  it("rejects invalid dotted references", () => {
    expect(expectConditionFailure("inventory")).toContain('Invalid dotted identifier "inventory".');
    expect(expectConditionFailure("scenario.")).toContain('Invalid dotted identifier "scenario.".');
    expect(expectConditionFailure("scenario..score")).toContain('Invalid dotted identifier "scenario..score".');
    expect(expectConditionFailure("scenario.score-value")).toContain(
      'Invalid dotted identifier "scenario.score-value".',
    );
  });

  it("rejects unsupported JavaScript operators", () => {
    expect(expectConditionFailure("scenario.a && scenario.b")).toContain("Unsupported condition operator `&&`.");
    expect(expectConditionFailure("scenario.a || scenario.b")).toContain("Unsupported condition operator `||`.");
    expect(expectConditionFailure("!scenario.a")).toContain("Unsupported condition operator `!`.");
    expect(expectConditionFailure("scenario.a === true")).toContain("Unsupported condition operator `===`.");
    expect(expectConditionFailure("scenario.a !== true")).toContain("Unsupported condition operator `!==`.");
  });

  it("rejects chained comparisons", () => {
    expect(expectConditionFailure("scenario.a < scenario.b < scenario.c")).toContain(
      "Chained comparison expressions are not supported.",
    );
  });

  it("rejects missing right-hand side expressions", () => {
    expect(expectConditionFailure("scenario.score >")).toContain('Missing right-hand side for condition operator ">".');
  });

  it("rejects missing closing parenthesis", () => {
    expect(expectConditionFailure("(scenario.a or scenario.b")).toContain(
      "Condition expression is missing closing parenthesis.",
    );
  });

  it("rejects extra tokens after complete expression", () => {
    expect(expectConditionFailure("scenario.a scenario.b")).toContain(
      'Unexpected token "scenario.b" after condition expression.',
    );
  });

  it("rejects single-quoted and backtick strings", () => {
    expect(expectConditionFailure("scenario.route == 'common'")).toContain(
      "Only double-quoted string literals are supported.",
    );
    expect(expectConditionFailure("scenario.route == `common`")).toContain(
      "Backtick string literals are not supported.",
    );
  });
});
