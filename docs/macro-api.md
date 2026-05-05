# Macro API

> Status: historical legacy API reference. The public macro API and legacy
> `compileTzr` macro expansion path were removed during DSL v2 cleanup. DSL v2
> currently has no macro syntax or macro expansion API.

This document preserves the removed legacy macro surface for historical reference. It is not a current `@tsuzuru/core` API.

Legacy macros were compile-time presentation shorthand. They were written in TypeScript and called from `.tzr` files with `$name(...)`. Scenario files did not define macros and did not execute JavaScript or TypeScript.

## Macro Calls

Macro calls use `$` and share the same argument syntax as runtime commands.

```txt
$enter("haruka", "smile", "center")
```

The removed legacy parser stored a macro call as a `MacroStatement` in the AST. During compilation, `compileTzr` converted that statement to a `MacroInstruction`, looked up a registered macro in `options.macros`, expanded it, and placed the returned instructions into the compiled IR.

`MacroInstruction` was a compiler-only instruction. A successful compilation removed macro calls from the compiled IR.

## Historical Registration

Historically, macros were registered through `compileTzr`:

```ts
import type { CommandInstruction, MacroDefinition } from "@tsuzuru/core";
import { compileTzr } from "@tsuzuru/core";

const enter: MacroDefinition = {
  expand(call): readonly CommandInstruction[] {
    return [
      {
        type: "CommandInstruction",
        name: "show",
        args: call.args,
        loc: call.loc,
      },
    ];
  },
};

const result = compileTzr(document, {
  macros: {
    enter,
  },
  pluginCommands: {
    show: { name: "show" },
  },
});
```

A macro entry may be either a function or an object with an `expand` function. The expand function receives:

- `call`: the `MacroInstruction`, including the macro name, parsed arguments, and source location
- `context`: currently `{ filePath }`

Unknown macros are compile-time errors:

```txt
Unknown macro "$missing".
```

## Expansion Rules

Macros should reduce repetitive presentation commands. They must not hide narrative structure or scenario control flow.

Macro expansion results must not include:

- `SceneInstruction`
- `LabelInstruction`
- `IfInstruction`
- `ChoiceInstruction`
- `MacroInstruction`
- `@jump` command instructions

The compiler reports an error when a macro returns one of these instructions.

Commands returned by macros are still validated normally after expansion. Core command argument validation applies to core commands, and plugin command registration and schema validation apply to plugin commands.

## Argument Validation

Macro calls currently expose their parsed arguments directly as `call.args`.

`@tsuzuru/core` v0.1 does not implement macro argument schema validation. There is no macro-side equivalent of plugin command argument schemas in the current `compileTzr` options.

Macro argument schema validation is deferred to post-v0.1. Until then, macro authors may inspect `call.args` in TypeScript if needed, but `.tzr` files should remain declarative and must not contain JavaScript or TypeScript logic.
