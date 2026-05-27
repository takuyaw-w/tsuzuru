# Tsuzuru Themes

Official Tsuzuru theme packages are CSS variable themes for `@tsuzuru/standard-ui-preact`.
They are not runtime plugins and do not change scenario, runtime, compiler, or
plugin behavior.

Theme CSS overrides the variables used by `@tsuzuru/standard-ui-preact/style.css`.
Import the standard UI CSS first, import one theme stylesheet after it, then
pass the theme object to `TsuzuruThemeProvider`. Existing theme package
`className` exports and `style.css` imports remain compatible.

```tsx
import "@tsuzuru/standard-ui-preact/style.css";
import "@tsuzuru/theme-standard/style.css";
import { standardTheme, TsuzuruGame, TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";

export function App() {
  return (
    <TsuzuruThemeProvider theme={standardTheme}>
      <TsuzuruGame scenario={scenario} assets={assets} />
    </TsuzuruThemeProvider>
  );
}
```

## Official Themes

- `standardTheme`
- `classicTheme`
- `darkNovelTheme`
- `minimalTheme`

These theme objects are exported from `@tsuzuru/standard-ui-preact`. Each
theme package still provides its `style.css` subpath and class name export for
CSS compatibility.

## Switching Themes

Import every official theme stylesheet you want to offer, keep the selected
theme id in application state, and pass the selected theme object to
`TsuzuruThemeProvider`. This does not affect runtime state, save data, or
`.tzr` scenario behavior.

```tsx
import "@tsuzuru/standard-ui-preact/style.css";
import "@tsuzuru/theme-standard/style.css";
import "@tsuzuru/theme-classic/style.css";
import "@tsuzuru/theme-dark-novel/style.css";
import "@tsuzuru/theme-minimal/style.css";
import {
  classicTheme,
  darkNovelTheme,
  minimalTheme,
  standardTheme,
  TsuzuruThemeProvider,
} from "@tsuzuru/standard-ui-preact";
import { useState } from "preact/hooks";

const themes = {
  standard: standardTheme,
  classic: classicTheme,
  "dark-novel": darkNovelTheme,
  minimal: minimalTheme,
} as const;

export function App() {
  const [themeId, setThemeId] = useState<keyof typeof themes>("standard");
  const theme = themes[themeId];

  return <TsuzuruThemeProvider theme={theme}>{/* app */}</TsuzuruThemeProvider>;
}
```

## Local Theme

Applications can define their own theme object in `src/themes/*.ts` and set the
standard UI tokens used by `@tsuzuru/standard-ui-preact`.

```ts
import type { TsuzuruTheme } from "@tsuzuru/standard-ui-preact";

export const localTheme = {
  id: "local",
  name: "Local",
  tokens: {
    colors: {
      surface: "rgba(16, 18, 24, 0.9)",
      surfaceBorder: "rgba(255, 232, 188, 0.45)",
      text: "#fff8e7",
      accent: "#ffd27a",
    },
    typography: {
      fontFamily: 'ui-serif, "Hiragino Mincho ProN", serif',
    },
  },
} satisfies TsuzuruTheme;
```

```tsx
import "@tsuzuru/standard-ui-preact/style.css";
import { TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";
import { localTheme } from "./themes/localTheme.js";

export function App() {
  return (
    <TsuzuruThemeProvider theme={localTheme}>
      <TsuzuruGame scenario={scenario} assets={assets} />
    </TsuzuruThemeProvider>
  );
}
```

Keep theme selection in application UI or config as theme ids. `.tzr` scenarios
should not switch themes, and custom themes should not replace standard UI
components.
