# Tsuzuru

[日本語版](./README.ja.md)

Tsuzuru is a TypeScript visual novel engine for building browser-first novel
games with readable `.tzr` scenario files, a framework-neutral core runtime,
and a Preact-based official UI stack.

It is designed for:

- game creators who want to write story flow in a small scenario DSL
- TypeScript developers who want explicit parser, compiler, runtime, and UI
  boundaries
- npm users who want a Vite + Preact starter they can edit into a static web
  game

The core idea is simple:

```txt
Scenario files describe narrative flow.
Runtime behavior, rendering, plugins, assets, storage policy, and app screens
belong in TypeScript.
```

Tsuzuru does not try to be a general-purpose scripting language or a clone of
KAG, TyranoScript, or Ren'Py. The `.tzr` language is intentionally constrained
so it can be parsed, validated, compiled, and connected to TypeScript plugins.

## Features

- **DSL v2 scenario authoring**: indentation-based `.tzr` files with `title`,
  `character`, `include`, `scene`, narration, dialogue, choices, conditional
  choices, `if` / `elif` / `else`, `jump`, `end`, `wait`, and `scenario.*`
  state updates.
- **Core parser, compiler, and runtime**: `@tsuzuru/core` exports `parseTzr`,
  `compileTzr`, `compileTzrProject`, runtime stepping, choices, jumps, waits,
  snapshots, restore helpers, and plugin command dispatch primitives.
- **Vite integration**: `@tsuzuru/vite-plugin` lets Vite apps import `.tzr`
  files as compiled runtime documents, including `include` support.
- **CLI and project config**: `@tsuzuru/cli` provides `tsuzuru check`, and
  `@tsuzuru/config` provides `defineTsuzuruConfig` plus Node config loading.
- **Preact adapter**: `@tsuzuru/preact` connects the core runtime to Preact with
  `useRuntime`, `RuntimeView`, click-to-advance behavior, choice selection, and
  save / restore adapter utilities.
- **Standard Preact UI**: `@tsuzuru/standard-ui-preact` provides reusable visual
  novel UI components and a higher-level `TsuzuruGame` starter component for
  the standard plugin set.
- **Official themes**: `@tsuzuru/theme-standard`, `@tsuzuru/theme-classic`,
  `@tsuzuru/theme-dark-novel`, and `@tsuzuru/theme-minimal` provide CSS
  variable themes for the standard UI. Themes are presentation packages, not
  runtime plugins.
- **Standard plugins**: visual, audio, text-sound, effect, camera, particle, and
  system unlock packages provide command metadata and runtime handlers for
  presentation state. Rendering, asset resolution, playback policy, and app
  screens remain host responsibilities.
- **Storage helpers**: `@tsuzuru/standard-game-storage` provides preferences,
  read tracking, save slot stores, and a standard runtime save adapter. It does
  not create Save / Load screens or decide when an app saves.
- **Project generator**: `create-tsuzuru` creates the current Vite + Preact
  starter with a title screen, a 16:9 game view, a `.tzr` scenario, asset maps,
  project config, and standard UI wiring.

## Quick Start

Start with the project generator:

```sh
npm create tsuzuru@latest my-game
cd my-game
npm install
npm run dev
```

The generated app opens with a title screen. Press Start, then edit
`scenario/main.tzr` and save the file. The first experience should be seeing a
small story change reflected in the browser.

The default template is the current Vite + Preact starter. The same starter can
also be selected explicitly:

```sh
npm create tsuzuru@latest my-game -- --template basic
npm create tsuzuru@latest my-game -- --template preact
```

This command uses the generator and dependency versions available from npm. If
you are testing this repository's current source before all matching workspace
packages have been published, use the checked-out starter example instead:

```sh
pnpm install --frozen-lockfile
pnpm --filter @tsuzuru/example-preact-starter dev
```

Generated projects include these useful scripts:

```sh
npm run check:scenario
npm run typecheck
npm run build
npm run preview
```

The starter is meant to be edited from:

- `scenario/main.tzr` for story, choices, and scene flow
- `src/assets.ts` for mapping scenario asset IDs to files
- `public/assets/images/` and `public/assets/audio/` for game assets
- `tsuzuru.config.ts` for scenario files, compile-time plugins, project
  identity, and declarative storage settings
- `src/themes/localTheme.ts` for the fixed theme used by the game

Load and Config buttons are visible placeholders in the generated starter.
`tsuzuru.config.ts` can declare standard storage settings, but Save / Load,
Settings, Backlog, Gallery, and migration behavior are application code.

Selected npm package pages:

- [`create-tsuzuru`](https://www.npmjs.com/package/create-tsuzuru)
- [`@tsuzuru/core`](https://www.npmjs.com/package/@tsuzuru/core)
- [`@tsuzuru/standard-ui-preact`](https://www.npmjs.com/package/@tsuzuru/standard-ui-preact)
- [`@tsuzuru` npm organization](https://www.npmjs.com/org/tsuzuru)

Source, issues, and release notes live on
[GitHub](https://github.com/tsuzuru-engine/tsuzuru).

## Minimal Scenario

Current Tsuzuru scenarios use DSL v2:

```tzr
title "Sample Game"

character mio name="Mio"

scene start:
  bg classroom with fade(duration=300)
  show mio_smile at center with dissolve(duration=250)

  mio:
    Hello.
    Welcome to Tsuzuru.

  choice "Continue?":
    "Continue" id=continue:
      jump next

scene next:
  narration:
    This is narration.

  end
```

For the full current syntax entry point, see [`docs/dsl.md`](docs/dsl.md). For
the stable-scope planning matrix, see
[`docs/design/dsl-support-matrix.md`](docs/design/dsl-support-matrix.md).

## Packages

This repository is a pnpm workspace with packages under `packages/*` and
runnable examples under `examples/*`.

```txt
packages/
  core/
  config/
  cli/
  vite-plugin/
  create-tsuzuru/
  preact/
  standard-ui-preact/
  theme-standard/
  theme-classic/
  theme-dark-novel/
  theme-minimal/
  standard-game-storage/
  plugin-std-visual/
  plugin-std-audio/
  plugin-std-text-sound/
  plugin-std-effect/
  plugin-std-camera/
  plugin-std-particle/
  plugin-std-hotspot/
  plugin-std-system/

examples/
  preact-basic/
  preact-hotspot-basic/
  preact-sound-novel/
  preact-starter/
```

| Package | Role |
| --- | --- |
| [`@tsuzuru/core`](packages/core/) | Parser, compiler, project compiler, runtime IR, runtime stepping, state, choices, jumps, waits, snapshots, restore helpers, and plugin command infrastructure. |
| [`@tsuzuru/config`](packages/config/) | Browser-safe project config types and `defineTsuzuruConfig`; Node config loading is available through an explicit subpath. |
| [`@tsuzuru/cli`](packages/cli/) | Command line tools, currently focused on `tsuzuru check` for scenario validation. |
| [`@tsuzuru/vite-plugin`](packages/vite-plugin/) | Vite plugin for importing `.tzr` files as compiled runtime documents. |
| [`create-tsuzuru`](packages/create-tsuzuru/) | Project generator for the current Vite + Preact starter. |
| [`@tsuzuru/preact`](packages/preact/) | Preact runtime adapter, runtime view, runtime hook, and save / restore adapter utilities. |
| [`@tsuzuru/standard-ui-preact`](packages/standard-ui-preact/) | Reusable Preact UI components, standard runtime layers, themes helpers, and `TsuzuruGame`. |
| [`@tsuzuru/standard-game-storage`](packages/standard-game-storage/) | Preferences, read tracking, save slot stores, and standard runtime save helpers. |
| [`@tsuzuru/theme-standard`](packages/theme-standard/) | Standard CSS variable theme for the standard UI. |
| [`@tsuzuru/theme-classic`](packages/theme-classic/) | Classic CSS variable theme for the standard UI. |
| [`@tsuzuru/theme-dark-novel`](packages/theme-dark-novel/) | Dark novel CSS variable theme for the standard UI. |
| [`@tsuzuru/theme-minimal`](packages/theme-minimal/) | Minimal CSS variable theme for the standard UI. |
| [`@tsuzuru/plugin-std-visual`](packages/plugin-std-visual/) | Background and sprite state command handlers. |
| [`@tsuzuru/plugin-std-audio`](packages/plugin-std-audio/) | BGM, sound effect, and voice state / event command handlers. |
| [`@tsuzuru/plugin-std-text-sound`](packages/plugin-std-text-sound/) | Text sound state, profile helpers, and optional browser playback helpers. |
| [`@tsuzuru/plugin-std-effect`](packages/plugin-std-effect/) | One-shot screen effect command handlers. |
| [`@tsuzuru/plugin-std-camera`](packages/plugin-std-camera/) | Durable camera state command handlers. |
| [`@tsuzuru/plugin-std-particle`](packages/plugin-std-particle/) | Durable particle state command handlers. |
| [`@tsuzuru/plugin-std-hotspot`](packages/plugin-std-hotspot/) | Rectangular hotspot state and click-wait command handlers. |
| [`@tsuzuru/plugin-std-system`](packages/plugin-std-system/) | Durable unlock state for endings, CGs, and achievements. |

Core stays independent from Preact, DOM, CSS, Vite, browser storage, and asset
loading. UI adapters, standard UI, examples, and applications own browser and
framework behavior.

## Examples

All current runnable examples are Preact-based. They are purpose-specific
references; start with `preact-starter`, then open the example that matches the
behavior you want to inspect.

| Example | Purpose |
| --- | --- |
| [`examples/preact-starter`](examples/preact-starter/) | Creator-facing starter example. Edit `scenario/main.tzr`, `src/assets.ts`, and the local theme to build a small novel game. |
| [`examples/preact-basic`](examples/preact-basic/) | Integration reference for the core runtime, Preact adapter, standard UI layers, standard plugins, save/load, preferences, backlog, auto mode, skip mode, and read tracking as example-owned app behavior. |
| [`examples/preact-hotspot-basic`](examples/preact-hotspot-basic/) | Minimal exploration ADV example for transparent rectangular hotspots and scene jumps. |
| [`examples/preact-sound-novel`](examples/preact-sound-novel/) | Long-form sound-novel presentation example using `TsuzuruGame` with novel message presentation and text reveal controls. |

Common example commands:

```sh
pnpm --filter @tsuzuru/example-preact-starter dev
pnpm --filter @tsuzuru/example-preact-starter check:scenario
pnpm --filter @tsuzuru/example-preact-starter typecheck
pnpm --filter @tsuzuru/example-preact-starter build
```

Repository-level example validation:

```sh
pnpm examples:check
pnpm examples:e2e
```

`examples:e2e` is a Playwright browser smoke suite and is intentionally separate
from the root unit test flow.

## Documentation

Start here:

- [Architecture](docs/architecture.md): package boundaries and runtime pipeline.
- [DSL](docs/dsl.md): current `.tzr` syntax entry point.
- [DSL support matrix](docs/design/dsl-support-matrix.md): current stable,
  parser-only, plugin-dependent, and deferred syntax status.
- [Roadmap](docs/roadmap.md): current product direction and near-term focus.
- [Runtime](docs/runtime.md): runtime state, events, choices, waits, variables,
  snapshots, and restore behavior.
- [Plugin API](docs/plugin-api.md): plugin command metadata and runtime handler
  boundaries.
- [Plugin docs](docs/plugins/): standard visual, audio, text-sound, effect,
  camera, particle, system, and Vite plugin details.
- [Themes](docs/themes.md): official theme package boundaries and usage.
- [Screen primitives](docs/ui/screen-primitives.md): reusable UI building blocks
  for project-specific screens.
- [Release notes](docs/releases/): release records and publish notes.

Historical design records and old implementation plans live under
`docs/history/`. Prefer the architecture, roadmap, DSL, support matrix, package
README files, and current examples when you need the current implementation
surface.

## Development

Install dependencies:

```sh
pnpm install --frozen-lockfile
```

Useful root checks:

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm typecheck
pnpm examples:check
pnpm release-readiness:check
```

Focused package checks use pnpm filters:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/standard-ui-preact test
pnpm --filter @tsuzuru/standard-ui-preact typecheck
```

Release and publish readiness helpers:

```sh
pnpm packages:build
pnpm publish-readiness:check
pnpm run pack:dry-run
pnpm run smoke:create-tsuzuru:local
```

`release-readiness:check` runs package builds, example self-checks, pack
dry-runs, publish-readiness, and local `create-tsuzuru` smoke in order. Actual
versioning, npm publish, git tags, and GitHub releases are maintainer actions,
not ordinary readiness checks.

## Current Status and Limitations

The workspace currently carries `1.0.0` package versions, but Tsuzuru is still
early compared with mature visual novel engines. It is suitable for trying the
current web-first TypeScript / Vite / Preact workflow, building experiments,
and developing against the current package boundaries. Treat the public surface
as intentionally small and still evolving.

Current limitations include:

- the official templates and examples are Preact-based; there is no current
  official Vue adapter or Vue template
- no GUI editor, visual scripting editor, Live2D integration, Pixi integration,
  or cloud save
- no arbitrary JavaScript or TypeScript execution inside `.tzr` files
- generic macros, presets, reusable staging syntax, and scenario-local
  procedures are not implemented
- rich inline text, inline waits/events, inline audio events, text block page
  breaks, and text block metadata remain deferred syntax
- visual coordinate placement and audio transition syntax remain future design
  work
- `system.*` condition reads are limited to current std-system runtime plugin
  state and require the std-system condition resolver
- save data migration is not provided; current helpers validate and reject
  incompatible data rather than migrating arbitrary old saves
- `@tsuzuru/standard-ui-preact` provides reusable components and starter runtime
  wiring, but project screens such as Save / Load, Settings, Backlog, Gallery,
  and asset policy remain application code

For a compact view of what is stable, plugin-dependent, parser-only, or
deferred, use the
[DSL support matrix](docs/design/dsl-support-matrix.md).

## License

MIT
