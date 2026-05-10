# Tsuzuru HTML Basic Example

This example shows the first no-framework browser playback path for Tsuzuru.

It uses `@tsuzuru/html` directly from Vanilla DOM code. It does not use Preact,
React, Vue, TSX, or JSX.

Current scope is intentionally small: this plays a `.tzr` scenario from browser
URLs and demonstrates include-based multi-file loading, narration, dialogue,
choices, timed waits, and end state rendering. It does not load `assets.json`
yet, and it does not implement std-visual or std-audio rendering.

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
});
```

## Commands

```sh
pnpm --filter @tsuzuru/example-html-basic dev
pnpm --filter @tsuzuru/example-html-basic typecheck
pnpm --filter @tsuzuru/example-html-basic build
```

`dev`, `typecheck`, and `build` first build `@tsuzuru/html` so the example uses
the package's exported JavaScript and CSS paths.

## Scenario Files

```txt
public/scenario/
  main.tzr
  chapters/
    01-opening.tzr
```

`main.tzr` includes the chapter file so the example exercises URL-based include
resolution.

## Current Limits

`assets.json`, std-visual DOM rendering, std-audio browser playback, save/load,
backlog, and settings are still outside this example.
