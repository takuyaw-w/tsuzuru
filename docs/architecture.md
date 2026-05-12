# Tsuzuru Architecture

This document describes the current Tsuzuru architecture.

Tsuzuru is a web-first visual novel engine built around:

- a constrained `.tzr` scenario DSL
- a TypeScript parser / compiler
- a browser-independent core runtime
- Preact integration packages
- Vue integration package
- standard visual / audio plugins
- a small runnable example

The current public parser/compiler API is:

```ts
import { parseTzr, compileTzr } from "@tsuzuru/core";
```

Legacy DSL support has been removed.

Do not treat the following as current architecture:

- `#scene(...)`
- `#label(...)`
- `:: Speaker`
- `@command(...)`
- `$macro(...)`
- `parseTzrV2`
- `compileTzrV2`
- legacy parser/compiler files
- macro expansion API
- deleted legacy examples

---

## Overview

The current pipeline is:

```txt
.tzr source
  -> parseTzr
  -> TzrDocument
  -> compileTzr
  -> CompiledTzrDocument
  -> RuntimeDocument / runtime IR
  -> RuntimeState
  -> RuntimeEvent
  -> Preact adapter / host app
  -> user UI
```

The guiding boundary is:

```txt
Scenario files describe narrative flow.
Runtime behavior, rendering, plugins, and reusable logic belong in TypeScript.
```

`.tzr` files must not become arbitrary JavaScript or TypeScript execution environments.

---

## Repository Structure

Current main packages:

```txt
packages/
  core/
  preact/
  vue/
  standard-ui-preact/
  plugin-std-visual/
  plugin-std-audio/
  plugin-std-text-sound/

examples/
  preact-basic/
  vue-basic/
```

Current design / planning docs:

```txt
docs/
  architecture.md
  dsl.md
  runtime.md
  plugin-api.md
  roadmap.md
  design/
    dsl-v2.md
  decisions/
  plans/
```

Current runnable examples:

```txt
examples/preact-basic
```

Future package candidates such as `@tsuzuru/vite` or `create-tsuzuru` must not be documented as implemented until they exist and work.

---

## Package Responsibilities

### `@tsuzuru/core`

`@tsuzuru/core` owns the scenario model, compiler, runtime IR, and execution semantics.

Responsibilities:

- `.tzr` parser
- scenario AST definitions
- compiler
- compiler diagnostics
- runtime document / IR definitions
- runtime state
- runtime stepping
- choice resolution
- conditional branch evaluation
- scene jump behavior
- command instruction dispatch
- runtime snapshot / restore
- plugin command infrastructure
- shared source-location and value primitives

`@tsuzuru/core` must not depend on:

- Preact
- DOM APIs
- CSS
- browser storage
- Vite-specific behavior
- application-specific assets
- example-specific behavior
- UI rendering logic

Core should remain usable as a standalone TypeScript package.

---

### `@tsuzuru/preact`

`@tsuzuru/preact` connects the core runtime to Preact.

Responsibilities:

- `useRuntime`
- `RuntimeView`
- runtime event handling for Preact consumers
- visible event management
- transient event stepping
- click-to-advance wiring
- choice selection wiring
- Preact-facing save/load adapter utilities
- view restoration helpers

`@tsuzuru/preact` must not own:

- `.tzr` syntax
- parser behavior
- compiler diagnostics
- IR generation
- runtime stepping semantics
- condition evaluation
- scene jump semantics
- core state model decisions

If behavior belongs to scenario execution, it belongs in `@tsuzuru/core`.

If behavior belongs to rendering or user interaction, it belongs in `@tsuzuru/preact` or userland UI.

### `@tsuzuru/vue`

`@tsuzuru/vue` connects the core runtime to Vue 3 Composition API.

Responsibilities:

- `useRuntime`
- `useTsuzuruRuntime`
- runtime event handling for Vue consumers
- visible event management
- transient event stepping
- click-to-advance wiring
- choice selection wiring
- Vue-facing save/load adapter utilities
- view restoration helpers

`@tsuzuru/vue` must not own:

- `.tzr` syntax
- parser behavior
- compiler diagnostics
- IR generation
- runtime stepping semantics
- condition evaluation
- scene jump semantics
- core state model decisions

There is no `@tsuzuru/standard-ui-vue` package yet. Vue UI layers currently live in `examples/vue-basic` or userland apps.

---

### `@tsuzuru/standard-ui-preact`

`@tsuzuru/standard-ui-preact` provides reusable Preact UI components.

Responsibilities:

- reusable visual novel UI components
- message layer components
- choice layer components
- viewport / shell style components
- standard UI building blocks

It must not own:

- parser behavior
- compiler behavior
- runtime stepping
- scenario semantics
- plugin state semantics

Standard UI components should be replaceable by userland components.

---

### `@tsuzuru/plugin-std-visual`

`@tsuzuru/plugin-std-visual` provides standard visual command handlers.

Responsibilities:

- maintain standard visual plugin state
- update background state
- update sprite state
- handle standard visual command instructions

It does not:

- render DOM / Canvas / WebGL
- resolve asset IDs to URLs
- load image assets
- own scene flow
- own runtime stepping

Asset resolution belongs to the app, renderer, or example.

---

### `@tsuzuru/plugin-std-audio`

`@tsuzuru/plugin-std-audio` provides standard audio command handlers.

Responsibilities:

- maintain standard audio plugin state
- update BGM state
- append SE events
- append voice events
- handle standard audio command instructions

It does not:

- create audio elements
- load audio files
- bundle audio assets
- stop or overlap real playback directly
- own scene flow
- own runtime stepping

Playback and asset resolution belong to the app, renderer, or example.

---

### `@tsuzuru/plugin-std-text-sound`

`@tsuzuru/plugin-std-text-sound` provides standard text blip sound state and command handlers.

Responsibilities:

- maintain standard text sound plugin state
- set or clear the current text sound asset ID
- handle standard text sound command instructions

It does not:

- create audio elements or audio contexts
- own text reveal timing
- resolve asset IDs to URLs or tone profiles
- own volume, interval, punctuation skip, or speaker mapping policy
- own scene flow
- own runtime stepping

Playback policy belongs to the app, renderer, or example.

---

### Examples

Examples are integration checks and usage references.

Current example:

```txt
examples/preact-basic
```

Example responsibilities:

- demonstrate current public APIs
- verify core, Preact, standard UI, and plugins can work together
- provide a small executable scenario
- show plugin command handling
- provide commands for manual verification

Examples should not become:

- production game templates
- full GUI editors
- asset pipelines
- plugin marketplaces
- showcases for unimplemented roadmap features

---

## Scenario DSL Boundary

Scenario files use the `.tzr` extension.

The current DSL is indentation-based and line-oriented.

Representative current syntax:

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

The DSL currently covers a practical runtime subset:

- title declaration
- character declaration
- scenes
- narration
- dialogue
- scene jumps
- choices
- conditional choices
- choice body execution
- `if` / `elif` / `else`
- `scenario.*` condition evaluation
- `set` for string / number / boolean / null values
- `set` from existing `scenario.*` variable references
- `add` for number values
- `wait 1000` timed wait authoring
- `end` / `stop`
- standard visual sugar:
  - `bg`
  - `show`
  - `hide`
- standard audio sugar:
  - `bgm`
  - `stopBgm`
  - `se`
  - `voice`

The DSL must not support arbitrary JavaScript or TypeScript execution.

---

## Current Non-Goals

Do not implement these unless explicitly requested:

- legacy DSL compatibility
- macro system
- preset / stage system
- scenario-local reusable procedures
- arbitrary JavaScript or TypeScript inside `.tzr`
- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility
- GUI editor
- visual scripting editor
- RPG/map/battle systems

Macro-like reusable staging may be reconsidered later as a constrained authoring feature, but it is not part of the current implementation.

---

## Parser

The parser converts `.tzr` source into `TzrDocument`.

Input:

```txt
.tzr source
```

Output:

```txt
TzrDocument
```

Parser responsibilities:

- parse top-level declarations
- parse scene blocks
- parse narration blocks
- parse dialogue blocks
- parse choices
- parse conditional branches
- parse state updates
- parse visual/audio sugar statements
- parse condition expressions
- attach source locations
- return parse diagnostics

Parser non-responsibilities:

- runtime execution
- compiler validation
- scene target existence validation
- plugin command execution
- rendering
- browser interaction
- asset loading

The parser should preserve source structure and source locations so compiler diagnostics can remain useful.

---

## Scenario AST

The scenario AST represents parsed authoring syntax.

Primary AST file:

```txt
packages/core/src/scenario-ast.ts
```

Shared source/value primitive file:

```txt
packages/core/src/ast.ts
```

The split is intentional:

- `scenario-ast.ts` owns scenario-specific AST nodes.
- `ast.ts` owns shared primitives such as source locations, text lines, and argument/value shapes.

The AST should preserve:

- top-level declarations
- scene bodies
- source locations
- dialogue and narration blocks
- choice bodies
- condition expressions
- visual/audio sugar statements
- state update statements

The AST should not contain runtime-only state.

---

## Compiler

The compiler converts `TzrDocument` into `CompiledTzrDocument`.

Input:

```txt
TzrDocument
```

Output:

```txt
CompiledTzrDocument
```

`CompiledTzrDocument` extends the runtime document shape and includes source and metadata useful to tooling and diagnostics.

Compiler responsibilities:

- validate duplicate titles
- validate duplicate characters
- validate duplicate scenes
- validate scene presence
- validate dialogue speakers
- validate scene jump targets
- validate supported condition expressions
- validate choice bodies
- compile narration to runtime instructions
- compile dialogue to runtime instructions
- compile scene jumps to `SceneJumpInstruction`
- compile choices to `BodyChoiceInstruction`
- compile `if` / `elif` / `else` to `IfInstruction`
- compile supported state updates to command instructions
- compile standard visual/audio sugar to command instructions
- produce compiler diagnostics

Compiler non-responsibilities:

- rendering
- browser events
- localStorage
- timers
- asset resolution
- actual plugin side effects
- user choice resolution at runtime
- arbitrary JavaScript execution

The compiler should reject unsupported authoring syntax rather than silently producing ambiguous runtime behavior.

---

## Runtime Document and IR

The runtime consumes a compiled instruction sequence.

Core IR types include:

- `RuntimeDocument`
- `CompiledTzrDocument`
- `TzrInstruction`
- `SceneInstruction`
- `NarrationInstruction`
- `DialogueInstruction`
- `SceneJumpInstruction`
- `BodyChoiceInstruction`
- `IfInstruction`
- `CommandInstruction`

IR should be:

- explicit
- typed
- stable enough for runtime execution
- easier to execute than AST
- independent from Preact
- independent from DOM
- independent from renderer implementation

Scene jumps are scene-based and resolve through `RuntimeDocument.scenes`.
Project compilation aggregates included scenes before runtime. Legacy
`#label(...)` syntax remains removed.

---

## Runtime

The runtime executes a compiled runtime document.

Input:

```txt
RuntimeDocument
RuntimeState
```

Main operation:

```txt
stepRuntime(document, state, options)
```

Output:

```txt
RuntimeStepResult
```

Runtime responsibilities:

- execute instructions
- move the runtime pointer
- emit runtime events
- evaluate conditional branches
- manage active branch frames
- manage pending choices
- resolve choices
- update runtime variables
- handle scene jumps
- dispatch plugin command instructions
- create snapshots
- restore snapshots

Runtime non-responsibilities:

- rendering
- DOM access
- Preact hooks
- CSS
- browser storage
- timers
- asset loading
- plugin lifecycle management
- UI layout decisions

The host or UI layer is responsible for observing runtime events and deciding how to present them.

---

## Runtime Events

Runtime events are the bridge between core execution and UI / host behavior.

Important event categories:

- scene events
- narration events
- dialogue events
- choice events
- choice resolution events
- scene jump events
- state events
- plugin command events
- stop events
- end events
- error / unsupported events

Some low-level runtime event types may exist before the current DSL authoring syntax exposes them fully. Do not treat every runtime event type as currently supported `.tzr` syntax.

---

## Runtime State

`RuntimeState` tracks execution state.

It includes:

- current pointer
- runtime variables
- active branch frames
- pending choices
- pending waits
- click-wait state
- stopped state
- plugin states

Runtime state must remain independent from UI component state.

Plugin state is stored under runtime plugin state, not in independent plugin-owned stores.

Scenario variables are the current state model. `RuntimeState.flags` and the low-level `inc` / `dec` / `flag` / `unflag` core command handlers are removed; `add` remains the supported numeric mutation command.

---

## Snapshot / Restore

Core owns runtime snapshots.

Core responsibilities:

- capture runtime state
- restore runtime state
- preserve plugin state
- deep clone instruction-bearing runtime structures where needed
- avoid restoring transient UI-only state

Preact responsibilities:

- adapt snapshots for view usage
- expose save/load helpers
- restore view-facing runtime state safely

Examples may use `localStorage`, but browser storage is not a core responsibility.

Compatibility is not guaranteed if scenario documents, compiled instruction order, runtime state shape, or event shape change after saving.

---

## Plugin Command Flow

Standard visual/audio DSL sugar compiles to runtime command instructions.

Flow:

```txt
.tzr visual/audio sugar
  -> parser statement
  -> compiler command instruction
  -> runtime dispatch
  -> plugin command handler
  -> runtime plugin state update
  -> renderer / app observes plugin state
  -> UI/audio presentation
```

Current implemented standard visual/audio sugar is intentionally renderer-independent.

The command handler updates runtime state. It does not render or load assets.

---

## Plugin Validation Policy

Plugin command validation has a minimal compiler foundation.

Plugins may expose command metadata through the same plugin definition object used for runtime state initialization. `compileTzr(document, { plugins })` or `compileTzr(document, { pluginCommands })` can then validate emitted plugin command names and basic argument shapes before runtime execution.

When validation metadata is present, every emitted non-core command is checked against that registry. Scenarios using std visual/audio commands must include the std plugin definitions at compile time. If no metadata is provided, std visual/audio sugar keeps the existing compatibility behavior and compiles without metadata validation.

`call namespace.command(...)` is the current custom plugin command authoring surface under metadata validation. It is not runtime call/return control flow.

The current validation scope is intentionally small:

- unknown plugin commands
- required / optional positional args
- required / optional named args
- unsupported named args
- basic string / number / boolean / identifier value types
- fixed allowed values such as std visual positions
- duplicate command metadata

Renderer-specific checks remain out of scope. Asset path resolution, asset file existence, playback behavior, and cross-command validation belong to apps, renderers, or future explicit design work.

---

## Preact Adapter Flow

The Preact adapter wraps runtime execution for UI usage.

Typical flow:

```txt
CompiledTzrDocument
  -> useRuntime
  -> runtime state
  -> visible event
  -> UI components
  -> user click / choice
  -> continue / choose
  -> next runtime step
```

`RuntimeView` should remain a convenience component, not a full visual novel UI framework.

Advanced game UI should be implemented with userland components or standard UI components, not by expanding core runtime responsibilities.

---

## Standard UI Flow

`@tsuzuru/standard-ui-preact` provides reusable UI components.

The standard UI package should:

- consume runtime-facing data
- render message and choice components
- provide layout primitives
- provide UI-level message presentation extension points
- remain replaceable
- avoid owning scenario semantics

The standard UI package should not:

- parse `.tzr`
- compile scenarios
- step runtime state
- mutate plugin state directly
- define DSL semantics

`MessageWindow` supports custom line rendering through `renderLine`, and
`RuntimeMessageLayer` can pass that renderer to narration and dialogue through
`renderMessageLine`. These hooks affect only message presentation; choices,
status events, runtime stepping, and scenario semantics stay unchanged.

`useTextReveal` is a standard UI hook for UI-level character reveal. A host can
use `onCharacterReveal` to trigger a pop sound or other presentation effect, but
actual audio playback, voice synchronization, and asset routing remain app or
plugin responsibilities. Rich text and inline event runtime support remain
deferred runtime/design topics.

`useTextReveal` exposes `isRevealing`, `isComplete`, `revealAll`, and `reset`
so UI code can coordinate message advance behavior. A common host policy is:
while `isRevealing` is true, click/Enter/Space calls `revealAll`; after the text
is complete, the same input advances the runtime. Core runtime is not involved
in text reveal timing.

---

## Example App Flow

`examples/preact-basic` demonstrates the current architecture in one runnable example.

It should show:

- current `.tzr` syntax
- `parseTzr`
- `compileTzr`
- runtime integration
- Preact integration
- standard visual/audio plugin handling
- placeholder visual/audio behavior without requiring real production assets

It should remain small and executable.

---

## Tooling

The repository uses pnpm workspaces.

Tooling versions are managed through `pnpm-workspace.yaml` catalog entries.

Current tooling includes:

- TypeScript
- Vitest
- Biome

Root scripts provide repository-level checks:

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm typecheck
pnpm --filter @tsuzuru/example-preact-basic build
```

Biome owns formatting, linting, and import organization.

Do not introduce ESLint or Prettier unless explicitly requested.

---

## Architecture Rules

### Keep Core Independent

Core must stay independent from rendering frameworks and browser APIs.

Allowed in core:

- pure TypeScript parser/compiler/runtime code
- runtime state and events
- plugin command dispatch infrastructure
- source locations and diagnostics

Not allowed in core:

- Preact components
- DOM access
- CSS
- localStorage
- asset loading
- app-specific rendering decisions

---

### Keep Scenario DSL Constrained

The DSL should remain readable and analyzable.

Do not add:

- arbitrary JS/TS execution
- hidden control flow through macros
- runtime-defined scenario syntax
- plugin-defined narrative flow control
- dynamic scene IDs
- broad expression language without explicit design

When in doubt, prefer explicit syntax and compile-time diagnostics.

---

### Keep Plugins Presentation-Focused

Plugins should extend runtime behavior through command handlers and plugin-owned state.

Plugins should not redefine:

- scene execution
- choice resolution
- branching semantics
- runtime pointer movement
- snapshot semantics
- compiler ownership of narrative structure

---

### Keep Examples Small

Examples should demonstrate supported behavior.

They should not become:

- full templates
- complex game projects
- asset-heavy showcases
- hidden integration test suites
- speculative roadmap demos

---

## Deferred Architecture Topics

The following topics are intentionally deferred:

- complex plugin command schemas
- broader `call` / `return` runtime semantics
- broader namespaced `wait` event semantics
- coordinate placement
- visual transition animation / renderer execution
- std system sugar
- rich text / inline event runtime
- persistent system state
- `system.*` runtime state references
- reusable staging / preset design
- macro-like authoring sugar

These should be handled as explicit design tasks, not incidental cleanup.

---

## Verification Guidance

For broad repository changes, run:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm typecheck
pnpm --filter @tsuzuru/example-preact-basic build
git diff --check
```

For package-focused work, run the relevant filtered checks first.

Examples:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/standard-ui-preact test
pnpm --filter @tsuzuru/plugin-std-visual test
pnpm --filter @tsuzuru/plugin-std-audio test
pnpm --filter @tsuzuru/plugin-std-text-sound test
```

If `rtk` is available, prefer equivalent `rtk` commands when they preserve the same verification intent and reduce output noise.

---

## Summary

Current Tsuzuru architecture is:

```txt
.tzr current DSL
  -> parseTzr
  -> TzrDocument
  -> compileTzr
  -> CompiledTzrDocument
  -> core runtime
  -> runtime events / plugin state
  -> Preact adapter and standard UI
  -> user-facing visual novel app
```

The architectural priority is:

```txt
Keep scenario syntax readable.
Keep runtime behavior predictable.
Keep rendering and assets outside core.
Keep extension logic in TypeScript.
```
