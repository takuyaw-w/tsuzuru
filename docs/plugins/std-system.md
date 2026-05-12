# std-system plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdSystemPlugin()` exposes metadata for compiler
> validation. The runnable integrations are
> [`examples/preact-basic`](../../examples/preact-basic/) and
> [`examples/vue-basic`](../../examples/vue-basic/).

`@tsuzuru/plugin-std-system` is Tsuzuru's standard system unlock state plugin.

The plugin records renderer-neutral meta progression in
`runtimeState.plugins.stdSystem`. It does not write to localStorage, render
gallery UI, emit timers, or decide where unlocks are displayed. Persistence and
presentation belong to the app, renderer, or example.

## Syntax Policy

std-system does not add dedicated DSL sugar. System mutation uses the standard
plugin call syntax:

```txt
call system.unlockEnding(id=trueEnd)
call system.unlockCg(id=textSoundLab)
call system.unlockAchievement(id=firstTextSoundLab)
```

Dedicated forms such as `unlock ending trueEnd` are not supported.

Direct scenario mutation is also prohibited:

```txt
set system.endings.trueEnd.unlocked = true
add system.playCount += 1
```

System state changes must go through `call system.*(...)` commands.

## Installation / Registration

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdSystemPlugin } from "@tsuzuru/plugin-std-system";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdSystemPlugin()],
});
```

Runtime execution needs the command handlers:

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdSystemCommandHandlers } from "@tsuzuru/plugin-std-system";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdSystemCommandHandlers(),
});
```

## Runtime State

```ts
export interface StdSystemUnlockEntry {
  readonly unlocked: boolean;
}

export interface StdSystemState {
  readonly endings: Readonly<Record<string, StdSystemUnlockEntry>>;
  readonly cgs: Readonly<Record<string, StdSystemUnlockEntry>>;
  readonly achievements: Readonly<Record<string, StdSystemUnlockEntry>>;
}
```

Initial state:

```ts
{
  endings: {},
  cgs: {},
  achievements: {},
}
```

Repeated unlocks are idempotent and do not warn.

## Commands

### `system.unlockEnding`

```txt
call system.unlockEnding(id=trueEnd)
```

Sets `stdSystem.endings.trueEnd` to `{ unlocked: true }`.

### `system.unlockCg`

```txt
call system.unlockCg(id=textSoundLab)
```

Sets `stdSystem.cgs.textSoundLab` to `{ unlocked: true }`.

### `system.unlockAchievement`

```txt
call system.unlockAchievement(id=firstTextSoundLab)
```

Sets `stdSystem.achievements.firstTextSoundLab` to `{ unlocked: true }`.

For all commands, `id` is required, may be an identifier or non-empty string,
and extra arguments are rejected by plugin command metadata.

## Condition Policy

The MVP supports unlock commands and durable runtime state. `if system.*`
condition evaluation remains deferred: the compiler still rejects system
condition references. Use scenario state for branching until a renderer-neutral
system condition resolver is added.

## Persistence Policy

std-system state is durable runtime state and may be saved and restored with
runtime snapshots. The plugin package does not persist to browser storage.
Examples or games that want cross-session unlocks should copy the
`stdSystem` state into their own storage layer and safely ignore corrupt stored
data.
