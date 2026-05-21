# 0033: Standard Transition Plugin

## Status

Accepted

## Context

Tsuzuru already separates durable visual state from one-shot presentation
events. `@tsuzuru/plugin-std-visual` owns background and sprite state, while
`@tsuzuru/plugin-std-effect` owns transient effect events.

Screen-wide scene transitions such as fade, wipe, and flash need similar
one-shot handling, but they should not become background or sprite animation
state.

## Decision

Add `@tsuzuru/plugin-std-transition` with the plugin state key
`stdTransition`.

The plugin stores one-shot transition events:

```ts
{
  events: StdTransitionEvent[],
  nextSequence: number,
}
```

Initial supported effects are:

- `fade`
- `wipe`
- `flash`

The DSL statement is:

```txt
transition fade(duration=500)
transition wipe(direction="left", duration=600)
transition flash(color="#ffffff", duration=180)
```

The command appends an event with `sequence: nextSequence` and increments
`nextSequence`. Runtime execution does not block for animation completion.
Scenarios that need exact timing should use `wait` after `transition`.

The package may use GSAP internally for its Preact layer, but GSAP is not part
of the public API or naming.

## Rationale

Transitions are closer to std-effect and std-audio one-shot events than to
std-visual state. Keeping them in a dedicated plugin avoids mixing persistent
visual content with screen-surface animation events.

Sequence-based consumption lets renderers play repeated identical transitions
without requiring core runtime async behavior.

## Consequences

### Positive

- Standard DSL syntax covers common full-screen transitions.
- Save snapshots do not replay already-consumed transitions.
- `stdVisual` remains responsible for persistent background and sprite state.
- Core remains renderer, Preact, and GSAP independent.

### Negative

- Hosts must include `wait` when scenario timing depends on transition length.
- Non-Preact renderers need their own layer implementation.

## Deferred

The following are not part of this decision:

- per-background / per-sprite animation
- scene graph animation
- runtime async blocking
- transition completion callbacks in DSL or runtime
- GSAP API exposure
- React or Vue adapters

## Related Documents

- `docs/plugins/std-transition.md`
- `docs/plugins/std-visual.md`
- `docs/plugins/std-effect.md`
- `docs/decisions/0004-std-visual-plugin.md`
- `docs/decisions/0023-std-effect-plugin.md`
