# Tsuzuru Architecture

> Status: partially historical. This document still contains legacy
> `parseTzr` / `compileTzr` and legacy AST references. The current supported DSL
> path is DSL v2 (`parseTzrV2` / `compileTzrV2`), and the cleanup result is tracked
> in [`plans/legacy-dsl-cleanup.md`](plans/legacy-dsl-cleanup.md).

This document describes the current architecture of Tsuzuru.

Tsuzuru is a web-first visual novel engine built around a constrained `.tzr` scenario DSL, a TypeScript core runtime, and a Preact adapter.

## Overview

The main pipeline is:

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

The core idea is:

```txt
Scenario files describe narrative flow.
Runtime behavior, rendering, plugins, and reusable logic belong in TypeScript.
```

`.tzr` files must not become arbitrary JavaScript or TypeScript execution environments.

## Packages

Current main packages:

```txt
packages/
  core/
  preact/

examples/
  basic/
  preact-basic/
```

Expected future package candidates:

```txt
packages/
  vite/
  create-tsuzuru/
```

Future packages should not be documented as implemented until they exist and work.

## Package Responsibilities

## `@tsuzuru/core`

`@tsuzuru/core` owns the engine model and execution logic.

Responsibilities:

- `.tzr` parser
- AST definitions
- compiler
- compiler diagnostics
- IR generation
- core command definitions
- command validation
- macro expansion
- plugin command registration and validation
- jump target validation
- condition evaluation
- runtime state
- runtime stepping
- choice resolution
- wait / waitClick / page / stop behavior
- runtime snapshot creation
- runtime restoration

`@tsuzuru/core` must not depend on:

- Preact
- DOM APIs
- CSS
- browser storage
- Vite-specific behavior
- example-specific behavior
- UI rendering logic

Core should remain usable as a standalone TypeScript package.

## `@tsuzuru/preact`

`@tsuzuru/preact` is the Preact adapter for Tsuzuru runtime.

Responsibilities:

- `useRuntime`
- `RuntimeView`
- renderable runtime event handling
- visible event handling
- transient event suppression
- auto-step behavior
- click-to-advance wiring
- choice selection wiring
- Preact-level save/load adapter utilities
- view restoration helpers

`@tsuzuru/preact` must not own:

- `.tzr` syntax
- parser behavior
- compiler validation
- IR generation
- runtime stepping semantics
- condition evaluation
- jump behavior
- core state model decisions

If behavior belongs to scenario execution, it belongs in `@tsuzuru/core`.

If behavior belongs to rendering or user interaction, it belongs in `@tsuzuru/preact`.

## Examples

Examples are integration checks and usage references.

Responsibilities:

- demonstrate current package APIs
- verify core and preact work together
- provide small executable scenarios
- show plugin command registration and handling
- show basic save/load usage
- provide clean commands for manual verification

Examples should not become:

- production game templates
- GUI editors
- full UI frameworks
- asset pipelines
- plugin marketplaces
- showcases for unimplemented roadmap features

## Scenario DSL Boundary

Scenario files use the `.tzr` extension.

The DSL currently supports:

```txt
#scene("id")
#label("id")

:: Speaker
Dialogue text

Narration text

@command(...)
$macro(...)

@if(...)
@else
@endif

? Question
- "Choice text" -> #target
```

DSL responsibilities:

- scenario structure
- narration
- dialogue
- choices
- jumps
- constrained conditionals
- command calls
- macro calls

DSL non-responsibilities:

- arbitrary JavaScript execution
- arbitrary TypeScript execution
- plugin definitions
- macro definitions
- UI implementation
- animation internals
- reusable procedure definitions
- hidden complex control flow

## Parser

The parser converts `.tzr` source into AST.

Input:

```txt
.tzr source
```

Output:

```txt
TzrDocument
```

Parser responsibilities:

- parse line-oriented scenario syntax
- group narration blocks
- group speaker blocks
- parse structure declarations
- parse command calls
- parse macro calls
- parse choice blocks
- parse conditional blocks
- attach source locations
- return parse diagnostics

Parser non-responsibilities:

- macro expansion
- plugin command validation
- same-file label validation
- cross-file existence checks
- runtime execution
- UI rendering

## AST

The AST represents parsed scenario source.

The AST should preserve:

- source structure
- source locations
- command arguments
- macro arguments
- choice targets
- condition source
- narration and dialogue text

The AST should not contain runtime-only state.

## Compiler

The compiler converts AST into compiled IR.

Input:

```txt
TzrDocument
```

Output:

```txt
CompiledTzrDocument
```

Compiler responsibilities:

- validate duplicate scene ids
- validate duplicate label ids
- validate same-file jump targets
- validate same-file choice targets
- validate invalid jump target formats
- validate core command arguments
- validate plugin command registration
- validate plugin command schemas
- validate plugin command arguments
- validate unknown non-core commands
- validate unknown macros
- expand macros
- reject unsafe macro expansion results
- produce executable IR
- produce compiler diagnostics

Compiler non-responsibilities:

- rendering UI
- managing browser events
- managing localStorage
- running timers
- resolving user choices at runtime
- executing arbitrary JavaScript from `.tzr`

## IR

IR is the compiled representation consumed by the runtime.

IR should be:

- explicit
- typed
- validated
- easier to execute than AST
- independent from Preact
- independent from DOM

Macro calls should not remain in runtime IR after successful compilation.

## Runtime

The runtime executes compiled IR.

Input:

```txt
CompiledTzrDocument
RuntimeState
```

Main operation:

```txt
stepRuntime(document, state)
```

Output:

```txt
RuntimeStepResult
```

Runtime responsibilities:

- execute instructions
- move the runtime pointer
- emit runtime events
- evaluate conditions
- update variables
- update flags
- handle jumps
- handle choices
- handle waits
- handle click waits
- handle stop state
- dispatch plugin commands
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

The host or UI layer is responsible for observing runtime events and deciding how to present them.

## Runtime Events

Runtime emits events such as:

```txt
scene
label
narration
dialogue
choice
jump
if
state
wait
waitClick
page
stop
pluginCommand
unsupported
error
end
```

Runtime events are the bridge between core execution and UI rendering.

The Preact adapter consumes runtime events and exposes view-oriented behavior.

## Runtime State

`RuntimeState` includes:

- current pointer
- variables
- flags
- active branch frames
- pending choice
- pending wait
- click-wait state
- stopped state

Runtime state should remain independent from UI component state.

## Save / Load Boundary

Core owns runtime snapshots.

Preact owns adapter-level view restoration helpers.

Examples may use `localStorage`, but browser storage is not a core responsibility.

Boundary:

```txt
@tsuzuru/core
  -> createRuntimeSnapshot
  -> restoreRuntimeState

@tsuzuru/preact
  -> createRuntimeSaveData
  -> isRuntimeSaveData
  -> restoreRuntimeSnapshotForView

examples
  -> localStorage
  -> buttons
  -> manual save/load flow
```

For v0.1, save data does not include scenario identity, scenario version, or migration metadata. Compatibility is not guaranteed if scenario documents, compiled instruction order, runtime state shape, or event shape change after saving.

## Plugin Commands

Plugins extend runtime behavior through registered command names.

Plugin command examples:

```txt
@bg("school_evening")
@bgm("daily")
@se("door")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
@transition("fade", duration=300)
@shake(target="screen", duration=300)
```

Plugin command flow:

```txt
.tzr command call
  -> parser records command
  -> compiler checks command registration
  -> compiler validates command arguments
  -> runtime emits or dispatches plugin command
  -> host / UI handles presentation behavior
```

Plugins should not own core flow control.

Core-owned commands include:

```txt
@jump(...)
@if(...)
@else
@endif
@set(...)
@inc(...)
@dec(...)
@flag(...)
@unflag(...)
@waitClick()
@page()
@stop()
@wait(...)
```

## Macros

Macros are compile-time shorthand.

Macro call example:

```txt
$enter("haruka", "smile", "center")
```

Macro flow:

```txt
.tzr macro call
  -> parser records macro call
  -> compiler looks up macro definition
  -> compiler expands macro
  -> compiler validates expanded instructions
  -> runtime receives normal IR
```

Macros should simplify repetitive presentation commands.

For v0.1, macros must not hide narrative structure.

Macro expansion should not generate:

- scenes
- labels
- conditionals
- choices
- macro instructions
- jumps

## Plugin vs Macro

Use a plugin command when behavior happens at runtime.

Use a macro when repetitive commands can be expanded at compile time.

```txt
plugin = runtime command extension
macro  = compile-time presentation shorthand
```

Do not use macros to hide branching, jumps, or choices.

Do not use plugins to redefine core execution semantics.

## Preact Adapter Flow

The Preact adapter wraps runtime execution for UI usage.

Typical flow:

```txt
CompiledTzrDocument
  -> useRuntime
  -> runtime state
  -> visibleEvent
  -> RuntimeView
  -> user click or choice
  -> continueClick / choose
  -> next runtime step
```

`RuntimeView` should remain a convenience component, not a full visual novel UI framework.

For v0.1, narration and dialogue may advance from message-area clicks, while `waitClick` and `page` continue through explicit continue-button wiring.

Advanced UI features should be implemented separately or by userland components.

## Example App Flow

The Preact example demonstrates:

```txt
scenario/main.tzr
  -> parseTzr
  -> compileTzr
  -> useRuntime
  -> RuntimeView
  -> Save / Load / Clear Save
```

The example may register simple plugin commands and handlers.

The example should remain small and easy to inspect.

## Dependency Direction

Allowed dependency direction:

```txt
examples/preact-basic
  -> @tsuzuru/preact
  -> @tsuzuru/core
```

```txt
examples/basic
  -> @tsuzuru/core
```

```txt
@tsuzuru/preact
  -> @tsuzuru/core
```

Not allowed:

```txt
@tsuzuru/core
  -> @tsuzuru/preact
```

```txt
@tsuzuru/core
  -> DOM
```

```txt
@tsuzuru/core
  -> Vite
```

```txt
@tsuzuru/core
  -> examples
```

## Current v0.1 Scope

v0.1 should focus on:

- `.tzr` parser
- compiler
- runtime
- same-file labels and jumps
- choices
- limited conditionals
- variables and flags
- text flow commands
- plugin command registration and validation
- macro expansion
- Preact adapter
- basic save/load
- executable examples
- manual setup using the examples as references
- accurate docs

## Explicit Non-Goals for v0.1

Do not include these unless explicitly re-scoped:

- GUI editor
- visual scripting editor
- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility
- arbitrary JavaScript in `.tzr`
- arbitrary TypeScript in `.tzr`
- `create-tsuzuru`
- `@tsuzuru/vite`
- Live2D
- Pixi integration
- advanced animation editor
- voice system
- backlog
- skip mode
- auto mode
- read tracking
- gallery
- achievements
- cloud save
- RPG systems
- battle systems

## Future Candidates

Possible post-v0.1 areas:

- cross-file jump existence validation
- `create-tsuzuru`
- `@tsuzuru/vite`
- backlog
- skip mode
- auto mode
- text speed settings
- ruby text
- variable interpolation
- multiple save slots
- config screen
- audio volume settings
- packaged plugin distribution
- VS Code extension
- syntax highlighting

Future candidates should remain documented as future work until implemented.

## Design Checklist

Before making architecture-affecting changes, check:

- Does this keep `.tzr` readable?
- Does this preserve static analyzability?
- Does this avoid arbitrary JavaScript execution?
- Does this preserve core / preact boundaries?
- Does this preserve plugin / macro boundaries?
- Does this require runtime state changes?
- Does this affect save/load compatibility?
- Does this affect public exports?
- Does this require docs updates?
- Does this require example updates?
- Does this require tests?

## Quality Gates

Common checks:

```sh
pnpm test
pnpm typecheck
```

Core checks:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/core build
```

Preact checks:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```

Example checks:

```sh
pnpm --filter @tsuzuru/example-basic build
pnpm --filter @tsuzuru/example-basic start
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

Run broader checks when changing public APIs, runtime semantics, DSL behavior, or example behavior.
