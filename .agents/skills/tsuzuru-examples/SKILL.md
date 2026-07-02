---
name: tsuzuru-examples
description: Use when creating, updating, verifying, or debugging Tsuzuru examples, especially examples/preact-starter, examples/preact-basic, examples/preact-hotspot-basic, and examples/preact-sound-novel.
---

# Tsuzuru Examples Skill

## Purpose

Use this skill for changes under `examples`.

Examples should demonstrate current public APIs and current DSL behavior without
moving package responsibilities into application code.

## Read First

1. `AGENTS.md`
2. The target example `package.json`
3. The target example `scenario/main.tzr`
4. Relevant example source and README files
5. Relevant package public exports

## Current Constraints

- Current runnable examples are `examples/preact-starter`,
  `examples/preact-basic`, `examples/preact-hotspot-basic`, and
  `examples/preact-sound-novel`.
- Use the current public parser/compiler exports from `@tsuzuru/core`.
- Do not restore deleted examples.
- Do not use removed DSL syntax.
- Do not introduce macro, preset, or stage syntax unless explicitly requested.
- Keep core narrative semantics in `@tsuzuru/core`; keep Preact adapter behavior in `@tsuzuru/preact`.

## Change Guidance

- Keep examples small and executable.
- Encode required package builds in package scripts, not in hidden manual setup.
- Keep plugin handlers minimal and presentation-focused.
- Use `localStorage` only for example-level browser save/load demonstrations.
- Update the example README when commands or demonstrated behavior change.

## Verification

For example changes:

```sh
rtk pnpm examples:check
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

When package source also changes:

```sh
rtk pnpm test
rtk pnpm typecheck
```

## Final Report

Include:

- example files changed
- behavior demonstrated
- package API assumptions
- commands run and results
- remaining manual verification, if any
