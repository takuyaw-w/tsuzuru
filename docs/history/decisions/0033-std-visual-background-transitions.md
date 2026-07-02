# 0033. Treat background transitions as std-visual metadata

## Status

Accepted.

## Context

Tsuzuru needs author-facing background change effects such as:

```txt
bg library with fade(duration=500)
bg station with pageTurn(direction="left", duration=800)
bg rooftop with blurFade(duration=700)
bg hallway with slide(direction="up", duration=650)
```

These effects describe how the background changes. They do not need a
screen-wide one-shot event model, a standalone `transition` statement, or a
renderer dependency in the standard plugin stack.

## Decision

`bg ... with ...` is owned by `@tsuzuru/plugin-std-visual`.

The compiler emits a std-visual `bg` command with normalized background
transition metadata. The std-visual runtime handler stores that metadata on
`runtimeState.plugins.stdVisual.background.transition`.

The standard stack does not include:

- `@tsuzuru/plugin-std-transition`
- standalone `transition ...` statements
- `stdTransition` plugin state
- GSAP dependency
- runtime blocking until animation completion

Renderer implementations may animate `fade`, `pageTurn`, `blurFade`, and
`slide` using CSS or another app-owned rendering technique. Scenario authors
should combine `bg ... with ...` with `wait` when script timing must match the
visual duration.

## Consequences

Background transition metadata is durable std-visual state. Snapshot / restore
does not need a prepare helper, and renderers should avoid replaying an
animation solely because restored state contains transition metadata.

Sprite transition metadata remains std-visual metadata for `show`, `hide`, and
`clear` commands.
