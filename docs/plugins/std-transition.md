# std-transition plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdTransitionPlugin()` exposes metadata for compiler
> validation. The runnable integration is
> [`examples/preact-basic`](../../examples/preact-basic/).

`@tsuzuru/plugin-std-transition` is Tsuzuru's standard screen transition
plugin. It records renderer-neutral one-shot events in
`runtimeState.plugins.stdTransition`.

The package also exports `ScreenTransitionLayer` from
`@tsuzuru/plugin-std-transition/preact` for Preact apps. That layer may use
GSAP internally, but GSAP is not exposed through public API names or DSL.

## Why It Is Separate From std-visual

`@tsuzuru/plugin-std-visual` stores persistent visual content such as the
current background and visible sprites.

`@tsuzuru/plugin-std-transition` stores one-shot screen-surface transition
events. Keeping these separate avoids saving a short screen animation as durable
visual state.

## Installation / Registration

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdTransitionPlugin } from "@tsuzuru/plugin-std-transition";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdTransitionPlugin()],
});
```

Runtime execution needs command handlers:

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdTransitionCommandHandlers } from "@tsuzuru/plugin-std-transition";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdTransitionCommandHandlers(),
});
```

Preact apps can render the overlay:

```tsx
import { ScreenTransitionLayer } from "@tsuzuru/plugin-std-transition/preact";

<ScreenTransitionLayer runtimeState={runtimeState} />;
```

## Runtime State

```ts
export type StdTransitionEffect = "fade" | "wipe" | "flash" | "pageTurn" | "blurFade" | "slide";

export type StdTransitionDirection = "left" | "right" | "up" | "down";

export type StdTransitionEvent = {
  sequence: number;
  effect: StdTransitionEffect;
  durationMs: number;
  direction?: StdTransitionDirection;
  color?: string;
};

export type StdTransitionState = {
  events: StdTransitionEvent[];
  nextSequence: number;
};
```

Initial state:

```ts
{
  events: [],
  nextSequence: 1,
}
```

Use `getStdTransitionState(runtimeState)` to read the state. It throws if the
plugin was not registered.

## Sequence Consumption

Each command appends one event using the current `nextSequence`, then increments
`nextSequence`. The first event sequence is `1`.

Renderers should start with `lastConsumedSequence = 0` and play only events
with a larger sequence.

## DSL

```txt
transition fade(duration=500)
transition wipe(direction="left", duration=600)
transition flash(color="#ffffff", duration=180)
transition pageTurn(direction="left", duration=800)
transition blurFade(duration=700)
transition slide(direction="up", duration=650)

bg station with fade(duration=600)
bg library with pageTurn(direction="left", duration=800)
bg rooftop with blurFade(duration=700)
bg hallway with slide(direction="right", duration=650)
```

Defaults:

- `fade`: `duration=400`, `color="#000000"`
- `wipe`: `duration=500`, `direction="left"`, `color="#000000"`
- `flash`: `duration=180`, `color="#ffffff"`
- `pageTurn`: `duration=800`, `direction="left"`, `color="#ffffff"`
- `blurFade`: `duration=700`, `color="#000000"`
- `slide`: `duration=600`, `direction="left"`, `color="#000000"`

Standalone `transition ...` statements are useful for flashbacks, white
flashes, and screen-wide direction that is not tied to a background change.
For location changes, prefer `bg <assetId> with <transitionEffect>(...)`.
Compiler output appends a std-transition event and then updates std-visual
background state. Runtime still does not wait for animation completion.

`duration` must be a positive integer. `direction` must be `"left"`,
`"right"`, `"up"`, or `"down"`. Extra named arguments are rejected.

## Runtime Timing

Transition commands do not block runtime stepping. They only append an event.
When exact scenario timing matters, combine transition commands with `wait`:

```txt
transition fade(duration=500)
wait 500
```

## Snapshot Policy

Transitions are one-shot events. Saving them would replay already-seen screen
animations after load, so apps should prepare state before creating a snapshot:

```ts
import { prepareStdTransitionStateForSnapshot } from "@tsuzuru/plugin-std-transition";

const saveReadyState = prepareStdTransitionStateForSnapshot(runtimeState);
```

The helper returns a new `RuntimeState` with:

```ts
{
  events: [],
  nextSequence: current.nextSequence,
}
```

It does not mutate the original state.

## Preact Layer

`ScreenTransitionLayer` watches `stdTransition.events` by sequence and plays
unconsumed fade, wipe, flash, pageTurn, blurFade, and slide events. It only
absorbs pointer events while a transition is active, and it cleans up its GSAP
timeline on unmount.
