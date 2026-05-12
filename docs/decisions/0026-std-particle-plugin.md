# 0026. Standard Particle Plugin

## Status

Accepted.

## Context

Tsuzuru already separates presentation plugins by state semantics:

- `@tsuzuru/plugin-std-visual` owns background and sprite state.
- `@tsuzuru/plugin-std-effect` owns transient one-shot effect events.
- `@tsuzuru/plugin-std-camera` owns durable viewport transform state.

Ambient particles such as rain or snow are not one-shot events. They should
continue until another particle command replaces them or `stopParticle` clears
them, and save/load may restore that state.

They also should not become part of std-visual because particles are an
environmental overlay rather than the current background or sprite set.

## Decision

Add `@tsuzuru/plugin-std-particle` with state key `stdParticle`.

The plugin owns durable renderer-neutral particle overlay state:

```ts
{
  current: { type: "rain" | "snow" | "sakura" | "dust", intensity: "light" | "normal" | "strong" } | null,
}
```

DSL v2 adds official standard plugin sugar:

```txt
particle rain intensity=normal
particle snow intensity=light
particle sakura intensity=normal
particle dust intensity=light
stopParticle
```

`particle` replaces the current particle state. `stopParticle` clears it and is
a no-op when no particle is active.

## Consequences

Actual DOM, CSS animation, reduced-motion policy, and renderer-specific styling
belong to renderers or apps. The standard plugin only owns command metadata,
runtime handlers, and durable state.

No snapshot-preparation helper is needed because particle state is intended to
persist across save/load.

Multiple particle layers, wind, direction, speed, size, color, density, smoke,
fog, embers, leaves, and custom particle definitions remain deferred.
