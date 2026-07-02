---
name: tsuzuru-core
description: Use when working on @tsuzuru/core parser, compiler, AST, IR, runtime, diagnostics, plugin command validation, and save/load primitives.
---

# Tsuzuru Core Skill

## Purpose

Use this skill for changes under `packages/core`.

Core owns parsing, AST, compiler validation, runtime IR, runtime stepping,
state, choices, jumps, conditions, command dispatch, diagnostics, and
snapshot/restore primitives.

## Read First

1. `AGENTS.md`
2. `packages/core/package.json`
3. Relevant files under `packages/core/src`
4. Relevant tests under `packages/core/tests`
5. Public exports in `packages/core/src/index.ts` when APIs change

## Investigation Guidance

Use CodeGraph MCP for structural investigation under `packages/core`: symbol
lookup, parser/compiler/runtime relationships, call flow, and impact analysis.
Use `rg` and file reads for exact diagnostics, test assertions, docs, config,
and `.tzr` scenario text.

## Current Constraints

- Current DSL implementation lives directly under `packages/core/src`.
- Use the current public parser/compiler exports from `@tsuzuru/core`.
- Do not restore deleted DSL implementation directories or deleted APIs.
- Do not add general-purpose scripting to `.tzr` files.
- Do not add macro, preset, or stage syntax unless explicitly requested.
- Do not depend on DOM, Preact, CSS, Vite, browser storage, or examples.

## Change Guidance

- Parser changes need parser tests.
- Compiler validation changes need compiler tests.
- Runtime behavior changes need runtime tests.
- Public export changes must update `packages/core/src/index.ts` and relevant docs/examples.
- Plugin command validation belongs in core only when it affects command contracts.
- Keep diagnostics deterministic and source-location aware.

## Verification

For core-only changes:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

When public API, runtime document shape, or examples are affected:

```sh
rtk pnpm test
rtk pnpm typecheck
rtk pnpm examples:check
```

## Final Report

Include:

- parser/compiler/runtime areas touched
- tests added or updated
- public API impact
- commands run and results
- remaining diagnostics or risks
