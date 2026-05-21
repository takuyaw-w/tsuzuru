# @tsuzuru/standard-ui-preact

Reusable Preact UI components and a starter game shell for Tsuzuru visual novel screens.

## Usage

For a creator-facing starter, compile a scenario project with the built-in
standard visual/audio plugin set and pass it to `TsuzuruGame`.

```tsx
import { defineTsuzuruGameScenario, TsuzuruGame } from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";

export const scenario = defineTsuzuruGameScenario({
  entryId: "scenario/main.tzr",
  documents: [{ id: "scenario/main.tzr", source }],
});

export function App() {
  return <TsuzuruGame scenario={scenario} assets={assets} />;
}
```

`assets` maps DSL asset IDs to image or audio resources. Image entries can also
omit `src` and provide a `label` / `className` for CSS placeholders.

Lower-level components remain available when an app wants to own runtime wiring
directly.

```tsx
import { GameShell, GameViewport, RuntimeMessageLayer } from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
```

The package provides UI components such as `GameViewport`, `GameShell`,
`MessageWindow`, `ChoiceLayer`, `StatusLayer`, `RuntimeMessageLayer`, and
`ScreenHost`, plus the high-level `TsuzuruGame` starter component.

`TsuzuruGame` handles the standard starter runtime wiring for visual/audio
plugins, message display, choices, click/keyboard advance, text reveal, and
basic asset playback. It does not own save/load, backlog, gallery, settings,
custom screens, or project-specific asset bundling policy. Use `@tsuzuru/preact`
directly when an app needs full runtime control.
