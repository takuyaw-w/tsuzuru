---
name: tsuzuru-docs
description: Use when updating README, docs, architecture notes, example READMEs, limitations, quickstart, and documentation consistency.
---

# Tsuzuru Docs Skill

## Purpose

Use this skill for documentation-only work.

Docs must describe the current implementation and avoid presenting future
scope as available behavior.

## Read First

1. `AGENTS.md`
2. The target docs or README files
3. Relevant package source or public exports when documenting APIs
4. Relevant example files when documenting example usage

## Current Constraints

- Document the current parser/compiler API exported by `@tsuzuru/core`.
- Document `examples/dsl-v2-basic` as the runnable example.
- Do not document removed DSL syntax as supported.
- Do not document macro, preset, or stage features as implemented.
- Keep historical context in dedicated decision or plan docs, not in task skills.

## Documentation Targets

- Root `README.md`: project overview, install/setup, current package roles, current example.
- `docs/architecture.md`: package boundaries and runtime responsibilities.
- DSL docs: current `.tzr` syntax only.
- Plugin docs: plugin command responsibilities and plugin-owned state.
- Example README files: exact run commands and what the example demonstrates.
- `AGENTS.md`: repository-wide rules only, not detailed API docs.

## Style Rules

- Prefer short, runnable examples.
- Use current package names and workspace paths.
- Do not add speculative roadmap prose unless the target doc is explicitly a plan.
- Keep docs aligned with code and examples in the same change.
- Use dedicated docs under `docs/history/decisions`, `docs/plans`, `docs/history/plans`, or `docs/design` for design records.

## Verification

For docs-only changes:

```sh
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

When docs include runnable commands or API examples, also run the relevant check:

```sh
rtk pnpm typecheck
rtk pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

## Final Report

Include:

- docs changed
- current behavior clarified
- commands run and results
- any docs intentionally left for later
