# System Condition Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement first-scope `system.*` condition reads by resolving the current `@tsuzuru/plugin-std-system` runtime plugin state through a generic core condition resolver.

**Architecture:** Core owns condition namespace validation and resolver dispatch, but does not import std-system or know its state shape. `@tsuzuru/plugin-std-system` declares the `system` condition namespace at compile time and exports a runtime resolver that reads `runtimeState.plugins.stdSystem`. Docs then promote only the supported runtime-plugin-state scope.

**Tech Stack:** TypeScript, Vitest, `@tsuzuru/core`, `@tsuzuru/plugin-std-system`, Oxfmt, Oxlint.

---

## File Structure

- Modify: `packages/core/src/runtime-types.ts`
  - Add `RuntimeConditionResolver`, resolver result types, `conditionResolvers` in `RuntimeStepOptions`, and new runtime error codes.
- Modify: `packages/core/src/condition-evaluator.ts`
  - Accept resolver options, route non-`scenario.*` references through namespace resolvers, and keep existing condition truthiness/comparison behavior.
- Modify: `packages/core/src/runtime-control.ts`
  - Pass `options.conditionResolvers` into `evaluateTzrCondition` for `if` and body-choice filtering.
- Modify: `packages/core/src/compiler.ts`
  - Add compile-time condition namespace declarations to plugin definitions and validate non-`scenario.*` condition references against them.
- Modify: `packages/core/src/index.ts`
  - Export the new public runtime condition resolver types if `export type * from "./runtime-types.js"` does not already expose them through the package surface.
- Modify: `packages/core/tests/dsl-v2-compiler.test.ts`
  - Add compile acceptance/rejection tests for `system.*` namespace declarations.
- Modify: `packages/core/tests/dsl-v2-condition-evaluator.test.ts`
  - Add focused resolver tests for missing resolver, duplicate resolver, boolean reads, comparisons, logical expressions, and resolver failure.
- Modify: `packages/core/tests/runtime.test.ts`
  - Add an integration test proving `stepRuntime` can execute an `if system.*` branch when a resolver is provided.
- Modify: `packages/plugin-std-system/src/index.ts`
  - Add `conditionNamespaces: ["system"]`, `tryGetStdSystemState`, and `createStdSystemConditionResolver`.
- Modify: `packages/plugin-std-system/tests/index.test.ts`
  - Add std-system resolver tests for unlocked state, missing ids, unsupported paths, missing plugin state, and conditional choice filtering.
- Modify: `packages/plugin-std-system/tests/save-load-integration.test.ts`
  - Add restore coverage proving resolver-visible unlock state survives snapshot / restore.
- Modify: `docs/dsl.md`, `docs/design/dsl-support-matrix.md`, `docs/plugins/std-system.md`, `docs/runtime.md`, `README.md`, `README.ja.md`
  - Update current docs after implementation passes, keeping browser persistence and migration out of scope.

## Task 1: Core Runtime Resolver Types

**Files:**
- Modify: `packages/core/src/runtime-types.ts`
- Test: `packages/core/tests/dsl-v2-condition-evaluator.test.ts`

- [ ] **Step 1: Add failing type-level usage in evaluator tests**

Add imports and a resolver fixture to `packages/core/tests/dsl-v2-condition-evaluator.test.ts`:

```ts
import type {
  RuntimeConditionResolver,
  RuntimeConditionResolveResult,
  RuntimeState,
  RuntimeValue,
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
```

- [ ] **Step 2: Run test to verify current types are missing**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-condition-evaluator
```

Expected: FAIL with TypeScript or test transform errors because `RuntimeConditionResolver` and `RuntimeConditionResolveResult` are not exported yet.

- [ ] **Step 3: Add runtime condition resolver types**

In `packages/core/src/runtime-types.ts`, add after `RuntimeValue`:

```ts
export type RuntimeConditionNamespace = "system" | (string & {});

export interface RuntimeConditionResolveError {
  readonly code: RuntimeErrorCode;
  readonly message: string;
}

export type RuntimeConditionResolveResult =
  | { readonly ok: true; readonly value: RuntimeValue | null | undefined }
  | { readonly ok: false; readonly error: RuntimeConditionResolveError };

export interface RuntimeConditionResolver {
  readonly namespace: RuntimeConditionNamespace;
  readonly resolve: (path: readonly string[], state: RuntimeState) => RuntimeConditionResolveResult;
}
```

Update `RuntimeStepOptions`:

```ts
export interface RuntimeStepOptions {
  readonly commandHandlers?: Readonly<Record<string, RuntimePluginCommandHandler>>;
  readonly conditionResolvers?: readonly RuntimeConditionResolver[];
  readonly onDiagnostic?: RuntimeDiagnosticReporter;
}
```

Extend `RuntimeErrorCode` with:

```ts
| "condition_resolver_missing"
| "condition_resolver_duplicate"
| "condition_resolver_failed"
| "condition_system_state_missing"
| "condition_system_path_unsupported"
```

- [ ] **Step 4: Run focused type/test command**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-condition-evaluator
```

Expected: The type export errors are gone. Existing `system.*` behavior may still fail until Task 2 changes evaluator behavior.

- [ ] **Step 5: Commit**

```sh
git add packages/core/src/runtime-types.ts packages/core/tests/dsl-v2-condition-evaluator.test.ts
git commit -m "feat(core): add condition resolver types"
```

## Task 2: Core Condition Evaluator Resolver Dispatch

**Files:**
- Modify: `packages/core/src/condition-evaluator.ts`
- Modify: `packages/core/src/runtime-control.ts`
- Test: `packages/core/tests/dsl-v2-condition-evaluator.test.ts`

- [ ] **Step 1: Add failing evaluator tests**

In `packages/core/tests/dsl-v2-condition-evaluator.test.ts`, add:

```ts
it("evaluates non-scenario references through a matching condition resolver", () => {
  const state = createState();
  const result = evaluateTzrCondition(parseCondition("system.endings.trueEnd.unlocked"), state, {
    conditionResolvers: [
      resolver("system", (path) => {
        expect(path).toEqual(["endings", "trueEnd", "unlocked"]);
        return ok(true);
      }),
    ],
  });

  expect(result).toEqual({ ok: true, value: true });
});

it("uses resolver values in comparisons and logical expressions", () => {
  const state = createState({ routeOpen: true });
  const result = evaluateTzrCondition(
    parseCondition("scenario.routeOpen and system.endings.trueEnd.unlocked == true"),
    state,
    {
      conditionResolvers: [resolver("system", () => ok(true))],
    },
  );

  expect(result).toEqual({ ok: true, value: true });
});

it("reports a missing condition resolver", () => {
  const result = evaluateTzrCondition(parseCondition("system.endings.trueEnd.unlocked"), createState(), {
    conditionResolvers: [],
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: "condition_resolver_missing",
      message:
        'Cannot evaluate condition reference "system.endings.trueEnd.unlocked" because condition resolver "system" is not registered.',
    },
  });
});

it("reports duplicate condition resolvers for the same namespace", () => {
  const result = evaluateTzrCondition(parseCondition("system.endings.trueEnd.unlocked"), createState(), {
    conditionResolvers: [resolver("system", () => ok(true)), resolver("system", () => ok(false))],
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: "condition_resolver_duplicate",
      message: 'Cannot evaluate condition reference "system.endings.trueEnd.unlocked" because condition resolver "system" is registered more than once.',
    },
  });
});

it("propagates condition resolver failures", () => {
  const result = evaluateTzrCondition(parseCondition("system.endings.trueEnd.title"), createState(), {
    conditionResolvers: [
      resolver("system", () => ({
        ok: false,
        error: {
          code: "condition_system_path_unsupported",
          message: 'Unsupported system condition reference "system.endings.trueEnd.title".',
        },
      })),
    ],
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: "condition_system_path_unsupported",
      message: 'Unsupported system condition reference "system.endings.trueEnd.title".',
    },
  });
});
```

- [ ] **Step 2: Run focused evaluator tests and verify failure**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-condition-evaluator
```

Expected: FAIL because `evaluateTzrCondition` does not accept resolver options and still returns `condition_system_reference_unsupported`.

- [ ] **Step 3: Implement evaluator options**

In `packages/core/src/condition-evaluator.ts`, import the new resolver type and add options:

```ts
import type { RuntimeConditionResolver, RuntimeErrorCode, RuntimeState, RuntimeValue } from "./runtime-types.js";

export interface TzrConditionEvaluationOptions {
  readonly conditionResolvers?: readonly RuntimeConditionResolver[];
}
```

Change signatures:

```ts
export function evaluateTzrCondition(
  expression: TzrConditionExpression,
  state: RuntimeState,
  options: TzrConditionEvaluationOptions = {},
): TzrConditionEvaluationResult {
  return evaluateBooleanExpression(expression, state, options);
}
```

Thread `options` through `evaluateBooleanExpression`, `evaluateLogicalExpression`, `evaluateComparisonExpression`, `evaluateValueExpression`, and `evaluateReference`.

Replace `evaluateReference` with:

```ts
function evaluateReference(
  reference: TzrConditionReference,
  state: RuntimeState,
  options: TzrConditionEvaluationOptions,
): ValueEvaluationResult {
  if (reference.root === "scenario") {
    return { ok: true, value: state.variables[reference.path] };
  }

  const resolvers = options.conditionResolvers?.filter((resolver) => resolver.namespace === reference.root) ?? [];
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

  return resolvers[0].resolve(reference.path.split(".").slice(1), state);
}
```

- [ ] **Step 4: Pass runtime options from runtime-control**

In `packages/core/src/runtime-control.ts`, change:

```ts
const result = evaluateTzrCondition(item.condition, state);
```

to:

```ts
const result = evaluateTzrCondition(item.condition, state, {
  conditionResolvers: options.conditionResolvers,
});
```

Make the same change for `instruction.condition` and `branch.condition` in `selectIfBranch`.

- [ ] **Step 5: Run focused tests**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-condition-evaluator
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add packages/core/src/condition-evaluator.ts packages/core/src/runtime-control.ts packages/core/tests/dsl-v2-condition-evaluator.test.ts
git commit -m "feat(core): resolve external condition namespaces"
```

## Task 3: Compile-Time Condition Namespace Validation

**Files:**
- Modify: `packages/core/src/compiler.ts`
- Test: `packages/core/tests/dsl-v2-compiler.test.ts`

- [ ] **Step 1: Add failing compiler tests**

In `packages/core/tests/dsl-v2-compiler.test.ts`, replace the current `system condition references` rejection tests with explicit namespace tests:

```ts
it("rejects system condition references without condition namespace support", () => {
  expect(
    expectCompileFailure("scene start:\n  if system.endings.trueEnd.unlocked:\n    narration:\n      locked\n"),
  ).toContain('Condition namespace "system" is not compile-supported. Register a plugin that declares conditionNamespaces: ["system"].');
});

it("compiles system condition references when condition namespace is registered", () => {
  const compiled = expectCompileSuccess(
    "scene start:\n  if system.endings.trueEnd.unlocked:\n    narration:\n      unlocked\n",
    { plugins: [{ name: "stdSystem", conditionNamespaces: ["system"] }] },
  );

  expect(compiled.instructions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "IfInstruction",
        condition: { type: "ConditionReference", path: "system.endings.trueEnd.unlocked", root: "system" },
      }),
    ]),
  );
});

it("compiles conditional choice items using registered system condition namespace", () => {
  const compiled = expectCompileSuccess(
    'scene start:\n  choice "Bonus":\n    "Gallery" id=gallery if system.cgs.mainVisual.unlocked:\n      end\n',
    { plugins: [{ name: "stdSystem", conditionNamespaces: ["system"] }] },
  );

  expect(JSON.stringify(compiled.instructions)).toContain("system.cgs.mainVisual.unlocked");
});
```

- [ ] **Step 2: Run compiler tests and verify failure**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-compiler
```

Expected: FAIL because `conditionNamespaces` is not part of `TzrCompilePluginDefinition` and compiler still rejects `system.*`.

- [ ] **Step 3: Add condition namespace support to compiler options**

In `packages/core/src/compiler.ts`, change `TzrCompilePluginDefinition`:

```ts
export interface TzrCompilePluginDefinition {
  readonly name: string;
  readonly commands?: PluginCommandMap;
  readonly conditionNamespaces?: readonly string[];
}
```

Add a compiler field:

```ts
private readonly conditionNamespaces: ReadonlySet<string>;
```

Initialize it in the constructor:

```ts
this.conditionNamespaces = this.collectConditionNamespaces(options);
```

Add:

```ts
private collectConditionNamespaces(options: TzrCompileOptions): ReadonlySet<string> {
  const namespaces = new Set<string>();
  for (const plugin of options.plugins ?? []) {
    for (const namespace of plugin.conditionNamespaces ?? []) {
      namespaces.add(namespace);
    }
  }
  return namespaces;
}
```

Replace the `system`-specific check in `validateSupportedCondition`:

```ts
if (expression.root !== "scenario" && !this.conditionNamespaces.has(expression.root)) {
  const hint =
    expression.root === "system"
      ? ' Register a plugin that declares conditionNamespaces: ["system"].'
      : "";
  this.addError(
    expression.loc.start,
    `Condition namespace "${expression.root}" is not compile-supported.${hint}`,
  );
}
```

- [ ] **Step 4: Run focused compiler tests**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-compiler
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add packages/core/src/compiler.ts packages/core/tests/dsl-v2-compiler.test.ts
git commit -m "feat(core): validate condition namespaces"
```

## Task 4: Runtime Integration for If and Choice Conditions

**Files:**
- Modify: `packages/core/tests/runtime.test.ts`
- Test: `packages/core/tests/runtime.test.ts`

- [ ] **Step 1: Add failing runtime integration tests**

In `packages/core/tests/runtime.test.ts`, add tests that use compiled instructions directly:

```ts
it("steps an if branch using a condition resolver", () => {
  const document = runtimeDocument([
    {
      type: "IfInstruction",
      condition: condition("system.endings.trueEnd.unlocked"),
      thenBranch: [{ type: "NarrationInstruction", lines: [textLine("unlocked")], loc }],
      elifBranches: [],
      loc,
    },
  ]);
  const state = createInitialRuntimeState(document);

  const result = stepRuntime(document, state, {
    conditionResolvers: [resolver("system", () => ok(true))],
  });

  expect(result.event).toMatchObject({
    type: "if",
    result: true,
    branch: "then",
    event: { type: "narration" },
  });
});

it("filters body choice items using a condition resolver", () => {
  const document = runtimeDocument([
    {
      type: "BodyChoiceInstruction",
      question: "Bonus",
      items: [
        {
          label: "Gallery",
          id: "gallery",
          condition: condition("system.cgs.mainVisual.unlocked"),
          body: [{ type: "StopInstruction", loc }],
          loc,
        },
      ],
      loc,
    },
  ]);
  const state = createInitialRuntimeState(document);

  const result = stepRuntime(document, state, {
    conditionResolvers: [resolver("system", () => ok(true))],
  });

  expect(result.event).toMatchObject({
    type: "choice",
    items: [expect.objectContaining({ id: "gallery" })],
  });
});
```

Use existing test helpers where possible. If `runtime.test.ts` does not have `condition`, `resolver`, `ok`, `runtimeDocument`, or `textLine`, add local helpers in that test file using current `RuntimeDocument`, `TextLine`, and `parseTzrCondition` utilities already present in nearby tests.

- [ ] **Step 2: Run runtime tests**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- runtime.test
```

Expected: PASS if Task 2 threaded options correctly; otherwise FAIL and fix `runtime-control.ts`.

- [ ] **Step 3: Commit**

```sh
git add packages/core/tests/runtime.test.ts packages/core/src/runtime-control.ts
git commit -m "test(core): cover condition resolver runtime flow"
```

## Task 5: Std-System Condition Resolver

**Files:**
- Modify: `packages/plugin-std-system/src/index.ts`
- Modify: `packages/plugin-std-system/tests/index.test.ts`
- Modify: `packages/plugin-std-system/tests/save-load-integration.test.ts`

- [ ] **Step 1: Add failing std-system resolver tests**

In `packages/plugin-std-system/tests/index.test.ts`, add:

```ts
describe("std-system condition resolver", () => {
  it("declares system condition namespace on the plugin definition", () => {
    expect(createStdSystemPlugin().conditionNamespaces).toEqual(["system"]);
  });

  it("returns undefined from tryGetStdSystemState when state is missing", () => {
    expect(tryGetStdSystemState(createInitialRuntimeState(createDocument()))).toBeUndefined();
  });

  it("resolves unlocked endings cgs and achievements", () => {
    const result = runStdSystemCommands(
      command("system.unlockEnding", [namedIdentifier("id", "trueEnd")]),
      command("system.unlockCg", [namedIdentifier("id", "mainVisual")]),
      command("system.unlockAchievement", [namedIdentifier("id", "firstClear")]),
    );
    const resolver = createStdSystemConditionResolver();

    expect(resolver.resolve(["endings", "trueEnd", "unlocked"], result.state)).toEqual({ ok: true, value: true });
    expect(resolver.resolve(["cgs", "mainVisual", "unlocked"], result.state)).toEqual({ ok: true, value: true });
    expect(resolver.resolve(["achievements", "firstClear", "unlocked"], result.state)).toEqual({ ok: true, value: true });
    expect(resolver.resolve(["endings", "missing", "unlocked"], result.state)).toEqual({ ok: true, value: false });
  });

  it("reports unsupported paths and missing plugin state without throwing", () => {
    const resolver = createStdSystemConditionResolver();
    const state = createInitialRuntimeState(createDocument());

    expect(resolver.resolve(["bad", "id", "unlocked"], state)).toEqual({
      ok: false,
      error: {
        code: "condition_system_path_unsupported",
        message: 'Unsupported system condition path "system.bad.id.unlocked".',
      },
    });
    expect(resolver.resolve(["endings", "trueEnd", "title"], state)).toEqual({
      ok: false,
      error: {
        code: "condition_system_path_unsupported",
        message: 'Unsupported system condition path "system.endings.trueEnd.title".',
      },
    });
    expect(resolver.resolve(["endings", "trueEnd", "unlocked"], state)).toEqual({
      ok: false,
      error: {
        code: "condition_system_state_missing",
        message: "runtimeState.plugins.stdSystem is not initialized. Register createStdSystemPlugin().",
      },
    });
  });
});
```

Update imports:

```ts
import {
  createStdSystemConditionResolver,
  tryGetStdSystemState,
} from "../src/index.js";
```

- [ ] **Step 2: Run std-system tests and verify failure**

Run:

```sh
rtk pnpm --filter @tsuzuru/plugin-std-system test
```

Expected: FAIL because resolver exports and `conditionNamespaces` are missing.

- [ ] **Step 3: Implement std-system resolver exports**

In `packages/plugin-std-system/src/index.ts`, import `RuntimeConditionResolver`:

```ts
type RuntimeConditionResolver,
```

Update `createStdSystemPlugin()`:

```ts
return {
  name: STD_SYSTEM_PLUGIN_NAME,
  commands: stdSystemPluginCommands,
  conditionNamespaces: ["system"],
  createInitialState: createInitialStdSystemState,
};
```

Add:

```ts
export function tryGetStdSystemState(runtimeState: RuntimeState): StdSystemState | undefined {
  const state = runtimeState.plugins[STD_SYSTEM_PLUGIN_NAME];
  return isStdSystemState(state) ? state : undefined;
}

export function createStdSystemConditionResolver(): RuntimeConditionResolver {
  return {
    namespace: "system",
    resolve(path, runtimeState) {
      const unsupported = unsupportedSystemConditionPath(path);
      if (unsupported !== undefined) {
        return unsupported;
      }

      const state = tryGetStdSystemState(runtimeState);
      if (state === undefined) {
        return {
          ok: false,
          error: {
            code: "condition_system_state_missing",
            message: "runtimeState.plugins.stdSystem is not initialized. Register createStdSystemPlugin().",
          },
        };
      }

      const [collection, id] = path;
      switch (collection) {
        case "endings":
          return { ok: true, value: isEndingUnlocked(state, id) };
        case "cgs":
          return { ok: true, value: isCgUnlocked(state, id) };
        case "achievements":
          return { ok: true, value: isAchievementUnlocked(state, id) };
      }
    },
  };
}

function unsupportedSystemConditionPath(path: readonly string[]) {
  const [collection, id, field] = path;
  if (
    path.length !== 3 ||
    id === undefined ||
    field !== "unlocked" ||
    (collection !== "endings" && collection !== "cgs" && collection !== "achievements")
  ) {
    return {
      ok: false as const,
      error: {
        code: "condition_system_path_unsupported" as const,
        message: `Unsupported system condition path "system.${path.join(".")}".`,
      },
    };
  }
  return undefined;
}
```

- [ ] **Step 4: Add save/load resolver visibility test**

In `packages/plugin-std-system/tests/save-load-integration.test.ts`, add:

```ts
it("keeps restored unlock state visible to the condition resolver", () => {
  const result = runScenarioWithStdSystem("scene start:\n  call system.unlockEnding(id=trueEnd)\n");
  const restored = restoreRuntimeState(createRuntimeSnapshot(result.state));
  const resolver = createStdSystemConditionResolver();

  expect(resolver.resolve(["endings", "trueEnd", "unlocked"], restored)).toEqual({
    ok: true,
    value: true,
  });
});
```

Use the existing scenario helper names in the file. If the helper is named differently, wire this assertion immediately after the existing snapshot / restore assertion in that test file.

- [ ] **Step 5: Run std-system tests**

Run:

```sh
rtk pnpm --filter @tsuzuru/plugin-std-system test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add packages/plugin-std-system/src/index.ts packages/plugin-std-system/tests/index.test.ts packages/plugin-std-system/tests/save-load-integration.test.ts
git commit -m "feat(std-system): add condition resolver"
```

## Task 6: End-to-End Compile and Runtime Integration

**Files:**
- Modify: `packages/plugin-std-system/tests/index.test.ts`
- Modify: `packages/core/tests/dsl-v2-compiler.test.ts`

- [ ] **Step 1: Add std-system compile/runtime integration test**

In `packages/plugin-std-system/tests/index.test.ts`, add:

```ts
it("compiles and evaluates system conditions through plugin metadata and resolver", () => {
  const parsed = parseTzr(
    "scene start:\n  call system.unlockEnding(id=trueEnd)\n  if system.endings.trueEnd.unlocked:\n    narration:\n      unlocked\n",
    { filePath: "scenario/std-system.tzr" },
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;

  const compiled = compileTzr(parsed.document, { plugins: [createStdSystemPlugin()] });
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) return;

  let state = createInitialRuntimeState(compiled.document, {
    plugins: [createStdSystemPlugin()],
  });
  const runtimeOptions = {
    commandHandlers: createStdSystemCommandHandlers(),
    conditionResolvers: [createStdSystemConditionResolver()],
  };

  state = stepRuntime(compiled.document, state, runtimeOptions).state;
  const result = stepRuntime(compiled.document, state, runtimeOptions);

  expect(result.event).toMatchObject({
    type: "if",
    result: true,
    branch: "then",
    event: { type: "narration" },
  });
});
```

- [ ] **Step 2: Run std-system tests**

Run:

```sh
rtk pnpm --filter @tsuzuru/plugin-std-system test
```

Expected: PASS.

- [ ] **Step 3: Run core tests**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```sh
git add packages/plugin-std-system/tests/index.test.ts packages/core/tests/dsl-v2-compiler.test.ts
git commit -m "test(std-system): cover system condition flow"
```

## Task 7: Documentation Promotion

**Files:**
- Modify: `docs/dsl.md`
- Modify: `docs/design/dsl-support-matrix.md`
- Modify: `docs/plugins/std-system.md`
- Modify: `docs/runtime.md`
- Modify: `README.md`
- Modify: `README.ja.md`
- Modify: `docs/design/system-condition-resolver.md`

- [ ] **Step 1: Update DSL docs**

In `docs/dsl.md`, replace the current deferred text for `system.*` condition reads with:

```md
`system.*` condition references can read current runtime std-system plugin state
when `@tsuzuru/plugin-std-system` is registered at compile time and its runtime
condition resolver is passed to `stepRuntime`.

Supported reads:

- `system.endings.<id>.unlocked`
- `system.cgs.<id>.unlocked`
- `system.achievements.<id>.unlocked`

These reads do not access browser persistence, gallery UI state, or remote
profiles. Direct `set system.*` and `add system.*` mutation remains invalid;
system state changes must go through `call system.*(...)` plugin commands.
```

- [ ] **Step 2: Update support matrix**

In `docs/design/dsl-support-matrix.md`, change the `if system.*` row status from `parser-only` to `plugin-dependent`, and update notes to say compile/runtime support requires std-system condition namespace metadata plus `createStdSystemConditionResolver()`.

- [ ] **Step 3: Update std-system plugin docs**

In `docs/plugins/std-system.md`, add a section:

````md
## Condition Reads

std-system also provides `createStdSystemConditionResolver()` for runtime
condition reads:

```ts
stepRuntime(document, state, {
  commandHandlers: createStdSystemCommandHandlers(),
  conditionResolvers: [createStdSystemConditionResolver()],
});
```

Supported condition paths:

- `system.endings.<id>.unlocked`
- `system.cgs.<id>.unlocked`
- `system.achievements.<id>.unlocked`

The resolver reads only `runtimeState.plugins.stdSystem`. It does not read
browser persistence or host gallery state.
````

- [ ] **Step 4: Update README limitations**

In `README.md` and `README.ja.md`, change the limitation from “`system.*` condition reads are not part of the current stable DSL subset” to “`system.*` reads are limited to current std-system runtime plugin state and require the std-system condition resolver.”

- [ ] **Step 5: Mark design status as implemented**

In `docs/design/system-condition-resolver.md`, update status:

```md
> Status: implemented for runtime std-system plugin state reads.
```

Add an implementation note saying browser persistence and indexed key syntax remain out of scope.

- [ ] **Step 6: Run docs checks**

Run:

```sh
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add docs/dsl.md docs/design/dsl-support-matrix.md docs/plugins/std-system.md docs/runtime.md README.md README.ja.md docs/design/system-condition-resolver.md
git commit -m "docs: document system condition resolver"
```

## Task 8: Final Verification

**Files:**
- No new source edits unless verification finds a defect.

- [ ] **Step 1: Run focused package checks**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm --filter @tsuzuru/plugin-std-system test
rtk pnpm --filter @tsuzuru/plugin-std-system typecheck
```

Expected: all commands exit 0.

- [ ] **Step 2: Run repository docs/tooling checks**

Run:

```sh
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run broader checks because public API and docs changed**

Run:

```sh
rtk pnpm test
rtk pnpm typecheck
rtk pnpm examples:check
```

Expected: all commands exit 0.

- [ ] **Step 4: Inspect public API diff**

Run:

```sh
git diff --stat
git diff -- packages/core/src/runtime-types.ts packages/core/src/compiler.ts packages/plugin-std-system/src/index.ts docs/design/dsl-support-matrix.md
```

Expected:

- core exposes generic resolver types and options
- compiler validates condition namespaces
- std-system exports resolver helpers
- docs mark `system.*` reads as plugin-dependent, not browser-persistent

- [ ] **Step 5: Final commit if verification required fixes**

If verification required follow-up fixes, commit them:

```sh
git add <fixed-files>
git commit -m "fix: stabilize system condition resolver"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: The plan covers supported syntax, compile-time namespace validation, runtime resolver dispatch, std-system resolver, save/load visibility, docs updates, and focused/broad verification from `docs/design/system-condition-resolver.md`.
- Placeholder scan: No placeholder markers or undefined “fill later” steps are used. Each code-changing task includes concrete files, snippets, commands, and expected outcomes.
- Type consistency: The same names are used throughout: `RuntimeConditionResolver`, `RuntimeConditionResolveResult`, `conditionResolvers`, `conditionNamespaces`, `tryGetStdSystemState`, and `createStdSystemConditionResolver`.
