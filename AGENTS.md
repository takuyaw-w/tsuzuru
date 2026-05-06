# AGENTS.md

## Project Overview

Tsuzuru is a web-first visual novel engine built with TypeScript.

The project aims to let creators:

- Write scenarios in readable `.tzr` files
- Compile scenarios into a runtime document
- Run visual novel scenarios in a browser-first runtime
- Build UI with Preact
- Extend presentation behavior with TypeScript plugins
- Distribute games as static web applications

Scenario files must describe narrative flow. They must not become a general-purpose programming language.

## Current Repository State

The current supported DSL path is the modern `.tzr` DSL implemented under `packages/core/src`.

Legacy DSL support has been removed.

Do not reintroduce:

- legacy `#scene(...)`
- legacy `#label(...)`
- legacy `:: Speaker`
- legacy `@command(...)`
- legacy `$macro(...)`
- legacy `parseTzrV2` / `compileTzrV2`
- legacy macro API
- legacy parser/compiler files
- deleted legacy examples

Current public parser/compiler API:

```ts
import { parseTzr, compileTzr } from "@tsuzuru/core";
```

Current runnable example:

```txt
examples/dsl-v2-basic
```

## Current Package Roles

Core packages:

```txt
packages/core
packages/preact
packages/standard-ui-preact
packages/plugin-std-visual
packages/plugin-std-audio
```

Current example:

```txt
examples/dsl-v2-basic
```

Package responsibilities:

- `@tsuzuru/core`
  - parser
  - scenario AST
  - compiler
  - runtime document / IR
  - runtime stepping
  - runtime state
  - snapshot / restore
  - command dispatch infrastructure

- `@tsuzuru/preact`
  - connects the core runtime to Preact
  - provides hooks and runtime-facing UI integration
  - must not own scenario semantics

- `@tsuzuru/standard-ui-preact`
  - provides reusable Preact UI components
  - must not own parser/compiler/runtime semantics

- `@tsuzuru/plugin-std-visual`
  - provides standard visual command handlers
  - owns visual plugin state updates
  - does not resolve asset paths

- `@tsuzuru/plugin-std-audio`
  - provides standard audio command handlers
  - owns audio plugin state updates
  - does not load or bundle audio assets

## Current DSL Direction

The `.tzr` DSL should be:

- readable
- line-oriented where practical
- statically analyzable
- friendly to syntax highlighting
- intentionally constrained
- not JavaScript
- not TypeScript
- not Markdown-dependent
- not KAG/KS-compatible by default

Do not allow arbitrary JavaScript or TypeScript inside `.tzr` files.

Do not add general-purpose scripting features unless explicitly requested.

## Current DSL Example

Use the current DSL style.

```txt
title "DSL v2 Basic"

character mio name="美緒"

scene start:
  bg station
  bgm daily_theme
  show mio_smile at center

  mio:
    遅いよ。

  set scenario.hasNotebook = true
  add scenario.score += 1

  if scenario.score >= 1:
    narration:
      スコアが増えた。
  else:
    narration:
      まだ何も起きていない。

  choice "どうする？":
    "手帳を見る" id=openNotebook if scenario.hasNotebook:
      se page
      jump notebook

    "立ち去る" id=leave:
      jump leave

scene notebook:
  voice mio_001
  mio:
    ちゃんと見ておいてね。
  hide mio_smile
  stopBgm
  end
```

Do not use old examples such as:

```txt
#scene("start")
#label("label")
:: Speaker
@bg("station")
$macro(...)
@if(...)
@endif
```

Those belong to the removed legacy DSL.

## Runtime and Compiler Principles

The compiler should convert scenario authoring syntax into a runtime document.

Runtime behavior should be explicit and predictable.

Core runtime responsibilities:

- execute compiled instructions
- expose runtime events
- manage scenario state
- resolve choices
- dispatch command instructions
- support snapshot / restore

The runtime must not depend on:

- DOM
- Preact
- CSS
- browser storage
- application-specific assets

## Plugin Policy

Plugins extend runtime behavior through command handlers and plugin-owned state.

Plugins may own presentation-related behavior such as:

- background state
- sprite state
- BGM state
- sound effect events
- voice events
- transitions in future versions
- camera or screen effects in future versions

Plugins must not own core narrative flow.

Core owns:

- scenes
- narration
- dialogue
- choices
- jumps
- conditional branching
- scenario state updates
- runtime stepping
- snapshot / restore

Plugin command validation policy is still a deferred design topic. Do not introduce a new validation framework unless explicitly requested.

## Macro / Preset Policy

Generic macro support is intentionally deferred.

Do not implement or reintroduce:

- `$macro(...)`
- TypeScript macro API
- scenario-local macro definitions
- macro expansion
- preset syntax
- stage syntax
- reusable staging syntax

Reusable staging may be reconsidered later as a constrained feature, but it is not part of the current implementation scope.

## Non-Goals

Do not implement these unless explicitly requested:

- arbitrary JS/TS execution inside `.tzr`
- legacy DSL compatibility
- TyranoScript compatibility
- KAG/KS compatibility
- Ren'Py compatibility
- GUI editor
- visual scripting editor
- macro system
- preset/stage system
- RPG/map/battle systems
- Live2D integration
- Pixi integration
- cloud save
- achievements
- gallery
- advanced animation editor

## Development Workflow

Keep changes small and reviewable.

Prefer focused tasks:

- parser-only changes
- compiler-only changes
- runtime-only changes
- docs-only changes
- example-only changes
- test-only changes

Do not combine unrelated refactors with feature work.

Do not revive deleted legacy files to make tests pass.

When unsure, preserve the current public API and report the uncertainty.

## Verification Commands

Use these commands before reporting completion:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm --filter @tsuzuru/example-dsl-v2-basic build
git diff --check
```

For package-specific changes, also run the relevant filtered checks.

Examples:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/standard-ui-preact test
pnpm --filter @tsuzuru/plugin-std-visual test
pnpm --filter @tsuzuru/plugin-std-audio test
```

If `rtk` is available, prefer the equivalent `rtk` command where it reduces token usage and preserves the same verification intent.

## Documentation Rules

Keep documentation aligned with the current implementation.

Current docs should not present removed legacy DSL syntax as supported.

Historical references are allowed only when clearly marked as historical.

Do not add long speculative roadmap sections to `AGENTS.md`.

Use dedicated docs for detailed design records:

```txt
docs/decisions/
docs/plans/
docs/design/
```

## Coding Guidelines

Use strict TypeScript.

Prefer:

- explicit types
- discriminated unions
- small modules
- pure parser/compiler functions where practical
- immutable data where practical
- clear runtime instruction types
- compile-time validation where practical

Avoid:

- `any`
- hidden global mutable state
- DOM dependency in core
- Preact dependency in core
- parsing via fragile ad-hoc string splitting when grammar-aware parsing is needed
- scenario execution logic inside UI components
- plugin APIs that freely mutate runtime internals

## Testing Policy

Prioritize tests for:

- parser behavior
- compiler behavior
- condition parsing/evaluation
- runtime stepping
- choices
- jumps
- state updates
- plugin command dispatch
- snapshot / restore
- invalid DSL diagnostics

When changing syntax, update parser tests first.

When changing compiled output, update compiler tests.

When changing runtime behavior, update runtime tests.

When changing public API names, update examples and docs in the same change.

## Agent Instructions

When working in this repository:

- Treat `main` as the source of truth unless the user specifies a branch.
- Inspect existing files before proposing changes.
- Do not assume old DSL syntax is still valid.
- Do not introduce macros, presets, or stage syntax unless explicitly requested.
- Do not restore deleted examples.
- Do not rename public APIs without explicit approval.
- Keep diffs minimal.
- Report commands run and their results.
- Report any skipped verification and the reason.
- Prefer concrete file paths and commands over general explanations.
