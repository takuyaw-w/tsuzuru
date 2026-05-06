---
name: tsuzuru-codex-workflow
description: Use for every Codex task in the Tsuzuru repository to enforce read order, scope control, current DSL assumptions, checks, and concise final reporting.
---

# Tsuzuru Codex Workflow Skill

## Purpose

Use this skill for every Codex task in the Tsuzuru repository.

It defines the shared process only. Use an area-specific skill for core, DSL,
Preact, examples, docs, tests, plugin commands, or release readiness work.

## Read First

Before editing, read only what is relevant:

1. `AGENTS.md`
2. `TODOS.md` when the task is TODO-driven
3. The relevant area-specific skill
4. The relevant package `package.json`
5. Relevant source, tests, examples, or docs

## Current Constraints

- Treat the modern `.tzr` DSL under `packages/core/src` as current.
- Use the public parser/compiler API exported from `@tsuzuru/core`.
- Treat `examples/dsl-v2-basic` as the current runnable example.
- Do not reintroduce removed DSL syntax, deleted examples, or deleted parser/compiler APIs.
- Do not introduce macro, preset, or stage syntax unless explicitly requested.
- Do not move scenario semantics into Preact, UI packages, examples, or plugins.

## Scope Rules

- Keep changes small and reviewable.
- Prefer one package or one task area at a time.
- Do not combine behavior changes with broad formatting or docs rewrites.
- Do not edit unrelated TODO items.
- Do not change public APIs without explicit approval.
- Preserve user changes already present in the worktree.

## Common Workflow

1. Inspect existing files before proposing or editing.
2. Identify the smallest safe write set.
3. Make focused edits.
4. Run focused checks for the touched area.
5. Run broader checks when public behavior, examples, or package contracts change.
6. Report commands, results, skipped checks, and remaining risks.

## Verification

For repository-wide changes, prefer:

```sh
rtk pnpm install --frozen-lockfile
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk pnpm test
rtk pnpm typecheck
rtk pnpm --filter @tsuzuru/example-dsl-v2-basic build
rtk git diff --check
```

For focused package changes, use the matching package checks first:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm --filter @tsuzuru/preact test
rtk pnpm --filter @tsuzuru/preact typecheck
rtk pnpm --filter @tsuzuru/standard-ui-preact test
rtk pnpm --filter @tsuzuru/plugin-std-visual test
rtk pnpm --filter @tsuzuru/plugin-std-audio test
```

Docs-only or skill-only changes usually need:

```sh
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

## Final Report

Include:

- changed files
- behavior impact, or state that there is none
- commands run and results
- skipped verification with reasons
- remaining warnings or follow-up work
