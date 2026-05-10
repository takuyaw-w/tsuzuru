# Tsuzuru HTML Basic Example

This example shows the no-framework browser playback path for Tsuzuru.

It uses `@tsuzuru/html` from plain HTML and Vanilla DOM. It does not use Preact,
React, Vue, TSX, or JSX.

The app is declarative: screens live in `index.html`, navigation uses hash links
such as `href="#runtime"`, and project settings live in
`public/tsuzuru.app.json`. Source scenario files live in `scenario/`, screen
fragments live in `src/screens/`, and `assets.ts` maps asset IDs to browser
URLs. The TypeScript entrypoint only wires those source files into the
declarative app:

```ts
import { mountTsuzuruHtmlAppsFromDocument, normalizeTsuzuruHtmlAssetsManifest } from "@tsuzuru/html";
import "@tsuzuru/html/style.css";
import { assets as assetsManifest } from "../assets.js";
import settingsHtml from "./screens/settings.html?raw";
import "./style.css";

const assets = normalizeTsuzuruHtmlAssetsManifest(assetsManifest, new URL("../assets.ts", import.meta.url));

await mountTsuzuruHtmlAppsFromDocument(document, {
  assets,
  screenFragments: {
    settings: settingsHtml,
  },
});
```

## Commands

```sh
pnpm --filter @tsuzuru/example-html-basic dev
pnpm --filter @tsuzuru/example-html-basic check:scenario
pnpm --filter @tsuzuru/example-html-basic test
pnpm --filter @tsuzuru/example-html-basic test:ui
pnpm --filter @tsuzuru/example-html-basic typecheck
pnpm --filter @tsuzuru/example-html-basic build
```

`dev`, `typecheck`, and `build` first build `@tsuzuru/html` so the example uses
the package's exported JavaScript and CSS paths.

`check:scenario` runs `tsuzuru check` through `tsuzuru.config.ts`. The CLI
validates `scenario/main.tzr` and `scenario/**/*.tzr`. The browser still loads
the entry scenario as `/scenario/main.tzr`; `vite.config.ts` serves and copies
the source `scenario/` directory to that browser URL.

## Files To Edit

Most users should not need to edit the TypeScript app implementation.
`assets.ts` is a typed data table for asset IDs and browser URLs.

Common editing targets:

- `index.html`: title, runtime, backlog, and gallery screen markup
- `public/tsuzuru.app.json`: title, scenario URL, initial screen, and storage
  key prefix
- `assets.ts`: asset ID to browser URL mapping
- `scenario/**/*.tzr`: scenario text
- `src/screens/*.html`: source screen fragments such as Settings
- `src/style.css`: visual styling
- `public/assets/images`: image files
- `public/assets/audio`: audio file location when real audio is added

Files usually left alone:

- `src/main.ts`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`

## Declarative Markup

`@tsuzuru/html` recognizes these attributes:

- `data-tsuzuru-html-app`: app root
- `data-config="/tsuzuru.app.json"`: app config URL
- `data-tsuzuru-screen="title"`: screen element
- `data-tsuzuru-runtime`: runtime mount point
- `data-tsuzuru-backlog`: session backlog mount point
- `data-tsuzuru-gallery`: gallery mount point
- `data-tsuzuru-setting="textFontSize"`
- `data-tsuzuru-setting="messageWindowOpacity"`
- `data-tsuzuru-setting="audioNoticesVisible"`
- `data-tsuzuru-setting-output="..."`

Hash links switch screens:

```html
<a href="#runtime">Start</a>
<a href="#backlog">Backlog</a>
<a href="#settings">Settings</a>
<a href="#gallery">Gallery</a>
```

Do not remove required `data-tsuzuru-*` attributes unless you also update the
screen behavior they connect to.

## App Config

`public/tsuzuru.app.json` uses version 1:

```json
{
  "version": 1,
  "title": "Tsuzuru HTML Basic",
  "scenario": {
    "entryUrl": "/scenario/main.tzr",
    "entryId": "scenario/main.tzr"
  },
  "initialScreen": "title",
  "storageKeyPrefix": "tsuzuru:example-html-basic"
}
```

`assetsUrl` is not used by this example. Instead, `src/main.ts` imports
`assets.ts`, normalizes it with `normalizeTsuzuruHtmlAssetsManifest`, and passes
the normalized assets directly to `@tsuzuru/html`. `assetsUrl` remains supported
by the package for apps that prefer a fetched JSON manifest.

## Scenario And Assets

```txt
scenario/
  main.tzr
  chapters/
    01-opening.tzr
assets.ts
src/screens/
  settings.html
public/assets/
  images/
    backgrounds/
      room.svg
    sprites/
      mio-smile.svg
  audio/
```

`main.tzr` includes the chapter file so the example exercises URL-based include
resolution. `assets.ts` maps visual and audio asset IDs to browser URLs. The
actual image files stay under `public/assets/images`, and future audio files
should be placed under `public/assets/audio`.

Audio entries are present in `assets.ts`, but the example intentionally does not
ship audio files. Missing audio files and autoplay failures are treated as
non-fatal notices by `@tsuzuru/html`.

## Current Limits

Save/load, Auto, Skip, read tracking persistence, rich visual transitions, and
production audio policy are still outside this example. Backlog is not persisted
across reloads.
