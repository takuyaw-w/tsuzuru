# AGENTS.md

## Project Overview

Tsuzuru is a web-first visual novel engine built with TypeScript.

The project aims to let creators:

- Write scenarios in readable `.tzr` files
- Compile scenarios into a runtime document
- Run visual novel scenarios in a browser-first runtime
- Build UI with framework adapters such as Preact and Vue
- Extend presentation behavior with TypeScript plugins
- Distribute games as static web applications

Scenario files must describe narrative flow. They must not become a general-purpose programming language.

## Source of Truth

Treat `main` as the source of truth unless the user explicitly specifies another branch.

The current supported DSL path is the modern `.tzr` DSL implemented under `packages/core/src`.

Legacy DSL support has been removed.

Do not reintroduce:

- legacy `#scene(...)`
- legacy `#label(...)`
- legacy `:: Speaker`
- legacy `@command(...)`
- legacy `$macro(...)`
- removed transitional `parseTzrV2` / `compileTzrV2` aliases
- legacy macro API
- legacy parser/compiler files
- deleted legacy examples

Current public parser/compiler API:

```ts
import { parseTzr, compileTzr } from "@tsuzuru/core";
```

## Current Package Roles

Current packages:

```txt
packages/core
packages/config
packages/cli
packages/create-tsuzuru
packages/preact
packages/vue
packages/standard-ui-preact
packages/plugin-std-visual
packages/plugin-std-audio
packages/plugin-std-text-sound
packages/plugin-std-effect
packages/plugin-std-camera
packages/plugin-std-particle
packages/plugin-std-system
```

Current examples:

```txt
examples/preact-basic
examples/vue-basic
```

Primary runnable example:

```txt
examples/preact-basic
```

Package responsibilities:

- `@tsuzuru/core`
  - parser
  - scenario AST
  - compiler
  - runtime document / IR
  - runtime stepping
  - runtime state
  - runtime events
  - choices
  - jumps
  - conditional branching
  - scenario state updates
  - snapshot / restore
  - command dispatch infrastructure
  - diagnostics

- `@tsuzuru/config`
  - project configuration helpers
  - `defineTsuzuruConfig`
  - config-related public types
  - must not own parser/compiler/runtime semantics

- `@tsuzuru/cli`
  - command line tools such as `tsuzuru check`
  - config loading orchestration
  - scenario file discovery
  - scenario validation entry points
  - must not duplicate core parser/compiler semantics

- `create-tsuzuru`
  - project scaffolding
  - default project templates
  - generated examples and starter files
  - generated templates must use the current DSL
  - must not generate legacy DSL syntax

- `@tsuzuru/preact`
  - connects the core runtime to Preact
  - provides hooks and runtime-facing UI integration
  - must not own scenario semantics

- `@tsuzuru/vue`
  - connects the core runtime to Vue
  - provides composables and runtime-facing UI integration
  - must not own scenario semantics

- `@tsuzuru/standard-ui-preact`
  - provides reusable Preact UI components
  - may provide layout, message, choice, control, and helper UI components
  - must not own parser/compiler/runtime semantics

- `@tsuzuru/plugin-std-visual`
  - provides standard visual command handlers
  - owns visual plugin state updates
  - does not resolve asset paths
  - does not render DOM or framework components

- `@tsuzuru/plugin-std-audio`
  - provides standard audio command handlers
  - owns audio plugin state updates
  - does not load or bundle audio assets
  - does not own browser audio playback policy

- `@tsuzuru/plugin-std-text-sound`
  - provides standard text sound command handlers
  - owns text sound plugin state updates
  - may provide browser playback helpers under explicit subpaths
  - does not own text reveal timing or speaker mapping policy

- `@tsuzuru/plugin-std-effect`
  - provides standard effect command handlers
  - owns transient effect plugin state updates
  - clears one-shot events before snapshots when requested by the host
  - does not render animations or own persistent visual state

- `@tsuzuru/plugin-std-camera`
  - provides standard camera command handlers
  - owns durable camera plugin state updates
  - supports snapshot / restore through runtime plugin state
  - does not render transforms or resolve focus target coordinates

- `@tsuzuru/plugin-std-particle`
  - provides standard particle command handlers
  - owns durable particle plugin state updates
  - supports snapshot / restore through runtime plugin state
  - does not render particle systems or resolve visual assets

- `@tsuzuru/plugin-std-system`
  - provides standard system unlock command handlers
  - owns durable unlock plugin state for endings, CGs, and achievements
  - supports snapshot / restore through runtime plugin state
  - does not persist to browser storage or render gallery / achievement UI

## Current DSL Direction

The `.tzr` DSL should be:

- readable
- indentation-based where useful
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
title "Preact Basic"

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
- Vue
- CSS
- Vite
- browser storage
- application-specific assets

Framework adapters and examples may depend on browser/framework APIs. Core must not.

## Plugin Policy

Plugins extend runtime behavior through command handlers and plugin-owned state.

Plugins may own presentation-related behavior such as:

- background state
- sprite state
- BGM state
- sound effect events
- voice events
- text sound state
- transitions
- transient screen effects
- camera state
- particle state
- system unlock state

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

Plugin command validation policy:

- Use the existing plugin command metadata validation when available.
- Do not introduce a new validation framework or incompatible schema system unless explicitly requested.
- Changes to plugin command metadata must update core compiler tests and relevant plugin tests.
- Plugin validation must not move narrative semantics out of core.

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
- save data migration system
- cross-runtime save compatibility guarantees

## Development Workflow

Keep changes small and reviewable.

Prefer focused tasks:

- parser-only changes
- compiler-only changes
- runtime-only changes
- docs-only changes
- example-only changes
- test-only changes
- package-only changes
- template-only changes

Do not combine unrelated refactors with feature work.

Do not revive deleted legacy files to make tests pass.

Do not update generated templates without checking that they still use the current DSL.

When unsure, preserve the current public API and report the uncertainty.

## Verification Commands

Use these commands before reporting completion for broad repository changes:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm typecheck
pnpm release-readiness:check
pnpm examples:check
pnpm publish-readiness:check
pnpm --filter @tsuzuru/example-preact-basic check:scenario
pnpm --filter @tsuzuru/example-preact-basic build
git diff --check
```

If `rtk` is available, prefer the equivalent `rtk` command where it reduces token usage and preserves the same verification intent.

Example:

```sh
rtk pnpm install --frozen-lockfile
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk pnpm test
rtk pnpm typecheck
rtk pnpm release-readiness:check
rtk pnpm examples:check
rtk pnpm publish-readiness:check
rtk pnpm --filter @tsuzuru/example-preact-basic check:scenario
rtk pnpm --filter @tsuzuru/example-preact-basic build
rtk git diff --check
```

For package-specific changes, run the relevant filtered checks first.

Examples:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck

pnpm --filter @tsuzuru/config test
pnpm --filter @tsuzuru/config typecheck

pnpm --filter @tsuzuru/cli test
pnpm --filter @tsuzuru/cli typecheck

pnpm --filter create-tsuzuru test
pnpm --filter create-tsuzuru typecheck

pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck

pnpm --filter @tsuzuru/vue test
pnpm --filter @tsuzuru/vue typecheck

pnpm --filter @tsuzuru/standard-ui-preact test
pnpm --filter @tsuzuru/standard-ui-preact typecheck

pnpm --filter @tsuzuru/plugin-std-visual test
pnpm --filter @tsuzuru/plugin-std-visual typecheck

pnpm --filter @tsuzuru/plugin-std-audio test
pnpm --filter @tsuzuru/plugin-std-audio typecheck

pnpm --filter @tsuzuru/plugin-std-text-sound test
pnpm --filter @tsuzuru/plugin-std-text-sound typecheck

pnpm --filter @tsuzuru/plugin-std-effect test
pnpm --filter @tsuzuru/plugin-std-effect typecheck

pnpm --filter @tsuzuru/plugin-std-camera test
pnpm --filter @tsuzuru/plugin-std-camera typecheck

pnpm --filter @tsuzuru/plugin-std-particle test
pnpm --filter @tsuzuru/plugin-std-particle typecheck

pnpm --filter @tsuzuru/plugin-std-system test
pnpm --filter @tsuzuru/plugin-std-system typecheck
```

For scenario or Preact example changes, also run:

```sh
pnpm --filter @tsuzuru/example-preact-basic check:scenario
pnpm --filter @tsuzuru/example-preact-basic test
pnpm --filter @tsuzuru/example-preact-basic typecheck
pnpm --filter @tsuzuru/example-preact-basic build
```

For Vue adapter or Vue example changes, also run:

```sh
pnpm --filter @tsuzuru/example-vue-basic check:scenario
pnpm --filter @tsuzuru/example-vue-basic test
pnpm --filter @tsuzuru/example-vue-basic typecheck
pnpm --filter @tsuzuru/example-vue-basic build
```

For package publishing, package exports, `files`, generated templates, or release-readiness changes, also run:

```sh
pnpm packages:build
pnpm run pack:dry-run
pnpm publish-readiness:check
pnpm run smoke:create-tsuzuru:local
```

`publish-readiness:check` inspects packed package contents and assumes package `dist` output already exists.
On a clean checkout, run `pnpm packages:build` first, or use `pnpm release-readiness:check` to run package build, examples, pack dry-run, publish-readiness, and local create-tsuzuru smoke in order.
`packages:build` is the release-readiness package build gate. It builds public publishable packages in explicit dependency order through package `build:self` scripts so dependency packages are not rebuilt repeatedly inside the root release flow.
Package-level `build` scripts may still build their dependencies first so filtered package builds keep working from a clean checkout.
Do not add a template `pnpm-lock.yaml` without first designing how local tarball rewrites update or replace that lockfile.
TypeScript project references / `tsc -b` are a future build-system design topic, not the current release-readiness build strategy.
`smoke:create-tsuzuru` and `smoke:create-tsuzuru:registry` are registry-based smoke checks for the published `create-tsuzuru` package.
CI and release-readiness should use `smoke:create-tsuzuru:local`, which packs `create-tsuzuru` and generated `@tsuzuru/*` dependencies from the workspace as local tarballs and installs generated projects with `pnpm install --prefer-offline`.
The local smoke still installs external template dependencies such as `preact`, `typescript`, and `vite` through the normal registry-backed pnpm flow.

If any verification is skipped, report the skipped command and the reason.

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

The current DSL design document should live at:

```txt
docs/design/dsl-v2.md
```

When changing public syntax, public APIs, examples, templates, or package behavior, update relevant docs in the same change.

When changing implementation status, ensure README and design docs do not contradict `main` as the current source of truth.

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
- deterministic diagnostics
- source-location-aware errors where practical

Avoid:

- `any`
- hidden global mutable state
- DOM dependency in core
- Preact dependency in core
- Vue dependency in core
- Vite dependency in core
- parsing via fragile ad-hoc string splitting when grammar-aware parsing is needed
- scenario execution logic inside UI components
- plugin APIs that freely mutate runtime internals
- duplicating parser/compiler behavior in CLI, examples, adapters, or templates

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
- plugin command metadata validation
- snapshot / restore
- invalid DSL diagnostics
- CLI scenario checking
- generated project templates when templates change

When changing syntax, update parser tests first.

When changing compiled output, update compiler tests.

When changing runtime behavior, update runtime tests.

When changing public API names, update examples and docs in the same change.

When changing templates, verify that generated projects:

- use the current DSL
- do not include legacy syntax
- can install dependencies
- can run scenario checks
- can build

## Agent Instructions

When working in this repository:

- Treat `main` as the source of truth unless the user specifies a branch.
- Inspect existing files before proposing changes.
- Do not assume old DSL syntax is still valid.
- Do not introduce macros, presets, or stage syntax unless explicitly requested.
- Do not restore deleted examples.
- Do not rename public APIs without explicit approval.
- Do not duplicate core semantics in CLI, adapters, examples, or templates.
- Keep diffs minimal.
- Report commands run and their results.
- Report any skipped verification and the reason.
- Prefer concrete file paths and commands over general explanations.
- Preserve user changes already present in the worktree.
- Do not treat prompt templates under `.agents/prompts/` as task requirements.
- Use area-specific skills under `.agents/skills/` when relevant.

## Japanese Prompt Note

User tasks may be written in Japanese.

Interpret Japanese prompts according to the constraints in this file.

Do not translate, weaken, or ignore these constraints because the user prompt is casual or abbreviated.
