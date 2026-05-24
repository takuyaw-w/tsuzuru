# @tsuzuru/standard-ui-preact

Reusable Preact UI components and a starter game shell for Tsuzuru visual novel screens.

## Usage

For a creator-facing Vite starter, import a `.tzr` file through
`@tsuzuru/vite-plugin` and pass the compiled scenario to `TsuzuruGame`.

```tsx
import { TsuzuruGame } from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
import scenario from "../scenario/main.tzr";

export function App() {
  return <TsuzuruGame scenario={scenario} assets={assets} />;
}
```

`assets` maps DSL asset IDs to image or audio resources. Image entries can also
omit `src` and provide a `label` / `className` for CSS placeholders.

## Message presentation

`TsuzuruGame` uses the default dialogue presentation unless
`messagePresentation` is set. The default style renders narration and dialogue
through the standard message window, with dialogue showing the speaker label as
part of the window.

```tsx
<TsuzuruGame scenario={scenario} assets={assets} messagePresentation="novel" />
```

`messagePresentation="novel"` renders narration and dialogue through the novel
presentation path (`RuntimeNovelTextLayer` and `NovelTextWindow`) for a
prose-forward text layout. This only changes how message events are displayed;
it does not change `.tzr` syntax, compiled scenario output, branching, choices,
state updates, or other scenario semantics.

Novel presentation can be tuned with `speakerMode`:

- `inline`: render dialogue with the speaker inline with the message text.
- `block`: render the speaker as a separate first line.
- `hidden`: hide speaker names and render the message body only.

```tsx
<TsuzuruGame scenario={scenario} assets={assets} messagePresentation={{ mode: "novel", speakerMode: "block" }} />
```

Lower-level components remain available when an app wants to own runtime wiring
directly.

```tsx
import {
  GameShell,
  GameViewport,
  NovelTextWindow,
  RuntimeControlBar,
  RuntimeMessageLayer,
  RuntimeNovelTextLayer,
  createAudioAssetsWithVolume,
  StdAudioLayer,
  StdAudioRuntimeLayer,
  StdAudioStatusPanel,
  StdCameraLayer,
  StdCameraRuntimeLayer,
  StdEffectLayer,
  StdParticleLayer,
  StdParticleRuntimeLayer,
  StdVisualLayer,
  StdVisualRuntimeLayer,
  useStdAudioNotices,
} from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
```

The package provides UI components such as `GameViewport`, `GameShell`,
`MessageWindow`, `NovelTextWindow`, `ChoiceLayer`, `StatusLayer`,
`RuntimeMessageLayer`, `RuntimeNovelTextLayer`, `RuntimeControlBar`,
`StdVisualLayer`, `StdAudioLayer`, `StdEffectLayer`, and `StdCameraLayer`,
`StdParticleLayer`, `ScreenHost`, Screen primitives, plus the high-level
`TsuzuruGame` starter component.

Screen primitives such as `Screen`, `ScreenPanel`, `ScreenHeading`,
`ScreenButton`, `ScreenField`, `ScreenList`, `ScreenListItem`, and `ScreenBadge`
are low-level building blocks for project-specific title, settings, save/load,
backlog, and gallery screens. They are not complete screen implementations. See
the repository docs: `docs/ui/screen-primitives.md`.
For form rows, `ScreenField` accepts `controlId` so the visible label can be
associated with the child control's `id`.

`RuntimeControlBar` provides a reusable in-game control bar for actions such as
Auto, Skip, Save, Load, Backlog, Settings, and Title. It is presentational only;
applications provide handlers and own the actual save/load/backlog/settings
logic.

`StdEffectLayer` renders standard effect events from
`@tsuzuru/plugin-std-effect`, such as flash, shake, pulse, and blur. Applications
can pass custom target selectors when their DOM structure differs from the
standard game shell.

`StdParticleLayer` renders the current state from
`@tsuzuru/plugin-std-particle` using standard particle presets such as rain,
snow, sakura, and dust. `StdParticleRuntimeLayer` is a thin bridge that reads
`stdParticle` state from the runtime and passes it to `StdParticleLayer`.

`StdVisualRuntimeLayer` is a thin bridge that reads `stdVisual` state from a
runtime state and delegates rendering to `StdVisualLayer`. It does not handle
camera state or example-specific placeholders. `StdVisualLayer` renders basic
std-visual background update
transitions and sprite show transitions without blocking runtime progression.
Initial mount uses the current visual state without replaying durable transition
metadata; `hide` / `clearBg` / `clearSprites` exit transitions are not handled
yet.

`StdCameraLayer` wraps visual children in a standard camera transform container.
`StdCameraRuntimeLayer` is a thin bridge that reads `stdCamera` state from the
runtime and delegates to `StdCameraLayer`. Applications can pass a
`resolveFocusOffset` callback when `cameraFocus` targets need app-specific
coordinate policy.

`StdAudioRuntimeLayer` connects a `StdAudioState` to standard browser playback,
audio notices, and an optional status panel. `StdAudioLayer` handles the
playback side effects, while `StdAudioStatusPanel` can display the current BGM,
latest SE/Voice event, and audio notices. `useStdAudioNotices` converts playback
diagnostics into a small deduplicated notice list, and
`createAudioAssetsWithVolume` turns simple asset path maps into volume-aware
audio asset maps. Applications still own asset maps and volume preferences.

`TsuzuruGame` handles the standard starter runtime wiring for visual/audio/effect
plugins, message display, choices, click/keyboard advance, text reveal, basic
asset playback, and simple standard effects. It does not own save/load, backlog,
gallery, settings, custom screens, or project-specific asset bundling policy.
Use `@tsuzuru/preact` directly with `StdVisualLayer` /
`StdVisualRuntimeLayer` / `StdCameraRuntimeLayer` / `StdAudioRuntimeLayer` /
`StdEffectLayer` / `StdParticleRuntimeLayer` / `RuntimeControlBar` when an app
needs full runtime control but still wants the standard presentation layers.
