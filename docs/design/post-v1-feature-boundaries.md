# Post-v1 Feature Boundary Design

> Status: design guidance for post-v1 work.
> This document does not promote any syntax to stable support. The current
> supported DSL remains the subset described in
> [`dsl-support-matrix.md`](dsl-support-matrix.md).

この文書は、v1.0 から外した機能を今後検討するときの境界を定義する。
対象は次の 4 つ。

- rich text / inline events
- `system.*` condition resolver
- visual coordinate placement
- audio transitions

目的は、実装前に core、standard plugin、Preact / standard UI、host app の責務を分けること。
ここで書く内容は current behavior ではなく、post-v1 の設計開始点である。

## Shared Principles

- `.tzr` はシナリオ DSL のまま保つ。任意 JavaScript / TypeScript 実行は入れない。
- Core は narrative flow、AST、compiler validation、runtime instruction、runtime stepping を所有する。
- Core は DOM、Preact、CSS、browser storage、asset loading、audio playback を所有しない。
- Standard plugins は plugin-owned state と command handlers を所有する。
- Renderer / UI adapter は表示、レイアウト、演出実行、ユーザー操作を所有する。
- Save / load の復元条件が曖昧な機能は、runtime / plugin state shape と validation policy を先に決める。
- Parser-only または design-only の syntax は、compiler / runtime / docs / tests が揃うまで stable にしない。

## Rich Text / Inline Events

### Current Boundary

現在の stable text authoring は plain narration / dialogue / `say` である。
Parser は一部の rich text や inline event shape を認識するが、compiler は stable runtime event に変換しない。

対象になり得る syntax:

- inline text spans such as `{text ...|...}`
- delay spans such as `{delay ms=...|...}`
- inline waits such as `{wait ms=...}`
- inline audio events such as `{se assetId=...}` and `{voice assetId=...}`
- text block click waits
- text block page breaks
- text block metadata

### Proposed Responsibility Split

Core should own:

- AST nodes for text segments and inline events
- compiler validation for allowed inline event shapes
- runtime event shape for structured message content
- fallback plain text extraction for logs, backlog, and accessibility
- deterministic source-location diagnostics

Core should not own:

- glyph rendering
- typewriter animation timing
- audio playback
- backlog UI layout
- user preference storage

Renderer / UI packages should own:

- text reveal policy
- inline span rendering
- page-break interaction
- mapping inline audio events to playback helpers
- backlog presentation

Standard audio / text sound plugins may own:

- plugin event payload validation
- one-shot audio event state where needed
- save-ready cleanup helpers for transient audio events

### Save / Load Policy

Rich text must define whether reveal position is saveable. The conservative
default is:

- runtime snapshot stores the current message event and blocking state
- renderer-specific reveal progress is host/UI state, not core state
- restoring a message may restart reveal unless a future adapter-level save
  schema explicitly stores reveal progress

Inline one-shot events need duplicate-prevention rules. A restored message must
not replay transient inline SE / voice events unless the host explicitly opts in.

### Promotion Gate

Do not promote rich text / inline events from parser-only until:

- compiler output has structured message runtime events
- Preact / standard UI can render plain fallback and at least one rich span
- backlog behavior is specified
- save / restore replay policy is specified
- core parser/compiler/runtime tests cover accepted and rejected syntax
- docs explain what is stable and what remains renderer-specific

## `system.*` Condition Resolver

### Current Boundary

`call system.unlock...` is a plugin-dependent write-side behavior.
`if system.*` condition reads are not stable because core does not own
std-system persistence or host gallery policy.

### Proposed Responsibility Split

Core should own:

- condition AST and expression evaluation framework
- a resolver interface for non-`scenario.*` reads
- compiler diagnostics when a condition references an unresolved namespace
- deterministic behavior when the resolver is missing

Core should not own:

- browser persistence for endings, CGs, achievements, or galleries
- std-system storage migration
- gallery / achievement UI

`@tsuzuru/plugin-std-system` should own:

- durable unlock state shape
- helper functions for reading known unlock keys
- validation of plugin state owned by std-system

Host / adapter code should own:

- composing runtime state, plugin state, and persistent storage
- deciding whether condition reads use current runtime plugin state, persisted
  app state, or both
- user-facing UI for locked / unlocked content

### Resolver Shape

A future resolver should be explicit and renderer-neutral. A conceptual shape is:

```ts
type RuntimeConditionResolver = {
  get(namespace: string, path: readonly string[]): unknown;
};
```

Core evaluation can ask the resolver for `system.*` values without importing
std-system. Missing values should be falsey or diagnostic-driven by explicit
policy, not by accidental JavaScript property access.

### Promotion Gate

Do not promote `system.*` condition reads until:

- resolver behavior exists without coupling core to std-system
- missing resolver and unknown path diagnostics are tested
- std-system state read helpers are documented
- save / load interaction with plugin state is documented
- examples show a small branch using `system.*` without browser persistence
  becoming core behavior

## Visual Coordinate Placement

### Current Boundary

Preset placement such as `show asset at left`, `center`, and `right` is the
stable direction. Arbitrary coordinate placement such as
`show asset at x=... y=...` remains parser-only / rejected.

### Proposed Responsibility Split

Core should own:

- parsing and validating coordinate syntax
- compiling accepted coordinate metadata into command arguments
- source-location diagnostics for invalid units or ranges

`@tsuzuru/plugin-std-visual` should own:

- durable sprite state fields for placement mode
- preserving coordinate metadata in plugin state
- migration policy if the sprite state shape changes

Renderer / standard UI should own:

- coordinate origin and units
- safe-area handling
- scaling across viewport sizes
- anchor interpretation
- collision / overlap policy, if any

### Coordinate Contract

The recommended initial contract is normalized stage coordinates:

- `x` and `y` are numbers from `0` to `1`
- `0,0` is the top-left of the stage content area
- `1,1` is the bottom-right of the stage content area
- optional `anchor` can be introduced later, but should not be implicit if it
  affects save compatibility

Pixel coordinates should stay out of the first stable contract because they bind
scenario files to a renderer resolution.

### Promotion Gate

Do not promote coordinate placement until:

- coordinate units and origin are documented
- std-visual state shape is version-aware or explicitly no-migration
- standard UI renders coordinates consistently on mobile and desktop
- compiler tests reject unsupported units and malformed coordinates
- visual examples demonstrate responsive behavior

## Audio Transitions

### Current Boundary

Statement-level audio commands such as `bgm`, `stopBgm`, `se`, and `voice` are
the stable direction. Transition syntax such as `bgm ... with fadeIn(...)` and
`stopBgm with fadeOut(...)` remains design-only.

### Proposed Responsibility Split

Core should own:

- syntax and compiler validation for transition arguments
- command metadata that describes the requested transition
- diagnostics for unsupported transition shapes

`@tsuzuru/plugin-std-audio` should own:

- durable BGM state including transition metadata when needed
- transient SE / voice events
- save-ready cleanup helpers for one-shot events

Browser audio helpers / host apps should own:

- actual playback
- Web Audio or HTMLAudioElement policy
- autoplay handling
- fade timing execution
- volume curves

### Save / Load Policy

Audio transitions must define in-progress restore behavior before becoming
stable. The conservative first policy is:

- snapshots store the target durable BGM state
- in-progress fade progress is not guaranteed to resume exactly
- restore may apply the final BGM state immediately unless the host stores
  adapter-level transition progress

This avoids making core responsible for wall-clock audio timing.

### Promotion Gate

Do not promote audio transitions until:

- transition metadata is represented in std-audio state or events
- restore behavior for in-progress transitions is documented
- browser helper behavior is covered by focused tests where practical
- compiler rejects unknown transition names and invalid durations
- examples demonstrate fade behavior without implying core owns playback

## Sequencing

Recommended order:

1. `system.*` condition resolver design spike, because it mainly affects core
   condition evaluation and std-system boundaries.
2. Visual coordinate placement, because the state shape is durable but the
   renderer contract can stay narrow.
3. Audio transitions, because browser playback and restore policy need careful
   host-owned behavior.
4. Rich text / inline events, because it crosses text rendering, backlog,
   audio, save/load, and UI interaction.

This order keeps the highest cross-cutting text model change last.

## Required Checks When Implementing

Design-only edits usually need:

```sh
pnpm format:check
pnpm lint
pnpm check
git diff --check
```

When any topic moves into implementation, add focused checks:

- Core syntax / compiler / runtime: `pnpm --filter @tsuzuru/core test`
- std-visual changes: `pnpm --filter @tsuzuru/plugin-std-visual test`
- std-audio changes: `pnpm --filter @tsuzuru/plugin-std-audio test`
- std-system changes: `pnpm --filter @tsuzuru/plugin-std-system test`
- Preact / standard UI rendering: matching package tests plus relevant example
  build or `pnpm examples:check`
