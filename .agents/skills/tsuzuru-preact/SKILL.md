---
name: tsuzuru-preact
description: Use when working on @tsuzuru/preact hooks, RuntimeView, visible events, auto-step behavior, click-to-advance, choices, and save/load adapter utilities.
---

# Tsuzuru Preact Skill

## Purpose

Use this skill for changes under `packages/preact`.

The Preact package connects the core runtime to Preact. It must not own parser,
compiler, DSL, or scenario execution semantics.

## Read First

1. `AGENTS.md`
2. `packages/preact/package.json`
3. `packages/preact/src/index.ts`
4. Relevant files under `packages/preact/src`
5. Relevant tests under `packages/preact/tests`
6. Relevant core runtime APIs under `packages/core/src`

## Current Constraints

- Core owns narrative semantics and runtime stepping.
- Preact owns hooks, visible event adaptation, convenience rendering, and adapter-level save/load utilities.
- Do not add scenario semantics to UI components.
- Do not depend on example-specific assumptions in package source.
- Use `examples/dsl-v2-basic` only for runnable integration verification.

## Change Guidance

- Keep `useRuntime` focused on runtime orchestration for Preact.
- Keep `RuntimeView` a convenience component, not a full game UI framework.
- Preserve clear behavior for auto-step, blocking events, choices, wait, and click-to-advance.
- Save/load adapter data should wrap core runtime snapshot primitives rather than inventing core state.
- Update public exports and tests when adapter APIs change.

## Verification

For Preact package changes:

```sh
rtk pnpm --filter @tsuzuru/preact test
rtk pnpm --filter @tsuzuru/preact typecheck
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

When core or examples are affected:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

## Final Report

Include:

- adapter behavior changed
- tests added or updated
- public export impact
- commands run and results
- remaining UI integration risks
