# 0035. Standard Hotspot Plugin

## Status

Accepted

## Date

2026-05-28

## Context

Tsuzuru needs a small clickable-map style feature for exploration ADV scenes,
background object inspection, simple map movement, image choices, and escape
game style interactions.

This should not become a broad adventure framework. Inventory, evidence,
locations, image-map editors, hover effects, non-rectangular hit areas, and
arbitrary callbacks are separate future topics.

## Decision

Add `@tsuzuru/plugin-std-hotspot` as a standard plugin package.

The plugin stores hotspot state under `runtimeState.plugins.stdHotspot`:

```ts
{
  hotspots: {},
  waiting: false,
}
```

The current DSL v2 syntax is:

```tzr
hotspot desk rect(x=160, y=260, width=220, height=120) jump inspect_desk
wait hotspot
clear hotspots
```

The compiler lowers those statements to plugin commands:

- `hotspot`
- `waitHotspot`
- `clearHotspots`

`@tsuzuru/standard-ui-preact` provides `StdHotspotLayer` and
`StdHotspotRuntimeLayer`. The UI layer reads plugin state and renders
transparent button regions. It converts coordinates from a fixed 960x540
reference viewport into percentages.

The runtime click action uses the existing scene jump path. On click, MVP clears
`waiting` and the runtime click wait flag, then jumps to the target scene. It
does not automatically clear `hotspots`; scenarios should use `clear hotspots`
when regions should be removed.

## Consequences

### Positive

- Hotspots remain renderer-neutral runtime/plugin state.
- Preact presentation stays in `@tsuzuru/standard-ui-preact`.
- The DSL remains constrained and statically analyzable.
- Existing runtime snapshot behavior can preserve hotspot state without a new
  save/load design.
- `examples/preact-hotspot-basic` demonstrates the feature without expanding
  `examples/preact-basic`.

### Negative / Trade-offs

- MVP supports rectangles only.
- MVP uses the existing click-wait flag internally to pause progression during
  `wait hotspot`.
- Keyboard/controller navigation and accessibility beyond labeled buttons are
  deferred.
- There is no authoring/debug editor for hotspot placement.

## Alternatives Considered

### Alternative A: Implement hotspots as UI-only component state

Rejected.

UI-only hotspots would not participate in runtime snapshots and would make the
DSL action state harder to inspect or validate.

### Alternative B: Add a larger adventure-system package now

Rejected.

The requested behavior is clickable regions that jump to scenes. Inventory,
location graphs, evidence, and puzzle state should be designed separately after
the basic command/state boundary is proven.

### Alternative C: Add circle, polygon, and hover options immediately

Rejected for the MVP.

The fixed rectangle syntax keeps parser/compiler changes small and makes the
first renderer layer straightforward.

## Related Documents

- [`docs/plugins/std-hotspot.md`](../plugins/std-hotspot.md)
- [`examples/preact-hotspot-basic`](../../examples/preact-hotspot-basic/)
