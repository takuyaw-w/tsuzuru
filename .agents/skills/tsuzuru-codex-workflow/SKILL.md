# Tsuzuru Codex Workflow Skill

## Purpose

Use this skill for every Codex task in the Tsuzuru repository.

This skill defines the common working process for Codex: what to read first, how to choose scope, how to avoid unnecessary changes, how to update TODOs, which checks to run, and how to report results.

Individual skills such as `tsuzuru-core`, `tsuzuru-preact`, `tsuzuru-dsl`, `tsuzuru-tests`, and `tsuzuru-docs` provide area-specific rules. This workflow skill provides the shared process.

## Read First

Before making any changes, read:

1. `AGENTS.md`
2. `TODOS.md`
3. The relevant area-specific skill
4. The relevant package `package.json`
5. Relevant source files
6. Relevant tests
7. Relevant docs

Do not start implementation before understanding the repository-wide design rules in `AGENTS.md`.

## Repository Principles

Tsuzuru is a web-first visual novel engine.

Key principles:

- `.tzr` files describe narrative flow.
- `.tzr` files must not become arbitrary JavaScript or TypeScript execution environments.
- Runtime behavior, rendering, plugins, and reusable logic belong in TypeScript.
- Core runtime logic belongs in `@tsuzuru/core`.
- Preact rendering and interaction adapters belong in `@tsuzuru/preact`.
- Plugins extend runtime behavior through registered commands.
- Macros are compile-time expansions for repetitive presentation logic.
- Static validation is preferred over runtime-only validation.
- Examples should remain small and executable.

## Skill Selection

Use the most relevant area-specific skill.

Use `tsuzuru-core` for:

- parser
- compiler
- AST
- IR
- runtime
- macro expansion
- plugin command registry
- condition evaluation
- runtime snapshot / restore

Use `tsuzuru-preact` for:

- `useRuntime`
- `RuntimeView`
- visible event behavior
- auto-step behavior
- click-to-advance
- choice interaction
- Preact save/load adapter

Use `tsuzuru-dsl` for:

- `.tzr` syntax
- DSL semantics
- command syntax
- macro syntax
- choice syntax
- conditional syntax
- jump target syntax
- `docs/dsl.md`

Use `tsuzuru-tests` for:

- regression tests
- quality gates
- test strategy
- runtime flow tests
- save/load tests
- `useRuntime` tests
- example verification

Use `tsuzuru-docs` for:

- README
- docs
- architecture docs
- example README files
- limitations
- quickstart
- documentation consistency

## Scope Selection

Prefer one small TODO item at a time.

Good scope:

- one unchecked TODO item
- one small cluster of closely related unchecked TODO items
- one bug fix and its regression test
- one public API change and its docs update
- one docs correction

Bad scope:

- broad refactor without explicit request
- multiple unrelated TODO items
- rewriting architecture while adding a test
- changing DSL syntax while fixing Preact UI
- modifying examples, docs, and runtime without a direct reason
- adding post-v0.1 features during v0.1 stabilization

## TODO Handling

When working from `TODOS.md`:

1. Pick one unchecked item or a tightly related small group.
2. Do not modify unrelated TODO sections.
3. Do not check an item until the behavior is actually complete.
4. If a parent item has unfinished children, keep the parent unchecked unless all required children are complete.
5. If a decision is made, document the decision in docs when it affects public behavior.
6. Move deferred work to post-v0.1 only when the user explicitly asks or the TODO already allows that decision.
7. Mention updated TODO items in the final report.

## Change Rules

Before editing, identify:

- target files
- expected behavior change
- required tests
- required docs
- relevant quality gates

During editing:

- keep the diff small
- preserve existing architecture boundaries
- avoid speculative abstractions
- avoid unrelated formatting churn
- avoid moving files unless necessary
- avoid changing public APIs without reason
- avoid silently changing behavior
- avoid adding dependencies unless necessary

After editing:

- run focused checks
- run broader checks when public behavior changes
- update TODOs only for completed work
- report remaining concerns

## Architecture Boundaries

Do not break these boundaries.

### Core

`@tsuzuru/core` owns:

- parser
- AST
- compiler
- IR
- runtime
- state
- choice resolution
- condition evaluation
- jump behavior
- macro expansion
- plugin command validation
- snapshot / restore primitives

Core must not depend on:

- Preact
- DOM
- CSS
- Vite-specific behavior
- example-specific behavior

### Preact

`@tsuzuru/preact` owns:

- Preact hooks
- convenience rendering
- visible event state
- adapter-level save/load utilities
- user interaction wiring

Preact must not own:

- parser behavior
- compiler validation
- runtime stepping semantics
- DSL syntax
- core state model decisions

### Docs

Docs must describe current behavior accurately.

Do not document future features as implemented.

### Examples

Examples should demonstrate current behavior.

Do not make examples depend on hidden setup or unpublished packages unless documented.

## Behavior Change Rules

When behavior changes:

- add or update tests
- update docs if public behavior changes
- update examples if the old example becomes incorrect
- update exports if public API changes
- update TODOs if the change completes a TODO item

Behavior changes include:

- parser output changes
- compiler diagnostics changes
- runtime event changes
- runtime state changes
- save/load format changes
- Preact hook behavior changes
- public API changes
- DSL syntax changes
- command validation changes

## Public API Rules

When adding or changing a public API:

1. Update the package source.
2. Update the package `src/index.ts` export if needed.
3. Add or update tests through public imports when practical.
4. Update relevant docs.
5. Run package typecheck.
6. Run package build when relevant.
7. Verify example build when examples depend on the API.

Do not expose unstable helpers unless needed.

## Test Rules

Add tests for behavior changes.

Prefer focused tests first.

Use integration-style tests only when the behavior crosses boundaries.

Do not bypass type errors with `any` unless the test explicitly verifies invalid input handling.

Do not add weak tests that only execute code without assertions.

## Documentation Rules

Update docs when public behavior changes.

Docs should clearly distinguish:

- implemented behavior
- v0.1 limitations
- post-v0.1 candidates

Do not describe unimplemented features as available.

Do not claim compatibility with KAG, TyranoScript, or Ren'Py.

Do not imply `.tzr` supports arbitrary JavaScript or TypeScript.

## Dependency Rules

Do not add dependencies unless necessary.

Before adding a dependency, consider:

- whether the existing code can solve the problem
- package size
- maintenance risk
- ESM compatibility
- browser compatibility
- test impact
- whether the dependency belongs in core, preact, example, or devDependencies

If adding a dependency, explain why in the final report.

## Command Selection

Run the smallest relevant checks first.

### Core focused

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
```

If core source or public API changed:

```sh
pnpm --filter @tsuzuru/core build
```

### Preact focused

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
```

If Preact source or public API changed:

```sh
pnpm --filter @tsuzuru/preact build
```

### Example focused

```sh
pnpm --filter @tsuzuru/example-preact-basic build
```

Use dev server checks only when browser behavior must be manually verified:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

### Repository level

```sh
pnpm test
pnpm typecheck
```

Run repository-level checks when:

- public APIs changed
- shared behavior changed
- multiple packages changed
- final quality gate work is requested
- the change affects examples or docs broadly

## Common Workflows

### Core implementation

1. Read `tsuzuru-core` skill.
2. Read relevant core source and tests.
3. Implement minimal behavior.
4. Add or update core tests.
5. Run core test and typecheck.
6. Run core build if public API or source changed.
7. Update docs if public behavior changed.
8. Update TODO if completed.

### Preact implementation

1. Read `tsuzuru-preact` skill.
2. Read relevant Preact source and tests.
3. Confirm whether behavior belongs in Preact or core.
4. Implement minimal adapter behavior.
5. Add or update Preact tests.
6. Run Preact test and typecheck.
7. Run Preact build if source changed.
8. Run example build if example behavior is affected.
9. Update TODO if completed.

### DSL change

1. Read `tsuzuru-dsl` skill.
2. Read `docs/dsl.md`.
3. Confirm the change does not make `.tzr` a general-purpose language.
4. Update parser / compiler / condition code as needed.
5. Add valid and invalid tests.
6. Update `docs/dsl.md`.
7. Run core checks.
8. Update TODO if completed.

### Test task

1. Read `tsuzuru-tests` skill.
2. Identify behavior to protect.
3. Add minimal test.
4. If fixing a bug, confirm the test fails before the fix when practical.
5. Apply minimal source fix if needed.
6. Run focused checks.
7. Update TODO if completed.

### Documentation task

1. Read `tsuzuru-docs` skill.
2. Compare docs against current source.
3. Correct inaccuracies.
4. Avoid documenting future behavior as implemented.
5. Run checks only when docs include commands or API examples that need verification.
6. Update TODO if completed.

## Final Report Rules

Keep final reports short.

Do not include long explanations unless there is a design decision or unresolved concern.

Always include:

- what changed
- what checks were run
- what TODOs were updated
- remaining concerns

Use this format:

```txt
実施内容:
- ...

確認:
- ...

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

## Failure Reporting

If a command fails, report:

- command
- failure summary
- likely cause if clear
- whether the failure is related to the current change
- what remains unresolved

Do not claim success if checks failed.

Do not hide skipped checks.

If a check was not run, say so and explain why.

## Prohibited Work

Do not do the following unless explicitly requested:

- broad refactoring
- changing DSL philosophy
- adding arbitrary JavaScript support to `.tzr`
- implementing TyranoScript compatibility
- implementing KAG / KS compatibility
- implementing Ren'Py compatibility
- adding GUI editor features
- adding Live2D or Pixi integration
- adding backlog / skip / auto mode during unrelated tasks
- moving core behavior into Preact
- moving UI behavior into core
- silently changing public API
- checking TODOs without completing them
- removing TODOs to make progress look better

## Completion Criteria

A Codex task is complete only when:

- the requested scope is implemented or explicitly analyzed
- relevant tests are added or updated
- relevant docs are updated when public behavior changes
- relevant checks are run
- completed TODOs are checked
- skipped checks are explained
- unresolved concerns are reported
- final report is concise and factual
