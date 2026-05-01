---
name: tsuzuru-docs
description: Use when updating README, docs, architecture notes, example READMEs, limitations, quickstart, and documentation consistency.
---

# Tsuzuru Docs Skill

## Purpose

Use this skill when creating, updating, reviewing, or correcting Tsuzuru documentation.

Documentation must describe the current implementation and explicit v0.1 direction accurately. Do not present future ideas as implemented features.

## Read First

Before editing documentation, read:

1. `AGENTS.md`
2. `TODOS.md`
3. root `README.md` if it exists
4. relevant docs under `docs/`
5. relevant package source under `packages/`
6. relevant example files under `examples/`
7. relevant package `package.json`

## Scope

This skill applies to:

- `README.md`
- `AGENTS.md`
- `TODOS.md`
- `docs/dsl.md`
- `docs/runtime.md`
- `docs/plugin-api.md`
- `docs/macro-api.md`
- `docs/architecture.md`
- `examples/*/README.md`
- package-level README files
- documentation comments only when they describe public behavior

## Documentation Principle

Documentation should be:

- accurate
- implementation-aligned
- concise
- practical
- command-oriented where useful
- explicit about limitations
- clear about package boundaries

Documentation should not be:

- aspirational without labeling it as future work
- misleading about implemented behavior
- overly promotional
- copied from another engine's terminology without adapting to Tsuzuru
- vague about v0.1 limitations

## Current Product Direction

Tsuzuru is a web-first visual novel engine.

It should allow creators to:

- write scenarios in readable `.tzr` files
- parse / compile / execute scenarios through `@tsuzuru/core`
- render and operate runtime state through `@tsuzuru/preact`
- build static web games with Vite-based workflows
- extend behavior with TypeScript plugins
- define reusable macros in TypeScript

The scenario DSL must describe story flow, not become a general-purpose programming language.

## Documentation Boundary

Keep these boundaries clear:

### Core

`@tsuzuru/core` owns:

- parser
- AST
- compiler
- IR
- runtime
- condition evaluation
- macro expansion
- plugin command registry
- command validation
- runtime state
- snapshot / restore primitives

### Preact

`@tsuzuru/preact` owns:

- `useRuntime`
- `RuntimeView`
- renderable event handling
- visible event handling
- auto-step behavior
- click-to-advance wiring
- choice selection wiring
- save/load adapter utilities

### DSL

`.tzr` owns:

- scenario structure
- narration
- dialogue
- choices
- jumps
- constrained conditionals
- command calls
- macro calls

### Plugins

Plugins own:

- presentation commands
- custom runtime behavior behind registered commands
- BGM / SE
- character display
- background display
- transitions
- effects

### Macros

Macros own:

- compile-time shorthand
- repetitive presentation command expansion

Macros should not hide narrative flow in v0.1.

## Do Not Document as Implemented Unless Verified

Do not describe the following as implemented unless the repository actually contains working code and examples:

- `create-tsuzuru`
- `@tsuzuru/vite`
- Vite plugin behavior
- cross-file jump existence validation
- GUI editor
- visual scripting
- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility
- arbitrary JavaScript inside `.tzr`
- Live2D
- Pixi integration
- backlog
- auto mode
- skip mode
- read tracking
- gallery
- achievements
- cloud save
- advanced save slots
- packaged plugin distribution
- VS Code extension
- syntax highlighting extension

If mentioned, place them under limitations, future work, or post-v0.1 candidates.

## README Rules

The root `README.md` should prioritize:

- what Tsuzuru is
- current package status
- quickstart
- example execution
- current DSL sample
- package overview
- v0.1 scope
- limitations
- development commands

Do not make the README look like a mature released product before the repository supports that claim.

Recommended sections:

```md
# Tsuzuru

## Overview

## Current Status

## Packages

## Quickstart

## Run Examples

## DSL Example

## Development

## v0.1 Scope

## Limitations

## License
```

## Quickstart Rules

Quickstart must be executable from a clean checkout.

Prefer commands that exist in current `package.json` files.

Example command style:

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @tsuzuru/example-preact-basic build
```

If `create-tsuzuru` is not implemented, do not use:

```sh
npm create tsuzuru
```

unless clearly marked as future direction.

## docs/dsl.md Rules

`docs/dsl.md` is the source of truth for `.tzr` syntax.

It should document:

- supported syntax
- unsupported syntax
- source locations
- structure declarations
- narration
- speaker blocks
- commands
- macro calls
- conditional blocks
- jump targets
- choices
- compiler diagnostics
- whitespace rules
- examples
- v0.1 limitations

When DSL behavior changes, update `docs/dsl.md`.

Do not document arbitrary JS expressions as valid DSL.

## docs/runtime.md Rules

`docs/runtime.md` should document:

- runtime state model
- runtime pointer
- runtime events
- `stepRuntime`
- choice handling
- blocked states
- wait / waitClick / page / stop
- variables and flags
- plugin command dispatch
- snapshot creation
- restore behavior
- known limitations

Runtime docs should not describe Preact-specific rendering behavior as core runtime behavior.

## docs/plugin-api.md Rules

`docs/plugin-api.md` should document:

- plugin command registration
- plugin command definitions
- argument schemas
- command validation
- runtime handler expectations
- difference between core-owned and plugin-owned commands
- unknown command behavior
- limitations

Do not imply plugins can own core flow control.

Plugin commands should not be documented as a way to override:

- `@jump`
- `@if`
- `@else`
- `@endif`
- `@set`
- `@inc`
- `@dec`
- `@flag`
- `@unflag`
- `@wait`
- `@waitClick`
- `@page`
- `@stop`

## docs/macro-api.md Rules

`docs/macro-api.md` should document:

- macro definition
- macro registration
- compile-time expansion
- argument handling
- allowed expansion results
- forbidden expansion results
- v0.1 limitations
- difference between macros and plugins

Macros should be documented as shorthand for repetitive presentation logic.

Do not describe macros as hidden control flow.

## docs/architecture.md Rules

`docs/architecture.md` should document:

- package boundaries
- compile-time flow
- runtime flow
- core / preact separation
- plugin / macro separation
- data flow from `.tzr` to AST to IR to runtime events
- save/load boundary
- example application role
- future package candidates

Recommended architecture flow:

```txt
.tzr source
  -> parseTzr
  -> AST
  -> compileTzr
  -> compiled IR
  -> runtime state
  -> runtime events
  -> Preact adapter
  -> user UI
```

## Example README Rules

Example README files should include:

- what the example demonstrates
- install assumptions
- commands to run
- expected behavior
- relevant package dependencies
- limitations

Do not over-explain Tsuzuru's full architecture inside each example README.

Point back to root docs where appropriate.

## TODOS.md Rules

`TODOS.md` is operational, not marketing documentation.

When updating TODOs:

- check only completed items
- do not check items based on partial work
- keep unfinished sub-items unchecked
- add notes only when they clarify scope
- do not silently remove unresolved tasks
- keep post-v0.1 candidates separate from v0.1 tasks

## AGENTS.md Rules

`AGENTS.md` is the repository-wide instruction document.

Update it only when project-level principles or persistent Codex behavior rules change.

Do not use `AGENTS.md` for task-specific notes that belong in `TODOS.md`.

Do not use `AGENTS.md` for detailed API documentation that belongs in `docs/`.

## Style Rules

Use clear technical English unless the existing document is Japanese.

Prefer:

- short paragraphs
- concrete examples
- runnable commands
- explicit limitations
- package names
- file paths
- current behavior

Avoid:

- vague claims
- long promotional prose
- unsupported roadmap promises
- inconsistent terminology
- excessive analogies
- mixing implemented and future behavior in one section

## Terminology

Use these terms consistently:

- Tsuzuru
- Tsuzuru Script
- `.tzr`
- scenario DSL
- parser
- AST
- compiler
- IR
- runtime
- runtime event
- plugin command
- macro
- Preact adapter
- `RuntimeView`
- `useRuntime`
- snapshot
- save/load

Avoid introducing multiple names for the same concept.

## Code Examples

Code examples must be:

- minimal
- current
- copy-paste friendly
- aligned with actual exports
- aligned with actual package names
- checked against current implementation when practical

For `.tzr` examples, prefer:

```txt
#scene("prologue")

The classroom was unusually quiet.

:: Haruka
You're late again.

? What do you do?
- "Apologize" -> #apologize
- "Make a joke" -> #joke

#label("apologize")
@jump("#after_choice")
```

For shell examples, prefer fenced `sh` blocks.

## Limitation Rules

When a feature is not implemented, use direct wording.

Good:

```md
Cross-file jump existence validation is not implemented in v0.1.
```

Bad:

```md
Cross-file jumps are fully validated.
```

Good:

```md
`create-tsuzuru` is planned but not currently available.
```

Bad:

```md
Start a project with `npm create tsuzuru`.
```

unless that package is actually implemented and published or locally usable.

## Documentation Change Checklist

Before finalizing documentation changes, verify:

- Does this match current implementation?
- Does this match `AGENTS.md`?
- Does this match `TODOS.md`?
- Are commands real?
- Are package names real?
- Are exports real?
- Are future features clearly labeled?
- Are limitations explicit?
- Are examples minimal and valid?
- Did related docs need updates?

## Commands

For docs-only changes, usually no build is required, but run checks when examples, commands, or public API descriptions were changed.

Recommended minimum when docs mention current APIs:

```sh
pnpm typecheck
```

When docs include example build instructions:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
```

When docs are updated after source behavior changes:

```sh
pnpm test
pnpm typecheck
```

## Completion Criteria

A documentation task is complete only when:

- The relevant docs are updated.
- The docs describe current behavior accurately.
- Future features are labeled as future work or limitations.
- Commands are valid for the current repository.
- Related docs are updated when terminology or behavior changes.
- TODO items are checked only when actually completed.
- Verification commands are run when relevant.
- The final report lists changed files, executed commands, results, and remaining concerns.

## Final Report Format

Use this format:

```txt
実施内容:
- ...

確認:
- ...

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

Keep the report short.
