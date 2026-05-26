# Tsuzuru Themes

Official Tsuzuru theme packages are CSS variable themes for `@tsuzuru/standard-ui-preact`.
They are not runtime plugins and do not change scenario, runtime, compiler, or
plugin behavior.

Theme CSS overrides the variables used by `@tsuzuru/standard-ui-preact/style.css`.
Import the standard UI CSS first, import one theme stylesheet after it, then
apply that theme package's class name to a wrapper around the standard UI.

```tsx
import "@tsuzuru/standard-ui-preact/style.css";
import "@tsuzuru/theme-standard/style.css";
import { standardThemeClassName } from "@tsuzuru/theme-standard";
import { TsuzuruGame } from "@tsuzuru/standard-ui-preact";

export function App() {
  return (
    <div className={standardThemeClassName}>
      <TsuzuruGame scenario={scenario} assets={assets} />
    </div>
  );
}
```

## Official Themes

- `@tsuzuru/theme-standard`
- `@tsuzuru/theme-classic`
- `@tsuzuru/theme-dark-novel`
- `@tsuzuru/theme-minimal`

Each package exports its theme class name and a `style.css` subpath.

## Local Theme

Applications can define their own theme class by setting the same CSS variables
used by `@tsuzuru/standard-ui-preact`.

```css
.tzr-theme-custom {
  --tzr-standard-ui-font-family: ui-serif, "Hiragino Mincho ProN", serif;
  --tzr-standard-ui-text-color: #fff8e7;
  --tzr-standard-ui-accent-color: #ffd27a;
  --tzr-standard-ui-window-bg: rgba(16, 18, 24, 0.9);
  --tzr-standard-ui-window-border: rgba(255, 232, 188, 0.45);
  --tzr-standard-ui-window-radius: 8px;
}
```

```tsx
import "@tsuzuru/standard-ui-preact/style.css";
import "./my-tsuzuru-theme.css";

export function App() {
  return (
    <div className="tzr-theme-custom">
      <TsuzuruGame scenario={scenario} assets={assets} />
    </div>
  );
}
```
