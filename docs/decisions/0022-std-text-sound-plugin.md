# 0022: Standard Text Sound Plugin

## Status

Accepted

## Context

Visual novels often use short sounds synchronized with text reveal, commonly
called popopo / text blip sound.

The first std-text-sound MVP only stored a current `assetId` and the examples
mapped `soft` to a raw `frequencyHz`. That made the author-facing model too
technical and pushed character-specific defaults into scenario commands.

Text sound should usually be chosen by narration / character defaults, while
scenario commands should only override that default for special direction.

## Decision

`@tsuzuru/plugin-std-text-sound` keeps the `stdTextSound` plugin state key, but
state now stores only an optional override profile ID:

```ts
{
  overrideProfileId: string | null;
}
```

The package exports a profile model based on:

- `tone` profiles with `note: "C5"` style note names
- `noise` profiles with `color: "white" | "pink"`
- `mix` profiles that play `tone` and `noise` layers together

The valid spelling is `noise`; `noize` is not supported. `frequencyHz` is not a
public profile field. The package converts notes with `noteToFrequencyHz()`.

The package also exports:

- `resolveStdTextSoundProfile()` for override / character / dialogue / narration defaults
- `shouldPlayStdTextSoundCharacter()` for common punctuation and whitespace skips
- `resolveStdTextSoundDurationMs()`
- `createStdTextSoundPlayer()` from `@tsuzuru/plugin-std-text-sound/browser`

The browser player helper is intentionally a subpath export because it uses Web
Audio types. The main package entry remains renderer-neutral.

## Commands

`textSound profileId` and `stopTextSound` remain as advanced override commands.

They are retained because Tsuzuru already has compiler sugar and plugin command
metadata for them, and keeping them does not change core runtime semantics.
Normal scenarios should rely on default mapping instead of repeating
`textSound` commands.

`textSound` requires one non-empty string argument and sets
`overrideProfileId`. `stopTextSound` requires no arguments and clears the
override. Calling `stopTextSound` with no active override is a no-op.

## Rationale

Text sound is presentation behavior tied to text reveal timing. The plugin
should not own runtime stepping, text reveal, DOM, audio files, or asset loading.

At the same time, profile shape, note conversion, duration mapping, basic skip
policy, and a small browser player are shared enough to live in the package.
This keeps examples from carrying duplicate oscillator code while preserving the
renderer-neutral runtime state.

## Consequences

### Positive

- Authors can configure `note: "E5"` instead of raw frequencies.
- Character-specific defaults are app configuration, not repeated scenario text.
- The Preact example uses the shared profile resolver and browser player.
- `std-audio`, `std-visual`, and core runtime semantics stay unchanged.

### Negative

- Apps still need to connect text reveal callbacks to playback.
- The browser helper covers generated tone / noise only; real audio file mapping
  remains app-owned future work.
- Profile validation is TypeScript-oriented in the MVP rather than a runtime
  schema validator.

## Reconsideration Criteria

- A standard asset manifest becomes part of Tsuzuru.
- Core / adapters expose a shared text reveal event stream.
- Non-browser renderers need a first-party player helper with the same profile
  model.

## Related Documents

- `docs/plugins/std-text-sound.md`
- `docs/plugins/std-audio.md`
- `docs/decisions/0005-std-audio-plugin.md`
- `docs/decisions/0012-text-preferences-mvp.md`
