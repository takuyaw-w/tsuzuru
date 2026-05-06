---
name: tsuzuru-release-readiness
description: Use when checking Tsuzuru release readiness, quality gates, package builds, public exports, README/docs accuracy, examples, tooling, and TODO completion.
---

# Tsuzuru Release Readiness Skill

## Purpose

Use this skill for broad readiness checks before publishing, tagging, or merging
large stabilization work.

This skill is for verification and consistency review. It should not introduce
new features.

## Read First

1. `AGENTS.md`
2. `TODOS.md`
3. root `package.json`
4. `pnpm-workspace.yaml`
5. package and example `package.json` files
6. public exports in package entrypoints
7. root README, docs, and example README files

## Current Constraints

- Current parser/compiler API is exported from `@tsuzuru/core`.
- Current DSL implementation lives under `packages/core/src`.
- Current runnable example is `examples/dsl-v2-basic`.
- TypeScript, Vitest, and Biome versions are managed through the pnpm catalog.
- Biome is a root dev dependency and root-level tool.
- Do not restore deleted APIs, deleted examples, or removed DSL syntax.
- Do not treat macro, preset, or stage features as current release scope unless explicitly requested.

## Readiness Checklist

- Root scripts match available tooling.
- Package names and exports match implementation.
- README and docs describe current behavior.
- Example builds from repository root.
- Tests and typecheck pass.
- Biome format, lint, and check pass.
- Lockfile is current and installable with `--frozen-lockfile`.
- TODO updates are evidence-backed.

## Verification

Use the full repository gate:

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

For package-specific release checks:

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm --filter @tsuzuru/preact test
rtk pnpm --filter @tsuzuru/preact typecheck
rtk pnpm --filter @tsuzuru/standard-ui-preact test
rtk pnpm --filter @tsuzuru/plugin-std-visual test
rtk pnpm --filter @tsuzuru/plugin-std-audio test
```

## Final Report

Include:

- readiness areas reviewed
- commands run and results
- public API or docs mismatches found
- TODO changes, if any
- release blockers and follow-up items
