# Tsuzuru HTML Basic Example

This example shows the first no-framework browser path for Tsuzuru.

It uses `@tsuzuru/html` directly from Vanilla DOM code. It does not use Preact,
React, Vue, TSX, or JSX.

Current scope is intentionally small: this is a mount example for the current
`@tsuzuru/html` public API. It does not play a scenario yet, does not load
`assets.json`, and does not demonstrate runtime stepping. Those pieces depend
on future `@tsuzuru/html` runtime controller, scenario loader, and asset loader
APIs.

The example mounts this shell:

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

## Future Scope

The placeholder `public/scenario` and `public/assets` directories are reserved
for a later example update after `@tsuzuru/html` supports scenario URL loading
and `assets.json`.
