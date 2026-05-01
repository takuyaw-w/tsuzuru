# Plugin API

This document describes the currently implemented plugin command surface in `@tsuzuru/core`.

Plugins extend runtime presentation behavior by registering command names that may appear in `.tzr` files. Core still owns scenario flow, state, choices, conditionals, save/load, and execution control.

## Command Registration

Register plugin-owned commands through `compileTzr`:

```ts
import { compileTzr, definePluginCommand } from "@tsuzuru/core";

const result = compileTzr(document, {
  pluginCommands: {
    bg: definePluginCommand("bg", {
      kind: "positional",
      arguments: [{ type: "string" }],
    }),
    show: definePluginCommand("show", {
      kind: "named",
      arguments: [
        { name: "character", type: "string" },
        { name: "pose", type: "string", optional: true },
        { name: "at", type: ["string", "identifier"], optional: true },
      ],
    }),
  },
});
```

The registry key must match `definition.name`. A mismatch is a compile-time error, and that entry is not treated as a registered command.

```ts
pluginCommands: {
  bg: { name: "show" }, // invalid
}
```

## Argument Schemas

Plugin commands may omit `args`. In that case, the compiler only checks that the command name is registered.

Supported schema kinds:

```ts
{ kind: "none" }
{ kind: "positional", arguments: [...] }
{ kind: "named", arguments: [...] }
```

Supported value types:

- `string`
- `number`
- `boolean`
- `identifier`

Arguments are required by default. Add `optional: true` for optional arguments.

## Positional Commands

```ts
bg: definePluginCommand("bg", {
  kind: "positional",
  arguments: [{ type: "string" }],
});
```

Valid:

```txt
@bg("school_evening")
```

Invalid:

```txt
@bg()
@bg(123)
@bg("school_evening", "extra")
@bg(name="school_evening")
```

## Named Commands

```ts
show: definePluginCommand("show", {
  kind: "named",
  arguments: [
    { name: "character", type: "string" },
    { name: "pose", type: "string", optional: true },
    { name: "at", type: ["string", "identifier"], optional: true },
  ],
});
```

Valid:

```txt
@show(character="haruka", pose="smile", at=center)
```

Invalid:

```txt
@show()
@show(character=haruka)
@show(character="haruka", extra=true)
@show(character="haruka", character="yu")
@show("haruka")
```

## Runtime Boundary

The compiler validates plugin command names and argument shapes. Runtime behavior is handled by runtime plugin command handlers and UI layers.

Plugin commands should not own core flow control. Keep these commands core-owned:

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
