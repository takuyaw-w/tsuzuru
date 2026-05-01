# Tsuzuru Core Skill

## Purpose

Use this skill when working on `@tsuzuru/core`.

`@tsuzuru/core` owns Tsuzuru's DSL parser, AST, compiler, IR, runtime, command validation, macro expansion, plugin command registry, runtime state, and save/load primitives.

The core package must stay independent from Preact, DOM, Vite, and browser UI concerns.

## Read First

Before editing, read:

1. `AGENTS.md`
2. `TODOS.md`
3. `packages/core/package.json`
4. Relevant files under `packages/core/src/`
5. Relevant tests under `packages/core/tests/`
6. Relevant docs under `docs/`

## Scope

This skill applies to:

- `packages/core/src/ast.ts`
- `packages/core/src/parser.ts`
- `packages/core/src/compiler.ts`
- `packages/core/src/ir.ts`
- `packages/core/src/runtime.ts`
- `packages/core/src/condition.ts`
- `packages/core/src/macro.ts`
- `packages/core/src/commands.ts`
- `packages/core/src/diagnostic.ts`
- `packages/core/src/index.ts`
- `packages/core/tests/`

## Core Responsibilities

`@tsuzuru/core` owns:

- `.tzr` parsing
- AST definitions
- compiler validation
- IR generation
- macro expansion
- plugin command definition and validation
- core command definitions
- jump target parsing and validation
- condition evaluation
- runtime stepping
- runtime state
- choice resolution
- wait / waitClick / page / stop behavior
- runtime snapshot creation
- runtime restoration
- save/load primitives

## Non-Responsibilities

Do not implement the following in core:

- Preact components
- DOM operations
- CSS
- visual layout
- message window rendering
- choice UI rendering
- browser event handlers
- localStorage access directly, unless explicitly designed as a core abstraction
- Vite-specific behavior
- example-specific behavior

## Design Rules

- `.tzr` is a constrained scenario DSL, not a JavaScript runtime.
- Scenario files describe narrative flow.
- Runtime behavior, rendering, plugins, and reusable logic belong in TypeScript.
- Validate as much as possible at compile time.
- Runtime should execute already-compiled IR.
- Keep public APIs explicit and typed.
- Prefer discriminated unions.
- Avoid hidden global mutable state.
- Avoid `any`.
- Avoid UI-driven changes to core data structures.
- Keep functions small and testable.

## DSL Safety Rules

Do not allow arbitrary JavaScript or TypeScript in `.tzr`.

Invalid examples:

```txt
@set(name="score", value=Math.random())
@bg(name=`school_${time}`)
@if(calcSomething())
```

Allowed value types should remain intentionally limited:

- string literals
- number literals
- boolean literals
- explicitly supported identifiers only when necessary

## Macro Rules

Macros are compile-time expansions.

Macros may simplify repetitive presentation commands.

For v0.1, macros must not hide narrative structure.

Avoid allowing macros to generate:

- `@if`
- `@else`
- `@endif`
- `@jump`
- `#scene`
- `#label`
- choices

Macro calls should not remain in runtime IR after compilation.

## Plugin Command Rules

Plugin commands extend runtime behavior, but they must not own core flow control.

Plugin-owned examples:

```txt
@bg("school_evening")
@bgm("daily")
@se("door")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
@transition("fade", duration=300)
@shake(target="screen", duration=300)
```

Core-owned commands:

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

Unknown commands should be compile-time errors unless registered as plugin commands.

## Runtime Rules

Runtime should:

- step through compiled IR
- emit runtime events
- update runtime state predictably
- handle choices through explicit choice resolution
- handle waits through explicit blocked states
- support snapshot and restore
- avoid direct UI assumptions

Runtime should not:

- render UI
- access DOM
- call Preact hooks
- depend on browser-specific APIs
- parse raw `.tzr` source during execution

## Error and Diagnostic Rules

Compiler diagnostics should include as much as possible:

- file path
- line number
- column number when available
- offending source line when available
- clear error message
- suggestion when practical

Example style:

```txt
scenario/main.tzr:24:8
Unknown label "#after_chioce".

Did you mean "#after_choice"?
```

## Testing Requirements

When behavior changes, add or update tests.

Prioritize tests for:

- parser behavior
- compiler validation
- invalid DSL diagnostics
- macro expansion
- plugin command validation
- jump target validation
- condition evaluation
- runtime stepping
- choice resolution
- wait / waitClick / page / stop behavior
- snapshot / restore

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

## Completion Criteria

A task is complete only when:

- The requested behavior is implemented.
- Relevant tests are added or updated.
- `pnpm --filter @tsuzuru/core test` passes.
- `pnpm --filter @tsuzuru/core typecheck` passes.
- Public API changes are reflected in `packages/core/src/index.ts`.
- Public behavior changes are reflected in docs.
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
