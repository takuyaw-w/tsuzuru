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

## Fixed Themes in Games

Normal games and starter projects should apply one fixed theme for the work.
Choose the theme in application code, import only the CSS needed for that
theme, and pass the theme object to `TsuzuruThemeProvider`. This does not
affect runtime state, save data, or `.tzr` scenario behavior.

```tsx
import "@tsuzuru/standard-ui-preact/style.css";
import "@tsuzuru/theme-standard/style.css";
import { standardTheme, TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";

export function App() {
  return <TsuzuruThemeProvider theme={standardTheme}>{/* app */}</TsuzuruThemeProvider>;
}
```

Runtime theme switching is not the standard starter's main purpose. If a project
needs to compare multiple themes or demonstrate theme switching, keep that in a
dedicated showcase or example rather than in the starter game flow.

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

Keep the chosen theme in application code or config as a theme id. `.tzr`
scenarios should not switch themes, and custom themes should not replace
standard UI components.

## Theme Helper API

`@tsuzuru/standard-ui-preact` exports the public theme object types and CSS
variable helper API for applications that need to validate or derive local theme
data:

- `TsuzuruTheme`
- `TsuzuruThemeCssVariables`
- `TsuzuruThemeCssVariableName`
- `createTsuzuruThemeCssVariables`
- `resolveTsuzuruTheme`

Use these helpers in application code or tooling around standard UI themes.
Theme packages remain CSS variable packages; they do not own runtime behavior or
scenario-driven theme switching.
