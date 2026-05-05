# 0003: Macro vs Plugin

## Status

Accepted

## Context

Tsuzuru has two extension mechanisms:

```txt
plugin
macro
```

Both can reduce the amount of syntax users write in `.tzr`, and both can involve TypeScript code.

Because of that, they are easy to confuse.

For example, the following scenario-level call could be interpreted in two different ways:

```txt
$enter("haruka", "smile", "center")
```

It might mean:

- expand into several presentation commands at compile time
- or execute custom runtime behavior

Tsuzuru needs a clear boundary so that scenario files stay readable and runtime behavior stays predictable.

## Decision

Use plugins for runtime command extension.

Use macros for compile-time presentation shorthand.

The boundary is:

```txt
plugin = runtime command extension
macro  = compile-time presentation shorthand
```

A plugin command remains meaningful at runtime.

A macro call should disappear before runtime.

## Plugin Definition

A plugin extends Tsuzuru by registering runtime command names that may appear in `.tzr`.

Example plugin-owned commands:

```txt
@bg("school_evening")
@bgm("daily")
@se("door")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
@transition("fade", duration=300)
@shake(target="screen", duration=300)
```

Plugin commands are validated by the compiler and handled by runtime handlers or UI layers.

## Macro Definition

A macro is a compile-time shorthand written in TypeScript and called from `.tzr`.

Example macro call:

```txt
$enter("haruka", "smile", "center")
```

A macro may expand into ordinary instructions, typically presentation-oriented commands.

For example, `$enter(...)` may expand into commands like:

```txt
@show(...)
@transition(...)
```

After successful compilation, the runtime should not receive macro instructions.

## Processing Flow

Plugin flow:

```txt
.tzr @command(...)
  -> parser records CommandStatement
  -> compiler validates command registration
  -> compiler validates command arguments
  -> IR contains CommandInstruction
  -> runtime dispatches command
  -> host or UI handles runtime behavior
```

Macro flow:

```txt
.tzr $macro(...)
  -> parser records MacroStatement
  -> compiler finds macro definition
  -> compiler expands macro
  -> compiler validates expanded instructions
  -> IR contains expanded instructions
  -> runtime receives no macro call
```

## When to Use a Plugin

Use a plugin when the behavior happens at runtime.

Good plugin use cases:

- change background
- play BGM
- play sound effect
- show character
- hide character
- run transition
- shake screen
- perform camera-like effect
- trigger host/UI presentation behavior
- integrate with rendering-specific systems

A plugin is appropriate when:

- a runtime event is needed
- UI or host code must react
- the command represents presentation or runtime behavior
- behavior depends on runtime state
- behavior cannot be represented as static expansion

## When Not to Use a Plugin

Do not use a plugin when:

- the goal is only to reduce repetitive command sequences
- the behavior can be fully expanded at compile time
- the command should not exist at runtime
- the feature would redefine core flow control
- the feature belongs to the core runtime

Do not use plugins to override core-owned commands.

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

## When to Use a Macro

Use a macro when the behavior is compile-time shorthand.

Good macro use cases:

- repeated character entrance sequence
- repeated character exit sequence
- background and BGM setup sequence
- common presentation command bundle
- small shorthand for multiple validated commands

A macro is appropriate when:

- expansion is deterministic
- runtime macro identity is unnecessary
- the output can be ordinary IR instructions
- the macro does not hide narrative flow
- the scenario remains readable after understanding the shorthand

## When Not to Use a Macro

Do not use a macro when:

- the behavior requires runtime interaction
- the behavior depends on runtime state
- the behavior should emit a distinct runtime event
- the behavior needs host/UI callback handling
- the macro would generate narrative control flow
- the macro would make scenario flow harder to inspect

For v0.1, macros must not generate:

```txt
@if(...)
@else
@endif
@jump(...)
#scene(...)
#label(...)
? Question
- "Choice" -> #target
```

Macros must not generate:

- scene instructions
- label instructions
- conditional instructions
- choice instructions
- macro instructions
- jump command instructions

## Narrative Flow Rule

Macros must not hide narrative structure.

This is allowed:

```txt
$enter("haruka", "smile", "center")
```

if it expands into presentation commands such as:

```txt
@show(character="haruka", pose="smile", at="center")
@transition("fade", duration=300)
```

This is not allowed:

```txt
$routeToBestEnding()
```

if it expands into:

```txt
@if(var("affection") >= 5)
@jump("#good_ending")
@else
@jump("#normal_ending")
@endif
```

Branching and jumps should remain visible in `.tzr`.

## Runtime Predictability Rule

Runtime should execute compiled IR.

Runtime should not evaluate macro definitions.

Runtime should not receive macro calls.

If a macro instruction reaches runtime after successful compilation, that is a compiler pipeline bug.

## Validation Rule

Plugin commands and macro expansion results must both be validated by the compiler.

Plugin validation includes:

- unknown command detection
- registry key and definition name consistency
- schema definition validation
- argument kind validation
- argument count validation
- argument name validation
- argument value type validation

Macro validation includes:

- unknown macro detection
- expansion result validation
- forbidden instruction rejection
- validation of commands produced by macros

Commands produced by macros are not exempt from plugin or core command validation.

## TypeScript Boundary

Plugin implementations and macro definitions belong in TypeScript.

`.tzr` may call plugins and macros, but it must not define them.

Allowed in `.tzr`:

```txt
@show(character="haruka", pose="smile", at="center")
$enter("haruka", "smile", "center")
```

Not allowed in `.tzr`:

```txt
plugin show() {
  ...
}

macro enter() {
  ...
}
```

Not allowed:

```txt
@script(...)
@eval(...)
@js(...)
```

## Relationship to `.tzr`

`.tzr` should remain declarative.

It should contain:

- story structure
- dialogue
- narration
- choices
- visible control flow
- command calls
- macro calls

It should not contain:

- plugin implementations
- macro implementations
- arbitrary JavaScript
- arbitrary TypeScript
- hidden reusable procedures
- large invisible control flow

## Relationship to Core

Both plugin validation and macro expansion belong to `@tsuzuru/core`.

Core owns:

- plugin command registry
- plugin command validation
- macro registration
- macro expansion
- macro safety validation
- generated IR validation

Preact must not decide whether a plugin or macro is valid DSL.

## Relationship to Preact

Preact may handle plugin command runtime effects when the runtime emits plugin command events.

Preact must not:

- expand macros
- validate plugin command schemas
- define DSL validity
- own core command semantics

Preact may provide convenient UI behavior for runtime events.

## Examples

### Plugin Example

Scenario:

```txt
@bg("school_evening")
@show(character="haruka", pose="smile", at="center")
```

Interpretation:

- compiler verifies `bg` and `show` are registered plugin commands
- runtime dispatches plugin command events
- host/UI updates presentation state

### Macro Example

Scenario:

```txt
$enter("haruka", "smile", "center")
```

Expansion:

```txt
@show(character="haruka", pose="smile", at="center")
@transition("fade", duration=300)
```

Interpretation:

- compiler expands `$enter`
- compiler validates `show` and `transition`
- runtime never sees `$enter`

## Consequences

### Positive

- extension model remains clear
- runtime behavior remains predictable
- scenario flow remains readable
- macros stay safe and inspectable
- plugins remain meaningful runtime extension points
- compiler validation remains central
- Preact adapter remains replaceable

### Negative

- some conveniences require more explicit TypeScript definitions
- macro authors cannot generate arbitrary flow in v0.1
- plugin authors cannot redefine core commands
- users must understand the plugin/macro distinction

## Anti-Patterns

Avoid this:

```txt
A macro that generates @jump based on hidden logic.
```

Avoid this:

```txt
A plugin command that replaces @if behavior.
```

Avoid this:

```txt
A macro that remains as a runtime instruction.
```

Avoid this:

```txt
A Preact component that expands macros.
```

Avoid this:

```txt
A plugin command used only to shorten repeated static commands.
```

Use a macro for static shorthand.

Use a plugin for runtime behavior.

## Reconsideration Criteria

This decision may be reconsidered only if:

- runtime behavior remains predictable
- `.tzr` remains readable
- hidden narrative flow is still avoided
- compiler validation remains strong
- macro expansion remains inspectable
- plugin command ownership remains clear
- tests can cover the behavior
- documentation can explain the distinction clearly

Even then, prefer explicit DSL constructs over hidden macro control flow.

## Related Documents

- `AGENTS.md`
- `docs/architecture.md`
- `docs/dsl.md`
- `docs/plugin-api.md`
- `docs/plans/legacy-dsl-cleanup.md`
- `docs/runtime.md`
- `docs/roadmap.md`
- `docs/decisions/0001-dsl-is-not-js.md`
- `docs/decisions/0002-core-preact-boundary.md`
