import { describe, expect, it } from "vitest";
import { evaluateTzrCondition } from "../src/condition-evaluator.js";
import {
  createInitialRuntimeState,
  parseTzrConditionExpression,
  type RuntimeConditionResolver,
  type RuntimeConditionResolveResult,
  type RuntimeDocument,
  type RuntimeState,
  type RuntimeValue,
} from "../src/index.js";

function resolver(
  namespace: string,
  resolve: (path: readonly string[], state: RuntimeState) => RuntimeConditionResolveResult,
): RuntimeConditionResolver {
  return { namespace, resolve };
}

function ok(value: RuntimeValue | null | undefined): RuntimeConditionResolveResult {
  return { ok: true, value };
}

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
  it("keeps condition resolver fixtures typed for resolver tests", () => {
    const state = createInitialRuntimeState(createDocument());
    const systemResolver = resolver("system", (path, receivedState) => {
      expect(path).toEqual(["flags", "ready"]);
      expect(receivedState).toBe(state);
      return ok(true);
    });

    expect(systemResolver.namespace).toBe("system");
    expect(systemResolver.resolve(["flags", "ready"], state)).toEqual({
      ok: true,
      value: true,
    });
  });

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
