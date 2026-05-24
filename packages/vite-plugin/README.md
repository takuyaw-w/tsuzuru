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

In most projects, keep compile-time plugin definitions in `tsuzuru.config.ts`
and call `tsuzuru()` from `vite.config.ts`.

```ts
import { tsuzuru } from "@tsuzuru/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tsuzuru()],
});
```

By default, `tsuzuru()` looks for `tsuzuru.config.ts` from the Vite root and
uses `config.plugins` as compile-time plugins. This keeps Vite builds and
`tsuzuru check` on the same plugin source of truth.

Use an explicit `plugins` option only when Vite needs to override the project
config. Explicit plugins take priority over `tsuzuru.config.ts`, including an
empty array. When explicit plugins are provided, the Vite plugin does not load
or watch `tsuzuru.config.ts`.

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

To disable config loading completely, pass `configFile: false`.

```ts
export default defineConfig({
  plugins: [tsuzuru({ configFile: false })],
});
```

To load a different config file, pass a path relative to the Vite root or an
absolute path.

```ts
export default defineConfig({
  plugins: [tsuzuru({ configFile: "config/tsuzuru.config.ts" })],
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
When a config file is loaded, it is also registered with Vite's watcher.

## Diagnostics

Parse and compile failures are reported as Vite build errors. Diagnostics use
Tsuzuru's source location data and include the `.tzr` file path, line, and
column when available.

## Limitations

- The plugin compiles scenarios only; it does not initialize the runtime.
- Asset IDs in `.tzr` files remain renderer or application concerns.
- Source maps for generated modules are not emitted yet.
