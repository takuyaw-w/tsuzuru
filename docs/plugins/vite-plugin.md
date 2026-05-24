# @tsuzuru/vite-plugin

`@tsuzuru/vite-plugin` lets Vite applications import `.tzr` scenario files
directly as compiled Tsuzuru runtime documents.

```ts
import scenario from "../scenario/main.tzr";
```

## Installation

```sh
pnpm add @tsuzuru/vite-plugin
```

## Vite config

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

The primary import form is queryless `.tzr`:

```ts
import scenario from "../scenario/main.tzr";
```

The explicit query form is also supported:

```ts
import scenario from "../scenario/main.tzr?tsuzuru";
```

The plugin intentionally ignores Vite's built-in `?raw` and `?url` query
forms.

## TypeScript declaration

Add the client declarations to the app `tsconfig.json`.

```json
{
  "compilerOptions": {
    "types": ["vite/client", "@tsuzuru/vite-plugin/client"]
  }
}
```

`*.tzr` and `*.tzr?tsuzuru` default exports are typed as
`CompiledTzrDocument` from `@tsuzuru/core`.

## Include support

Top-level `include "./chapter.tzr"` directives are followed recursively from
the imported entry file. Include paths are resolved relative to the file that
contains the directive.

The entry file and every discovered include are registered with Vite's watcher
with `this.addWatchFile(...)`, so edits to included `.tzr` files invalidate the
compiled module.

When a config file is loaded, it is also registered with Vite's watcher.

## Diagnostics

Parse and compile failures are reported as Vite errors. The error message uses
Tsuzuru diagnostics in this shape:

```txt
[error] scenario/main.tzr:2:3 Unknown scene "missing".
```

When source location data is available, the Vite error also includes file,
line, column, and a one-line source frame.

## Limitations

- The plugin only compiles scenario files into ESM modules.
- Runtime initialization, UI, save/load, asset path resolution, and audio or
  image loading remain app/runtime responsibilities.
- Source maps for generated scenario modules are not emitted yet.
