# @tsuzuru/plugin-std-text-sound

Standard text sound plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene start:
  textSound soft
  narration:
    Text reveal can play a short blip per character.
  stopTextSound
```

## Usage

```ts
import {
  createStdTextSoundCommandHandlers,
  createStdTextSoundPlugin,
} from "@tsuzuru/plugin-std-text-sound";
```

The plugin owns only renderer-neutral text sound state. It does not play audio,
create an `AudioContext`, use timers, or resolve assets.
