# Legacy DSL Cleanup Record

> Status: cleanup record and follow-up tracker for `feature/new-dsl`.
> DSL v2 is the current supported DSL path. This document records what was
> removed, what remains because it is shared, and what still needs a focused
> follow-up before v1.0.

## Current Supported DSL Surface

- Public APIs: `parseTzrV2`, `compileTzrV2`
- Parser: `packages/core/src/parser.ts`
- Compiler: `packages/core/src/compiler.ts`
- DSL AST: `packages/core/src/scenario-ast.ts`
- Condition parser/evaluator: `packages/core/src/condition-parser.ts`, `packages/core/src/condition-evaluator.ts`
- Runnable example: `examples/dsl-v2-basic`

The `packages/core/src/dsl-v2/` transition directory was removed. The DSL v2
implementation now lives directly under `packages/core/src/`.

## Removed Legacy Surface

The following legacy-only items were removed during the DSL v2 cleanup:

- legacy parser/compiler public APIs: `parseTzr`, `compileTzr`
- legacy parser/compiler result and option types
- legacy AST document/statement types
- legacy IR instruction types such as label jumps, old choices, old if blocks,
  and macro instructions
- legacy condition evaluator API such as `evaluateCondition`
- macro public API and macro expansion path
- legacy parser/compiler/condition/macro tests
- legacy example source packages
- the old `packages/core/src/dsl-v2/` internal directory layout

The legacy `compileTzr({ pluginCommands })` validation path is also gone.
`definePluginCommand` and std plugin command maps remain as metadata/runtime
integration points. DSL v2 plugin command validation policy is still undecided.

## Dead File Audit Result

| Item | Classification | Decision |
|---|---|---|
| `docs/macro-api.md` | delete now | Removed. The public macro API no longer exists and macro support is intentionally out of scope. Historical macro rationale remains in ADR 0003. |
| `docs/dsl.md` | rewrite/minimize | Rewritten as the current DSL v2 entry point. Legacy `#scene(...)`, `#label(...)`, `@command(...)`, and `$macro(...)` are explicitly marked historical. |
| `docs/plans/dsl-v2-compile-to-ir.md` | keep with note | Retained as an implementation plan/history document. It already carries a historical status note. |
| `docs/plans/legacy-dsl-cleanup.md` | keep with note | Retained as this cleanup record and follow-up tracker. |
| Old example dist-only directories | delete now | Removed because they referenced deleted legacy examples and were not runnable source packages. |
| `README.md` | rewrite/minimize | Kept DSL v2-first; removed wording that implied current macro support. |
| ADRs under `docs/decisions/` | keep with note | Retained as historical decisions. Broken links to the removed macro API doc were replaced. |
| `docs/roadmap.md` | keep with note | Retained as partially historical roadmap. It has a status note warning about legacy syntax and APIs. |
| `docs/architecture.md` | keep with note | Retained as partially historical architecture map. A full rewrite is a larger docs task. |

## Shared Components Retained

These files are still used by DSL v2, runtime, tests, examples, or plugin
integration and must not be removed as part of legacy cleanup:

- `packages/core/src/ast.ts`: shared primitive source/value/text types such as
  `SourceLocation`, `SourceRange`, `TextLine`, `TzrArgument`, and `TzrValue`
- `packages/core/src/ir.ts`: current runtime instruction/document types
- `packages/core/src/runtime.ts`
- `packages/core/src/runtime-control.ts`
- `packages/core/src/runtime-commands.ts`
- `packages/core/src/runtime-frames.ts`
- `packages/core/src/runtime-snapshot.ts`
- `packages/core/src/runtime-types.ts`
- `packages/core/src/commands.ts`
- `packages/core/src/diagnostic.ts`
- `packages/core/src/plugin-command.ts`

## RuntimeDocument And Runtime State Follow-Ups

`RuntimeDocument.labels` remains for now. Current DSL v2 scene jumps and body
choices do not use it, and `CompiledTzrV2Document` currently emits `labels: {}`.
Removing the field would touch public type shape and many tests/fixtures, so it
should be handled in a focused runtime document cleanup.

`RuntimeState.flags` and the low-level `inc`, `dec`, `flag`, and `unflag`
runtime command handlers remain. DSL v2 authoring currently uses `set` and
`add`; docs must not present flag commands as current DSL v2 syntax. These
runtime primitives can be revisited once the v2 state model is finalized.

## Residual Reference Policy

Residual mentions of legacy syntax or APIs are acceptable only in:

- historical ADRs
- historical implementation plans
- cleanup records
- repository instructions that describe old design context

Current entry points such as `README.md`, `docs/dsl.md`, current plugin docs,
and runnable example docs should present DSL v2 as the supported path and must
not direct users to `parseTzr`, `compileTzr`, `$macro(...)`, `#scene(...)`, or
old example packages as current behavior.

## Remaining PR-Ready Tasks

- Decide DSL v2 plugin command validation policy.
- Decide public API naming before release planning: keep `parseTzrV2` /
  `compileTzrV2`, or rename the current DSL path back to `parseTzr` /
  `compileTzr` in a separate breaking API task.
- Decide whether `RuntimeDocument.labels` should be removed or made optional.
- Decide whether `RuntimeState.flags` and `inc` / `dec` / `flag` / `unflag`
  remain long-term runtime primitives.
- Rewrite `docs/architecture.md` from a DSL v2-first perspective.
- Refresh historical roadmap wording when v0.1 release scope is finalized.
