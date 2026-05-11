# 0021: HTML Package

## Status

Reverted / superseded.

This decision is historical. The experimental framework-free HTML route was
removed: `packages/html`, `examples/html-basic`, and
`packages/create-tsuzuru/templates/html` no longer exist. `@tsuzuru/html` is not
a current package, and `create-tsuzuru --template html` is not supported. The
current non-Preact framework integration is `@tsuzuru/vue` with
`examples/vue-basic`.

## Context

Tsuzuru currently has a renderer-independent core runtime, a Preact adapter, and
a Preact standard UI package.

The current browser example and `create-tsuzuru` template are useful for Preact
users, but they make Preact look like the only supported way to run a Tsuzuru
scenario in a browser. Tsuzuru also needs a first-party path for users who want
plain HTML and Vanilla DOM integration without React, Preact, Vue, or another UI
framework.

The new package must not change `.tzr` syntax, core runtime semantics, standard
plugin semantics, or the existing Preact packages.

## Decision

Add a future package named:

```txt
@tsuzuru/html
```

with this directory:

```txt
packages/html
```

`@tsuzuru/html` is the official Vanilla DOM / HTML runtime and UI adapter. It
will provide an imperative mount API, default DOM rendering for common runtime
events, default DOM layers for official std-visual and std-audio state, and an
exported CSS file.

The package name is explicitly not `web-player`.

The primary API will be:

```ts
const player = await mountTsuzuruHtml(root, options);
```

where `root` is an `HTMLElement` and `options` describes the scenario source,
asset manifest, plugins, command handlers, and host callbacks.

## Responsibility Boundaries

`@tsuzuru/core` continues to own parser, compiler, runtime state, runtime
stepping, choices, jumps, conditions, snapshots, restore, diagnostics, and
plugin command dispatch. Core must not import DOM, CSS, browser storage,
`@tsuzuru/html`, or renderer-specific helpers.

`@tsuzuru/preact` remains the Preact runtime adapter and hook package. It owns
`useRuntime`, Preact-visible event state, Preact save/load adapter helpers, and
Preact convenience rendering. It must not import `@tsuzuru/html`.

`@tsuzuru/standard-ui-preact` remains the Preact UI component package. It owns
Preact components and Preact UI hooks such as message history, text reveal, and
auto mode. It must not import `@tsuzuru/html`, and `@tsuzuru/html` must not
reuse Preact components.

`@tsuzuru/html` owns DOM-specific runtime wiring:

- mounting and destroying a DOM player
- loading browser-served scenario files when requested
- compiling loaded scenario projects through `compileTzrProject`
- creating and stepping core runtime state
- exposing imperative controls for start, step, choice, save, load, reset, and
  destroy
- rendering narration, dialogue, choices, status, visual state, and audio
  playback through browser DOM APIs
- applying package CSS classes and CSS variables
- reporting host-facing diagnostics for load, compile, asset, and playback
  problems

`@tsuzuru/html` must not own scenario semantics. If a behavior changes what a
scenario means or how runtime state advances, it belongs in `@tsuzuru/core` or
the relevant plugin, not in `@tsuzuru/html`.

## Public API Shape

The first API should be small and imperative:

```ts
import { mountTsuzuruHtml } from "@tsuzuru/html";
import "@tsuzuru/html/style.css";

const player = await mountTsuzuruHtml(document.getElementById("app")!, {
  scenario: {
    entryUrl: "/scenario/main.tzr",
    entryId: "public/scenario/main.tzr",
  },
  assetsUrl: "/assets/assets.json",
});
```

Candidate types:

```ts
export interface MountTsuzuruHtmlOptions {
  readonly scenario:
    | TsuzuruHtmlScenarioUrlSource
    | TsuzuruHtmlScenarioProjectSource
    | TsuzuruHtmlCompiledDocumentSource;
  readonly assets?: TsuzuruHtmlAssets;
  readonly assetsUrl?: string | URL;
  readonly plugins?: readonly RuntimePluginDefinition[];
  readonly commandHandlers?: Readonly<Record<string, RuntimePluginCommandHandler>>;
  readonly autoStart?: boolean;
  readonly autoClearWait?: boolean;
  readonly autoStepTransientEvents?: boolean;
  readonly onDiagnostic?: (diagnostic: TsuzuruHtmlDiagnostic) => void;
  readonly fetch?: typeof globalThis.fetch;
}

export interface TsuzuruHtmlScenarioUrlSource {
  readonly entryUrl: string | URL;
  readonly entryId?: string;
}

export interface TsuzuruHtmlScenarioProjectSource {
  readonly entryId: string;
  readonly documents: readonly TzrProjectDocumentInput[];
}

export interface TsuzuruHtmlCompiledDocumentSource {
  readonly document: RuntimeDocument;
}

export interface TsuzuruHtmlPlayer {
  readonly root: HTMLElement;
  readonly ready: Promise<void>;
  readonly start: () => void;
  readonly step: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly destroy: () => void;
  readonly createSnapshot: () => RuntimeSnapshot;
  readonly restoreSnapshot: (snapshot: RuntimeSnapshot) => void;
  readonly createSaveData: () => RuntimeSaveData;
  readonly restoreSaveData: (saveData: RuntimeSaveData) => void;
  readonly getState: () => RuntimeState;
  readonly getEvent: () => RuntimeEvent | null;
  readonly getVisibleEvent: () => RuntimeEvent | null;
}
```

`mountTsuzuruHtml` is asynchronous because URL-based scenarios and asset
manifests require browser `fetch`.

## Scenario URL Loading

`@tsuzuru/html` may compile from already-provided documents or from a browser
URL. URL loading is a host convenience, not a new core behavior.

For URL sources:

- `entryUrl` is fetched as text.
- `entryId` defaults to the normalized URL path without a leading slash.
- Hosts may pass `entryId` explicitly when runtime document IDs should match
  CLI paths such as `public/scenario/main.tzr`.
- Fetch failures become `TsuzuruHtmlDiagnostic` entries and stop mounting.
- Invalid parser/compiler diagnostics are rendered as a DOM error screen and
  reported through `onDiagnostic`.

Core still receives an in-memory `compileTzrProject({ entryId, documents })`
input. Core does not read files or fetch URLs.

## Include-Based Multi-File Scenario Resolution

For URL-based scenario loading, `@tsuzuru/html` resolves top-level
`include "./path.tzr"` recursively before calling `compileTzrProject`.

The loader should use the same include semantics as the current project
compiler:

- include paths are compile-time only
- include paths resolve relative to the including document id
- duplicate includes are loaded once
- circular and missing includes are diagnostics
- compiled runtime events do not include include directives

The browser loader tracks both document IDs and fetch URLs:

- document IDs are normalized project paths used by `compileTzrProject`
- fetch URLs are resolved with `new URL(includePath, currentDocumentUrl)`

This lets an example serve files from `/scenario/...` while passing document
IDs that match the CLI configuration, such as `public/scenario/...`.

The loader must not scan directories in the browser. It discovers documents only
from explicit include directives, or from a host-provided `documents` array.

## Asset Manifest

`@tsuzuru/html` will use an optional `assets.json` manifest for std-visual and
std-audio asset ID resolution.

Initial manifest shape:

```json
{
  "version": 1,
  "baseUrl": "./",
  "visual": {
    "backgrounds": {
      "station": {
        "src": "images/backgrounds/station.webp",
        "alt": "Station"
      }
    },
    "sprites": {
      "mio_smile": {
        "src": "images/sprites/mio-smile.webp",
        "alt": "美緒"
      }
    }
  },
  "audio": {
    "bgm": {
      "daily_theme": {
        "src": "audio/bgm/daily-theme.ogg"
      }
    },
    "se": {
      "page": {
        "src": "audio/se/page.wav"
      }
    },
    "voice": {
      "mio_001": {
        "src": "audio/voice/mio-001.ogg"
      }
    }
  }
}
```

Manifest URLs resolve relative to the manifest URL first, then `baseUrl` when
provided. Missing asset entries and failed media loads are non-fatal
diagnostics. They must not change runtime execution.

The manifest is not a DSL feature. The compiler may validate asset IDs against
a manifest in future work, but that is outside this decision.

## Standard Visual and Audio

`@tsuzuru/html` should provide a default standard setup for common DSL v2
scenarios:

- `createStdVisualPlugin()`
- `createStdVisualCommandHandlers()`
- `createStdAudioPlugin()`
- `createStdAudioCommandHandlers()`

Hosts may override `plugins` and `commandHandlers` when they need custom
plugins or custom command handling.

For std-visual, `@tsuzuru/html` reads `stdVisual` plugin state, resolves
background and sprite asset IDs through `assets.json`, and renders DOM elements
with stable package classes. Transition metadata is applied as CSS classes and
CSS custom properties. Actual animation remains CSS / renderer behavior.

For std-audio, `@tsuzuru/html` reads `stdAudio` plugin state, resolves BGM / SE
/ Voice asset IDs through `assets.json`, and manages browser audio elements.
BGM is treated as continuing state. SE and Voice use the plugin sequence values
to consume one-shot events only once. Browser autoplay failures and missing
files are reported as non-fatal diagnostics.

The std-visual and std-audio plugin packages continue to own renderer-neutral
state. They still do not load files or touch browser APIs.

## CSS Customization

`@tsuzuru/html` exports:

```txt
@tsuzuru/html/style.css
```

The CSS policy is:

- stable class names under a `tzr-html-` prefix
- CSS variables for colors, spacing, type, message window, choice layer, visual
  layer, and basic transitions
- no Shadow DOM by default, so host CSS can override styles normally
- optional host `className` / `data-*` hooks may be added through options later
- no theme framework in the first implementation

The package should ship a functional default look, but production games are
expected to override CSS.

## examples/html-basic

Add a future example at:

```txt
examples/html-basic
```

The example demonstrates Tsuzuru without Preact:

```txt
examples/html-basic/
  package.json
  assets.ts
  index.html
  vite.config.ts
  tsconfig.json
  tsuzuru.config.ts
  scenario/
    main.tzr
    chapters/
      01-opening.tzr
  src/
    main.ts
    style.css
    screens/
      settings.html
  public/
    assets/
      images/
      audio/
```

`src/main.ts` imports `mountTsuzuruHtmlAppsFromDocument`, imports
`@tsuzuru/html/style.css`, imports example CSS, imports `assets.ts`, and wires
screen fragments into the declarative app.

The example uses browser-served scenario URLs through `public/tsuzuru.app.json`:

```json
{
  "scenario": {
    "entryUrl": "/scenario/main.tzr",
    "entryId": "scenario/main.tzr"
  }
}
```

The TypeScript entrypoint provides typed assets:

```ts
await mountTsuzuruHtmlAppsFromDocument(document, {
  assets,
  screenFragments: {
    settings: settingsHtml,
  },
});
```

`tsuzuru.config.ts` should point the CLI at the source files under `scenario`:

```ts
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
```

The example should stay smaller than `examples/preact-basic`. It should show
title/start, message window, choices, std-visual, std-audio, and basic error
reporting. Save/load, backlog persistence, skip mode, read tracking, gallery,
and advanced settings are not required for the first HTML example.

## create-tsuzuru Template

After `@tsuzuru/html` and `examples/html-basic` were added, `create-tsuzuru`
added bundled template selection.

The HTML template name is:

```txt
html
```

The existing Preact template remains `basic`, with `preact` accepted as an
alias. The explicit CLI behavior is:

```sh
create-tsuzuru my-game --template html
```

The HTML template is maintained in `packages/create-tsuzuru/templates/html`, not
copied at runtime from `examples/html-basic`.

## Non-Goals

This decision does not add implementation code.

Out of scope:

- changing `.tzr` syntax
- changing runtime semantics
- adding public APIs now
- changing package versions
- introducing `web-player`
- React, Preact, Vue, Svelte, or framework adapters
- adding `@tsuzuru/standard-ui-html` as a separate package in the first step
- Vite plugin support
- asset ID compiler validation
- cloud save
- IndexedDB save policy
- packaged gallery / achievement systems
- Live2D, Pixi, Canvas, or WebGL renderer integration
- advanced animation editor

## Consequences

### Positive

- Tsuzuru gets a first-party no-framework browser path.
- Core remains renderer-independent.
- Preact users keep the existing adapter and standard UI packages unchanged.
- Generated projects can eventually offer a smaller non-Preact template.
- Static web hosting becomes easier to demonstrate because scenarios and assets
  can be loaded by URL.

### Negative

- `@tsuzuru/html` combines runtime adapter and minimal DOM UI, so it is broader
  than `@tsuzuru/preact`.
- Some UI behavior will duplicate concepts from `@tsuzuru/standard-ui-preact`
  in DOM form.
- Browser URL loading must carefully mirror include resolution without turning
  core into a file loader.
- Asset and audio playback policy will need conservative defaults and clear
  diagnostics.

## Reconsideration Criteria

Revisit this decision if:

- HTML users need a split between `@tsuzuru/html` and
  `@tsuzuru/standard-ui-html`
- asset manifest validation needs to move into compiler or CLI
- scenario URL loading needs a manifest instead of recursive include fetches
- std-visual or std-audio browser behavior grows beyond a minimal default layer
- create-tsuzuru template selection changes package or example naming

## Related Documents

- `AGENTS.md`
- `docs/decisions/0002-core-preact-boundary.md`
- `docs/decisions/0004-std-visual-plugin.md`
- `docs/decisions/0005-std-audio-plugin.md`
- `docs/decisions/0006-standard-ui-preact.md`
- `docs/decisions/0010-create-tsuzuru.md`
- `docs/decisions/0011-include-based-multi-file-scenario.md`
- `docs/decisions/0019-audio-playback-mvp.md`
- `docs/plans/v0.17-html-package.md`
