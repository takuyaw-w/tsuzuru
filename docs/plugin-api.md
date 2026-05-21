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
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [
      {
        name: "transition",
        type: "string",
        optional: true,
        values: ["fade", "dissolve"],
        requiredWith: ["duration"],
      },
      {
        name: "duration",
        type: "number",
        optional: true,
        integer: true,
        min: 0,
        requiredWith: ["transition"],
      },
    ],
  }),
  show: definePluginCommand("show", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [
      { name: "position", type: "string", optional: true, values: ["left", "center", "right"] },
      {
        name: "transition",
        type: "string",
        optional: true,
        values: ["fade", "dissolve"],
        requiredWith: ["duration"],
      },
      {
        name: "duration",
        type: "number",
        optional: true,
        integer: true,
        min: 0,
        requiredWith: ["transition"],
      },
    ],
  }),
  hide: definePluginCommand("hide", {
    kind: "mixed",
    positional: [{ type: "string", nonEmpty: true }],
    named: [
      {
        name: "transition",
        type: "string",
        optional: true,
        values: ["fade", "dissolve"],
        requiredWith: ["duration"],
      },
      {
        name: "duration",
        type: "number",
        optional: true,
        integer: true,
        min: 0,
        requiredWith: ["transition"],
      },
    ],
  }),
  clearBg: definePluginCommand("clearBg", {
    kind: "named",
    arguments: [
      {
        name: "transition",
        type: "string",
        optional: true,
        values: ["fade", "dissolve"],
        requiredWith: ["duration"],
      },
      {
        name: "duration",
        type: "number",
        optional: true,
        integer: true,
        min: 0,
        requiredWith: ["transition"],
      },
    ],
  }),
  clearSprites: definePluginCommand("clearSprites", {
    kind: "named",
    arguments: [
      {
        name: "transition",
        type: "string",
        optional: true,
        values: ["fade", "dissolve"],
        requiredWith: ["duration"],
      },
      {
        name: "duration",
        type: "number",
        optional: true,
        integer: true,
        min: 0,
        requiredWith: ["transition"],
      },
    ],
  }),
};
```

The registry key must match `definition.name` when a plugin exposes a command map. Duplicate command names are compile errors.

```ts
const pluginCommands = {
  bg: { name: "show" }, // invalid
};
```

Standard plugins expose metadata on the plugin object returned by their
`createStd*Plugin()` functions:

```ts
const compiled = compileTzr(document, {
  plugins: [
    createStdVisualPlugin(),
    createStdAudioPlugin(),
    createStdTransitionPlugin(),
    createStdSystemPlugin(),
  ],
});
```

Passing metadata enables compile-time validation for emitted plugin commands. If
no plugin metadata is passed, current std visual/audio/text-sound/effect/
transition/camera DSL sugar remains compatible and is compiled without plugin
command metadata validation. `call system.*(...)` commands require std-system
metadata because generic `call` is only compile-supported through plugin
command registration.

When metadata validation is enabled, the compiler validates every emitted
non-core command against the supplied registry. If a scenario uses standard
plugin commands, pass the corresponding standard plugins to `compileTzr` so
their command names and argument schemas are registered.

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

Use `nonEmpty: true` for required non-empty string values, and `values: [...]` for a fixed set of allowed string or identifier values. Number arguments can use `integer: true` and `min: number`. Named arguments can use `requiredWith: [...]` when optional arguments must be supplied together. Extra positional or named args are rejected by default; metadata can opt into `allowExtraPositional` or `allowExtraNamed`.

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

Named arguments are currently produced by `call namespace.command(...)` when plugin command validation metadata is provided. This is the custom plugin command authoring surface. It compiles to a plugin `CommandInstruction`; it is not a runtime subroutine call, call stack, or `return` mechanism.

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

Std visual transition metadata on `show`, `hide`, and `clear` is compiled as
command arguments and remains renderer-independent. `transition` and `duration`
must be supplied together, and `duration` is validated as a finite integer
greater than or equal to `0`. The std visual plugin stores transition metadata
on surviving state objects; actual animation timing and presentation remain UI
or renderer responsibilities.

Std transition DSL sugar compiles to the `transition` plugin command with a
screen transition effect, normalized duration, and default color/direction
arguments. This includes standalone `transition ...` statements and
`bg ... with <screenTransition>(...)`, where the compiler appends the
transition command and then updates std-visual background state. Runtime
execution appends a one-shot transition event and does not block scenario
stepping; strict timing should use `wait`.

Broader call/return runtime semantics remain deferred.

Plugin commands should not own core flow control. Keep these commands core-owned:

```txt
jump / scene jump
if / elif / else
choice
set / add
waitClick / page / stop / wait
```

Macro, preset, and stage syntax remain out of scope.
