# std-effect plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdEffectPlugin()` exposes metadata for compiler
> validation. The runnable integration is
> [`examples/preact-basic`](../../examples/preact-basic/).

`@tsuzuru/plugin-std-effect` is Tsuzuru's standard one-shot screen effect plugin.

The plugin records renderer-neutral effect events in `runtimeState.plugins.stdEffect`.
It does not run CSS animations, touch DOM, start timers, or decide how an effect
looks. Renderers and apps consume event `sequence` values and translate them into
presentation.

## Why It Is Separate From std-visual

`@tsuzuru/plugin-std-visual` stores persistent visual state such as the current
background and visible sprites.

`@tsuzuru/plugin-std-effect` stores one-shot events such as a shake or flash.
Keeping these separate avoids treating a short animation as durable scene state.

## Installation / Registration

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdEffectPlugin()],
});
```

Runtime execution needs the command handlers:

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdEffectCommandHandlers } from "@tsuzuru/plugin-std-effect";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdEffectCommandHandlers(),
});
```

## Runtime State

```ts
export interface StdEffectState {
  readonly events: readonly StdEffectEvent[];
  readonly nextSequence: number;
}
```

Initial state:

```ts
{
  events: [],
  nextSequence: 1,
}
```

Events:

```ts
type StdEffectEvent =
  | { sequence: number; type: "shake"; target: "screen" | "message" | "sprites"; intensity: "light" | "normal" | "strong"; durationMs: number }
  | { sequence: number; type: "flash"; color: string; durationMs: number }
  | { sequence: number; type: "pulse"; target: "screen" | "message" | "sprites"; intensity: "light" | "normal" | "strong"; durationMs: number }
  | { sequence: number; type: "blur"; target: "screen"; amount: number; durationMs: number };
```

Use `getStdEffectState(runtimeState)` to read the state. It throws if the plugin
was not registered.

## Sequence Consumption

Each command appends one event and increments `nextSequence`.

Renderers should keep a `lastConsumedEffectSequence` value and only play events
with a larger sequence:

```ts
for (const event of effect.events) {
  if (event.sequence > lastConsumedEffectSequence) {
    playEffect(event);
    lastConsumedEffectSequence = event.sequence;
  }
}
```

## Commands

### `shake`

```txt
shake screen intensity=strong duration=400
shake message intensity=light duration=180
shake sprites duration=240
```

`target` is `"screen" | "message" | "sprites"`. `intensity` is optional and
defaults to `"normal"`. `duration` is required, uses milliseconds, and must be an
integer greater than or equal to `0`.

### `flash`

```txt
flash color="#ffffff" duration=120
flash color="#ff3333" duration=180
```

`color` and `duration` are required. `color` must be HEX:

- `#RGB`
- `#RRGGBB`
- `#RRGGBBAA`

### `pulse`

```txt
pulse screen intensity=normal duration=240
pulse message intensity=light duration=180
pulse sprites intensity=strong duration=260
```

`pulse` uses the same `target`, `intensity`, and `duration` policy as `shake`.

### `blur`

```txt
blur screen amount=6 duration=300
blur screen amount=10 duration=500
```

MVP `blur` only accepts `screen`. `amount` is a number greater than or equal to
`0`. `duration` is required, uses milliseconds, and must be an integer greater
than or equal to `0`.

## Snapshot Policy

Effects are one-shot events. Saving them would replay already-seen screen
animations after load, so apps should prepare state before creating a snapshot:

```ts
import { prepareStdEffectStateForSnapshot } from "@tsuzuru/plugin-std-effect";

const saveReadyState = prepareStdEffectStateForSnapshot(runtimeState);
```

The helper returns a new `RuntimeState` with:

```ts
{
  events: [],
  nextSequence: current.nextSequence,
}
```

It does not mutate the original state.

## Presentation Policy

Actual animation is renderer / app responsibility. The Preact example consumes
`stdEffect.events`, tracks sequence consumption, and implements CSS
animations for screen, message, sprite, flash overlay, and screen blur targets.

The plugin intentionally does not include particle, rain, snow, sakura, smoke,
manga-line, glitch, vignette, invert, monochrome, or chromatic effects.
