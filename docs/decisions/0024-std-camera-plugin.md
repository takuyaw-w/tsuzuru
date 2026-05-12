# 0024. Standard Camera Plugin

## Status

Accepted.

## Context

Tsuzuru has separate standard plugins for persistent visual content and
one-shot screen effects:

- `@tsuzuru/plugin-std-visual` owns background and sprite state.
- `@tsuzuru/plugin-std-effect` owns transient effect events.

Camera presentation needs different semantics. A zoom or focus should persist
until another camera command changes it, and save/load may restore that state.
It should not be modeled as a one-shot event, and it should not make the visual
plugin responsible for viewport transforms.

## Decision

Add `@tsuzuru/plugin-std-camera` with state key `stdCamera`.

The plugin owns durable renderer-neutral camera state:

```ts
{
  x: number,
  y: number,
  zoom: number,
  focusTarget: string | null,
  transition: { durationMs: number, easing: "linear" | "ease" | "easeIn" | "easeOut" } | null,
}
```

The official DSL sugar is:

```txt
camera x=0 y=0 zoom=1 duration=300
camera focus tone_stand zoom=1.2 duration=400
reset camera duration=300
```

`camera` updates x/y/zoom and clears focus. `camera focus` stores a focus target
and zoom. `reset camera` restores the initial pose. The plugin does not inspect
DOM, CSS, loaded assets, or sprite coordinates.

## Consequences

Renderers decide how to turn `focusTarget` into a transform. The examples use a
simple policy based on `stdVisual.sprites` positions.

Camera state is saved and restored as durable presentation state. Unlike
std-effect, no snapshot-preparation helper is needed.

Camera shake, rotation, camera paths, keyframe animation, and exact target
coordinate solving remain out of scope.
