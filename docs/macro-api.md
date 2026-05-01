# Macro API

This document describes the currently implemented macro surface in `@tsuzuru/core`.

Macros are compile-time presentation shorthand. They are written in TypeScript and called from `.tzr` files with `$name(...)`. Scenario files do not define macros and do not execute JavaScript or TypeScript.

## Macro Calls

Macro calls use `$` and share the same argument syntax as runtime commands.

```txt
$enter("haruka", "smile", "center")
```

The parser stores a macro call as a `MacroStatement` in the AST. During compilation, `compileTzr` converts that statement to a `MacroInstruction`, looks up a registered macro in `options.macros`, expands it, and places the returned instructions into the compiled IR.

`MacroInstruction` is a compiler-only instruction. A successful compilation removes macro calls from the compiled IR.

## Registration

Register macros through `compileTzr`:

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
