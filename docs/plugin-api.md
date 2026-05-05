# Plugin API

> Status: partially historical. Plugin command metadata and runtime handlers
> remain, but legacy `compileTzr({ pluginCommands })` validation was removed with
> the old DSL compiler. DSL v2 currently emits std visual/audio runtime commands
> directly for the supported subset.

This document describes the currently implemented plugin command metadata and runtime handler surface in `@tsuzuru/core`.

Plugins extend runtime presentation behavior by handling command names emitted by the DSL v2 compiler. Core still owns scenario flow, state, choices, conditionals, save/load, and execution control.

## Command Metadata

Plugin command metadata remains available through `definePluginCommand`. The legacy compiler path that consumed `pluginCommands` was removed with `compileTzr`, so this metadata is not currently a DSL v2 compile-time validation registry.

```ts
import { definePluginCommand } from "@tsuzuru/core";

export const stdVisualPluginCommands = {
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
};
```

The registry key should match `definition.name` when a plugin exposes a command map. DSL v2 compile-time validation for plugin command maps is not implemented yet.

```ts
const pluginCommands = {
  bg: { name: "show" }, // invalid
};
```

## Argument Schemas

Plugin commands may omit `args`. This means the metadata defines only the command name until a future compiler or tooling validation policy consumes the schema.

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

The examples in this section use the removed legacy `@command(...)` notation only
to show argument shapes. They are not current DSL v2 authoring syntax.

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

Runtime behavior is handled by runtime plugin command handlers and UI layers. DSL v2 currently emits std visual/audio commands for the supported subset; arbitrary plugin command validation remains a follow-up design task.

Plugin commands should not own core flow control. Keep these commands core-owned:

```txt
jump / scene jump
if / elif / else
choice
set / add
waitClick / page / stop / wait
```
