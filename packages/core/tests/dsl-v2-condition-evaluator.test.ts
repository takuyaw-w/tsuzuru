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

  it("routes non-scenario references through a matching resolver", () => {
    const state = createInitialRuntimeState(createDocument());
    const systemResolver = resolver("system", (path, receivedState) => {
      expect(path).toEqual(["endings", "trueEnd", "unlocked"]);
      expect(receivedState).toBe(state);
      return ok(true);
    });

    expect(
      evaluateTzrCondition(parseCondition("system.endings.trueEnd.unlocked"), state, {
        conditionResolvers: [systemResolver],
      }),
    ).toEqual({
      ok: true,
      value: true,
    });
  });

  it("uses resolver values in comparisons and logical expressions", () => {
    const state = {
      ...createInitialRuntimeState(createDocument()),
      variables: { "scenario.score": 5 },
    };
    const systemResolver = resolver("system", (path) => {
      if (path.join(".") === "endings.trueEnd.unlocked") {
        return ok(true);
      }
      if (path.join(".") === "endings.trueEnd.clearCount") {
        return ok(2);
      }
      return {
        ok: false,
        error: {
          code: "condition_system_path_unsupported",
          message: `Unsupported system condition path "${path.join(".")}".`,
        },
      };
    });

    expect(
      evaluateTzrCondition(
        parseCondition("system.endings.trueEnd.unlocked and system.endings.trueEnd.clearCount >= 2 and scenario.score > 3"),
        state,
        { conditionResolvers: [systemResolver] },
      ),
    ).toEqual({
      ok: true,
      value: true,
    });
  });

  it("returns a missing resolver error for an unregistered namespace", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(evaluateTzrCondition(parseCondition("system.endings.trueEnd.unlocked"), state)).toEqual({
      ok: false,
      error: {
        code: "condition_resolver_missing",
        message:
          'Cannot evaluate condition reference "system.endings.trueEnd.unlocked" because condition resolver "system" is not registered.',
      },
    });
  });

  it("returns a duplicate resolver error when a namespace is registered more than once", () => {
    const state = createInitialRuntimeState(createDocument());
    const conditionResolvers = [
      resolver("system", () => ok(true)),
      resolver("system", () => ok(false)),
    ];

    expect(
      evaluateTzrCondition(parseCondition("system.endings.trueEnd.unlocked"), state, {
        conditionResolvers,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "condition_resolver_duplicate",
        message:
          'Cannot evaluate condition reference "system.endings.trueEnd.unlocked" because condition resolver "system" is registered more than once.',
      },
    });
  });

  it("propagates resolver failures", () => {
    const state = createInitialRuntimeState(createDocument());
    const systemResolver = resolver("system", (path) => ({
      ok: false,
      error: {
        code: "condition_system_path_unsupported",
        message: `Unsupported system condition path "${path.join(".")}".`,
      },
    }));

    expect(
      evaluateTzrCondition(parseCondition("system.endings.trueEnd.title"), state, {
        conditionResolvers: [systemResolver],
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "condition_system_path_unsupported",
        message: 'Unsupported system condition path "endings.trueEnd.title".',
      },
    });
  });
});
