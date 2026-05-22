# @tsuzuru/vite-plugin

`@tsuzuru/vite-plugin` lets Vite applications import `.tzr` scenario files as
compiled Tsuzuru runtime documents.

```ts
import scenario from "../scenario/main.tzr";
```

## Installation

```sh
pnpm add @tsuzuru/vite-plugin
```

## Vite Configuration

```ts
import { tsuzuru } from "@tsuzuru/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tsuzuru()],
});
```

When a scenario uses plugin-owned `call` commands, pass the same compile-time
plugin definitions that `tsuzuru.config.ts` uses for scenario checks:

```ts
import { createStdSystemPlugin } from "@tsuzuru/plugin-std-system";
import { tsuzuru } from "@tsuzuru/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tsuzuru({
      plugins: [createStdSystemPlugin()],
    }),
  ],
});
```

The plugin also accepts the explicit query form when a project needs it:

```ts
import scenario from "../scenario/main.tzr?tsuzuru";
```

Vite's built-in `?raw` and `?url` queries are left alone.

## TypeScript

Add the client types to the application `tsconfig.json`.

```json
{
  "compilerOptions": {
    "types": ["vite/client", "@tsuzuru/vite-plugin/client"]
  }
}
```

The default export of `*.tzr` is typed as `CompiledTzrDocument` from
`@tsuzuru/core`.

## Include Support

Top-level `include "./chapter.tzr"` directives are followed recursively from
the imported entry file. Include paths are resolved relative to the file that
contains the directive, and included files are registered with Vite's watcher.

## Diagnostics

Parse and compile failures are reported as Vite build errors. Diagnostics use
Tsuzuru's source location data and include the `.tzr` file path, line, and
column when available.

## Limitations

- The plugin compiles scenarios only; it does not initialize the runtime.
- Asset IDs in `.tzr` files remain renderer or application concerns.
- Source maps for generated modules are not emitted yet.
