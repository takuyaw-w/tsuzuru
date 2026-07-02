---
name: tsuzuru-tests
description: Use when adding, updating, reviewing, or debugging tests for parser, compiler, runtime, Preact adapter, save/load, examples, and quality gates.
---

# Tsuzuru Tests Skill

## Purpose

Use this skill for test changes and verification strategy.

Tests should protect current DSL parsing, compiler validation, runtime
behavior, Preact adapter behavior, save/load behavior, plugin command dispatch,
and example build integrity.

## Read First

1. `AGENTS.md`
2. root `package.json`
3. target package `package.json`
4. relevant source files
5. relevant tests

## Investigation Guidance

Use CodeGraph MCP to understand source symbols, call flow, and impact before
adding or changing tests. Use `rg` and file reads for exact test names,
assertion text, snapshots, fixture contents, diagnostics, and `.tzr` scenario
text.

## Current Constraints

- Tests should target the current parser/compiler API exported by `@tsuzuru/core`.
- Current runnable examples are the Preact examples under `examples/preact-*`.
- Do not add tests for removed DSL syntax as supported behavior.
- Do not add macro, preset, or stage tests unless explicitly requested.
- Do not weaken test assertions to accommodate tooling updates.

## Test Placement

- Parser, compiler, runtime, conditions, choices, jumps, state updates, plugin command dispatch: `packages/core/tests`.
- Preact hooks, visible events, adapter save/load, click-to-advance: `packages/preact/tests`.
- Standard UI components: `packages/standard-ui-preact/tests`.
- Standard plugin handlers: the matching plugin package tests.
- Example integrity: build the current example from the repository root.

## Change Guidance

- Add regression tests with the smallest scenario that proves the behavior.
- Keep package responsibility boundaries in test placement.
- Update snapshots or expected output only when the behavior intentionally changes.
- For syntax changes, update parser tests first.
- For compiled output changes, update compiler tests.
- For runtime changes, update runtime tests.

## Verification

Focused checks:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm --filter @tsuzuru/preact test
rtk pnpm --filter @tsuzuru/preact typecheck
rtk pnpm --filter @tsuzuru/standard-ui-preact test
rtk pnpm --filter @tsuzuru/plugin-std-visual test
rtk pnpm --filter @tsuzuru/plugin-std-audio test
```

Repository checks when behavior, exports, examples, or tooling are affected:

```sh
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk pnpm test
rtk pnpm typecheck
rtk pnpm examples:check
rtk git diff --check
```

## Final Report

Include:

- tests added or updated
- behavior covered
- commands run and results
- skipped checks with reasons
- remaining coverage gaps
