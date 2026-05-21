---
name: tsuzuru-dsl
description: Use when designing or modifying current .tzr DSL syntax, parser behavior, compiler validation, command syntax, choices, jumps, and conditions.
---

# Tsuzuru DSL Skill

## Purpose

Use this skill for current `.tzr` syntax, parser behavior, compiler validation,
DSL-facing diagnostics, and DSL documentation.

## Read First

1. `AGENTS.md`
2. `packages/core/src/parser.ts`
3. `packages/core/src/scenario-ast.ts`
4. `packages/core/src/compiler.ts`
5. Relevant parser/compiler tests under `packages/core/tests`
6. Current example scenario under `examples/dsl-v2-basic`

## Investigation Guidance

Use CodeGraph MCP for parser/compiler symbol lookup, relationship tracing, and
impact analysis. Use `rg` and file reads for `.tzr` scenario files, exact
syntax examples, diagnostics, docs, and test assertion text.

## Current Constraints

- The current DSL is implemented under `packages/core/src`.
- The DSL should stay readable, line-oriented where practical, statically analyzable, and intentionally constrained.
- Do not add arbitrary JavaScript or TypeScript execution inside `.tzr` files.
- Do not restore removed DSL syntax or removed parser/compiler APIs.
- Do not add macro, preset, or stage syntax unless explicitly requested.
- Treat `examples/dsl-v2-basic` as the current runnable example.

## Change Guidance

- Update parser tests before changing syntax.
- Update compiler tests when compiled output or validation changes.
- Keep diagnostics explicit and source-location aware.
- Keep narrative flow owned by core: scenes, narration, dialogue, choices, jumps, conditions, and state updates.
- Plugin commands may extend presentation behavior, but plugins must not own narrative flow.
- Update docs and examples in the same change when public syntax changes.

## Verification

For DSL/parser/compiler changes:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

When syntax appears in examples or docs:

```sh
rtk pnpm --filter @tsuzuru/example-dsl-v2-basic build
rtk pnpm test
rtk pnpm typecheck
```

## Final Report

Include:

- syntax or validation behavior changed
- tests added or updated
- docs/examples updated
- commands run and results
- compatibility or follow-up notes
