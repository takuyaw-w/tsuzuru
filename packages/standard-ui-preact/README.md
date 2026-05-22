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

Lower-level components remain available when an app wants to own runtime wiring
directly.

```tsx
import {
  GameShell,
  GameViewport,
  RuntimeControlBar,
  RuntimeMessageLayer,
  createAudioAssetsWithVolume,
  StdAudioLayer,
  StdAudioRuntimeLayer,
  StdAudioStatusPanel,
  StdEffectLayer,
  StdVisualLayer,
  useStdAudioNotices,
} from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
```

The package provides UI components such as `GameViewport`, `GameShell`,
`MessageWindow`, `ChoiceLayer`, `StatusLayer`, `RuntimeMessageLayer`,
`RuntimeControlBar`, `StdVisualLayer`, `StdAudioLayer`, `StdEffectLayer`, and
`ScreenHost`, plus the high-level `TsuzuruGame` starter component.

`RuntimeControlBar` provides a reusable in-game control bar for actions such as
Auto, Skip, Save, Load, Backlog, Settings, and Title. It is presentational only;
applications provide handlers and own the actual save/load/backlog/settings
logic.

`StdEffectLayer` renders standard effect events from
`@tsuzuru/plugin-std-effect`, such as flash, shake, pulse, and blur. Applications
can pass custom target selectors when their DOM structure differs from the
standard game shell.

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
`StdAudioRuntimeLayer` / `StdEffectLayer` / `RuntimeControlBar` when an app
needs full runtime control but still wants the standard presentation layers.
