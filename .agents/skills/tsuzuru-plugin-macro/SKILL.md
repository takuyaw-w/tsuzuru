---
name: tsuzuru-plugin-macro
description: Use when working on plugin commands, plugin command validation, plugin schemas, and deferred macro/preset/stage boundary decisions.
---

# Tsuzuru Plugin Command Skill

## Purpose

Use this skill for plugin command definitions, plugin command validation,
runtime plugin command dispatch, and plugin-owned state behavior.

The skill name is retained for compatibility with existing agent references,
but current implementation work should focus on plugin commands. Macro, preset,
and stage features are deferred unless the user explicitly requests them.

## Read First

1. `AGENTS.md`
2. `packages/core/src/plugin-command.ts`
3. `packages/core/src/commands.ts`
4. `packages/core/src/compiler.ts` when compiler validation is involved
5. `packages/core/src/runtime.ts` and runtime command files when dispatch is involved
6. Plugin package source and tests when standard plugin behavior changes

## Current Constraints

- Core owns narrative flow and command dispatch infrastructure.
- Plugins may own presentation-related state such as visual or audio state.
- Plugins must not own scenes, choices, jumps, conditions, or scenario state updates.
- Do not add macro, preset, or stage syntax unless explicitly requested.
- Do not move plugin command validation into Preact or UI packages.

## Change Guidance

- Keep plugin command schemas explicit and deterministic.
- Add core tests for command registration or validation behavior.
- Add plugin package tests for plugin-owned state handlers.
- Keep runtime behavior predictable when a handler is missing.
- Update public exports and docs when plugin APIs change.

## Verification

For core plugin command changes:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

For standard plugin package changes:

```sh
rtk pnpm --filter @tsuzuru/plugin-std-visual test
rtk pnpm --filter @tsuzuru/plugin-std-audio test
rtk pnpm typecheck
```

When examples change:

```sh
rtk pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

## Final Report

Include:

- plugin command contracts changed
- validation or runtime dispatch impact
- tests added or updated
- commands run and results
- deferred macro/preset/stage notes, if relevant
