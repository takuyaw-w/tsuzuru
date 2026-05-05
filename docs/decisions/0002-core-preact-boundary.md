# 0002: Core and Preact Boundary

## Status

Accepted

## Context

Tsuzuru has two main packages:

```txt
@tsuzuru/core
@tsuzuru/preact
```

`@tsuzuru/core` owns the scenario model and runtime execution.

`@tsuzuru/preact` owns Preact-facing rendering and interaction helpers.

Because visual novel engines often mix script execution, rendering, UI state, effects, and storage into one layer, there is a risk that Tsuzuru's package boundary becomes unclear over time.

This decision defines where behavior belongs.

## Decision

Keep `@tsuzuru/core` independent from Preact, DOM, CSS, Vite, browser storage, and example-specific behavior.

Keep Preact-specific rendering, hooks, visible event handling, and user interaction wiring inside `@tsuzuru/preact`.

The boundary is:

```txt
@tsuzuru/core
  -> scenario execution

@tsuzuru/preact
  -> rendering adapter and user interaction wiring
```

## Core Responsibilities

`@tsuzuru/core` owns:

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
- runtime events
- choice resolution
- wait / waitClick / page / stop semantics
- runtime snapshot creation
- runtime restoration

Core is responsible for deciding what happens when the scenario advances.

## Core Non-Responsibilities

`@tsuzuru/core` must not own:

- Preact components
- Preact hooks
- JSX
- DOM access
- CSS
- browser events
- message window rendering
- choice button rendering
- localStorage access
- IndexedDB access
- Vite plugin behavior
- asset loading policy
- example-specific behavior

Core must remain usable without a browser UI.

## Preact Responsibilities

`@tsuzuru/preact` owns:

- `useRuntime`
- `RuntimeView`
- visible runtime event handling
- renderable event filtering
- transient event suppression
- auto-step behavior
- click-to-advance wiring
- choice selection wiring
- adapter-level save/load helpers
- view restoration helpers
- basic convenience rendering

Preact is responsible for helping a Preact application consume runtime events.

## Preact Non-Responsibilities

`@tsuzuru/preact` must not own:

- `.tzr` syntax
- parser behavior
- AST definitions
- compiler validation
- IR generation
- core command semantics
- condition evaluation
- jump behavior
- runtime stepping rules
- runtime state model decisions
- plugin command validation
- macro expansion
- DSL diagnostics

If behavior changes how a scenario executes, it belongs in `@tsuzuru/core`.

If behavior changes how a runtime event is displayed or interacted with, it belongs in `@tsuzuru/preact`.

## Data Flow

The intended flow is:

```txt
.tzr source
  -> parseTzr
  -> AST
  -> compileTzr
  -> CompiledTzrDocument
  -> createInitialRuntimeState
  -> stepRuntime
  -> RuntimeEvent
  -> useRuntime
  -> visibleEvent
  -> RuntimeView or userland UI
```

`@tsuzuru/preact` consumes compiled documents and runtime APIs from `@tsuzuru/core`.

`@tsuzuru/core` must not import from `@tsuzuru/preact`.

## Dependency Direction

Allowed:

```txt
@tsuzuru/preact
  -> @tsuzuru/core
```

Allowed:

```txt
examples/preact-basic
  -> @tsuzuru/preact
  -> @tsuzuru/core
```

Allowed:

```txt
examples/basic
  -> @tsuzuru/core
```

Not allowed:

```txt
@tsuzuru/core
  -> @tsuzuru/preact
```

Not allowed:

```txt
@tsuzuru/core
  -> DOM
```

Not allowed:

```txt
@tsuzuru/core
  -> Vite
```

Not allowed:

```txt
@tsuzuru/core
  -> examples
```

## Runtime Events as Boundary Objects

Runtime events are the primary boundary between core and UI.

Core emits events such as:

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
end
```

Preact decides how to expose, filter, preserve, and render those events.

Core should not know how those events are visually represented.

## Choice Handling

Core owns choice semantics.

Core should decide:

- when a choice is pending
- which choice items exist
- how choice targets resolve
- how `resolveChoice` updates runtime state

Preact owns choice interaction.

Preact should decide:

- how choices are displayed
- how clicks are wired
- how selected item indexes are passed to core
- how visible state changes after selection

## Click and Wait Handling

Core owns blocking semantics.

Core should decide:

- `@waitClick()` creates click waiting
- `@page()` creates click waiting
- `@wait(ms)` creates timed waiting
- `@stop()` stops execution
- when runtime is blocked

Preact owns UI continuation wiring.

Preact should decide:

- whether a message area click calls `continueClick`
- how wait state is represented in the UI
- whether timed wait is auto-cleared
- how visible events are preserved while transient events auto-step

## Save / Load Boundary

Core owns runtime snapshot primitives.

Core APIs:

```txt
createRuntimeSnapshot
restoreRuntimeState
```

Preact owns adapter-level view restoration.

Preact APIs may include:

```txt
createRuntimeSaveData
isRuntimeSaveData
restoreRuntimeSnapshotForView
```

Examples may use browser storage:

```txt
localStorage
```

Browser storage must not become a core dependency.

## Plugin Boundary

Plugin command validation belongs to `@tsuzuru/core`.

Runtime plugin command events may be handled by a host or UI layer.

Preact may provide a convenient way to react to plugin command events, but it must not decide whether a plugin command is valid DSL.

Compiler validation remains a core responsibility.

## Macro Boundary

Macro expansion belongs to `@tsuzuru/core`.

Preact must not expand macros.

Runtime must not receive macro instructions after successful compilation.

Macro expansion is part of the compile-time pipeline.

## Example Boundary

Examples may compose core and preact.

Examples may include:

- local scenario source
- minimal plugin commands
- minimal plugin handlers
- localStorage save/load demonstration
- simple UI layout

Examples must not become the place where core or preact package behavior is implemented.

If a behavior is useful to consumers generally, implement it in the appropriate package.

## Rationale

Keeping the boundary strict has several benefits:

- core remains testable without a browser
- runtime behavior remains deterministic
- Preact adapter remains replaceable
- other UI adapters can be added later
- parser and compiler remain independent of rendering
- save/load model is easier to reason about
- package APIs stay clearer
- examples remain small

This also protects future possibilities such as:

- a different UI adapter
- a non-Preact renderer
- a CLI compiler
- editor tooling
- static analysis
- Vite integration
- project scaffolding

## Consequences

### Positive

- clearer package ownership
- easier testing
- easier documentation
- fewer circular dependencies
- better long-term extensibility
- cleaner public APIs

### Negative

- some behavior requires coordination between core and preact
- adapter code must map runtime events carefully
- examples need to compose multiple package APIs
- some convenience features may require deliberate API design instead of quick UI-side hacks

## Common Placement Guide

Put this in `@tsuzuru/core`:

- parser bug fix
- compiler validation
- condition evaluation
- jump semantics
- choice semantics
- runtime state change
- runtime event shape
- snapshot shape
- macro expansion
- plugin command validation

Put this in `@tsuzuru/preact`:

- hook state management
- visible event preservation
- auto-step behavior
- click-to-advance wiring
- choice click handler
- default rendering
- save/load adapter for view state

Put this in examples:

- simple usage demonstration
- local scenario
- local plugin handler demo
- localStorage demo
- manual verification UI

Put this in docs:

- public behavior explanation
- architecture boundary explanation
- limitations
- quickstart
- examples of supported usage

## Anti-Patterns

Avoid these:

```txt
@tsuzuru/core imports Preact
```

```txt
@tsuzuru/core reads localStorage
```

```txt
@tsuzuru/preact parses .tzr syntax
```

```txt
RuntimeView implements scenario execution rules
```

```txt
examples contain core runtime fixes
```

```txt
plugin validation is moved into UI code
```

```txt
macro expansion is delayed until rendering
```

## Reconsideration Criteria

This decision may be reconsidered only if:

- there is a clear use case that cannot be solved with the current boundary
- tests remain simple
- package dependency direction remains acyclic
- core can still run without browser APIs
- public APIs remain understandable
- docs can explain the new model clearly

Even then, prefer adding explicit adapter APIs over weakening the core boundary.

## Related Documents

- `AGENTS.md`
- `docs/architecture.md`
- `docs/runtime.md`
- `docs/dsl.md`
- `docs/plugin-api.md`
- `docs/plans/legacy-dsl-cleanup.md`
- `docs/roadmap.md`
- `docs/decisions/0001-dsl-is-not-js.md`
