# Tsuzuru DSL

> Status: current DSL entry point for `feature/new-dsl`.
> DSL v2 is the current supported DSL path. The old DSL parser/compiler,
> legacy AST, and macro API were removed. `parseTzr` / `compileTzr` now refer
> to the current DSL implementation.

This document is a short entry point for the currently supported `.tzr` syntax.
For the fuller design notes, see [`docs/design/design/dsl-v2.md`](design/design/dsl-v2.md).
For runnable code, see [`examples/dsl-v2-basic`](../examples/dsl-v2-basic/).

## Current API

Use the current DSL APIs from `@tsuzuru/core`:

```ts
import { compileTzr, parseTzr } from "@tsuzuru/core";
```

No compatibility aliases for the transitional v2 API names are exported.

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
- `scene` bodies
- narration and dialogue
- `jump` to another scene in the same document
- body choices with optional conditions
- `if` / `elif` / `else`
- `set` and `add`
- `wait 1000` timed waits in milliseconds
- std visual sugar: `bg`, `show`, `hide`
- std audio sugar: `bgm`, `stopBgm`, `se`, `voice`
- `end`

Some design-level syntax in `docs/design/design/dsl-v2.md` may still be parser-only
or not implemented at runtime. Treat `examples/dsl-v2-basic` as the current
runnable reference.

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
