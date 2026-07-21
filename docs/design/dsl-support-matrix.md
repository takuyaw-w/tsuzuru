# DSL Support Matrix

> Status: v1.0 planning reference.
> This matrix describes the current implementation on `main`. It does not add
> syntax and does not by itself approve a v1.0 release.

This document separates the stable `.tzr` authoring subset from parser-only,
design-only, and plugin-dependent syntax. It is the release-planning companion
to [`dsl-v2.md`](dsl-v2.md).

## Status Values

| Status | Meaning |
| --- | --- |
| `stable` | Candidate for the v1.0 stable DSL subset. Parser, compiler, runtime or plugin behavior, docs, and tests are present. |
| `supported-needs-docs` | Implemented enough to support, but docs need more complete user-facing detail before v1.0. |
| `implemented-experimental` | Implemented, but semantics or coverage are not mature enough to promise as v1.0 stable yet. |
| `parser-only` | Parsed into AST, but compiler/runtime support is intentionally absent or rejected. |
| `compiler-only` | Compiler support exists but runtime/user-facing execution is not complete. |
| `runtime-only` | Runtime primitive exists but current `.tzr` authoring syntax does not expose it. |
| `plugin-dependent` | Core parses/compiles a command, but runtime behavior requires registering the matching plugin handlers. |
| `example-only` | Demonstrated in examples without a general stable DSL promise. |
| `design-only` | Documented as future or design direction, not currently implemented as supported authoring syntax. |
| `unsupported` | Explicitly rejected by parser/compiler/runtime. |
| `removed-legacy` | Removed old DSL syntax. Must not be documented as current syntax. |

## Summary

The v1.0 stable candidate is the plain, compile-supported DSL subset:

- top-level `title`, `character`, `include`, and `scene`
- plain narration and dialogue text
- `choice`, conditional choice items, and scenario-state `if` / `elif` / `else`
- static scene `jump` and `end`
- `set` / `add` for `scenario.*`
- timed `wait <durationMs>`
- standard plugin sugar that compiles to registered plugin commands

The main non-stable DSL areas are explicitly post-v1.0 or optional tooling:

- rich inline markup and explicit text block controls are parser-only today and
  are explicitly not part of the v1.0 stable subset
- namespaced `wait namespace.event(...)` remains design-only
- `system.*` condition reads are plugin-dependent: compile-time support
  requires std-system condition namespace metadata, and runtime support requires
  `createStdSystemConditionResolver()`
- visual preset placement (`left` / `center` / `right`) is the v1.0 target;
  coordinate placement remains parser-only
- statement-level audio commands (`bgm`, `stopBgm`, `se`, `voice`) are the
  v1.0 target; audio transition syntax remains design-only
- editor / syntax highlighting is optional tooling, not a v1.0 release blocker

For v1.0, plain narration, dialogue, and `say` text are the stable text
authoring target. Blank physical lines are ignored as authoring whitespace.
Rich text, inline events, explicit click waits, page breaks, and text block
metadata remain post-v1.0 design work.

For v1.0 conditions, `scenario.*` references are the stable target. `system.*`
condition reads are supported only for the current std-system runtime plugin
state through the std-system condition namespace metadata plus
`createStdSystemConditionResolver()`. Use `call system.unlock...` commands for
std-system write-side behavior.

For v1.0 visual placement, `show asset at left`, `show asset at center`, and
`show asset at right` are the stable std-visual target. `show asset at
x=... y=...` remains post-v1.0 renderer coordinate policy work.

For v1.0 audio, `bgm`, `stopBgm`, `se`, and `voice` are the stable std-audio
target. `bgm ... with fadeIn(...)` and `stopBgm with fadeOut(...)` remain
post-v1.0 audio-layer timing and save/load design work.

For v1.0 editor support, DSL semantics are defined by parser, compiler,
runtime/plugin behavior, docs, examples, and tests. Syntax highlighting, VS Code
extension work, LSP diagnostics, and GUI editor support are optional tooling and
may ship independently after engine v1.0. Future editor grammars should track
this matrix instead of defining a separate supported syntax.

## Core DSL Matrix

| Syntax | Category | Parser | Compiler | Runtime | Plugin | Docs | Examples | Tests | v1.0 Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `title "..."` | Core metadata | yes | metadata | n/a | n/a | yes | yes | yes | `stable` | Document-level metadata only. |
| `character id name="..."` | Core metadata | yes | metadata | dialogue validation | n/a | yes | yes | yes | `stable` | Dialogue speaker IDs are validated by compiler. |
| `include "./path.tzr"` | Core project directive | yes | project compiler | n/a | n/a | yes | yes | yes | `stable` | `compileTzrProject` resolves includes; single-document compile ignores project loading. |
| `scene id:` / `scene id "title":` | Core flow | yes | yes | yes | n/a | yes | yes | yes | `stable` | Static scene IDs only. |
| `narration:` plain text | Core text | yes | plain text only | yes | n/a | yes | yes | yes | `stable` | Blank physical lines are ignored. Rich inline nodes, page breaks, explicit click waits, and `:meta` are not included in the v1.0 stable subset. |
| `say id:` plain text | Core text | yes | plain text only | yes | n/a | yes | tests | yes | `stable` | Compiles like dialogue shorthand; plain text only for v1.0. |
| `<characterId>:` plain text | Core text | yes | plain text only | yes | n/a | yes | yes | yes | `stable` | Requires a declared character; plain text only for v1.0. |
| `choice "..."` | Core flow | yes | yes | yes | n/a | yes | yes | yes | `stable` | Runtime emits body-choice events and resumes selected body. |
| `"label" id=... if scenario.*:` | Core flow | yes | yes | yes | n/a | yes | unit tests | yes | `stable` | Conditional choice filtering supports `scenario.*` conditions. |
| `if` / `elif` / `else` with `scenario.*` | Core flow | yes | yes | yes | n/a | yes | unit tests | yes | `stable` | Logical `and` / `or` / `not`, comparisons, literals, and parentheses are covered; nesting is limited to 128 levels. |
| `if system.*` | Core / std-system boundary | yes | yes with condition namespace metadata | resolver-dependent | std-system resolver | yes | no | yes | `plugin-dependent` | Supported paths are `system.endings.<id>.unlocked`, `system.cgs.<id>.unlocked`, and `system.achievements.<id>.unlocked`; compile with `createStdSystemPlugin()` metadata and run with `createStdSystemConditionResolver()`. |
| `jump sceneId` | Core flow | yes | yes | yes | n/a | yes | yes | yes | `stable` | Cross-file jump validation is supported through `compileTzrProject`. |
| `end` | Core flow | yes | stop command | yes | n/a | yes | yes | yes | `stable` | Compiles to the core stop command. |
| `set scenario.x = <value>` | Core state | yes | yes | yes | n/a | yes | unit tests | yes | `stable` | Values: string, finite number, boolean, `null`, or existing `scenario.*` reference; integer syntax is limited to safe integers. |
| `set system.* = ...` | Core / std-system boundary | rejected or compile-rejected | rejected | no | std-system | yes | no | yes | `unsupported` | System mutation must use `call system.*(...)`. |
| `add scenario.x += <number>` | Core state | yes | yes | yes | n/a | yes | unit tests | yes | `stable` | Missing value starts from `0`; non-number existing values produce runtime error. |
| `call namespace.action(...)` | Plugin command | yes | yes with plugin metadata | handler-dependent | required | yes | yes for std-system | yes | `plugin-dependent` | Without plugin metadata the compiler rejects generic `call`; registered plugin metadata validates args. |
| `wait 1000` | Core wait | yes | yes | yes | host clears wait | yes | unit tests | yes | `stable` | Runtime emits a pending timed wait; host controls timer completion. |
| `wait namespace.event(...)` | Future wait | yes | rejected | no | future host/plugin | yes | no | yes | `design-only` | Parser recognizes the shape, but compiler rejects namespaced waits. |
| Inline `{text ...|...}` | Core text markup | yes | rejected | no | renderer future | yes | no | yes | `parser-only` | Rich inline text is parsed but not compiled. Not included in the v1.0 stable subset. |
| Inline `{delay ms=...|...}` | Core text markup | yes | rejected | no | renderer future | yes | no | yes | `parser-only` | Parsed for future text reveal control. Not included in the v1.0 stable subset. |
| Inline `{wait ms=...}` | Core text event | yes | rejected | no | host future | yes | no | yes | `parser-only` | Not compiled into runtime events. Not included in the v1.0 stable subset. |
| Inline `{se assetId=...}` | std-audio inline event | yes | rejected | no | std-audio future | yes | no | yes | `parser-only` | Statement-level `se` is supported; inline `se` is not included in the v1.0 stable subset. |
| Inline `{voice assetId=...}` | std-audio inline event | yes | rejected | no | std-audio future | yes | no | yes | `parser-only` | Statement-level `voice` is supported; inline `voice` is not included in the v1.0 stable subset. |
| Text block blank line | Core text whitespace | ignored | n/a | n/a | n/a | yes | yes | yes | `stable` | Blank physical lines do not create AST nodes or runtime events. |
| Text block `---` page break | Core text control | yes | rejected | no | host future | yes | no | yes | `parser-only` | Compiler rejects `TextPageBreak`. Not included in the v1.0 stable subset. |
| Text block `:meta` | Core text metadata | yes | rejected | no | renderer future | yes | no | yes | `parser-only` | Metadata attributes parse but compiler rejects the block metadata. Not included in the v1.0 stable subset. |

## Standard Plugin Sugar Matrix

| Syntax | Category | Parser | Compiler | Runtime | Plugin | Docs | Examples | Tests | v1.0 Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bg asset` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Durable background state. |
| `show asset at left/center/right` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Preset placement is compiled and runtime-handled. |
| `show asset at x=... y=...` | std-visual sugar | yes | rejected | no | std-visual future | yes | no | yes | `parser-only` | Compiler explicitly rejects coordinate placement for now. Not included in the v1.0 stable subset. |
| `hide asset` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Hides matching sprite if present. |
| `clear sprites` | std-visual sugar | yes | command | plugin handler | std-visual | yes | tests | yes | `plugin-dependent` | Clears sprite state. |
| `clear bg` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Clears background state. |
| `show/hide/clear ... with fade(duration=...)` | std-visual transition | yes | command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Renderer owns actual animation. |
| `with dissolve(duration=...)` | std-visual transition | yes | command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Renderer owns actual animation. |
| `bg ... with fade(...)` | std-visual background transition | yes | bg command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Background update metadata; use `wait` for strict timing. |
| `bg ... with pageTurn(...)` | std-visual background transition | yes | bg command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Page-turn style background update metadata; use `wait` for strict timing. |
| `bg ... with blurFade(...)` | std-visual background transition | yes | bg command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Background update metadata; use `wait` for strict timing. |
| `bg ... with slide(...)` | std-visual background transition | yes | bg command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Background update metadata; use `wait` for strict timing. |
| `bg ... with wipeLeft(...)` | std-visual background transition | yes | bg command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Background update metadata; use `wait` for strict timing. |
| `bg ... with wipeRight(...)` | std-visual background transition | yes | bg command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Background update metadata; use `wait` for strict timing. |
| `bgm asset` | std-audio sugar | yes | `startBgm` command | plugin handler | std-audio | yes | yes | yes | `plugin-dependent` | Durable BGM state. |
| `stopBgm` | std-audio sugar | yes | command | plugin handler | std-audio | yes | yes | yes | `plugin-dependent` | Clears durable BGM state. |
| `se asset` | std-audio sugar | yes | command | plugin handler | std-audio | yes | yes | yes | `plugin-dependent` | One-shot event; save-ready snapshots clear events through plugin helper. |
| `voice asset` | std-audio sugar | yes | command | plugin handler | std-audio | yes | tests | yes | `plugin-dependent` | One-shot event; save-ready snapshots clear events through plugin helper. |
| `bgm ... with fadeIn(...)` | std-audio transition | no | no | no | future | design note | no | yes | `design-only` | Not current parser/compiler syntax. Not included in the v1.0 stable subset. |
| `stopBgm with fadeOut(...)` | std-audio transition | no | no | no | future | design note | no | yes | `design-only` | Not current parser/compiler syntax. Not included in the v1.0 stable subset. |
| `textSound asset` | std-text-sound sugar | yes | command | plugin handler | std-text-sound | yes | no | yes | `plugin-dependent` | Advanced override command; normal usage can be app-side defaults. |
| `stopTextSound` | std-text-sound sugar | yes | command | plugin handler | std-text-sound | yes | no | yes | `plugin-dependent` | Clears override profile ID. |
| `shake ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
| `flash ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
| `pulse ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
| `blur ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
| `transition fade(...)` | standalone transition | no | no | no | none | no | no | yes | `unsupported` | Standalone screen transition statements are not part of the current DSL. |
| `camera x=... y=... zoom=...` | std-camera sugar | yes | command | plugin handler | std-camera | yes | yes | yes | `plugin-dependent` | Durable camera state. |
| `camera focus asset ...` | std-camera sugar | yes | command | plugin handler | std-camera | yes | yes | yes | `plugin-dependent` | Durable focus target state; renderer resolves coordinates. |
| `reset camera` | std-camera sugar | yes | command | plugin handler | std-camera | yes | yes | yes | `plugin-dependent` | Resets durable camera state. |
| `particle type ...` | std-particle sugar | yes | command | plugin handler | std-particle | yes | yes | yes | `plugin-dependent` | Durable particle overlay state. |
| `stopParticle` | std-particle sugar | yes | command | plugin handler | std-particle | yes | yes | yes | `plugin-dependent` | Clears particle overlay state. |
| `call system.unlockEnding(id=...)` | std-system command | yes | command with metadata | plugin handler | std-system | yes | yes | yes | `plugin-dependent` | Durable unlock state. |
| `call system.unlockCg(id=...)` | std-system command | yes | command with metadata | plugin handler | std-system | yes | yes | yes | `plugin-dependent` | Durable unlock state. |
| `call system.unlockAchievement(id=...)` | std-system command | yes | command with metadata | plugin handler | std-system | yes | yes | yes | `plugin-dependent` | Durable unlock state. |

## Removed Legacy Syntax

The following syntax is removed and must stay out of current examples,
templates, and user-facing syntax docs except as clearly historical context.

| Syntax | Category | Parser | Compiler | Runtime | Plugin | Docs | Examples | Tests | v1.0 Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `#scene(...)` | legacy DSL | no | no | no | n/a | historical only | no | cleanup tests | `removed-legacy` | Use `scene id:`. |
| `#label(...)` | legacy DSL | no | no | no | n/a | historical only | no | cleanup tests | `removed-legacy` | Static scene IDs replace label flow. |
| `:: Speaker` | legacy DSL | no | no | no | n/a | historical only | no | cleanup tests | `removed-legacy` | Use `say id:` or `<characterId>:`. |
| `@command(...)` | legacy DSL | no | no | no | n/a | historical only | no | cleanup tests | `removed-legacy` | Use `call namespace.action(...)` or standard plugin sugar. |
| `$macro(...)` | legacy macro | no | no | no | n/a | historical only | no | cleanup tests | `removed-legacy` | Macro support is intentionally deferred. |
| `parseTzrV2` / `compileTzrV2` | transitional API | no | no | no | n/a | historical only | no | cleanup tests | `removed-legacy` | Current public APIs are `parseTzr` / `compileTzr`. |

## v1.0 Blockers

There are no unresolved DSL support-scope blockers in this matrix. Remaining
v1.0 blockers are tracked in
[`v1.0-release-gate.md`](../plans/v1.0-release-gate.md).

Closed for v1.0: parser-only text features (`:meta`, page break, rich inline
text, inline waits, inline audio events) and future explicit click waits are not part of the v1.0
stable subset. They remain post-v1.0 design work.
`system.*` condition reads are plugin-dependent and limited to current
std-system runtime plugin state; std-system write-side
`call system.unlock...` commands remain plugin-dependent.
Visual coordinate placement is also not part of the v1.0 stable subset; preset
std-visual placement remains plugin-dependent.
Audio transitions are also not part of the v1.0 stable subset; statement-level
std-audio commands remain plugin-dependent.
Editor / syntax highlighting is not a v1.0 blocker; it remains optional tooling
that should follow this matrix.

Post-v1 feature boundary guidance for rich text / inline events, remaining
`system.*` persistence/gallery policy, visual coordinate placement, and audio
transitions is tracked in
[`post-v1-feature-boundaries.md`](post-v1-feature-boundaries.md). That document
is design guidance only and does not promote future syntax to stable support.
The implemented first-scope design for `system.*` condition reads is tracked in
[`system-condition-resolver.md`](system-condition-resolver.md).

## Recommended Issues

### 1. Design rich text and inline event support after v1.0

- Purpose: design text block controls and inline syntax without overpromising
  them in v1.0.
- Scope: renderer message model, text reveal timing, backlog representation,
  save/load interaction, inline audio events, `:meta`, explicit click waits,
  `---` page breaks, `{text}`, `{delay}`, `{wait}`, inline `{se}`, and inline
  `{voice}`.
- Done when: each feature has a compiler/runtime design, renderer contract,
  compatibility notes, tests, and user docs before being promoted from
  parser-only.
- Suggested checks: `pnpm --filter @tsuzuru/core test`, `pnpm check`.
- Risk: making rich text stable too early can constrain renderer and adapter
  behavior.

### 2. Extend `system.*` beyond runtime plugin state

- Purpose: design any future std-system condition reads that need browser
  persistence, gallery state, remote profiles, or host storage policy.
- Scope: persistence source selection, host override policy, save/load
  compatibility, docs, and examples.
- Done when: future condition reads have an explicit source-of-truth policy,
  tests, and user docs before being promoted beyond the current
  `runtimeState.plugins.stdSystem` resolver.
- Suggested checks: `pnpm --filter @tsuzuru/core test`,
  `pnpm --filter @tsuzuru/plugin-std-system test`.
- Risk: persistent system state can constrain host app storage and gallery
  behavior if it is made implicit.

### 3. Design visual coordinate placement after v1.0

- Purpose: design arbitrary sprite coordinates without locking the v1.0
  renderer coordinate system too early.
- Scope: compiler support, std-visual state metadata, renderer coordinate
  origin, anchor, safe-area behavior, responsive layout, docs, and examples.
- Done when: coordinate placement has an explicit renderer contract, compiler
  and plugin state design, tests, and user docs before being promoted from
  parser-only.
- Suggested checks: `pnpm --filter @tsuzuru/core test`,
  `pnpm --filter @tsuzuru/plugin-std-visual test`.
- Risk: coordinate semantics can lock responsive renderer behavior and
  std-visual state shape too early.

### 4. Design audio transitions after v1.0

- Purpose: design BGM fade behavior without overpromising host audio timing or
  save/load semantics in v1.0.
- Scope: parser/compiler syntax, std-audio state or event shape, renderer audio
  timing, transition-in-progress save/load behavior, docs, and examples.
- Done when: audio transitions have an explicit audio-layer contract,
  save/load policy, compiler/plugin design, tests, and user docs before being
  promoted from design-only.
- Suggested checks: `pnpm --filter @tsuzuru/core test`,
  `pnpm --filter @tsuzuru/plugin-std-audio test`.
- Risk: transition timing and in-progress restore behavior can constrain host
  audio implementations too early.

### 5. Track editor and syntax highlighting support after v1.0

- Purpose: improve `.tzr` authoring UX without making engine v1.0 depend on
  editor tooling.
- Scope: syntax grammar, VS Code extension decision, optional LSP diagnostics,
  snippets, docs, release cadence, and keeping editor grammar aligned with this
  support matrix.
- Done when: editor tooling has an implementation plan or separate release
  vehicle, and docs explain how its grammar follows the v1.0 DSL subset.
- Suggested checks: docs-only `pnpm check`.
- Risk: editor grammar can drift from parser/compiler behavior if it is not
  validated against the matrix.
