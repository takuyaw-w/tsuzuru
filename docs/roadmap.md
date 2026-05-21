# Tsuzuru Roadmap

> Status: partially historical. The old v0.1 scope sections are retained as
> pre-DSL-v2-cleanup history. Entries that mention old parser/compiler
> semantics, old DSL syntax, removed macro API, or removed example names are not
> current feature guidance. Use
> [`design/design/dsl-v2.md`](design/design/dsl-v2.md) and
> [`plans/legacy-dsl-cleanup.md`](plans/legacy-dsl-cleanup.md) for the current
> DSL direction.

This document defines Tsuzuru's product scope by milestone.

`TODOS.md` is the operational task list.  
This roadmap is the product and architecture scope boundary.

## Product Direction

Tsuzuru is a web-first visual novel engine built with TypeScript, Vite-oriented workflows, and a framework-neutral core. The official v0.x UI stack, templates, and examples focus on Preact-based JSX. Vue support is out of the initial scope and may be reconsidered later as an optional adapter.

The goal is not to clone KAG, TyranoScript, or Ren'Py.

Tsuzuru should provide:

- readable `.tzr` scenario files
- static validation
- predictable runtime behavior
- TypeScript-based plugins
- future TypeScript-based reusable extensions if macro support is reintroduced
- Preact-based UI customization
- static web app distribution

The guiding principle:

```txt
Keep the scenario readable.
Keep the runtime predictable.
Keep extension logic in TypeScript.
```

## v0.1 Goal

> Historical note: this v0.1 section describes the pre-DSL-v2-cleanup milestone.
> It is not the current supported DSL/API list.

The historical v0.1 goal was complete when a small visual novel could be written in `.tzr`, compiled by `@tsuzuru/core`, rendered by `@tsuzuru/preact`, and verified through examples.

This v0.1 scope has been completed and stabilization checks have passed. This marks the planned v0.1 scope as complete, but does not mean Tsuzuru is production ready or comparable to mature visual novel engines.

## Historical v0.1 Scope

The pre-cleanup v0.1 scope included:

- `.tzr` parser
- AST definitions
- compiler
- compiler diagnostics
- compiled IR
- same-file scene and label declarations
- same-file jump validation
- narration
- speaker dialogue
- choices
- limited conditionals
- variables
- flags
- core text flow commands
- runtime stepping
- runtime events
- choice resolution
- plugin command registration
- plugin command argument validation
- macro expansion
- macro safety validation
- runtime snapshot creation
- runtime restoration
- Preact adapter
- basic `RuntimeView`
- `useRuntime`
- visible event handling
- click-to-advance behavior
- choice selection behavior
- basic save/load adapter utilities
- `examples/basic`
- `examples/preact-basic`
- basic docs
- root README quickstart

## Historical v0.1 DSL Scope

The removed legacy `.tzr` DSL supported:

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

Supported jump target forms:

```txt
#label
file.tzr
file.tzr#label
```

Same-file labels are validated.

Cross-file target shape may be accepted, but cross-file existence validation is not required for v0.1 unless explicitly re-scoped.

## Historical v0.1 Core Commands

Core-owned commands include:

```txt
@jump(...)
@stop()
@wait(...)
@waitClick()
@page()
@set(...)
@inc(...)
@dec(...)
@flag(...)
@unflag(...)
```

Core-owned commands affect scenario flow, runtime state, save/load behavior, or execution control.

They should not be moved into plugin ownership.

## Historical v0.1 Plugin Scope

v0.1 plugins support command registration and validation.

Plugin commands may represent presentation behavior such as:

```txt
@bg("school_evening")
@bgm("daily")
@se("door")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
@transition("fade", duration=300)
@shake(target="screen", duration=300)
```

v0.1 plugin goals:

- register plugin-owned command names
- validate unknown command names
- validate plugin command schemas
- validate plugin command arguments
- dispatch plugin commands through runtime handlers

Plugins must not own core flow control.

## Historical v0.1 Macro Scope

The removed legacy macro API treated macros as compile-time presentation shorthand.

Macro calls use:

```txt
$enter("haruka", "smile", "center")
```

v0.1 macro goals:

- register macros in TypeScript
- expand macros during compilation
- remove macro calls from runtime IR
- validate expanded commands
- reject unsafe macro expansion results

For v0.1, macros must not generate:

- scenes
- labels
- conditionals
- choices
- macro instructions
- jumps

Macro argument schema validation is not required for v0.1 unless explicitly re-scoped.

## Historical v0.1 Preact Scope

`@tsuzuru/preact` should provide:

- `useRuntime`
- `RuntimeView`
- renderable event handling
- visible event handling
- auto-step behavior for transient events
- click-to-advance wiring
- choice selection wiring
- basic save/load adapter utilities
- restore helpers for runtime snapshots and visible events

`RuntimeView` should remain a convenience component.

It should not become a full game UI framework in v0.1.

## Historical v0.1 Example Scope

The removed legacy examples demonstrated the pre-cleanup architecture.

`examples/basic` should demonstrate core usage.

`examples/preact-basic` should demonstrate:

- parsing scenario source
- compiling scenario source
- registering plugin commands
- handling plugin command events
- rendering runtime events
- click-to-advance
- choices
- save
- load
- clear save

The example scenario should ideally include:

- narration
- dialogue
- choice
- jump
- if
- flag
- variable
- wait
- plugin command
- save/load-friendly flow

## Historical v0.1 Documentation Scope

v0.1 documentation should include:

- root README quickstart
- DSL documentation
- runtime documentation
- plugin API documentation
- macro API documentation
- architecture documentation
- example README files
- clear limitations

Documentation must describe current behavior accurately.

Do not document future features as implemented behavior.

## Explicit Non-Goals for v0.1

The following are not part of v0.1:

- GUI editor
- visual scripting editor
- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility
- arbitrary JavaScript inside `.tzr`
- arbitrary TypeScript inside `.tzr`
- scenario-local macro definitions
- complex expression language
- inline JavaScript expressions
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
- map systems
- battle systems
- multi-language translation workflow
- plugin marketplace
- packaged plugin distribution

These may be reconsidered later, but should not be introduced during v0.1 stabilization.

## Deferred from v0.1

The following can be deferred to post-v0.1 unless explicitly re-scoped:

- macro argument schema validation
- cross-file jump existence validation
- `create-tsuzuru`
- `@tsuzuru/vite`
- backlog
- skip mode
- auto mode
- read tracking
- text speed settings
- ruby text
- variable interpolation
- inline links
- multiple save slots
- config screen
- audio volume settings
- packaged plugin distribution
- VS Code extension
- syntax highlighting

## post-v0.1 Candidates

## Project Creation

Possible package:

```txt
create-tsuzuru
```

Potential scope:

- generate Vite + Preact project
- include sample `.tzr`
- include example plugin command setup
- include minimal save/load UI
- include TypeScript config
- include package scripts

This is not part of v0.1 unless explicitly re-scoped.

For v0.1, project creation is manual. Users should follow the root README quickstart or use `examples/preact-basic` as the current runnable Vite + Preact reference.

## Vite Integration

Possible package:

```txt
@tsuzuru/vite
```

This is not part of v0.1. For v0.1, Vite projects should load `.tzr` files with `?raw` or another host-owned file loading path and pass the source string to `parseTzr`, then compile it with `compileTzr`.

Potential scope:

- import `.tzr` files
- compile `.tzr` at build time
- provide diagnostics during development
- support hot reload for scenarios
- optionally expose raw source and compiled IR

This is not part of v0.1 unless explicitly re-scoped.

## Editor Support

Potential scope:

- syntax highlighting
- diagnostics
- snippets
- VS Code extension
- jump target navigation
- outline view

This should come after the DSL stabilizes.

## Runtime Features

Potential scope:

- backlog
- skip mode
- auto mode
- read tracking
- text speed settings
- multiple save slots
- config screen
- audio volume settings

These should not be implemented until the core runtime and save/load model are stable.

## Visual Features

Potential scope:

- richer transition system
- camera-like effects
- advanced character positioning
- voice playback
- Live2D
- Pixi integration

These should stay plugin-oriented where possible.

## Compatibility

Tsuzuru may borrow concepts from existing engines, but compatibility is not a near-term goal.

Not planned for v0.1:

- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility

If compatibility is ever considered, it should be treated as a separate adapter or migration tool, not as a constraint on core DSL design.

## Re-Scoping Rules

A post-v0.1 feature can move into v0.1 only if:

- it is explicitly requested
- it does not destabilize the DSL
- it does not violate architecture boundaries
- it can be tested
- it can be documented accurately
- it does not introduce large unrelated work
- it does not make `.tzr` a general-purpose scripting language

## Release Readiness

v0.1 readiness requires:

- `pnpm install` passes
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm --filter @tsuzuru/core build` passes
- `pnpm --filter @tsuzuru/preact build` passes
- `pnpm --filter @tsuzuru/example-preact-basic build` passes
- examples work from a clean checkout
- public exports are reviewed
- README quickstart is accurate
- docs match implementation
- limitations are explicit
- TODOs reflect actual status

As of the v0.1 final readiness review, these release-readiness checks have been completed for the planned v0.1 scope. Deferred post-v0.1 items remain intentionally unimplemented unless explicitly re-scoped.

## Roadmap Maintenance

Update this file when:

- v0.1 scope changes
- a feature is explicitly deferred
- a post-v0.1 feature becomes planned
- a package boundary changes
- a major architectural decision changes
- documentation starts implying a new capability

Do not use this file as a task checklist.

Use `TODOS.md` for operational task tracking.
