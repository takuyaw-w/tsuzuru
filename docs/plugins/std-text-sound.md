# std-text-sound plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current. The browser playback helper is exposed from the separate
> `@tsuzuru/plugin-std-text-sound/browser` subpath.

`@tsuzuru/plugin-std-text-sound` is Tsuzuru's standard plugin for popopo / text
blip sound.

The plugin keeps renderer-neutral state and command handlers. It also exports
profile types, resolver helpers, character skip policy, note conversion, and a
basic Web Audio player helper for browser apps. Actual playback is still driven
by the renderer / app text reveal callback.

The main package entry does not use DOM, timers, `Audio`, or `AudioContext`.
Browser-specific playback lives under the `/browser` subpath.

## Profile Model

Author-facing profiles use musical notes instead of raw frequencies.

```ts
import type { StdTextSoundConfig } from "@tsuzuru/plugin-std-text-sound";

export const textSound = {
  profiles: {
    narration: {
      type: "noise",
      color: "white",
      duration: "short",
      volume: 0.18,
    },
    mio: {
      type: "mix",
      duration: "short",
      volume: 0.55,
      layers: [
        { type: "tone", note: "E5", waveform: "triangle", volume: 0.7 },
        { type: "noise", color: "white", volume: 0.12 },
      ],
    },
  },
  defaults: {
    narration: "narration",
    dialogue: "mio",
    characters: {
      mio: "mio",
    },
  },
} satisfies StdTextSoundConfig;
```

Supported top-level profile types are:

- `tone`: a short oscillator sound using `note: "C5"` style note names.
- `noise`: a short white or pink noise sound. The valid spelling is `noise`; `noize` is not supported.
- `mix`: a profile-level duration and volume with multiple `tone` / `noise` layers played together.

Supported notes are sharp-only `C3` through `B6`. Flats such as `Db5` are not
part of the MVP. `frequencyHz` is not a public authoring field; the helper
`noteToFrequencyHz()` converts notes internally using A4 = 440Hz.

Durations are `short`, `normal`, and `long`, mapped by
`resolveStdTextSoundDurationMs()` to 24ms, 32ms, and 48ms.

## Defaults And Resolver

Most scenarios should not write `textSound` for every dialogue line. Configure
defaults in app / example assets and resolve them when a character is revealed.

`resolveStdTextSoundProfile(config, state, context)` uses this priority:

1. Runtime override profile ID from `state.overrideProfileId`
2. Dialogue speaker default from `defaults.characters[speakerId]`
3. Dialogue default from `defaults.dialogue`
4. Narration default from `defaults.narration`
5. `null`

`shouldPlayStdTextSoundCharacter(character)` returns `false` for empty strings,
whitespace, newlines, punctuation, and brackets, including Japanese punctuation.
It returns `true` for normal hiragana, katakana, kanji, and alphanumeric
characters.

## Runtime State

std-text-sound state is stored under `runtimeState.plugins.stdTextSound`.

```ts
export interface StdTextSoundState {
  readonly overrideProfileId: string | null;
}
```

Initial state:

```ts
{ overrideProfileId: null }
```

Use `getStdTextSoundState(runtimeState)` to read it. The helper throws if the
plugin was not registered.

## Commands

The DSL commands remain available as advanced override controls.

```txt
textSound mio
stopTextSound
```

`textSound profileId` sets `overrideProfileId` to a non-empty profile ID.
`stopTextSound` clears the override by setting `overrideProfileId` to `null`.

Normal text sound usage should prefer character / narration defaults instead of
writing these commands throughout the scenario.

## Browser Helper

Browser apps can use the optional helper:

```ts
import { createStdTextSoundPlayer } from "@tsuzuru/plugin-std-text-sound/browser";

const player = createStdTextSoundPlayer({
  defaultMinIntervalMs: 45,
  onError: (error) => {
    console.warn("text sound playback failed", error);
  },
});

player.play(profile, { volume: 0.55 });
player.destroy();
```

The player uses Web Audio:

- `tone`: `OscillatorNode` + `GainNode`
- `noise`: generated `AudioBufferSourceNode` + `GainNode`
- `mix`: tone and noise layers started together

Playback errors, including autoplay / `AudioContext.resume()` failure, are
reported through `onError` and are not thrown from `play()`.

## Presentation Policy

Volume preferences, throttle interval, punctuation skip, and speaker mapping are
presentation policy. The plugin provides helpers for common behavior, but the
renderer / app decides when to call playback from text reveal.

The Preact and Vue examples wire `resolveStdTextSoundProfile()`,
`shouldPlayStdTextSoundCharacter()`, and `createStdTextSoundPlayer()` to their
text reveal callbacks. They do not include real audio assets.
