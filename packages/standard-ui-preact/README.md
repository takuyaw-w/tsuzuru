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
  RuntimeMessageLayer,
  StdAudioLayer,
  StdVisualLayer,
} from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
```

The package provides UI components such as `GameViewport`, `GameShell`,
`MessageWindow`, `ChoiceLayer`, `StatusLayer`, `RuntimeMessageLayer`,
`StdVisualLayer`, `StdAudioLayer`, and `ScreenHost`, plus the high-level
`TsuzuruGame` starter component.

`TsuzuruGame` handles the standard starter runtime wiring for visual/audio
plugins, message display, choices, click/keyboard advance, text reveal, and
basic asset playback. It does not own save/load, backlog, gallery, settings,
custom screens, or project-specific asset bundling policy. Use `@tsuzuru/preact`
directly with `StdVisualLayer` / `StdAudioLayer` when an app needs full runtime
control but still wants the standard visual and audio presentation layers.
