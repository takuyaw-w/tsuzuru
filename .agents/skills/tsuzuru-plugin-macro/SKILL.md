# Tsuzuru Plugin / Macro Skill

## Purpose

Use this skill when working on Tsuzuru plugin commands or macros.

Plugins and macros are both extension mechanisms, but they have different responsibilities:

```txt
plugin = runtime command extension
macro  = compile-time presentation shorthand
```

Do not blur this boundary.

## Read First

Before editing plugin or macro behavior, read:

1. `AGENTS.md`
2. `TODOS.md`
3. `docs/plugin-api.md`
4. `docs/macro-api.md`
5. `docs/dsl.md`
6. `packages/core/src/compiler.ts`
7. `packages/core/src/macro.ts`
8. `packages/core/src/commands.ts`
9. `packages/core/src/ir.ts`
10. relevant tests under `packages/core/tests/`
11. examples that register plugin commands or macros

## Scope

This skill applies to:

- plugin command registration
- plugin command validation
- plugin command argument schemas
- plugin command runtime dispatch boundaries
- macro registration
- macro expansion
- macro safety validation
- macro-related compiler diagnostics
- plugin / macro docs
- plugin / macro tests
- examples that demonstrate plugin commands or macros

## Core Distinction

Plugins extend runtime behavior through registered command names.

Macros expand at compile time and should disappear from runtime IR.

Use this mental model:

```txt
.tzr
  -> parser
  -> AST with command and macro calls
  -> compiler
     -> validates plugin commands
     -> expands macros
     -> rejects unsafe macro results
  -> IR without macro calls
  -> runtime
     -> dispatches plugin command events
```

## Plugin Responsibilities

Plugin commands may own presentation-oriented runtime behavior.

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

Plugin command registration and argument validation belong to the compiler.

Plugin command handling at runtime may be implemented by runtime handlers or UI layers.

## Plugin Non-Responsibilities

Plugin commands must not own core flow control.

Keep these core-owned:

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

Do not let plugins override or redefine core command semantics.

Do not use plugin commands as a backdoor for arbitrary script execution.

## Plugin Registration Rules

Plugin commands should be registered through compiler options.

Registry keys must match command definition names.

Invalid example:

```ts
pluginCommands: {
  bg: { name: "show" },
}
```

This should be a compiler error.

A registered plugin command may define an argument schema.

Supported schema kinds:

```ts
{ kind: "none" }
{ kind: "positional", arguments: [...] }
{ kind: "named", arguments: [...] }
```

Supported value types:

```txt
string
number
boolean
identifier
```

## Plugin Argument Schema Rules

For positional schemas:

- required arguments come before optional arguments
- optional arguments after required arguments are allowed
- required arguments after optional arguments should be invalid
- too few arguments should be invalid
- too many arguments should be invalid
- named arguments should be invalid for positional schemas

For named schemas:

- duplicate schema argument names should be invalid
- missing required named arguments should be invalid
- unknown named arguments should be invalid
- duplicate call argument names should be invalid
- positional arguments should be invalid for named schemas

For `none` schemas:

- any supplied argument should be invalid

## Plugin Diagnostics

Plugin-related diagnostics should clearly identify:

- unknown command
- registry key / definition name mismatch
- invalid schema definition
- missing required argument
- unknown argument
- duplicate argument
- wrong argument kind
- wrong value type
- too many arguments
- too few arguments

Diagnostics should include source location when possible.

## Macro Responsibilities

Macros are compile-time presentation shorthand.

Examples:

```txt
$enter("haruka", "smile", "center")
$exit("haruka")
$sceneChange("school_evening", "daily")
```

Macros may reduce repetitive presentation commands.

Macros may return command instructions that are then validated normally by the compiler.

Macro calls should not remain in the compiled runtime IR.

## Macro Non-Responsibilities

Macros must not hide narrative structure in v0.1.

Macros should not generate:

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

Macros should not behave like functions inside `.tzr`.

Scenario files must not define macros.

Scenario files must not execute JavaScript or TypeScript through macros.

## Macro Expansion Rules

Macro expansion results must not include:

- `SceneInstruction`
- `LabelInstruction`
- `IfInstruction`
- `ChoiceInstruction`
- `MacroInstruction`
- `@jump` command instructions

The compiler should reject forbidden macro expansion results.

Commands returned by macros must still pass normal validation.

That means:

- core command argument validation still applies
- plugin command registration still applies
- plugin command argument schema validation still applies

## Macro Argument Rules

Macro calls currently expose parsed arguments to TypeScript macro implementations.

Macro argument schema validation is not implemented in v0.1.

Do not invent macro argument schema support unless the task explicitly requires it.

If macro argument validation is discussed, document it as post-v0.1 unless implementation is explicitly requested.

## Plugin vs Macro Decision Guide

Use a plugin command when:

- behavior happens at runtime
- the result should be a runtime event
- UI or runtime handler must react to the command
- the command maps to presentation behavior
- the command needs runtime state or rendering integration

Use a macro when:

- repetitive `.tzr` command sequences should be shortened
- expansion can happen at compile time
- no runtime macro identity is needed
- the macro does not hide narrative control flow
- the output can be represented as ordinary validated instructions

Do not use a macro when:

- the behavior requires runtime interaction
- the behavior should depend on runtime state
- the macro would generate jumps or choices
- the macro would make the scenario flow harder to read

Do not use a plugin when:

- the behavior is just compile-time shorthand
- the command should disappear before runtime
- the goal is to reduce repetitive command sequences

## Core Boundary

Plugin and macro systems belong to `@tsuzuru/core`.

Do not move plugin validation or macro expansion into `@tsuzuru/preact`.

Preact may handle plugin command runtime effects if the runtime emits plugin command events, but Preact should not decide whether a plugin command is valid DSL.

## DSL Boundary

The `.tzr` DSL may call plugins and macros.

The `.tzr` DSL must not:

- define plugins
- define macros
- execute arbitrary JavaScript
- contain TypeScript implementation logic
- hide large reusable procedures inside scenario files

## Runtime Boundary

Runtime may emit plugin command events.

Runtime should not receive macro instructions after compilation.

If a macro instruction reaches runtime, treat it as a compiler pipeline bug.

Runtime plugin handler missing behavior should be explicit and tested when changed.

## Documentation Rules

When plugin behavior changes, update:

- `docs/plugin-api.md`
- `docs/dsl.md` if syntax or command rules change
- `docs/runtime.md` if runtime dispatch behavior changes
- examples if public usage changes

When macro behavior changes, update:

- `docs/macro-api.md`
- `docs/dsl.md` if macro call syntax changes
- `docs/architecture.md` if pipeline behavior changes
- examples if public usage changes

Do not document plugin or macro future ideas as implemented behavior.

## Testing Requirements

Add or update tests when plugin or macro behavior changes.

Prioritize plugin tests for:

- unknown plugin command
- registered plugin command
- registry key / name mismatch
- schema kind `none`
- positional schema validation
- named schema validation
- duplicate named schema argument definitions
- optional positional argument ordering
- wrong value type
- duplicate call arguments
- unknown call arguments
- missing required arguments

Prioritize macro tests for:

- unknown macro
- successful macro expansion
- macro call removed from compiled IR
- macro expansion command validation
- macro expansion using plugin command validation
- forbidden `SceneInstruction`
- forbidden `LabelInstruction`
- forbidden `IfInstruction`
- forbidden `ChoiceInstruction`
- forbidden `MacroInstruction`
- forbidden `@jump`
- macro diagnostics source location

## Example Rules

Examples may use simple plugin commands or macros to demonstrate extension points.

Keep example plugin handlers minimal.

Keep example macros simple.

Do not build a large presentation engine inside examples.

Do not add macros that hide narrative flow.

## Review Checklist

Before finalizing plugin or macro work, verify:

- Is this runtime behavior or compile-time shorthand?
- Is plugin / macro responsibility clear?
- Are core commands still core-owned?
- Does `.tzr` remain declarative?
- Does this avoid arbitrary JavaScript execution in scenario files?
- Are unsafe macro expansion results rejected?
- Are plugin command schemas validated?
- Are diagnostics clear?
- Are tests updated?
- Are docs updated?
- Are examples updated if public usage changed?

## Commands

Focused core checks:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
```

If core source or public API changed:

```sh
pnpm --filter @tsuzuru/core build
```

If examples changed:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

Repository-level checks when public behavior changed:

```sh
pnpm test
pnpm typecheck
```

## Completion Criteria

A plugin or macro task is complete only when:

- plugin / macro boundaries remain clear
- requested behavior is implemented or documented as a decision
- relevant compiler tests are added or updated
- relevant runtime tests are added or updated if runtime dispatch changed
- docs are updated when public behavior changes
- examples are updated when public usage changes
- focused checks pass
- completed TODO items are checked in `TODOS.md`
- final report lists changed files, executed commands, results, and remaining concerns

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
