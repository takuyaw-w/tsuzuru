# @tsuzuru/plugin-std-system

Standard system unlock plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene start:
  call system.unlockEnding(id=trueEnd)
  call system.unlockCg(id=textSoundLab)
  call system.unlockAchievement(id=firstClear)
```

## Usage

```ts
import {
  createStdSystemCommandHandlers,
  createStdSystemPlugin,
} from "@tsuzuru/plugin-std-system";
```

The plugin owns durable unlock state for endings, CGs, and achievements. It does
not persist to browser storage or render gallery / achievement UI.
