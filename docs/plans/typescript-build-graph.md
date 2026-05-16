# TypeScript Build Graph Plan

This note records the current decision for TypeScript project references in the
Tsuzuru monorepo.

## Current State

- The repository has `tsconfig.base.json`, but no root `tsconfig.json`,
  `tsconfig.packages.json`, or `tsconfig.examples.json`.
- Package and example `tsconfig.json` files extend `tsconfig.base.json`.
- `packages/core`, `packages/config`, `packages/cli`, `packages/create-tsuzuru`,
  `packages/preact`, `packages/vue`, `packages/standard-ui-preact`,
  `packages/plugin-std-visual`, and `packages/plugin-std-audio` are the current
  `composite: true` pilots and write TypeScript build info to
  `.tsbuildinfo/tsconfig.tsbuildinfo`.
- `packages/core` is the first structural dependency root pilot. Standard
  plugins depend on it, so preparing core as a composite project is required
  before the packages graph can become dependency-complete.
- `packages/plugin-std-visual` is the first pilot with a workspace dependency
  edge. It now has an explicit TypeScript project reference to
  `packages/core`, while its package import still resolves through the built
  `@tsuzuru/core` declaration output.
- `packages/plugin-std-audio` is the second standard plugin dependency-edge
  pilot. It uses the same explicit TypeScript project reference to
  `packages/core`, while its package import also continues to resolve through
  built `@tsuzuru/core` declarations.
- `packages/cli` is the first higher-risk dependency-edge pilot. It references
  both `packages/config` and `packages/core`, keeps Node types enabled, and
  preserves the `tsuzuru` bin target at `dist/src/index.js`.
- `packages/preact` is the first framework adapter dependency-edge pilot. It
  references `packages/core`, keeps `rootDir: "src"` / `dist/index.*` output,
  and preserves JSX, DOM lib, and `preact` peer dependency behavior.
- `packages/vue` is the second framework adapter dependency-edge pilot. It
  references `packages/core`, keeps the same `rootDir: "src"` / `dist/index.*`
  layout category, and preserves DOM lib and `vue` peer dependency behavior.
- `packages/standard-ui-preact` is the first CSS-asset UI package
  dependency-edge pilot. It references `packages/core`, keeps the
  `rootDir: "src"` / `dist/index.*` layout category, and preserves JSX, DOM
  lib, `preact` peer dependency behavior, CSS copy, and `./style.css` export.
- Other package `tsconfig.json` files do not use `composite`, `references`,
  `incremental`, or `tsBuildInfoFile`.
- `tsconfig.packages.experimental.json` exists only as a manual dry-validation
  reference list for current pilots. It is not called from root scripts, CI, or
  release-readiness.
- Root `packages:build` builds public publishable packages in explicit order
  with package `build:self` scripts.
- Root `packages:typecheck:self` runs public package `typecheck:self` scripts
  after `packages:build` has produced dependency `dist` output.
- Root `test` also runs `packages:build` first so package-level tests can
  resolve workspace package imports through package `exports` that point at
  built `dist` files on a clean checkout.
- Package-level `build` and `typecheck` scripts keep dependency builds so
  filtered package work still works from a clean checkout.
- Examples keep standalone `typecheck` / `build` scripts with dependency builds,
  while `examples:check:self` is used after `packages:build` for release
  readiness.

## Source and Test Config Split

TypeScript project references should not be introduced while package source and
tests share the same referenced project.

Current package shapes:

- `packages/config` is the first source/test tsconfig split pilot. Its source
  `tsconfig.json` includes only `src/**/*.ts`, and `tsconfig.test.json` covers
  source plus tests with `noEmit`.
- `packages/create-tsuzuru` is the second pilot. It has no workspace package
  dependencies, keeps `rootDir: "."` / `outDir: "dist"`, includes only
  `src/**/*.ts` in source build, and uses `tsconfig.test.json` for source plus
  tests typechecking.
- `packages/plugin-std-visual` is the third pilot and first dependency-edge
  package. Its source `tsconfig.json` includes only `src/**/*.ts`, while
  `tsconfig.test.json` covers source plus tests with `noEmit`.
- `packages/core` is the fourth pilot and first dependency root package. Its
  source `tsconfig.json` includes only `src/**/*.ts`, while
  `tsconfig.test.json` covers source plus tests with `noEmit`.
- `packages/plugin-std-audio` is the fifth pilot and second dependency-edge
  package. Its source `tsconfig.json` includes only `src/**/*.ts`, while
  `tsconfig.test.json` covers source plus tests with `noEmit`.
- `packages/cli` is the sixth pilot and first multi-dependency package edge.
  Its source `tsconfig.json` includes only `src/**/*.ts`, while
  `tsconfig.test.json` covers source plus tests with `noEmit`.
- `packages/preact` is the seventh pilot and first framework adapter package.
  Its source `tsconfig.json` already includes only `src/**/*.ts` and
  `src/**/*.tsx`, so it stays source-only without adding `tsconfig.test.json`.
- `packages/vue` is the eighth pilot and second framework adapter package. Its
  source `tsconfig.json` already includes only `src/**/*.ts`, so it also stays
  source-only without adding `tsconfig.test.json`.
- `packages/standard-ui-preact` is the ninth pilot and first CSS-asset UI
  package. Its source `tsconfig.json` already includes only `src/**/*.ts` and
  `src/**/*.tsx`, so it also stays source-only without adding
  `tsconfig.test.json`.
- The remaining standard plugin packages still use `rootDir: "."`,
  `outDir: "dist"`, and include both `src/**/*.ts` and `tests/**/*.ts`.
- Package tarballs are protected by `files`, but source builds still compile
  tests for the packages that include `tests/**/*.ts`.

If project references are introduced, each package should move toward:

```txt
packages/foo/tsconfig.json       # source build, declarations, publish layout
packages/foo/tsconfig.test.json  # test typecheck, references source if needed
```

The source config should own emitted declarations and the package `dist` layout.
The test config should own Vitest-facing test typechecking and should not emit
publish artifacts.

### `@tsuzuru/config` pilot

`@tsuzuru/config` was selected as the first pilot because it is public, has no
workspace package dependencies, has a small source/test shape, and publishes
from `dist/src/index.*`.

Pilot layout:

```txt
packages/config/tsconfig.json       # source build only, keeps rootDir "." and dist/src layout
packages/config/tsconfig.test.json  # source + tests typecheck, noEmit
```

`packages/config` keeps `build:self` as `tsc -p tsconfig.json`. The source
config now uses `composite: true` and writes build info to
`.tsbuildinfo/tsconfig.tsbuildinfo`. Its `typecheck:self` uses
`tsc -p tsconfig.test.json`, so root `packages:typecheck:self` still checks
source and tests for this package.

The pilot keeps `rootDir: "."` and `outDir: "dist"` so the publish layout stays
at `dist/src/index.js` and `dist/src/index.d.ts`. It must not emit
`dist/tests/*`. `pack:dry-run` and `publish-readiness:check` must continue to
exclude `.tsbuildinfo` from the tarball.

### `create-tsuzuru` pilot

`create-tsuzuru` was selected as the second pilot because it is public, has no
workspace package dependencies, and uses the same `rootDir: "."` / `dist/src`
publish layout shape as `@tsuzuru/config`. It also exercises a package with a
CLI `bin` entry and template files without involving package-to-package
TypeScript dependencies.

Pilot layout:

```txt
packages/create-tsuzuru/tsconfig.json       # source build only, keeps rootDir "." and dist/src layout
packages/create-tsuzuru/tsconfig.test.json  # source + tests typecheck, noEmit
```

`create-tsuzuru` keeps `build:self` as `tsc -p tsconfig.json`. The source config
uses `composite: true` and writes build info to
`.tsbuildinfo/tsconfig.tsbuildinfo`. Its `typecheck:self` uses
`tsc -p tsconfig.test.json`, preserving package correctness checks while keeping
test files out of source emit.

The pilot must keep `dist/src/index.js`, `dist/src/index.d.ts`,
`dist/src/create-project.*`, and `dist/src/template.*` stable. It must not emit
`dist/tests/*`. `pack:dry-run` and `publish-readiness:check` must continue to
exclude `.tsbuildinfo` from the tarball.

### `@tsuzuru/plugin-std-visual` pilot

`@tsuzuru/plugin-std-visual` was selected as the third pilot because it is a
small public standard plugin with one workspace dependency on `@tsuzuru/core`.
This makes it the first dependency-edge pilot without taking on the larger
surface area of `@tsuzuru/core`, `@tsuzuru/cli`, or a plugin with multiple
exports.

Pilot layout:

```txt
packages/plugin-std-visual/tsconfig.json       # source build only, keeps rootDir "." and dist/src layout
packages/plugin-std-visual/tsconfig.test.json  # source + tests typecheck, noEmit
```

`@tsuzuru/plugin-std-visual` keeps package-level `build` and `typecheck` scripts
that build `@tsuzuru/core` first, so filtered package work remains safe on a
clean checkout. Its `build:self` remains `tsc -p tsconfig.json`, while
`typecheck:self` uses `tsc -p tsconfig.test.json` and assumes `@tsuzuru/core`
has already produced the package `dist` output.

The source config uses `composite: true` and writes build info to
`.tsbuildinfo/tsconfig.tsbuildinfo`. The pilot keeps the publish layout at
`dist/src/index.js` and `dist/src/index.d.ts`. It must not emit `dist/tests/*`,
and `.tsbuildinfo` must not appear in pack output or
`publish-readiness:check`.

The visual source config now declares:

```json
"references": [{ "path": "../core" }]
```

This was validated as an isolated reference-edge experiment.
`tsc -b tsconfig.packages.experimental.json --dry --verbose` lists
`packages/core/tsconfig.json` before
`packages/plugin-std-visual/tsconfig.json`, and visual becomes the out-of-date
project when its source tsconfig changes. This confirms that TypeScript treats
the explicit `plugin-std-visual -> core` reference as a build graph edge.

The source package import remains stable under NodeNext package resolution:
`@tsuzuru/core` resolves through the workspace package link and the
`exports.types` target `packages/core/dist/src/index.d.ts`. With the reference
present, TypeScript also reports project-reference compiler option redirects
while resolving declarations from core. This means the experiment does not
replace the existing package-output contract; it layers an explicit build graph
edge on top of the current `dist` declaration layout.

`packages/plugin-std-visual/tsconfig.test.json` extends the source config for
compiler options and file shape, but `tsc --showConfig` does not show inherited
top-level `references`. The test typecheck therefore continues to validate the
existing source-plus-tests flow through built `@tsuzuru/core` package output and
`noEmit: true`.

### `@tsuzuru/core` pilot

`@tsuzuru/core` was selected as the fourth pilot because every standard plugin
depends on it. The previous experimental graph could address the visual plugin
as a composite project, but it could not represent a dependency-complete package
graph while core was not itself a composite reference target.

Pilot layout:

```txt
packages/core/tsconfig.json       # source build only, keeps rootDir "." and dist/src layout
packages/core/tsconfig.test.json  # source + tests typecheck, noEmit
```

`@tsuzuru/core` keeps `build:self` as `tsc -p tsconfig.json`. Its source config
uses `composite: true` and writes build info to
`.tsbuildinfo/tsconfig.tsbuildinfo`. Its `typecheck:self` uses
`tsc -p tsconfig.test.json`, so root `packages:typecheck:self` still checks the
parser, compiler, runtime, diagnostics, and command tests without emitting test
artifacts.

The pilot keeps `rootDir: "."` and `outDir: "dist"` so the publish layout stays
at `dist/src/index.js` and `dist/src/index.d.ts`, with the rest of the
package's `files` allowlist still pointing at `dist/src/*`. It must not emit
`dist/tests/*`, and `.tsbuildinfo` must not appear in pack output or
`publish-readiness:check`.

This prepares core as a reference target for the current standard plugin
experiments. The visual and audio plugins still resolve core package imports
through built package output, matching the current `packages:build` /
`packages:typecheck:self` flow, even though their source configs now declare
explicit reference edges.

### `@tsuzuru/plugin-std-audio` pilot

`@tsuzuru/plugin-std-audio` was selected as the fifth pilot because it has the
same single-export standard plugin shape as visual and the same workspace
dependency on `@tsuzuru/core`. It tests whether the explicit plugin-to-core
reference pattern remains stable after more than one plugin points at core.

Pilot layout:

```txt
packages/plugin-std-audio/tsconfig.json       # source build only, keeps rootDir "." and dist/src layout
packages/plugin-std-audio/tsconfig.test.json  # source + tests typecheck, noEmit
```

`@tsuzuru/plugin-std-audio` keeps package-level `build` and `typecheck` scripts
that build `@tsuzuru/core` first, so filtered package work remains safe on a
clean checkout. Its `build:self` remains `tsc -p tsconfig.json`, while
`typecheck:self` uses `tsc -p tsconfig.test.json` and assumes `@tsuzuru/core`
has already produced the package `dist` output.

The source config uses `composite: true`, writes build info to
`.tsbuildinfo/tsconfig.tsbuildinfo`, includes only `src/**/*.ts`, and declares:

```json
"references": [{ "path": "../core" }]
```

The pilot keeps the publish layout at `dist/src/index.js` and
`dist/src/index.d.ts`. It must not emit `dist/tests/*`, and `.tsbuildinfo` must
not appear in pack output or `publish-readiness:check`.

The audio reference-edge experiment used the same validation pattern as visual.
`tsc -b tsconfig.packages.experimental.json --dry --verbose` lists
`packages/core/tsconfig.json` before both standard plugin projects, then lists
`packages/plugin-std-visual/tsconfig.json` and
`packages/plugin-std-audio/tsconfig.json` as separate core dependents. This
confirms that multiple plugin-to-core references are stable in the manual graph.

The audio package import remains stable under NodeNext package resolution:
`@tsuzuru/core` resolves through the workspace package link and the
`exports.types` target `packages/core/dist/src/index.d.ts`. As with visual, the
project reference supplies the build graph edge but does not replace the
existing built declaration contract.

### `@tsuzuru/cli` pilot

`@tsuzuru/cli` was selected as the sixth pilot because it is a public bin
package and has workspace dependencies on both `@tsuzuru/config` and
`@tsuzuru/core`. This is higher risk than the standard plugin edge experiments:
the package has a `bin` entry, uses Node types, imports `compileTzrProject` as a
runtime value from core, loads config files through `jiti`, and is used by
example scenario checks and create-tsuzuru smoke tests.

Pilot layout:

```txt
packages/cli/tsconfig.json       # source build only, keeps rootDir "." and dist/src layout
packages/cli/tsconfig.test.json  # source + tests typecheck, noEmit
```

`@tsuzuru/cli` keeps package-level `build` and `typecheck` scripts that build
`@tsuzuru/config` and `@tsuzuru/core` first, so filtered package work remains
safe on a clean checkout. Its `build:self` remains `tsc -p tsconfig.json`,
while `typecheck:self` uses `tsc -p tsconfig.test.json`.

The source config keeps `types: ["node"]`, uses `composite: true`, writes build
info to `.tsbuildinfo/tsconfig.tsbuildinfo`, includes only `src/**/*.ts`, and
declares:

```json
"references": [{ "path": "../config" }, { "path": "../core" }]
```

The pilot keeps the publish layout at `dist/src/index.js`,
`dist/src/index.d.ts`, `dist/src/check.*`, `dist/src/config-loader.*`, and
`dist/src/scenario-files.*`. It must not emit `dist/tests/*`, and
`.tsbuildinfo` must not appear in pack output or `publish-readiness:check`.
The `bin.tsuzuru` target remains `./dist/src/index.js`.

The CLI reference-edge experiment used the manual package graph validation.
`tsc -b tsconfig.packages.experimental.json --dry --verbose` lists
`packages/core/tsconfig.json` and `packages/config/tsconfig.json` before
`packages/cli/tsconfig.json`. This confirms that TypeScript treats the
`cli -> config/core` references as build graph edges.

The CLI package imports remain stable under NodeNext package resolution:
`@tsuzuru/config` resolves through the workspace package link and
`packages/config/dist/src/index.d.ts`, while `@tsuzuru/core` resolves through
`packages/core/dist/src/index.d.ts`. As with the plugin pilots, the project
references supply build graph edges but do not replace the existing built
declaration contracts.

### `@tsuzuru/preact` pilot

`@tsuzuru/preact` was selected as the seventh pilot because it is the first
framework adapter package in the project reference experiment. Unlike the
Node-oriented and standard plugin packages, it uses `rootDir: "src"` and
publishes directly from `dist/index.*` rather than `dist/src/index.*`. It also
exercises JSX emit, DOM lib types, a `preact` peer dependency, and example
applications that consume the built adapter output.

Pilot layout:

```txt
packages/preact/tsconfig.json  # source build only, keeps rootDir "src" and dist/index layout
```

`@tsuzuru/preact` already had a source-only tsconfig with
`include: ["src/**/*.ts", "src/**/*.tsx"]`, so this pilot does not add
`tsconfig.test.json`. Its package-level `build` and `typecheck` scripts keep
building `@tsuzuru/core` first for clean checkout safety. `build:self` remains
`tsc -p tsconfig.json`, while `typecheck:self` remains
`tsc -p tsconfig.json --noEmit`.

The source config keeps `jsx: "react-jsx"`, `jsxImportSource: "preact"`, and
`lib: ["ES2022", "DOM"]`, uses `composite: true`, writes build info to
`.tsbuildinfo/tsconfig.tsbuildinfo`, and declares:

```json
"references": [{ "path": "../core" }]
```

The pilot keeps the publish layout at `dist/index.js`, `dist/index.d.ts`,
`dist/runtime-save.*`, `dist/runtime-view.*`, and `dist/use-runtime.*`.
`.tsbuildinfo` must not appear under `dist`, in pack output, or in
`publish-readiness:check`. The `preact` peer dependency remains unchanged.

The Preact reference-edge experiment uses the manual package graph validation.
`tsc -b tsconfig.packages.experimental.json --dry --verbose` lists
`packages/core/tsconfig.json` before `packages/preact/tsconfig.json`. This
confirms that TypeScript treats the explicit `preact -> core` reference as a
build graph edge while preserving the framework adapter output layout.

The Preact package import remains stable under NodeNext package resolution:
`@tsuzuru/core` resolves through the workspace package link and
`packages/core/dist/src/index.d.ts`. The project reference supplies the build
graph edge but does not replace the existing built declaration contract.

### `@tsuzuru/vue` pilot

`@tsuzuru/vue` was selected as the eighth pilot because it is the second
framework adapter package in the project reference experiment. It uses the same
`rootDir: "src"` / `dist/index.*` publish layout category as Preact, but it
exercises Vue-specific public types, a `vue` peer dependency, and the Vue
example application that consumes the built adapter output.

Pilot layout:

```txt
packages/vue/tsconfig.json  # source build only, keeps rootDir "src" and dist/index layout
```

`@tsuzuru/vue` already had a source-only tsconfig with
`include: ["src/**/*.ts"]`, so this pilot does not add `tsconfig.test.json`.
Its package-level `build` and `typecheck` scripts keep building
`@tsuzuru/core` first for clean checkout safety. `build:self` remains
`tsc -p tsconfig.json`, while `typecheck:self` remains
`tsc -p tsconfig.json --noEmit`.

The source config keeps `lib: ["ES2022", "DOM"]`, uses `composite: true`,
writes build info to `.tsbuildinfo/tsconfig.tsbuildinfo`, and declares:

```json
"references": [{ "path": "../core" }]
```

The pilot keeps the publish layout at `dist/index.js`, `dist/index.d.ts`,
`dist/runtime-save.*`, `dist/runtime-view.*`, and `dist/use-runtime.*`.
`.tsbuildinfo` must not appear under `dist`, in pack output, or in
`publish-readiness:check`. The `vue` peer dependency remains unchanged.

The Vue reference-edge experiment uses the manual package graph validation.
`tsc -b tsconfig.packages.experimental.json --dry --verbose` lists
`packages/core/tsconfig.json` before `packages/vue/tsconfig.json`. This
confirms that TypeScript treats the explicit `vue -> core` reference as a build
graph edge while preserving the framework adapter output layout.

The Vue package import remains stable under NodeNext package resolution:
`@tsuzuru/core` resolves through the workspace package link and
`packages/core/dist/src/index.d.ts`. The project reference supplies the build
graph edge but does not replace the existing built declaration contract.

### `@tsuzuru/standard-ui-preact` pilot

`@tsuzuru/standard-ui-preact` was selected as the ninth pilot because it is a
Preact-facing UI package with a broader exported component surface than the
framework adapter packages. It uses the same `rootDir: "src"` / `dist/index.*`
layout category as Preact, but it also has a CSS copy step and publishes
`./style.css` through package exports.

Pilot layout:

```txt
packages/standard-ui-preact/tsconfig.json  # source build only, keeps rootDir "src" and dist/index layout
```

`@tsuzuru/standard-ui-preact` already had a source-only tsconfig with
`include: ["src/**/*.ts", "src/**/*.tsx"]`, so this pilot does not add
`tsconfig.test.json`. Its package-level `build` and `typecheck` scripts keep
building `@tsuzuru/core` first for clean checkout safety. `build:self` remains
`tsc -p tsconfig.json && node scripts/copy-css.mjs`, while `typecheck:self`
remains `tsc -p tsconfig.json --noEmit`.

The source config keeps `jsx: "react-jsx"`, `jsxImportSource: "preact"`, and
`lib: ["ES2022", "DOM"]`, uses `composite: true`, writes build info to
`.tsbuildinfo/tsconfig.tsbuildinfo`, and declares:

```json
"references": [{ "path": "../core" }]
```

The pilot keeps the publish layout at `dist/index.js`, `dist/index.d.ts`, the
component and hook outputs such as `dist/ChoiceLayer.*`, `dist/GameShell.*`,
`dist/RuntimeMessageLayer.*`, `dist/useTextReveal.*`, and `dist/style.css`.
The CSS source remains `src/style.css`, copied by `scripts/copy-css.mjs` during
`build:self`. `exports["./style.css"]` remains `./dist/style.css`, and
`files` continues to include `dist/style.css`. `.tsbuildinfo` must not appear
under `dist`, in pack output, or in `publish-readiness:check`. The `preact`
peer dependency remains unchanged.

The Standard UI Preact reference-edge experiment uses the manual package graph
validation. `tsc -b tsconfig.packages.experimental.json --dry --verbose` lists
`packages/core/tsconfig.json` before
`packages/standard-ui-preact/tsconfig.json`. This confirms that TypeScript
treats the explicit `standard-ui-preact -> core` reference as a build graph edge
while preserving the UI package output and CSS asset layout.

The Standard UI Preact package import remains stable under NodeNext package
resolution: `@tsuzuru/core` resolves through the workspace package link and
`packages/core/dist/src/index.d.ts`. The project reference supplies the build
graph edge but does not replace the existing built declaration contract.

## .tsbuildinfo Placement

Current pilots use a package-local cache directory that is outside publish
`files` patterns:

```txt
packages/core/.tsbuildinfo/tsconfig.tsbuildinfo
packages/config/.tsbuildinfo/tsconfig.tsbuildinfo
packages/cli/.tsbuildinfo/tsconfig.tsbuildinfo
packages/create-tsuzuru/.tsbuildinfo/tsconfig.tsbuildinfo
packages/preact/.tsbuildinfo/tsconfig.tsbuildinfo
packages/vue/.tsbuildinfo/tsconfig.tsbuildinfo
packages/standard-ui-preact/.tsbuildinfo/tsconfig.tsbuildinfo
packages/plugin-std-visual/.tsbuildinfo/tsconfig.tsbuildinfo
packages/plugin-std-audio/.tsbuildinfo/tsconfig.tsbuildinfo
```

Do not put `.tsbuildinfo` directly under `dist`, because `dist` is publish-facing
and is inspected by `pack:dry-run` / `publish-readiness:check`. A package-local
cache directory is easy to clean, does not collide across packages, and can be
made cacheable in CI later.

The repository `.gitignore` must ignore `.tsbuildinfo` directories and
`*.tsbuildinfo` files. `publish-readiness:check` must fail if a tarball includes
TypeScript build info paths.

## Package and Example Graphs

Keep package and example graphs separate if project references are introduced.

First-choice shape:

```txt
tsconfig.packages.json  # publish package source graph
tsconfig.examples.json  # app/example typecheck graph, if useful later
```

Reasons:

- Publish package builds must preserve package `types`, `exports.types`, `files`,
  and `dist` layout.
- Examples are Vite applications and should keep bundler/app responsibilities
  separate from package declaration emit.
- Release readiness already separates `packages:build` from
  `examples:check:self`.

Do not fold packages and examples into one `tsconfig.build.json` until there is
a concrete reason to mix those responsibilities.

### Experimental packages graph

`tsconfig.packages.experimental.json` is present as a manual experiment only:

```txt
tsconfig.packages.experimental.json
```

It references the current composite pilots:

- `packages/core`
- `packages/config`
- `packages/cli`
- `packages/create-tsuzuru`
- `packages/preact`
- `packages/vue`
- `packages/standard-ui-preact`
- `packages/plugin-std-visual`
- `packages/plugin-std-audio`

This file is intentionally not wired into root scripts, CI, `check`, `typecheck`,
or `release-readiness:check`. The graph can now include core and config as
addressable composite projects, visual/audio explicitly reference core, CLI
explicitly references config/core, and Preact/Vue/Standard UI Preact explicitly
reference core. It is still not a complete package dependency graph because the
other workspace package dependency edges have not been designed or validated.
Today the pilots still resolve workspace imports through package output under
`dist`, matching the release-readiness flow.

Manual dry validation may be run with:

```sh
pnpm exec tsc -b tsconfig.packages.experimental.json --dry
pnpm exec tsc -b tsconfig.packages.experimental.json --dry --verbose
```

This validates that the current pilot projects can be addressed by `tsc -b`,
and that the explicit visual/audio/preact/vue/standard-ui-preact-to-core and
cli-to-config/core edges affect build order. It must not be interpreted as a
complete monorepo build graph until the remaining package dependency references
are added deliberately and their package-import behavior is checked.

### Formal packages graph design direction

The next design step is not to replace package builds with `tsc -b`. The
near-term package graph should separate two responsibilities:

- `build:self` remains the release and publish build responsibility. It emits
  package artifacts, runs package-local non-TypeScript build steps, and preserves
  each package's `types`, `exports`, `files`, `bin`, and `dist` layout.
- `tsc -b` is a package graph validation responsibility. It should validate that
  composite package projects are addressable, that explicit references describe
  dependency order, and that package imports still resolve against the expected
  declaration output.

This separation matters because `tsc -b` only understands TypeScript project
emit. It does not guarantee:

- CSS copy steps such as `@tsuzuru/standard-ui-preact` copying
  `src/style.css` to `dist/style.css`
- template file copy or generated starter layout behavior in `create-tsuzuru`
- CLI `bin` targets such as `tsuzuru` pointing at `dist/src/index.js`
- package `exports` and `files` allowlists matching the packed tarball
- publish artifacts being complete after non-TypeScript build work

Therefore `release-readiness:check`, `pack:dry-run`, and
`publish-readiness:check` remain required distribution validation even after a
formal packages graph exists. A future `tsconfig.packages.json` can become a
formal graph validation input only after it is dependency-complete for the
publishable package set and its checks are explicitly scoped as validation, not
as a replacement for `packages:build`.

Conditions before promoting `tsconfig.packages.experimental.json` to a formal
`tsconfig.packages.json`:

- Every publishable package that participates in the package graph has a
  source-only composite tsconfig with package-local `.tsbuildinfo` outside
  `dist`.
- Every workspace package dependency in the publishable package set has an
  explicit project reference or a documented reason to stay outside the graph.
- `pnpm exec tsc -b tsconfig.packages.experimental.json --dry --verbose`
  explains the expected package order and does not reveal hidden dependency
  order assumptions.
- Node package import resolution still goes through the intended package
  declaration paths such as `dist/src/index.d.ts` or `dist/index.d.ts`.
- `packages:build`, `packages:typecheck:self`, `pack:dry-run`,
  `publish-readiness:check`, and `release-readiness:check` continue to validate
  emitted package contents.
- The formal graph's root-script integration point is named and scoped as graph
  validation, not as package artifact generation.

## Publish Layout Constraints

The current packages publish types from existing `dist` paths:

- Node-oriented packages and standard plugins generally expose
  `./dist/src/index.d.ts`.
- Framework packages generally expose `./dist/index.d.ts`.

A future `tsc -b` migration must keep:

- `outDir` stable
- declaration output paths stable
- package `types` and `exports.types` valid
- `files` patterns valid
- `publish-readiness:check` passing

`build:self` and `tsc -b` must not become competing sources of truth. If
`tsc -b` becomes the package build gate, `build:self` should either delegate to
the reference build or be retired in the same staged migration.

## Decision for now

- `tsc -b` remains manual-only, but the
  visual/audio/preact/vue/standard-ui-preact-to-core and cli-to-config/core
  project reference edges are now present as isolated pilots.
- The current `build:self` / `typecheck:self` flow remains the release-readiness
  build strategy. `build:self` remains responsible for package artifacts and
  package-local non-TypeScript build steps. `tsc -b` is treated as dependency
  graph validation, not as the artifact build source of truth.
- Root `test` keeps the same clean-checkout assumption as root `typecheck`:
  build public package `dist` output before running package tests that resolve
  workspace imports through package `exports`.
- If project references are introduced, source tsconfig and test tsconfig must be
  split first for packages whose source configs include tests. `@tsuzuru/core`,
  `@tsuzuru/config`, `@tsuzuru/cli`, `create-tsuzuru`,
  `@tsuzuru/plugin-std-visual`, and `@tsuzuru/plugin-std-audio` are the current
  source/test split pilots. `@tsuzuru/preact`, `@tsuzuru/vue`, and
  `@tsuzuru/standard-ui-preact` are source-only already, so they do not add test
  tsconfigs.
- `@tsuzuru/core`, `@tsuzuru/config`, `@tsuzuru/cli`, `create-tsuzuru`,
  `@tsuzuru/preact`, `@tsuzuru/vue`, `@tsuzuru/standard-ui-preact`,
  `@tsuzuru/plugin-std-visual`, and `@tsuzuru/plugin-std-audio` are the current
  `composite: true` pilots. The visual/audio plugins, CLI, Preact, Vue, and
  Standard UI Preact are also explicit dependency-reference pilots. Do not
  expand `composite` broadly until these packages keep publish layout stable
  under `pack:dry-run` and `publish-readiness:check`.
- `.tsbuildinfo` should stay in package-local `.tsbuildinfo/` cache directories,
  not under `dist`.
- Examples should be designed as a separate graph from the packages graph.
- `tsconfig.packages.experimental.json` remains a manual experiment. It should
  not become a root script, CI, `typecheck`, or `release-readiness:check` gate
  yet because it covers only current pilots, not the complete package dependency
  graph, and because the existing release flow still depends on explicit
  package-order builds plus package `exports.types` declaration output.

## Migration steps

1. Trial source/test tsconfig split in representative packages. `@tsuzuru/config`
   and `create-tsuzuru` are the dependency-free pilots.
2. Confirm each pilot keeps publish layout stable and does not emit test output.
3. Keep `.tsbuildinfo` placement in package-local
   `.tsbuildinfo/tsconfig.tsbuildinfo` paths outside `dist`.
4. Check the impact of `composite: true` in dependency-free pilots.
5. Move one small standard plugin package so the migration tests a package with
   a workspace dependency on `@tsuzuru/core`. `@tsuzuru/plugin-std-visual` was
   the initial dependency-edge pilot, and `@tsuzuru/plugin-std-audio` is the
   second plugin-to-core edge.
6. Keep `tsconfig.packages.experimental.json` manual-only and use it for dry
   validation, not as a release gate.
7. Prepare `@tsuzuru/core` as a composite reference target before treating the
   graph as dependency-complete.
8. Add a higher-risk CLI package edge to `@tsuzuru/config` and `@tsuzuru/core`
   while preserving the `tsuzuru` bin layout.
9. Add the first framework adapter edge with `@tsuzuru/preact` pointing to
   `@tsuzuru/core`, while preserving `rootDir: "src"`, JSX, DOM lib, peer
   dependency behavior, and `dist/index.*` publish layout.
10. Add the second framework adapter edge with `@tsuzuru/vue` pointing to
    `@tsuzuru/core`, while preserving DOM lib, Vue peer dependency behavior,
    and `dist/index.*` publish layout.
11. Add the broader Preact UI package edge with
    `@tsuzuru/standard-ui-preact` pointing to `@tsuzuru/core`, while preserving
    JSX, DOM lib, Preact peer dependency behavior, CSS copy, `./style.css`
    export, and `dist/index.*` publish layout.
12. Define the formal package graph responsibility before wiring it into root
    scripts. The graph should validate TypeScript package dependency order; it
    should not replace `build:self` as the release artifact build.
13. Run an equivalent of `tsc -b --dry` / no-emit graph validation before using
    it as a gate.
14. If the package layout and publish-readiness checks remain stable, expand to
    the package graph.
15. Treat the examples graph as a separate design.

## Next Migration Candidates

1. Formal `tsconfig.packages.json` design
   - Reason: visual/audio, CLI, Preact, Vue, and Standard UI Preact now show
     that explicit package references can coexist with package `exports.types`
     resolution, bin publish layout, framework adapter `dist/index.*` layout,
     and a CSS asset export. The next formal graph should validate dependency
     order while leaving `build:self` responsible for release artifacts.
   - Risk: the experimental graph is still not dependency-complete for all
     publishable packages, and the root-script integration point for graph
     validation has not been named.
2. Remaining standard plugin-to-core edges
   - Reason: useful to prove repeatability across more plugin packages.
   - Risk: diminishing returns now that visual and audio already cover the
     simple standard plugin shape.
3. Future browser package additions, such as `@tsuzuru/html` if introduced
   - Reason: browser-facing packages should be classified into the package graph
     or examples graph deliberately instead of inferred by naming.
   - Risk: no such package exists today, so this remains a design placeholder.
