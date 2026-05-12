# std-particle plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdParticlePlugin()` exposes metadata for compiler
> validation. The runnable integrations are
> [`examples/preact-basic`](../../examples/preact-basic/) and
> [`examples/vue-basic`](../../examples/vue-basic/).

`@tsuzuru/plugin-std-particle` is Tsuzuru's standard durable particle overlay
state plugin.

The plugin records renderer-neutral particle state in
`runtimeState.plugins.stdParticle`. It does not render DOM, run CSS animation,
start timers, or resolve visual assets. Renderers and apps translate the current
particle state into presentation.

## Why It Is Separate

`@tsuzuru/plugin-std-visual` stores persistent visual content such as the current
background and visible sprites.

`@tsuzuru/plugin-std-effect` stores one-shot events such as shake, flash, pulse,
and blur.

`@tsuzuru/plugin-std-particle` stores durable environmental overlay state such
as rain, snow, sakura, or dust. Keeping it separate avoids mixing ambient
overlays into background/sprite state or replay-only effect events.

## Installation / Registration

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdParticlePlugin } from "@tsuzuru/plugin-std-particle";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdParticlePlugin()],
});
```

Runtime execution needs the command handlers:

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdParticleCommandHandlers } from "@tsuzuru/plugin-std-particle";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdParticleCommandHandlers(),
});
```

## Runtime State

```ts
export type StdParticleType = "rain" | "snow" | "sakura" | "dust";
export type StdParticleIntensity = "light" | "normal" | "strong";

export interface StdParticleCurrent {
  readonly type: StdParticleType;
  readonly intensity: StdParticleIntensity;
}

export interface StdParticleState {
  readonly current: StdParticleCurrent | null;
}
```

Initial state:

```ts
{
  current: null,
}
```

Use `getStdParticleState(runtimeState)` to read the state. It throws if the
plugin was not registered.

## Commands

### `particle`

```txt
particle rain intensity=normal
particle snow intensity=light
particle sakura intensity=normal
particle dust intensity=light
```

The positional argument is required and must be one of `"rain"`, `"snow"`,
`"sakura"`, or `"dust"`. `intensity` is optional, defaults to `"normal"`, and
must be `"light"`, `"normal"`, or `"strong"`.

Running `particle ...` replaces the current particle state. MVP supports one
particle layer at a time.

### `stopParticle`

```txt
stopParticle
```

`stopParticle` takes no arguments and sets `current` to `null`. Running it while
no particle is active is a no-op and does not warn.

## Snapshot Policy

Particles are durable presentation state. They may be saved and restored with
runtime snapshots as-is. There is no `prepareStdParticleStateForSnapshot()`
helper.

## Presentation Policy

Actual rendering is renderer / app responsibility. The Preact and Vue examples
consume `stdParticle.current` and implement lightweight CSS overlays for rain,
snow, sakura, and dust with `pointer-events: none` and reduced-motion handling.

The MVP intentionally does not include multiple simultaneous particle layers,
wind, direction, speed, size, color, density, smoke, fog, embers, leaves, or
custom renderer-provided particle definitions.
