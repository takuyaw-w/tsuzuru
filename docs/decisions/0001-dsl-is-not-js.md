# 0001: `.tzr` is not JavaScript

## Status

Accepted

## Context

Tsuzuru uses `.tzr` files as scenario files for visual novels.

Scenario files need enough expressive power to describe:

- scenes
- labels
- narration
- dialogue
- choices
- jumps
- conditionals
- state changes
- runtime command calls
- macro calls

There is a strong temptation to allow arbitrary JavaScript or TypeScript expressions inside `.tzr` because it would make the DSL more flexible.

For example:

```txt
@set(name="score", value=Math.random())
@bg(name=`school_${time}`)
@if(calcSomething())
```

This would make small cases convenient, but it would also make scenario files harder to statically analyze and harder to maintain.

Tsuzuru's design goal is not to create another general-purpose scripting runtime.

## Decision

`.tzr` files must not support arbitrary JavaScript or TypeScript execution.

Scenario files describe narrative flow.

Runtime behavior, rendering, reusable logic, plugins, and macros belong in TypeScript.

The `.tzr` DSL should remain:

- readable
- constrained
- statically analyzable
- line-oriented where practical
- friendly to syntax highlighting
- independent from JavaScript execution semantics

## Allowed Direction

`.tzr` may support constrained values:

```txt
"string"
1
-1
1.5
true
false
identifier
```

`.tzr` may support constrained condition expressions such as:

```txt
flag("met_haruka")
!flag("met_haruka")
var("affection") >= 3
var("route") == "haruka"
```

If compound conditions are needed later, prefer explicit DSL functions:

```txt
@if(all(flag("met_haruka"), var("affection") >= 3))
@if(any(flag("route_a"), flag("route_b")))
```

Do not use JavaScript operators or arbitrary JavaScript function calls as the expression model.

## Disallowed Direction

Do not allow these in `.tzr`:

```txt
Math.random()
Date.now()
foo + bar
someFunction()
window.localStorage.getItem("x")
`template_${value}`
() => value
await something()
import(...)
```

Do not allow scenario-local JavaScript blocks.

Do not allow scenario-local TypeScript blocks.

Do not allow scenario-local macro definitions.

Do not allow plugin definitions inside `.tzr`.

## Rationale

Arbitrary JavaScript inside `.tzr` would weaken Tsuzuru's core design:

- parser behavior would become harder to reason about
- compiler validation would become weaker
- diagnostics would become less predictable
- save/load compatibility would become harder
- scenario files would become harder for non-engineers to read
- static analysis and future editor tooling would become harder
- scenario review would require understanding JavaScript side effects
- narrative flow could become hidden inside arbitrary code

Keeping `.tzr` constrained preserves the separation of responsibilities:

```txt
.tzr
  -> narrative flow

TypeScript plugins
  -> runtime behavior

TypeScript macros
  -> compile-time shorthand

Preact
  -> rendering and interaction
```

## Consequences

### Positive

- `.tzr` remains readable.
- compiler validation remains practical.
- diagnostics can point to DSL-level mistakes.
- future syntax highlighting and editor tooling become easier.
- scenario flow remains inspectable.
- runtime behavior stays predictable.
- plugin and macro APIs remain meaningful extension points.

### Negative

- some dynamic behavior requires TypeScript plugins or macros.
- scenario authors cannot freely compute values inline.
- complex condition logic may require future DSL design.
- engine developers must design explicit extension points instead of relying on JavaScript escape hatches.

## Impact on Plugins

Plugins are the correct place for runtime behavior.

Plugin commands may be called from `.tzr`:

```txt
@bg("school_evening")
@show(character="haruka", pose="smile", at="center")
@shake(target="screen", duration=300)
```

But plugin implementations must be written in TypeScript.

`.tzr` should only contain the command call, not the implementation.

## Impact on Macros

Macros are the correct place for compile-time shorthand.

Macro calls may be written in `.tzr`:

```txt
$enter("haruka", "smile", "center")
```

But macro definitions must be written in TypeScript.

`.tzr` should only contain the macro call, not the macro implementation.

For v0.1, macros must not hide narrative structure by generating:

- scenes
- labels
- conditionals
- choices
- jumps
- macro instructions

## Impact on Runtime

The runtime should execute compiled IR, not raw JavaScript embedded in scenario files.

Runtime state changes should happen through core-owned commands such as:

```txt
@set(...)
@inc(...)
@dec(...)
@flag(...)
@unflag(...)
```

Flow control should happen through core-owned constructs such as:

```txt
@jump(...)
@if(...)
@else
@endif
? Question
- "Choice" -> #target
```

## Impact on Documentation

Docs must not imply that `.tzr` supports arbitrary JavaScript or TypeScript.

When documenting examples, prefer DSL-native forms.

Good:

```txt
@if(var("affection") >= 3)
@jump("#haruka_route")
@endif
```

Bad:

```txt
@if(getAffection() >= calculateThreshold())
@jump(`#${routeName}`)
@endif
```

## Reconsideration Criteria

This decision may be reconsidered only if all of the following are true:

- the DSL remains statically analyzable
- diagnostics remain clear
- save/load behavior remains predictable
- the feature does not require executing arbitrary user code from `.tzr`
- the feature has a constrained grammar
- the feature can be tested thoroughly
- the feature does not undermine plugin or macro boundaries

Even then, prefer a constrained DSL construct over JavaScript execution.

## Related Documents

- `AGENTS.md`
- `docs/dsl.md`
- `docs/architecture.md`
- `docs/plugin-api.md`
- `docs/macro-api.md`
- `docs/runtime.md`
- `docs/roadmap.md`
