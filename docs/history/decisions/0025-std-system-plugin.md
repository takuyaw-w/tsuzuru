# 0025. Standard System Plugin

## Status

Accepted.

## Context

Tsuzuru already separates presentation plugins by state semantics:

- `@tsuzuru/plugin-std-visual` owns background and sprite state.
- `@tsuzuru/plugin-std-effect` owns transient one-shot effect events.
- `@tsuzuru/plugin-std-camera` owns durable viewport transform state.

CG, ending, and achievement unlocks are meta progression. They should persist
as system state, but they should not become generic scenario variables and they
should not require new dedicated DSL sugar.

## Decision

Add `@tsuzuru/plugin-std-system` with state key `stdSystem`.

The plugin owns durable renderer-neutral unlock state:

```ts
{
  endings: Record<string, { unlocked: true }>,
  cgs: Record<string, { unlocked: true }>,
  achievements: Record<string, { unlocked: true }>,
}
```

Unlocks use standard plugin call syntax:

```txt
call system.unlockEnding(id=trueEnd)
call system.unlockCg(id=textSoundLab)
call system.unlockAchievement(id=firstTextSoundLab)
```

No dedicated `unlock ending ...` sugar is added. Direct `set system.*` and
`add system.*` remain invalid so system mutation always goes through
`call system.*(...)`.

## Consequences

Repeated unlocks are idempotent and do not warn.

The plugin does not touch localStorage, DOM, timers, gallery UI, or achievement
presentation. Persistence beyond runtime snapshots belongs to the app or
renderer.

`if system.*` conditions remain deferred for this MVP. Supporting them later
should add a renderer-neutral condition resolver without exposing arbitrary
system mutation.
