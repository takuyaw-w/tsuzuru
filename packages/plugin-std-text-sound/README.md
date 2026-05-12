# @tsuzuru/plugin-std-text-sound

Standard text sound plugin state, profile helpers, and browser playback helper
for Tsuzuru.

## Profiles

```ts
import type { StdTextSoundConfig } from "@tsuzuru/plugin-std-text-sound";

export const textSound = {
  profiles: {
    narration: { type: "noise", color: "white", duration: "short", volume: 0.18 },
    mio: {
      type: "mix",
      duration: "short",
      layers: [
        { type: "tone", note: "E5", waveform: "triangle", volume: 0.7 },
        { type: "noise", color: "white", volume: 0.12 },
      ],
    },
  },
  defaults: {
    narration: "narration",
    dialogue: "mio",
    characters: { mio: "mio" },
  },
} satisfies StdTextSoundConfig;
```

## Usage

```ts
import {
  createStdTextSoundCommandHandlers,
  createStdTextSoundPlugin,
} from "@tsuzuru/plugin-std-text-sound";
import { createStdTextSoundPlayer } from "@tsuzuru/plugin-std-text-sound/browser";
```

The main plugin owns only renderer-neutral state:

```ts
{ overrideProfileId: string | null }
```

`textSound profileId` and `stopTextSound` remain available as advanced override
commands. Normal usage should prefer narration / character defaults and resolve
profiles from the text reveal callback.

The `/browser` helper uses Web Audio for generated `tone`, `noise`, and `mix`
profiles. Real audio files are not bundled or resolved by this package.
