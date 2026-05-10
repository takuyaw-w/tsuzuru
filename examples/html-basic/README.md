# Tsuzuru HTML Basic Example

This example shows the no-framework browser playback path for Tsuzuru.

It uses `@tsuzuru/html` from plain HTML and Vanilla DOM. It does not use Preact,
React, Vue, TSX, or JSX.

The app is declarative: screens live in `index.html`, navigation uses hash links
such as `href="#runtime"`, and project settings live in
`public/tsuzuru.app.json`. The only TypeScript entrypoint mounts declarative
apps from the document:

```ts
import { mountTsuzuruHtmlAppsFromDocument } from "@tsuzuru/html";
import "@tsuzuru/html/style.css";
import "./style.css";

await mountTsuzuruHtmlAppsFromDocument();
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

`check:scenario` runs `tsuzuru check` through `tsuzuru.config.ts`. The browser
loads `/scenario/main.tzr` from Vite's public directory, while the CLI validates
the same files on disk from `public/scenario/main.tzr` and
`public/scenario/**/*.tzr`.

## Files To Edit

Most users should not need to edit TypeScript.

Common editing targets:

- `index.html`: title, runtime, backlog, and gallery screen markup
- `public/tsuzuru.app.json`: title, scenario URL, assets URL, initial screen,
  and storage key prefix
- `public/screens/settings.html`: external Settings screen fragment
- `public/scenario/**/*.tzr`: scenario text
- `public/assets/assets.json`: asset ID to browser URL mapping
- `src/style.css`: visual styling

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
- `data-src="/screens/settings.html"`: external screen fragment URL
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
    "entryId": "public/scenario/main.tzr"
  },
  "assetsUrl": "/assets/assets.json",
  "initialScreen": "title",
  "storageKeyPrefix": "tsuzuru:example-html-basic"
}
```

## Scenario And Assets

```txt
public/scenario/
  main.tzr
  chapters/
    01-opening.tzr
public/assets/
  assets.json
  images/
    backgrounds/
      room.svg
    sprites/
      mio-smile.svg
```

`main.tzr` includes the chapter file so the example exercises URL-based include
resolution. `assets.json` maps visual and audio asset IDs to browser URLs.

Audio entries are present in `assets.json`, but the example intentionally does
not ship audio files. Missing audio files and autoplay failures are treated as
non-fatal notices by `@tsuzuru/html`.

## Current Limits

Save/load, Auto, Skip, read tracking persistence, rich visual transitions, and
production audio policy are still outside this example. Backlog is not persisted
across reloads.
