# 0034. Use tsuzuru.config.ts as the compile-time plugin source of truth

## Status

Accepted

## Date

2026-05-25

## Context

Tsuzuru projects need compile-time plugin definitions when scenarios use
plugin-owned commands. The compiler uses these definitions to validate command
names and argument shapes before runtime.

Before this decision, examples and templates duplicated the same compile-time
plugin definitions in both `tsuzuru.config.ts` and `vite.config.ts`.

That duplication made the project model harder to explain:

```txt
tsuzuru.config.ts = Tsuzuru project config
vite.config.ts    = Vite integration plus duplicated Tsuzuru plugin config
```

It also introduced maintenance risk. Adding or removing a standard plugin could
make `tsuzuru check` and Vite dev/build disagree if only one file was updated.

This decision records the design introduced by:

- `112469fc3eb5572d7a7a321e0124131d6297c9b0`
- `9591f592524c2ca487ba13ee043f4e00e25a419d`

## Decision

Tsuzuru uses `tsuzuru.config.ts` as the source of truth for compile-time plugin
definitions.

`tsuzuru check` and `@tsuzuru/vite-plugin` both read the same project config and
use `config.plugins` for compile-time command validation. This keeps CLI checks
and Vite dev/build aligned.

`vite.config.ts` should describe Vite integration only. The standard Vite config
shape is:

```ts
import preact from "@preact/preset-vite";
import { tsuzuru } from "@tsuzuru/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact(), tsuzuru()],
});
```

Standard examples and `create-tsuzuru` templates must not duplicate
`createStdVisualPlugin()`, `createStdAudioPlugin()`, or other compile-time
plugin factories in `vite.config.ts`.

`@tsuzuru/config` keeps its root export browser-safe. The root export centers on
config types and `defineTsuzuruConfig()`. Node-only dependencies such as `fs`,
`path`, and `jiti` belong behind the explicit `@tsuzuru/config/node` subpath.

`@tsuzuru/vite-plugin` loads config as follows:

- `tsuzuru()` looks for `tsuzuru.config.ts` from the Vite root.
- If the config exists, `config.plugins` is used as compile-time plugins.
- If the default config is missing, the plugin falls back to `plugins: []` for
  backward compatibility.
- Invalid config and config syntax errors are reported as Vite errors.
- Config files are registered with Vite's watcher. The default config path is
  also watched when the file does not exist yet, so creating it can invalidate
  compiled scenario modules.

Explicit Vite plugin options remain an advanced override:

```ts
tsuzuru({
  plugins: [createSomePlugin()],
});
```

The precedence is:

```txt
explicit options.plugins > tsuzuru.config.ts plugins > []
```

`plugins: []` is also an explicit override. When `options.plugins` is provided,
`@tsuzuru/vite-plugin` does not load or watch `tsuzuru.config.ts`.

Vite integrations can also disable config loading completely:

```ts
tsuzuru({
  configFile: false,
});
```

This is an escape hatch for advanced use cases that intentionally compile `.tzr`
files without project config plugins.

## Consequences

### Positive

- `tsuzuru.config.ts` becomes the single project-facing place for compile-time
  plugin definitions.
- `tsuzuru check` and Vite dev/build use the same plugin definitions, reducing
  drift between validation and browser builds.
- `vite.config.ts` stays small and focused on Vite integration.
- `create-tsuzuru` templates are easier to explain and maintain.
- `@tsuzuru/config` preserves a browser-safe root export while still offering a
  Node loader for tools through `@tsuzuru/config/node`.
- Vite users keep a backward-compatible path: projects without
  `tsuzuru.config.ts` can still compile scenarios with no compile-time plugins.
- Advanced users can still override plugin definitions explicitly in
  `vite.config.ts` when necessary.

### Negative / Trade-offs

- `@tsuzuru/vite-plugin` now has a package dependency on `@tsuzuru/config`.
- Vite builds can fail earlier when `tsuzuru.config.ts` exists but is invalid or
  has a syntax error. This is intentional because the config is part of the
  compile-time input.
- Explicit Vite overrides are more specialized: when `plugins` is provided,
  `tsuzuru.config.ts` is intentionally ignored by the Vite plugin.
- Node config loading lives in `@tsuzuru/config/node`, so tooling must import
  the correct subpath instead of the browser-safe root.

## Alternatives Considered

### Alternative A: Keep plugin definitions in Vite config

Rejected.

This keeps compile-time plugin definitions duplicated between `tsuzuru.config.ts`
and `vite.config.ts`. It makes examples and generated templates harder to
understand, and plugin additions can easily update CLI checks without updating
Vite builds, or the reverse.

### Alternative B: Add a Vite-plugin-specific config file

Rejected.

A Vite-specific config would split Tsuzuru project configuration across multiple
files. That weakens the relationship between `tsuzuru check` and Vite dev/build,
and it makes the source of truth less clear.

### Alternative C: Move runtime command handlers into config

Rejected for this decision.

Compile-time plugin definitions and runtime command handlers have different
responsibilities. Compile-time plugins describe command metadata used by the
compiler. Runtime handlers execute behavior in an app or renderer context and
can involve asset resolution, browser audio policy, rendering policy, and host
state.

Moving runtime command handlers into `tsuzuru.config.ts` would overextend the
project config and blur package boundaries.

## Implementation Notes

- `@tsuzuru/config` root export remains data-oriented and browser-safe.
- `@tsuzuru/config/node` provides `loadTsuzuruConfig()`,
  `loadOptionalTsuzuruConfig()`, `resolveTsuzuruConfigPath()`,
  `validateTsuzuruConfig()`, and `TsuzuruConfigLoadError`.
- The CLI uses `@tsuzuru/config/node` for config loading, then keeps CLI-owned
  scenario file collection and diagnostic formatting in the CLI package.
- `@tsuzuru/vite-plugin` uses the same loader for config-driven compile-time
  plugins, but preserves explicit `plugins` and `configFile: false` escape
  hatches.
- `configFile: false` is a `@tsuzuru/vite-plugin` option. The lower-level
  `@tsuzuru/config/node` loader accepts a config path, but does not model this
  Vite-specific escape hatch.
- `examples/preact-basic` and the `create-tsuzuru` basic template keep
  compile-time plugin factories in `tsuzuru.config.ts` and use `tsuzuru()` in
  `vite.config.ts`.

## Follow-ups

- Revisit this decision only if Tsuzuru introduces a new constrained project
  configuration layer that changes where compile-time plugin metadata should
  live.
- Runtime command handler configuration remains outside this decision. Any move
  to centralize runtime handlers should be handled as a separate design record.
