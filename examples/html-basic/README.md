# Tsuzuru HTML Basic Example

This example shows the first no-framework browser playback path for Tsuzuru.

It uses `@tsuzuru/html` directly from Vanilla DOM code. It does not use Preact,
React, Vue, TSX, or JSX.

Current scope is intentionally small: this plays a `.tzr` scenario from browser
URLs and demonstrates include-based multi-file loading, narration, dialogue,
choices, timed waits, std-visual background/sprite rendering, std-audio event
handling, and end state rendering.

The example mounts the HTML adapter with a scenario URL:

```ts
import { mountTsuzuruHtml } from "@tsuzuru/html";
import "@tsuzuru/html/style.css";
import "./style.css";

const root = document.getElementById("app");

if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #app element.");
}

await mountTsuzuruHtml(root, {
  title: "Tsuzuru HTML Basic",
  className: "html-basic-player",
  scenario: {
    entryUrl: "/scenario/main.tzr",
    entryId: "public/scenario/main.tzr",
  },
  assetsUrl: "/assets/assets.json",
});
```

## Commands

```sh
pnpm --filter @tsuzuru/example-html-basic dev
pnpm --filter @tsuzuru/example-html-basic check:scenario
pnpm --filter @tsuzuru/example-html-basic typecheck
pnpm --filter @tsuzuru/example-html-basic build
```

`dev`, `typecheck`, and `build` first build `@tsuzuru/html` so the example uses
the package's exported JavaScript and CSS paths.

`check:scenario` runs `tsuzuru check` through `tsuzuru.config.ts`. The browser
loads `/scenario/main.tzr` from Vite's public directory, while the CLI validates
the same files on disk from `public/scenario/main.tzr` and
`public/scenario/**/*.tzr`.

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

## Current Limits

Save/load, backlog, settings, rich visual transitions, and production audio
policy are still outside this example.
