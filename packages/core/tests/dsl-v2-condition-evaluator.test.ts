import { describe, expect, it } from "vitest";
import { evaluateTzrCondition } from "../src/condition-evaluator.js";
import { createInitialRuntimeState, parseTzrConditionExpression, type RuntimeDocument } from "../src/index.js";

function parseCondition(source: string) {
  const result = parseTzrConditionExpression(source, { filePath: "scenario/condition.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }
  return result.expression;
}

function createDocument(): RuntimeDocument {
  return {
    filePath: "scenario/condition.tzr",
    instructions: [],
    scenes: {},
  };
}

describe("evaluateTzrCondition", () => {
  it("evaluates scenario references from runtime variables", () => {
    const state = {
      ...createInitialRuntimeState(createDocument()),
      variables: { "scenario.hasNotebook": true },
    };

    expect(evaluateTzrCondition(parseCondition("scenario.hasNotebook"), state)).toEqual({
      ok: true,
      value: true,
    });
  });

  it("keeps system references unsupported at runtime evaluator boundary", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(evaluateTzrCondition(parseCondition("system.endings.trueEnd.unlocked"), state)).toEqual({
      ok: false,
      error: {
        code: "condition_system_reference_unsupported",
        message:
          'Cannot evaluate system condition reference "system.endings.trueEnd.unlocked" because system state is not supported yet.',
      },
    });
  });
});
