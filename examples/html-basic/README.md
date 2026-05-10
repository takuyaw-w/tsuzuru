# Tsuzuru HTML Basic Example

This example shows the no-framework browser playback path for Tsuzuru.

It uses `@tsuzuru/html` directly from Vanilla DOM code. It does not use Preact,
React, Vue, TSX, or JSX.

The host app is also written with Vanilla DOM. It provides a title screen,
runtime screen, session-only backlog, example-owned settings, and an asset
gallery while keeping scenario playback inside `@tsuzuru/html`.

The app starts by loading HTML screen templates, then the runtime screen mounts
the HTML adapter with a scenario URL:

```ts
import "@tsuzuru/html/style.css";
import { createHtmlBasicApp } from "./app.js";
import "./style.css";

const root = document.getElementById("app");

if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #app element.");
}

await createHtmlBasicApp(root);
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

`test` covers small host-app helpers. `test:ui` runs a Playwright smoke test for
the title/runtime/backlog/settings/gallery flow.

## Scenario Files

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

The image files are small SVG assets generated for this repository example.
Audio entries are present in `assets.json`, but the example intentionally does
not ship audio files. Missing audio files and autoplay failures are treated as
non-fatal notices by `@tsuzuru/html`.

## Screens

- Title: starts runtime playback and links to Backlog / Settings / Gallery.
- Runtime: mounts `@tsuzuru/html` and keeps a small Vanilla DOM control bar.
- Backlog: records narration and dialogue visible events for the current
  browser session only.
- Settings: stores text font size, message window opacity, and notice display
  preferences in `localStorage`, then applies them through CSS variables.
- Gallery: reads `assets.json` and displays visual assets with thumbnails; audio
  assets are listed by ID because the example does not ship audio files.

## Editable Templates

The screen structure lives in plain HTML files under `public/screens/`.
Non-engineers can edit copy and markup in these files without touching
TypeScript:

- `public/screens/title.html`
- `public/screens/backlog.html`
- `public/screens/settings.html`
- `public/screens/gallery.html`
- `public/screens/runtime-menu.html`

Other commonly edited files are:

- `src/style.css` for visual styling
- `public/scenario/**/*.tzr` for scenario text
- `public/assets/assets.json` for asset IDs and browser URLs

TypeScript in `src/app.ts` loads those templates and connects behavior through
the following template contract:

- `data-action="start"`
- `data-action="back"`
- `data-action="open-backlog"`
- `data-action="open-settings"`
- `data-action="open-gallery"`
- `data-action="return-title"`
- `data-slot="backlog-list"`
- `data-slot="gallery-content"`
- `data-slot="settings-form"`
- `data-slot="runtime-root"`
- `data-slot="runtime-menu"`
- `data-field="text-font-size"`
- `data-field="message-window-opacity"`
- `data-field="audio-notices-visible"`

Dynamic runtime text, backlog entries, settings values, and asset IDs are
inserted with `textContent` or DOM attributes. Removing required `data-action`,
`data-slot`, or `data-field` attributes will break the connected behavior and
show a template error in the player.

## Current Limits

Save/load, Auto, Skip, read tracking persistence, rich visual transitions, and
production audio policy are still outside this example. Backlog is not persisted
across reloads.
