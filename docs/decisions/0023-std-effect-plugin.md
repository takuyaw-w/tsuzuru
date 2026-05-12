# 0023: Standard Effect Plugin

## Status

Accepted

## Context

Screen shake, flash, pulse, and blur are common visual novel direction tools.
They are short-lived presentation events, not persistent scene state.

`@tsuzuru/plugin-std-visual` already owns durable background and sprite state.
Mixing one-shot effects into that package would make save / load behavior
ambiguous because a visual state snapshot should restore what is visible, while
an effect event should not replay after load.

## Decision

Add `@tsuzuru/plugin-std-effect` with the plugin state key `stdEffect`.

The plugin stores one-shot events:

```ts
{
  events: StdEffectEvent[],
  nextSequence: number,
}
```

Supported MVP commands are:

- `shake`
- `flash`
- `pulse`
- `blur`

Each command appends an event with `sequence: nextSequence` and increments
`nextSequence`. Renderers consume events by sequence and run their own CSS or
native animations.

The package exports `prepareStdEffectStateForSnapshot(runtimeState)`, which
clears `events` and preserves `nextSequence`.

## Rationale

Effects are closer to std-audio SE / voice events than to std-visual background
state. A sequence-based event queue makes repeated identical effects observable
without requiring core runtime semantics or renderer APIs to change.

Keeping actual animation in examples and renderers preserves the existing plugin
boundary: packages own renderer-neutral state and handlers; apps own DOM, CSS,
timers, reduced-motion policy, and visual styling.

## Consequences

### Positive

- Standard DSL sugar can cover common one-shot screen effects.
- Save snapshots do not replay already-consumed effects.
- `stdVisual` remains persistent visual state only.
- Core runtime semantics stay limited to plugin command dispatch.

### Negative

- Apps must implement effect rendering.
- Multiple simultaneous effects are renderer policy.
- Color HEX validation needs std-effect-specific checks because generic plugin
  command metadata does not currently support regular expressions.

## Deferred

The following effects are not part of this MVP:

- particle / rain / snow / sakura / smoke / manga lines
- glitch / vignette / invert / monochrome / chromatic

## Related Documents

- `docs/plugins/std-effect.md`
- `docs/plugins/std-visual.md`
- `docs/plugins/std-audio.md`
- `docs/decisions/0004-std-visual-plugin.md`
- `docs/decisions/0005-std-audio-plugin.md`
