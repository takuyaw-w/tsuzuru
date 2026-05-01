# Tsuzuru DSL Skill

## Purpose

Use this skill when designing, reviewing, or modifying Tsuzuru's `.tzr` DSL.

The `.tzr` format is a constrained scenario DSL for visual novels. It describes narrative flow, not arbitrary program logic.

The DSL must remain readable, statically analyzable, and intentionally limited.

## Read First

Before editing DSL-related behavior, read:

1. `AGENTS.md`
2. `TODOS.md`
3. `docs/dsl.md`
4. `packages/core/src/ast.ts`
5. `packages/core/src/parser.ts`
6. `packages/core/src/compiler.ts`
7. `packages/core/src/ir.ts`
8. `packages/core/src/condition.ts`
9. Relevant parser / compiler tests under `packages/core/tests/`

## Scope

This skill applies to changes involving:

- `.tzr` syntax
- parser behavior
- AST shape
- compiler validation
- command syntax
- macro call syntax
- choice syntax
- jump target syntax
- condition syntax
- DSL diagnostics
- `docs/dsl.md`

## DSL Design Principle

Tsuzuru Script should be:

- ASCII-first
- readable as a scenario script
- line-oriented where practical
- easy to statically analyze
- friendly to syntax highlighting
- intentionally constrained
- independent from Markdown
- not JavaScript
- not TypeScript
- not KAG / KS compatible by default
- not TyranoScript compatible by default
- not Ren'Py compatible by default

The most important rule:

```txt
Scenario files describe narrative flow.
Runtime behavior, rendering, plugins, and reusable logic belong in TypeScript.
```

## Supported DSL Surface

The current DSL surface includes:

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

## Symbol Semantics

Use these symbols consistently:

| Symbol | Meaning |
|---|---|
| `#` | structural declaration |
| `::` | speaker block |
| `@` | runtime command |
| `$` | compile-time macro |
| `?` | choice block |
| `-` | choice item |
| `->` | transition target |

Do not introduce `[]` tag syntax.

## Parser Responsibilities

The parser should:

- be line-oriented where practical
- produce AST only
- record source locations
- parse directives
- parse narration and speaker blocks
- parse command and macro calls
- parse choice blocks
- parse conditional blocks
- return parse diagnostics for malformed syntax

The parser should not:

- execute runtime behavior
- validate plugin command existence
- expand macros
- validate same-file labels
- validate cross-file existence
- render UI
- access files
- depend on Preact or DOM

## Compiler Responsibilities

The compiler should:

- validate same-file structure
- validate duplicate scenes
- validate duplicate labels
- validate missing same-file jump targets
- validate missing same-file choice targets
- validate invalid jump target shape
- validate core command arguments
- validate plugin command registration
- validate plugin command arguments when schemas exist
- validate unknown non-core commands
- validate unknown macros
- expand macros
- reject forbidden macro expansion results
- generate IR

The compiler should not:

- render UI
- run Preact logic
- perform browser interaction
- execute arbitrary JavaScript from `.tzr`
- rely on raw string parsing after normalized compiler output exists

## Runtime Boundary

Runtime execution belongs to `@tsuzuru/core`, but syntax design must keep runtime predictable.

DSL changes must consider:

- runtime state shape
- save/load snapshot compatibility
- runtime event shape
- choice resolution
- wait / waitClick / page / stop behavior
- plugin command dispatch
- Preact adapter impact

## Allowed Value Types

Command and macro arguments should remain intentionally limited.

Currently supported value types:

```txt
"string"
1
-1
1.5
true
false
identifier
```

Do not allow arbitrary expressions such as:

```txt
Math.random()
foo + bar
`template_${value}`
someFunction()
window.localStorage.getItem("x")
```

## Runtime Commands

Runtime commands use `@name(...)`.

Examples:

```txt
@bg("school_evening")
@show(character="haruka", pose="smile", at=center)
@jump("#after_choice")
```

Unknown command names are not parse errors.

Unknown command names become compiler errors unless:

- they are core-owned commands
- or they are registered plugin commands

## Core-Owned Commands

Core-owned commands affect scenario flow, runtime state, save/load behavior, or execution control.

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

Do not move these into plugin ownership.

## Plugin-Owned Commands

Plugin commands may handle presentation behavior.

Examples:

```txt
@bg("school_evening")
@bgm("daily")
@se("door")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
@transition("fade", duration=300)
@shake(target="screen", duration=300)
```

Plugin commands must be registered and validated by the compiler.

Plugin commands should not own core flow control.

## Macro Calls

Macro calls use `$name(...)`.

Examples:

```txt
$enter("haruka", "smile", "center")
$exit("haruka")
$sceneChange("school_evening", "daily")
```

Macros are compile-time expansions.

Macro calls should not remain in runtime IR after compilation.

## Macro Safety Rules

Macros may simplify repetitive presentation commands.

For v0.1, macros must not hide narrative structure.

The compiler should reject macro expansion results that create:

- scene declarations
- label declarations
- conditional instructions
- choice instructions
- macro instructions
- `@jump` command instructions

Avoid allowing macros to generate:

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

## Conditional Syntax

Conditionals use:

```txt
@if(...)
@else
@endif
```

Supported condition expression forms should remain constrained.

Expected forms:

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

Do not add arbitrary JavaScript expression support.

Avoid adding `&&` and `||` in v0.1 unless explicitly required.

If compound conditions become necessary later, prefer explicit DSL functions:

```txt
@if(all(flag("met_haruka"), var("affection") >= 3))
@if(any(flag("route_a"), flag("route_b")))
```

## Jump Target Syntax

Supported target forms:

```txt
#label
file.tzr
file.tzr#label
```

Examples:

```txt
@jump("#after_choice")
@jump("chapter-01.tzr")
@jump("chapter-01.tzr#start")
```

Choice items use the same target rules:

```txt
? Where do you go?
- "Stay here" -> #stay
- "Go to classroom" -> chapter-01.tzr#classroom
```

Normalize jump targets into structured metadata during parsing or compilation.

Do not rely on raw string parsing beyond the compiler stage.

## Choice Syntax

Choices use:

```txt
? Question
- "Choice text" -> #target
```

Rules:

- choice item text must be a double-quoted string
- each choice item must have a transition target
- malformed choice items are parse errors
- same-file targets are compiler-validated
- choice rendering belongs to Preact
- choice resolution belongs to runtime

## Structure Declarations

Scenes and labels use function-like declarations:

```txt
#scene("prologue")
#label("after_choice")
```

Rules:

- ids must be string literals
- duplicate scene ids are compiler errors
- duplicate label ids are compiler errors
- `#scene` and `#label` should not be allowed inside `@if` branches
- labels are jump targets
- invalid same-file label references are compiler errors

## Dialogue and Narration

Speaker dialogue:

```txt
:: Haruka
You're late again.
```

Narration:

```txt
The classroom was unusually quiet.
```

Rules:

- `::` without a speaker name is invalid
- scenario text should remain readable without TypeScript knowledge
- plain non-empty lines become narration unless inside a speaker block
- blank lines separate blocks

## Diagnostics

Parse and compile diagnostics should include as much as possible:

- file path
- line number
- column number
- source line
- clear message
- suggestion when practical

Example:

```txt
scenario/main.tzr:24:8
Unknown label "#after_chioce".

Did you mean "#after_choice"?
```

## Documentation Rules

When DSL behavior changes, update `docs/dsl.md`.

If DSL behavior affects runtime, also check:

- `docs/runtime.md`
- `docs/plugin-api.md`
- `docs/macro-api.md`
- `docs/architecture.md`

Do not document unimplemented behavior as if it already works.

Clearly separate:

- implemented behavior
- v0.1 limitation
- post-v0.1 candidate

## Testing Requirements

When DSL syntax or validation changes, add or update tests.

Prioritize tests for:

- valid syntax
- invalid syntax
- source locations
- parse diagnostics
- compiler diagnostics
- duplicate labels
- missing labels
- invalid jump targets
- choice parsing
- condition parsing
- macro restrictions
- plugin command validation
- docs examples if practical

## Review Checklist

Before finalizing a DSL change, verify:

- Does this keep `.tzr` readable?
- Does this preserve static analyzability?
- Does this avoid arbitrary JavaScript execution?
- Does this preserve core / preact / plugin / macro boundaries?
- Does this require runtime state changes?
- Does this affect save/load compatibility?
- Does this affect public exports?
- Are tests updated?
- Is `docs/dsl.md` updated?

## Commands

Run focused checks first:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
```

When relevant, also run:

```sh
pnpm --filter @tsuzuru/core build
pnpm test
pnpm typecheck
```

If Preact behavior is affected, also run:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
```

## Completion Criteria

A task is complete only when:

- The DSL behavior is implemented or documented as a proposal.
- Parser / compiler tests are added or updated when behavior changes.
- Runtime tests are added or updated if execution behavior changes.
- `docs/dsl.md` is updated when syntax or semantics change.
- Related docs are updated when boundaries or behavior change.
- `pnpm --filter @tsuzuru/core test` passes.
- `pnpm --filter @tsuzuru/core typecheck` passes.
- Completed TODO items are checked in `TODOS.md`.
- The final report lists changed files, executed commands, results, and remaining concerns.

## Final Report Format

Use this format:

```txt
実施内容:
- ...

確認:
- pnpm --filter @tsuzuru/core test: pass
- pnpm --filter @tsuzuru/core typecheck: pass

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

Keep the report short.
