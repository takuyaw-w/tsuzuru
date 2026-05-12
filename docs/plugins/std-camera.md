# std-camera plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdCameraPlugin()` exposes metadata for compiler
> validation. The runnable integrations are
> [`examples/preact-basic`](../../examples/preact-basic/) and
> [`examples/vue-basic`](../../examples/vue-basic/).

`@tsuzuru/plugin-std-camera` is Tsuzuru's standard durable camera state plugin.

The plugin records renderer-neutral camera state in `runtimeState.plugins.stdCamera`.
It does not run CSS transforms, inspect DOM layout, start timers, or resolve exact
sprite coordinates. Renderers and apps translate the camera state into a visual
presentation.

## Why It Is Separate

`@tsuzuru/plugin-std-visual` stores persistent visual content such as the current
background and visible sprites.

`@tsuzuru/plugin-std-effect` stores one-shot events such as shake, flash, pulse,
and blur.

`@tsuzuru/plugin-std-camera` stores durable viewport transform state: x, y, zoom,
focus target, and transition. Keeping it separate avoids mixing viewport motion
with sprite/background ownership or one-shot effect events.

## Installation / Registration

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdCameraPlugin()],
});
```

Runtime execution needs the command handlers:

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdCameraCommandHandlers } from "@tsuzuru/plugin-std-camera";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdCameraCommandHandlers(),
});
```

## Runtime State

```ts
export type StdCameraEasing = "linear" | "ease" | "easeIn" | "easeOut";

export interface StdCameraTransition {
  readonly durationMs: number;
  readonly easing: StdCameraEasing;
}

export interface StdCameraState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly focusTarget: string | null;
  readonly transition: StdCameraTransition | null;
}
```

Initial state:

```ts
{
  x: 0,
  y: 0,
  zoom: 1,
  focusTarget: null,
  transition: null,
}
```

Each camera command stores a transition object. The initial state uses `null`
because no camera command has run yet.

## Commands

### `camera`

```txt
camera x=0 y=0 zoom=1 duration=300
camera x=80 y=-20 zoom=1.15 duration=500
camera zoom=1.08 duration=240
camera x=0 y=-20 duration=300
```

`x`, `y`, and `zoom` are named arguments. At least one of them is required.
Omitted values keep the current state. `zoom` must be greater than `0`.

`duration` is optional, defaults to `0`, uses milliseconds, and must be an
integer greater than or equal to `0`. `easing` is optional and defaults to
`"ease"`.

Running `camera` clears `focusTarget`.

### `camera focus`

```txt
camera focus tone_stand zoom=1.2 duration=400
camera focus noize_stand zoom=1.18 duration=360 easing=easeOut
```

The positional argument is a focus target asset id. The plugin does not check
whether that target currently exists. Renderers may inspect `stdVisual.sprites`
or another presentation model to decide how to place the camera.

`zoom` is optional, defaults to `1.15`, and must be greater than `0`.
`duration` is optional and defaults to `300`. `easing` is optional and defaults
to `"ease"`.

### `reset camera`

```txt
reset camera duration=300
reset camera
```

`reset camera` restores x, y, zoom, and focus target to the initial camera pose.
It still records the command transition so renderers can animate the reset.

## Snapshot Policy

Camera is durable presentation state. It may be saved and restored with the
runtime snapshot as-is. There is no `prepareStdCameraStateForSnapshot()` helper.

## Presentation Policy

Actual transform behavior is renderer / app responsibility. The Preact and Vue
examples consume `stdCamera`, translate `x`, `y`, `zoom`, `duration`, and
`easing` into CSS custom properties, and use `stdVisual.sprites` for a simple
left / center / right focus policy.

The plugin intentionally does not include rotation, camera shake, path/keyframe
animation, or exact target coordinate solving.
