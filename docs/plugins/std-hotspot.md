# std-hotspot plugin

> Status: DSL v2-first MVP. Runtime handlers and plugin command metadata are
> current, and `createStdHotspotPlugin()` exposes metadata for compiler
> validation. The runnable integration is
> [`examples/preact-hotspot-basic`](../../examples/preact-hotspot-basic/).

`@tsuzuru/plugin-std-hotspot` is Tsuzuru's standard rectangular hotspot state
plugin.

The plugin records renderer-neutral hotspot state in
`runtimeState.plugins.stdHotspot`. It does not render DOM, draw overlays, or own
an adventure-game system. Renderers and apps translate the current hotspot state
into clickable presentation.

## Responsibility Split

`@tsuzuru/plugin-std-hotspot` owns:

- hotspot state
- `hotspot`, `waitHotspot`, and `clearHotspots` command handlers
- command metadata for compiler validation
- helper functions such as `getStdHotspotState()`

`@tsuzuru/standard-ui-preact` owns:

- `StdHotspotLayer`
- `StdHotspotRuntimeLayer`
- converting 960x540 hotspot coordinates to percentage-positioned transparent
  buttons
- calling the runtime jump path when a hotspot is clicked

## Runtime State

```ts
export type StdHotspotState = {
  readonly hotspots: StdHotspots;
  readonly waiting: boolean;
};

export type StdHotspots = Readonly<Record<string, StdHotspot>>;

export type StdHotspot = {
  readonly shape: StdHotspotRect;
  readonly action: StdHotspotAction;
};
```

Initial state:

```ts
{
  hotspots: {},
  waiting: false,
}
```

Use `getStdHotspotState(runtimeState)` to read the state. It throws if the
plugin was not registered.

## DSL v2 Syntax

```tzr
hotspot desk rect(x=160, y=260, width=220, height=120) jump inspect_desk
hotspot door rect(x=720, y=180, width=120, height=360) jump hallway
wait hotspot
clear hotspots
```

MVP supports only:

```txt
hotspot <id> rect(x=<number>, y=<number>, width=<number>, height=<number>) jump <sceneId>
wait hotspot
clear hotspots
```

The `hotspot` statement overwrites an existing hotspot with the same id.
`wait hotspot` sets `waiting: true` and blocks runtime progression until a
standard hotspot runtime layer resolves a click. `clear hotspots` clears the
hotspot map and sets `waiting: false`.

When a hotspot is clicked, MVP sets `waiting: false`, clears the runtime click
wait flag, and jumps to the target scene. It does not automatically clear the
hotspot map. Use `clear hotspots` in the target scene when the regions should be
removed.

## Coordinates

Coordinates are relative to a 960x540 `GameViewport` reference size:

- `x=0, y=0` is the viewport top-left
- `x`, `y`, `width`, and `height` are numbers in that reference coordinate
  system
- `x` and `y` must be `0` or greater
- `width` and `height` must be greater than `0`
- Preact layers convert values to percentages before rendering

The MVP intentionally does not add `baseWidth` / `baseHeight` options.

## Not Included in the MVP

- circle or polygon shapes
- hover effects
- tooltip text
- cursor customization
- conditional hotspots
- enabled / disabled DSL options
- z-index DSL options
- callback actions
- external URLs
- arbitrary script actions
- image-map editor or debug editor
- inventory, evidence, location, or adventure-system management

## Example

Run the dedicated example:

```sh
pnpm --filter @tsuzuru/example-preact-hotspot-basic dev
```
