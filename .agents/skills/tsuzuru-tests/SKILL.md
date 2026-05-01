# Tsuzuru Tests Skill

## Purpose

Use this skill when adding, updating, reviewing, or debugging tests in Tsuzuru.

Tests should protect DSL parsing, compiler validation, runtime behavior, Preact adapter behavior, save/load behavior, and example build integrity.

This repository uses Vitest for package tests.

## Read First

Before editing tests, read:

1. `AGENTS.md`
2. `TODOS.md`
3. root `package.json`
4. target package `package.json`
5. relevant source files
6. existing tests near the target behavior
7. related docs under `docs/`

## Scope

This skill applies to:

- `packages/core/tests/`
- `packages/preact/tests/`
- test-related source changes under `packages/core/src/`
- test-related source changes under `packages/preact/src/`
- example verification under `examples/`
- TODO items related to regression tests or quality gates

## Root Commands

The root scripts currently run core and preact checks.

Use:

```sh
pnpm test
pnpm typecheck
```

Focused checks are preferred during implementation.

## Core Test Areas

Add or update core tests when changing:

- parser behavior
- AST shape
- compiler validation
- IR generation
- macro expansion
- plugin command validation
- core command validation
- jump target parsing
- same-file label validation
- condition evaluation
- runtime stepping
- choice resolution
- wait / waitClick / page / stop behavior
- runtime snapshot creation
- runtime restoration
- diagnostics

## Preact Test Areas

Add or update Preact tests when changing:

- `useRuntime`
- `RuntimeView`
- renderable event handling
- visible event behavior
- transient event filtering
- auto-step behavior
- auto-step stopping conditions
- autoStepMaxSteps loop protection
- click-to-advance behavior
- choice selection behavior
- save data creation
- save data validation
- snapshot restore behavior for view state

## Example Verification Areas

Verify examples when changing:

- public core APIs
- public preact APIs
- package exports
- build behavior
- example scenario behavior
- save/load adapter behavior
- runtime event shape
- choice behavior
- plugin command handling

Use:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
```

Use dev server checks only when the task explicitly requires browser confirmation:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

## Test Placement

Prefer colocating tests by package responsibility.

Use core tests for:

- parser
- compiler
- runtime
- macro
- condition
- command validation
- diagnostics

Use preact tests for:

- hook behavior
- adapter behavior
- component behavior
- visible event handling
- save/load view restoration

Do not put Preact-specific tests in `packages/core/tests/`.

Do not put core runtime semantics tests in `packages/preact/tests/` unless the test is specifically verifying adapter integration.

## Test Design Rules

Tests should be:

- small
- deterministic
- behavior-oriented
- explicit about expected output
- focused on one responsibility where practical
- written through public APIs when practical
- clear about whether they are parser, compiler, runtime, or adapter tests

Avoid:

- testing implementation details unnecessarily
- giant end-to-end tests for small behavior
- snapshot tests for complex objects unless they add real value
- brittle assertions tied to unrelated fields
- hiding important expectations in helper functions
- using `any` to bypass type errors

## Regression Test Rules

When fixing a bug, add a regression test that fails before the fix.

A good regression test should include:

- minimal input
- exact failing behavior
- expected result
- clear test name
- no unrelated setup

## DSL Test Rules

For DSL changes, test both valid and invalid cases.

Prioritize:

- valid syntax
- malformed syntax
- source locations
- parse diagnostics
- compiler diagnostics
- duplicate scene ids
- duplicate label ids
- missing same-file labels
- invalid jump targets
- malformed choices
- invalid condition syntax
- unknown commands
- unknown macros
- forbidden macro expansion results

## Runtime Flow Test Rules

Runtime flow tests should cover realistic instruction progression.

Important flows:

```txt
scene -> narration -> dialogue -> choice -> jump
```

```txt
if true branch
if false branch
flag / variable branch
wait / waitClick / page / stop
```

For runtime tests, assert:

- emitted event kind
- runtime pointer movement
- blocked state when relevant
- variables / flags when relevant
- choice pending state when relevant
- snapshot / restore behavior when relevant

## Save / Load Test Rules

Save/load tests should verify round-trip behavior.

Prioritize:

- snapshot round-trip
- choice during save/load
- wait during save/load
- waitClick during save/load
- page during save/load
- narration display during save/load
- dialogue display during save/load
- visible event restoration in Preact adapter

Do not invent incompatible save data formats in tests.

Use public save/load helpers where available.

## Auto-Step Test Rules

For `useRuntime` auto-step behavior, test:

- auto-step advances transient events
- auto-step stops at narration
- auto-step stops at dialogue
- auto-step stops at choice
- auto-step stops at waitClick
- auto-step stops at page
- auto-step stops at stop
- autoStepMaxSteps prevents infinite loops
- autoStepError is exposed when applicable
- visibleEvent does not flicker through transient events

## Diagnostics Test Rules

Diagnostic tests should check:

- message
- filePath when available
- line when available
- column when available
- sourceLine when available
- target token location when relevant

Avoid asserting entire diagnostic objects when unrelated fields make the test brittle.

Prefer focused assertions.

## Public API Test Rules

When a public API is added or changed:

- update package `src/index.ts`
- add tests through public imports when practical
- verify typecheck
- verify package build when relevant

Public API changes may require docs updates.

## Command Matrix

Core focused:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/core build
```

Preact focused:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```

Example focused:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
```

Repository-level:

```sh
pnpm test
pnpm typecheck
```

## Which Commands to Run

If only core tests changed:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
```

If core source changed:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/core build
```

If Preact tests changed:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
```

If Preact source changed:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```

If public APIs or examples changed:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
pnpm test
pnpm typecheck
```

## TODO Handling

When completing a test-related TODO:

1. Implement or update the test.
2. Confirm the test fails before the fix when practical.
3. Apply the minimal source fix if needed.
4. Run focused checks.
5. Run broader checks if public behavior changed.
6. Check the completed item in `TODOS.md`.
7. Report commands and results.

Do not check a TODO unless the relevant behavior is actually covered.

## Completion Criteria

A test task is complete only when:

- The requested tests are added or updated.
- The tests cover the intended behavior.
- Focused test command passes.
- Relevant typecheck command passes.
- Relevant build command passes when source or public API changed.
- `TODOS.md` is updated when a TODO item was completed.
- The final report lists changed files, executed commands, results, and remaining concerns.

## Final Report Format

Use this format:

```txt
実施内容:
- ...

確認:
- pnpm --filter ... test: pass
- pnpm --filter ... typecheck: pass

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

Keep the report short.
