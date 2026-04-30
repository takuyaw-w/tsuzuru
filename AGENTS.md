## Core Product Concept

Tsuzuru is a web-first visual novel engine.

It should allow creators to:

- Start a project with `npm create tsuzuru`
- Write scenarios in readable `.tzr` files
- Build and distribute games as static web apps
- Customize UI with Preact
- Extend behavior with TypeScript plugins
- Define reusable macros in TypeScript
- Avoid writing JavaScript or TypeScript directly inside scenario files

The scenario DSL should describe the story flow, not become a general-purpose programming language.

## Design Philosophy

The most important design rule:

> Scenario files describe narrative flow.
> Runtime behavior, rendering, and reusable logic belong in TypeScript.

Do not let `.tzr` files become a dumping ground for:

- arbitrary JavaScript
- complex logic
- UI implementation
- animation internals
- plugin definitions
- large reusable procedures
- hidden control flow

Tsuzuru should take inspiration from KAG/KS, but must avoid excessive freedom and unreadable tag-heavy scripts.

## Target Users

Primary users:

- Web developers who want to create visual novels
- TypeScript/Vite users
- Indie game creators comfortable with npm-based workflows
- Small teams separating scenario writing from engine/plugin development

Non-primary users:

- Users expecting a no-code GUI editor
- Users requiring full TyranoScript/KAG/Ren'Py compatibility
- Users building RPGs, action games, or complex simulation systems
- Users expecting arbitrary scripting inside scenario files

## Technical Stack

Expected stack:

- TypeScript
- Vite
- Preact
- ESM
- Browser-first runtime
- LocalStorage-based save system for v0.1

Preferred package structure:

```txt
packages/
  core/
  preact/
  vite/
  create-tsuzuru/

examples/
  basic/
```

Expected package names:

```txt
@tsuzuru/core
@tsuzuru/preact
@tsuzuru/vite
create-tsuzuru
```

## Scenario DSL Principles

Tsuzuru Script should be:

- ASCII-first
- readable as a script
- line-oriented where possible
- easy to statically analyze
- friendly to syntax highlighting
- not fully JavaScript
- not Markdown-dependent
- not compatible with KAG/KS by default
- intentionally constrained

Scenario files should use `.tzr`.

Example:

```txt
#scene("prologue")

@bg("school_evening")
@bgm("daily")

The classroom was unusually quiet.

:: Haruka
You're late again.

:: Yu
I made it, so it's fine.

$enter("haruka", "smile", "center")

? What do you do?
- "Apologize" -> #apologize
- "Make a joke" -> #joke

#label("apologize")

:: Yu
Sorry. I'll come earlier tomorrow.

@inc(name="haruka_affection", by=1)
@jump("#after_choice")

#label("joke")

:: Yu
This was a perfectly calculated arrival.

@dec(name="haruka_affection", by=1)
@jump("#after_choice")

#label("after_choice")

@if(var("haruka_affection") >= 1)
:: Haruka
At least you apologized.
@else
:: Haruka
You never change.
@endif
```

## DSL Symbol Semantics

Use the following symbol roles consistently.

```txt
#scene(...)    Structure declaration
#label(...)    Jump target declaration

:: Speaker     Speaker block

@command(...)  Runtime command
$macro(...)    Compile-time macro

@if(...)       Conditional block
@else          Conditional else
@endif         Conditional end

? Question     Choice block
- "Text" -> target
```

Meaning:

| Symbol | Meaning |
|---|---|
| `#` | structural declaration |
| `::` | speaker block |
| `@` | runtime command |
| `$` | compile-time macro |
| `?` | choice |
| `-` | choice item |
| `->` | choice transition |

Do not use `[]` tag syntax.

## Structure Declarations

Use function-like declarations:

```txt
#scene("prologue")
#label("start")
```

`#scene(...)` defines a scene unit.

`#label(...)` defines a jumpable location.

Labels should be statically checked.

Invalid jump targets should produce compile-time errors.

## Dialogue

Speaker dialogue:

```txt
:: Haruka
You're late again.
```

Narration:

```txt
The classroom was unusually quiet.
```

Scenario text should remain readable without requiring knowledge of TypeScript.

## Runtime Commands

Runtime commands use `@`.

Examples:

```txt
@bg("school_evening")
@bgm("daily")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
@inc(name="haruka_affection", by=1)
@dec(name="haruka_affection", by=1)
@set(name="route", value="haruka")
@flag("met_haruka")
@unflag("met_haruka")
@jump("#after_choice")
@jump("chapter-01.tzr#start")
```

`@command(...)` is not JavaScript execution.

It is a parsed DSL command.

Do not allow:

```txt
@set(name="score", value=Math.random())
@bg(name=`school_${time}`)
@if(calcSomething())
```

Allowed values should initially be limited to:

- string literals
- numbers
- booleans
- simple identifiers if explicitly supported

## Macro Calls

Macros use `$`.

Examples:

```txt
$enter("haruka", "smile", "center")
$exit("haruka")
$sceneChange("school_evening", "daily")
```

Macros are compile-time expansions.

A macro call should not remain in the runtime IR after compilation.

Macro definitions must be written in TypeScript, not inside `.tzr` files.

Example TypeScript macro concept:

```ts
defineMacro({
  name: "enter",
  args: ["character", "pose", "at"],
  expand({ character, pose, at }) {
    return [
      command("show", { character, pose, at }),
      command("transition", { name: "fadeIn", duration: 300 }),
    ];
  },
});
```

Macros should be used to reduce repetitive presentation commands.

For v0.1, macros should not generate hidden control flow.

Avoid allowing macros to generate:

- `@if`
- `@else`
- `@endif`
- `@jump`
- `#scene`
- `#label`
- choices

Reason:

> Macros should simplify presentation, not hide narrative structure.

## Plugin Commands

Plugins extend runtime behavior.

Examples of plugin-owned commands:

```txt
@bg("school_evening")
@bgm("daily")
@se("door")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
@transition("fade", duration=300)
@shake(target="screen", duration=300)
```

Plugin commands must be registered and validated.

Unknown commands should be compile-time errors.

Plugin commands should not own core flow control.

## Core Commands

The following should be core-owned, not plugin-owned:

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

Reason:

These commands affect scenario flow, runtime state, save/load behavior, or execution control.

## Jump Targets

Support same-file and cross-file jumps.

Recommended forms:

```txt
@jump("#label")
@jump("chapter-01.tzr")
@jump("chapter-01.tzr#label")
```

Choices should use the same target format:

```txt
? Where do you go?
- "Stay here" -> #stay
- "Go to classroom" -> chapter-01.tzr#classroom
```

Internally, normalize jump targets into a structured representation:

```ts
{
  file?: string;
  label?: string;
}
```

Do not rely on raw string parsing beyond the compiler stage.

## Choice Syntax

Use:

```txt
? What do you do?
- "Apologize" -> #apologize
- "Make a joke" -> #joke
```

Choices are core DSL features.

Choice rendering belongs to the Preact UI layer.

Choice resolution belongs to the runtime.

## Conditional Branching

Conditionals are required.

Use:

```txt
@if(flag("met_haruka"))
:: Haruka
We meet again.
@else
:: Haruka
Nice to meet you.
@endif
```

Variable comparisons:

```txt
@if(var("haruka_affection") >= 3)
@jump("#haruka_route")
@else
@jump("#common_route")
@endif
```

The conditional expression language must be limited.

Do not execute JavaScript.

Initial supported condition forms:

```txt
flag("name")
!flag("name")
var("name") == value
var("name") != value
var("name") >= number
var("name") <= number
var("name") > number
var("name") < number
```

Avoid adding `&&` and `||` in v0.1 unless necessary.

If needed later, prefer explicit forms:

```txt
@if(all(flag("met_haruka"), var("affection") >= 3))
@if(any(flag("route_a"), flag("route_b")))
```

## Click Waiting and Text Flow

Click waiting is required.

Support:

```txt
@waitClick()
@page()
@stop()
@wait(500)
```

Semantics:

| Command | Meaning |
|---|---|
| `@waitClick()` | wait for user click while keeping current message |
| `@page()` | wait for user click, then clear message/page |
| `@stop()` | stop scenario execution until resumed externally |
| `@wait(ms)` | wait for a fixed duration |

Text display should have sensible defaults.

Recommended default:

```ts
text: {
  defaultAdvance: "page"
}
```

Possible values:

```txt
none
waitClick
page
```

For v0.1, default to `page`.

This allows normal dialogue to be written without explicit `@page()` after every line.

## Save and Load

v0.1 should support minimal save/load.

Save data should include:

- current file
- current scene
- current label or instruction pointer
- runtime variables
- flags
- visible presentation state if necessary
- call stack only if `@call` is introduced later

Use LocalStorage for v0.1.

Avoid complex save slots initially.

## Features to Avoid in v0.1

Do not implement these in v0.1 unless explicitly required:

- GUI editor
- visual scripting editor
- TyranoScript compatibility
- KAG/KS compatibility
- Ren'Py compatibility
- arbitrary JS/TS in `.tzr`
- scenario-local macro definitions
- complex expression language
- inline JavaScript
- Live2D
- Pixi integration
- advanced animation editor
- voice system
- backlog
- skip/auto mode
- read tracking
- gallery
- achievements
- cloud save
- multi-language translation workflow
- RPG/map/battle systems

## Possible v0.2 Features

Candidates for later versions:

```txt
@call("common.tzr#routine")
@return()
```

Also consider later:

- backlog
- auto mode
- skip mode
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

## Architecture Boundaries

Core owns:

- parser
- AST
- compiler
- macro expansion
- IR
- runtime
- state
- save/load
- choices
- labels
- jumps
- conditionals
- command dispatch
- plugin registry

Preact layer owns:

- rendering
- message window
- choice UI
- menus
- save/load screens
- layout
- theme
- component replacement

Plugins own:

- background display
- character display
- BGM
- SE
- transition
- shake
- camera-like effects
- custom presentation behavior
- optional external integrations

Macros own:

- compile-time expansion of repetitive DSL patterns
- shorthand for common presentation sequences

## Implementation Priorities

Recommended order:

1. Define AST types
2. Define IR types
3. Define runtime state model
4. Define `.tzr` parser
5. Implement `#scene(...)` and `#label(...)`
6. Implement dialogue and narration
7. Implement `@jump(...)`
8. Implement cross-file jump target parsing
9. Implement choices
10. Implement limited `@if(...)`
11. Implement variables and flags
12. Implement text flow commands
13. Implement macro expansion
14. Implement plugin command registry
15. Implement basic Preact renderer
16. Implement LocalStorage save/load
17. Build `examples/basic`
18. Build `create-tsuzuru`

Do not start from UI first.

The core model and DSL compiler should be designed before the Preact UI becomes complex.

## Parser and Compiler Requirements

The compiler should validate:

- unknown commands
- unknown macros
- invalid macro arguments
- invalid command arguments
- duplicate labels
- missing jump targets
- malformed choice blocks
- invalid condition syntax
- invalid cross-file references
- labels declared inside invalid positions if restricted
- unsupported value types

Compiler errors should include:

- file path
- line number
- column if possible
- offending source line
- clear message

Example:

```txt
scenario/main.tzr:24:8
Unknown label "#after_chioce".

Did you mean "#after_choice"?
```

## Coding Guidelines

Use TypeScript strictly.

Prefer:

- explicit types
- discriminated unions
- immutable data where practical
- small modules
- testable parser/compiler functions
- no hidden global mutable state
- no direct DOM dependency in core
- no Preact dependency in core

Avoid:

- `any`
- runtime-only validation when compile-time validation is possible
- plugin APIs that mutate internals freely
- scenario execution logic inside UI components
- parsing with fragile ad-hoc string splits once grammar becomes non-trivial

## Testing Policy

Prioritize tests for:

- parser
- macro expansion
- jump target resolution
- condition evaluation
- runtime stepping
- save/load serialization
- invalid DSL diagnostics

Example test areas:

```txt
#scene parsing
#label parsing
speaker block parsing
choice parsing
@jump("#label")
@jump("file.tzr#label")
@if(flag("x"))
@if(var("x") >= 1)
$macro(...) expansion
unknown command error
unknown macro error
duplicate label error
missing label error
```

## Documentation Requirements

Maintain docs for:

```txt
docs/
  concept.md
  dsl.md
  runtime.md
  plugin-api.md
  macro-api.md
  architecture.md
```

`docs/dsl.md` should be treated as the source of truth for `.tzr` syntax.

Keep examples small and executable.

## Product Direction

Tsuzuru should not become a clone of KAG/KS, TyranoScript, or Ren'Py.

It should borrow useful concepts:

- scenario files
- labels
- jumps
- choices
- click waiting
- reusable commands
- macros

But it should keep a modern TypeScript architecture:

- typed plugins
- typed macros
- static validation
- Vite-first development
- Preact-rendered UI
- web-first distribution

The guiding principle:

> Keep the scenario readable.
> Keep the runtime predictable.
> Keep extension logic in TypeScript.
