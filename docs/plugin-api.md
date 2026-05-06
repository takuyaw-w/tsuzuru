# Plugin API

> Status: current for DSL v2. Plugin command metadata can be passed to
> `compileTzr` for compile-time validation, and runtime handlers still execute
> the resulting command instructions.

This document describes the currently implemented plugin command metadata and runtime handler surface in `@tsuzuru/core`.

Plugins extend runtime presentation behavior by handling command names emitted by the DSL v2 compiler. Core still owns scenario flow, state, choices, conditionals, save/load, and execution control.

## Command Metadata

Plugin command metadata is defined with `definePluginCommand`. The compiler can consume this metadata through `compileTzr(document, { plugins })` or `compileTzr(document, { pluginCommands })`.

```ts
import { definePluginCommand } from "@tsuzuru/core";

export const stdVisualPluginCommands = {
  bg: definePluginCommand("bg", {
    kind: "positional",
    arguments: [{ type: "string", nonEmpty: true }],
  }),
  show: definePluginCommand("show", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [{ name: "position", type: "string", optional: true, values: ["left", "center", "right"] }],
  }),
};
```

The registry key must match `definition.name` when a plugin exposes a command map. Duplicate command names are compile errors.

```ts
const pluginCommands = {
  bg: { name: "show" }, // invalid
};
```

Standard plugins expose metadata on the plugin object returned by `createStdVisualPlugin()` and `createStdAudioPlugin()`:

```ts
const compiled = compileTzr(document, {
  plugins: [createStdVisualPlugin(), createStdAudioPlugin()],
});
```

Passing metadata enables compile-time validation for emitted plugin commands. If no plugin metadata is passed, current std visual/audio DSL sugar remains compatible and is compiled without plugin command metadata validation.

## Argument Schemas

Plugin commands may omit `args`. This defines only the command name. When `args` is present, the compiler validates argument shape.

Supported schema kinds:

```ts
{ kind: "none" }
{ kind: "positional", arguments: [...] }
{ kind: "named", arguments: [...] }
{ kind: "mixed", positional: [...], named: [...] }
```

Supported value types:

- `string`
- `number`
- `boolean`
- `identifier`

Arguments are required by default. Add `optional: true` for optional arguments.

Use `nonEmpty: true` for required non-empty string values, and `values: [...]` for a fixed set of allowed string or identifier values. Extra positional or named args are rejected by default; metadata can opt into `allowExtraPositional` or `allowExtraNamed`.

## Positional Commands

```ts
bg: definePluginCommand("bg", {
  kind: "positional",
  arguments: [{ type: "string", nonEmpty: true }],
});
```

Valid:

```txt
bg school_evening
```

Invalid:

```txt
bg
bg ""
bg school evening
```

## Named Commands

Named arguments are currently produced by `call namespace.command(...)` when plugin command validation metadata is provided.

```ts
screenOpen: definePluginCommand("screen.open", {
  kind: "named",
  arguments: [
    { name: "id", type: "identifier" },
    { name: "modal", type: "boolean", optional: true },
  ],
});
```

Valid:

```txt
call screen.open(id=notebook, modal=true)
```

Invalid:

```txt
call screen.open()
call screen.open(id="notebook")
call screen.open(id=notebook, extra=true)
```

## Runtime Boundary

Runtime behavior is handled by runtime plugin command handlers and UI layers. Compile-time plugin command validation checks command names and argument shape, but it does not load assets, check file existence, render images, or play audio.

Plugin commands should not own core flow control. Keep these commands core-owned:

```txt
jump / scene jump
if / elif / else
choice
set / add
waitClick / page / stop / wait
```

Macro, preset, and stage syntax remain out of scope.
