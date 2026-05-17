# Tsuzuru DSL

> Status: current DSL entry point.
> DSL v2 is the current supported DSL path. The old DSL parser/compiler,
> legacy AST, and macro API were removed. `parseTzr` / `compileTzr` now refer
> to the current DSL implementation.

This document is a short entry point for the currently supported `.tzr` syntax.
For the fuller design notes, see [`docs/design/dsl-v2.md`](design/dsl-v2.md).
For the v1.0 stable-scope planning matrix, see
[`docs/design/dsl-support-matrix.md`](design/dsl-support-matrix.md).
For runnable code, see [`examples/preact-basic`](../examples/preact-basic/).

## Current API

Use the current DSL APIs from `@tsuzuru/core`:

```ts
import { compileTzr, compileTzrProject, parseTzr } from "@tsuzuru/core";
```

No compatibility aliases for the transitional v2 API names are exported.
`compileTzrProject` compiles an in-memory set of `.tzr` documents. Core does
not read from the file system.

## Current Syntax Snapshot

DSL v2 uses line-oriented declarations and indented scene bodies:

```txt
character mio name="美緒"

scene start:
  bg station
  bgm daily_theme
  show mio_smile at center

  mio:
    遅いよ。

  choice "どうする？":
    "手帳を見る" if scenario.hasNotebook:
      jump notebook

    "立ち去る":
      jump leave

scene notebook:
  mio:
    ちゃんと持ってきたんだね。
  end

scene leave:
  hide mio
  stopBgm
  end
```

The currently implemented runnable subset covers:

- document metadata and character declarations
- `include "./path.tzr"` compile-time project directives
- `scene` bodies
- narration and dialogue
- `jump` to another scene in the same document
- cross-file `jump` targets when compiled with `compileTzrProject`
- body choices with optional conditions
- `if` / `elif` / `else`
- `set` and `add`
- `wait 1000` timed waits in milliseconds
- std visual sugar: `bg`, `show`, `hide`, `clear bg`, `clear sprites`
- std audio sugar: `bgm`, `stopBgm`, `se`, `voice`
- std effect, camera, particle, text sound, and system plugin commands in the
  ranges listed by the support matrix
- `end`

For v1.0 planning, the stable text authoring subset is plain narration,
dialogue shorthand, and `say` block text. Rich inline text markup, inline
delay/wait, inline `{se}` / `{voice}`, blank-line click waits, `---` page
breaks, and text block `:meta` are parser-only design syntax and are not part
of the v1.0 stable subset. Use statement-level plugin commands such as `se` and
`voice` instead of inline audio events.

Some design-level syntax in `docs/design/dsl-v2.md` may still be parser-only or
not implemented at runtime. Treat `examples/preact-basic` as the current
runnable reference, and use the support matrix to distinguish v1.0 stable
candidates from deferred syntax.

Current state authoring supports string, number, boolean, and `null` values:

```txt
set scenario.selectedItem = null
set scenario.name = "mio"
set scenario.currentSpeaker = scenario.name
add scenario.score += 1
```

`set scenario.b = scenario.a` copies an existing `scenario.*` runtime value at
execution time. Missing source values produce a runtime error event.
`system.*` state remains deferred and cannot be targeted or copied by `set`.
The core runtime emits wait events for `wait 1000`, but does not start browser
timers; hosts clear the wait after their own timer completes.
Visual transitions such as `bg station with fade(duration=300)` compile to
renderer-independent std-visual metadata. Core and std-visual do not run DOM,
CSS, or timer animations for transitions.

## Current Implementation Files

- Parser: [`packages/core/src/parser.ts`](../packages/core/src/parser.ts)
- Compiler: [`packages/core/src/compiler.ts`](../packages/core/src/compiler.ts)
- DSL AST: [`packages/core/src/scenario-ast.ts`](../packages/core/src/scenario-ast.ts)
- Shared primitive types: [`packages/core/src/ast.ts`](../packages/core/src/ast.ts)
- Condition parser/evaluator: [`packages/core/src/condition-parser.ts`](../packages/core/src/condition-parser.ts), [`packages/core/src/condition-evaluator.ts`](../packages/core/src/condition-evaluator.ts)
- Runtime IR: [`packages/core/src/ir.ts`](../packages/core/src/ir.ts)

## Removed Legacy Syntax

The following forms are historical only and should not be documented as current
authoring syntax:

```txt
#scene("prologue")
#label("start")
@command(...)
$macro(...)
@if(...)
@else
@endif
```

Historical decisions and cleanup notes remain in:

- [`docs/decisions`](decisions/)
- [`docs/plans/dsl-v2-compile-to-ir.md`](plans/dsl-v2-compile-to-ir.md)
- [`docs/plans/legacy-dsl-cleanup.md`](plans/legacy-dsl-cleanup.md)
