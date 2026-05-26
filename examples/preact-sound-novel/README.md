# Tsuzuru Preact Sound Novel Example

This example is dedicated to long-form sound-novel presentation checks. It uses
`TsuzuruGame` with `messagePresentation="novel"` through the object form:

```tsx
<TsuzuruGame
  scenario={scenario}
  assets={assets}
  messagePresentation={{ mode: "novel", speakerMode }}
  text={{ reveal: true, charactersPerSecond }}
/>
```

The scenario is intentionally prose-heavy. It includes long narration blocks,
multi-line dialogue, choices, placeholder background changes, light standard
audio/effect commands, and enough text to inspect reveal timing and overflow
behavior on the fullscreen novel text layer.

The preview controls in the top-right corner let you switch:

- `speakerMode`: `inline`, `block`, `hidden`
- text speed: `30`, `60`, `120` characters per second

The example does not bundle image or audio files. Backgrounds are placeholder
CSS classes registered from `src/assets.ts`, and missing audio assets are safe
for this preview.

```sh
pnpm --filter @tsuzuru/example-preact-sound-novel dev
pnpm --filter @tsuzuru/example-preact-sound-novel check:scenario
pnpm --filter @tsuzuru/example-preact-sound-novel typecheck
pnpm --filter @tsuzuru/example-preact-sound-novel build
pnpm --filter @tsuzuru/example-preact-sound-novel test
pnpm --filter @tsuzuru/example-preact-sound-novel test:ui
```
