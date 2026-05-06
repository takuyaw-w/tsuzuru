# @tsuzuru/standard-ui-preact

Reusable Preact UI components for Tsuzuru visual novel screens.

## Usage

```tsx
import { GameShell, GameViewport, RuntimeMessageLayer } from "@tsuzuru/standard-ui-preact";
import "@tsuzuru/standard-ui-preact/style.css";
```

The package provides UI components such as `GameViewport`, `GameShell`,
`MessageWindow`, `ChoiceLayer`, `StatusLayer`, `RuntimeMessageLayer`, and
`ScreenHost`.

It does not parse scenarios, step the runtime, load assets, or own save/load
behavior. Use `@tsuzuru/preact` for runtime hooks.
