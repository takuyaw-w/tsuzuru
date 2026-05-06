# @tsuzuru/plugin-std-audio

Standard audio plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene start:
  bgm daily_theme
  se page
  voice mio_001
  stopBgm
```

## Usage

```ts
import {
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
} from "@tsuzuru/plugin-std-audio";
```

The plugin owns BGM state and one-shot SE/voice events. It does not load or
bundle audio assets.
