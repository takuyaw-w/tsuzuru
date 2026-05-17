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

The main DSL gaps before v1.0 are not parser features. They are support-scope
decisions:

- rich inline markup and text block controls are parser-only today and are
  explicitly not part of the v1.0 stable subset
- namespaced `wait namespace.event(...)` remains design-only
- `system.*` conditions parse but are compile-unsupported
- audio transition syntax is design-only
- editor / syntax highlighting scope is not implemented

For v1.0, plain narration, dialogue, and `say` text are the stable text
authoring target. Rich text, inline events, blank-line click waits, page breaks,
and text block metadata remain post-v1.0 design work.

## Core DSL Matrix

| Syntax | Category | Parser | Compiler | Runtime | Plugin | Docs | Examples | Tests | v1.0 Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `title "..."` | Core metadata | yes | metadata | n/a | n/a | yes | yes | yes | `stable` | Document-level metadata only. |
| `character id name="..."` | Core metadata | yes | metadata | dialogue validation | n/a | yes | yes | yes | `stable` | Dialogue speaker IDs are validated by compiler. |
| `include "./path.tzr"` | Core project directive | yes | project compiler | n/a | n/a | yes | yes | yes | `stable` | `compileTzrProject` resolves includes; single-document compile ignores project loading. |
| `scene id:` / `scene id "title":` | Core flow | yes | yes | yes | n/a | yes | yes | yes | `stable` | Static scene IDs only. |
| `narration:` plain text | Core text | yes | plain text only | yes | n/a | yes | yes | yes | `stable` | Rich inline nodes, page breaks, click waits, and `:meta` are parser-only and not included in the v1.0 stable subset. |
| `say id:` plain text | Core text | yes | plain text only | yes | n/a | yes | tests | yes | `stable` | Compiles like dialogue shorthand; plain text only for v1.0. |
| `<characterId>:` plain text | Core text | yes | plain text only | yes | n/a | yes | yes | yes | `stable` | Requires a declared character; plain text only for v1.0. |
| `choice "..."` | Core flow | yes | yes | yes | n/a | yes | yes | yes | `stable` | Runtime emits body-choice events and resumes selected body. |
| `"label" id=... if scenario.*:` | Core flow | yes | yes | yes | n/a | yes | unit tests | yes | `stable` | Conditional choice filtering supports `scenario.*` conditions. |
| `if` / `elif` / `else` with `scenario.*` | Core flow | yes | yes | yes | n/a | yes | unit tests | yes | `stable` | Logical `and` / `or` / `not`, comparisons, literals, and parentheses are covered. |
| `if system.*` | Core / std-system boundary | yes | rejected | no | std-system future | yes | no | yes | `parser-only` | Compiler rejects system condition references until a renderer-neutral resolver exists. |
| `jump sceneId` | Core flow | yes | yes | yes | n/a | yes | yes | yes | `stable` | Cross-file jump validation is supported through `compileTzrProject`. |
| `end` | Core flow | yes | stop command | yes | n/a | yes | yes | yes | `stable` | Compiles to the core stop command. |
| `set scenario.x = <value>` | Core state | yes | yes | yes | n/a | yes | unit tests | yes | `stable` | Values: string, number, boolean, `null`, or existing `scenario.*` reference. |
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
| Text block blank line click wait | Core text control | yes | rejected | no | host future | yes | no | yes | `parser-only` | Compiler rejects `TextClickWait`. Not included in the v1.0 stable subset. |
| Text block `---` page break | Core text control | yes | rejected | no | host future | yes | no | yes | `parser-only` | Compiler rejects `TextPageBreak`. Not included in the v1.0 stable subset. |
| Text block `:meta` | Core text metadata | yes | rejected | no | renderer future | yes | no | yes | `parser-only` | Metadata attributes parse but compiler rejects the block metadata. Not included in the v1.0 stable subset. |

## Standard Plugin Sugar Matrix

| Syntax | Category | Parser | Compiler | Runtime | Plugin | Docs | Examples | Tests | v1.0 Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bg asset` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Durable background state. |
| `show asset at left/center/right` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Preset placement is compiled and runtime-handled. |
| `show asset at x=... y=...` | std-visual sugar | yes | rejected | no | std-visual future | yes | no | yes | `parser-only` | Compiler explicitly rejects coordinate placement for now. |
| `hide asset` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Hides matching sprite if present. |
| `clear sprites` | std-visual sugar | yes | command | plugin handler | std-visual | yes | tests | yes | `plugin-dependent` | Clears sprite state. |
| `clear bg` | std-visual sugar | yes | command | plugin handler | std-visual | yes | yes | yes | `plugin-dependent` | Clears background state. |
| `with fade(duration=...)` | std-visual transition | yes | command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Renderer owns actual animation. |
| `with dissolve(duration=...)` | std-visual transition | yes | command metadata | plugin state metadata | std-visual | yes | yes | yes | `plugin-dependent` | Renderer owns actual animation. |
| `bgm asset` | std-audio sugar | yes | `startBgm` command | plugin handler | std-audio | yes | yes | yes | `plugin-dependent` | Durable BGM state. |
| `stopBgm` | std-audio sugar | yes | command | plugin handler | std-audio | yes | yes | yes | `plugin-dependent` | Clears durable BGM state. |
| `se asset` | std-audio sugar | yes | command | plugin handler | std-audio | yes | yes | yes | `plugin-dependent` | One-shot event; save-ready snapshots clear events through plugin helper. |
| `voice asset` | std-audio sugar | yes | command | plugin handler | std-audio | yes | tests | yes | `plugin-dependent` | One-shot event; save-ready snapshots clear events through plugin helper. |
| `bgm ... with fadeIn(...)` | std-audio transition | no | no | no | future | design note | no | historical plan only | `design-only` | Not current parser/compiler syntax. |
| `stopBgm with fadeOut(...)` | std-audio transition | no | no | no | future | design note | no | historical plan only | `design-only` | Not current parser/compiler syntax. |
| `textSound asset` | std-text-sound sugar | yes | command | plugin handler | std-text-sound | yes | no | yes | `plugin-dependent` | Advanced override command; normal usage can be app-side defaults. |
| `stopTextSound` | std-text-sound sugar | yes | command | plugin handler | std-text-sound | yes | no | yes | `plugin-dependent` | Clears override profile ID. |
| `shake ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
| `flash ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
| `pulse ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
| `blur ...` | std-effect sugar | yes | command | plugin handler | std-effect | yes | yes | yes | `plugin-dependent` | One-shot effect event. |
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

Before v1.0, the DSL support decision should close these items:

1. Decide whether `system.*` conditions remain out of scope for v1.0.
2. Decide whether visual coordinate placement is out of scope for v1.0.
3. Decide whether audio transitions remain design-only for v1.0 and update
   user-facing docs accordingly.
4. Decide whether editor / syntax highlighting is a v1.0 blocker or a
   post-v1.0 improvement.

Closed for v1.0: parser-only text features (`:meta`, page break, click wait,
rich inline text, inline waits, inline audio events) are not part of the v1.0
stable subset. They remain post-v1.0 design work.

## Recommended Issues

### 1. Design rich text and inline event support after v1.0

- Purpose: design text block controls and inline syntax without overpromising
  them in v1.0.
- Scope: renderer message model, text reveal timing, backlog representation,
  save/load interaction, inline audio events, `:meta`, blank-line click waits,
  `---` page breaks, `{text}`, `{delay}`, `{wait}`, inline `{se}`, and inline
  `{voice}`.
- Done when: each feature has a compiler/runtime design, renderer contract,
  compatibility notes, tests, and user docs before being promoted from
  parser-only.
- Suggested checks: `pnpm --filter @tsuzuru/core test`, `pnpm check`.
- Risk: making rich text stable too early can constrain renderer and adapter
  behavior.

### 2. Decide `system.*` condition support

- Purpose: clarify whether std-system unlock state can be used directly in
  `if` and conditional choices for v1.0.
- Scope: compiler validation, runtime condition resolver, docs, and examples.
- Done when: `if system.*` is either implemented with tests or documented as
  not v1.0 stable.
- Suggested checks: `pnpm --filter @tsuzuru/core test`,
  `pnpm --filter @tsuzuru/plugin-std-system test`.
- Risk: system state may require a renderer-neutral persistent-state boundary.

### 3. Decide visual coordinate placement scope

- Purpose: resolve the gap where `show asset at x=... y=...` parses but
  compiler rejects it.
- Scope: compiler support, std-visual metadata, renderer expectations, docs,
  and examples.
- Done when: coordinate placement is either stable with tests or marked
  explicitly out of v1.0.
- Suggested checks: `pnpm --filter @tsuzuru/core test`,
  `pnpm --filter @tsuzuru/plugin-std-visual test`.
- Risk: coordinate semantics can lock renderer coordinate systems too early.

### 4. Remove or implement audio transition syntax

- Purpose: align docs with implementation for `bgm ... with fadeIn(...)` and
  `stopBgm with fadeOut(...)`.
- Scope: parser/compiler/plugin tests if implemented, or user-facing docs if
  deferred.
- Done when: no current user-facing doc presents audio transitions as stable
  unless tests prove they compile and run.
- Suggested checks: `pnpm --filter @tsuzuru/core test`,
  `pnpm --filter @tsuzuru/plugin-std-audio test`.
- Risk: audio transition policy touches renderer/audio-layer behavior.

### 5. Scope editor and syntax highlighting for v1.0

- Purpose: decide whether `.tzr` editor support is required for v1.0.
- Scope: syntax grammar, VS Code extension decision, docs, and release gate
  classification.
- Done when: v1.0 docs say whether editor support is a blocker or post-v1.0.
- Suggested checks: docs-only `pnpm check`.
- Risk: adding editor tooling can expand release scope beyond runtime/package
  readiness.
