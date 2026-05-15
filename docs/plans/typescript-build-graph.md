# TypeScript Build Graph Plan

This note records the current decision for TypeScript project references in the
Tsuzuru monorepo.

## Current State

- The repository has `tsconfig.base.json`, but no root `tsconfig.json`,
  `tsconfig.packages.json`, or `tsconfig.examples.json`.
- Package and example `tsconfig.json` files extend `tsconfig.base.json`.
- `packages/core`, `packages/config`, `packages/create-tsuzuru`, and
  `packages/plugin-std-visual` are the current `composite: true` pilots and
  write TypeScript build info to
  `.tsbuildinfo/tsconfig.tsbuildinfo`.
- `packages/core` is the first structural dependency root pilot. Standard
  plugins depend on it, so preparing core as a composite project is required
  before the packages graph can become dependency-complete.
- `packages/plugin-std-visual` is the first pilot with a workspace dependency
  edge. It now has an explicit TypeScript project reference to
  `packages/core`, while its package import still resolves through the built
  `@tsuzuru/core` declaration output.
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
- `packages/cli` and the remaining standard plugin packages still use
  `rootDir: "."`, `outDir: "dist"`, and include both `src/**/*.ts` and
  `tests/**/*.ts`.
- `packages/preact`, `packages/vue`, and `packages/standard-ui-preact` use
  `rootDir: "src"` and include source files only.
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

This prepares core as a reference target for the current visual plugin
experiment. The visual plugin still resolves core package imports through built
package output, matching the current `packages:build` /
`packages:typecheck:self` flow, even though the source config now declares the
explicit reference edge.

## .tsbuildinfo Placement

Current pilots use a package-local cache directory that is outside publish
`files` patterns:

```txt
packages/core/.tsbuildinfo/tsconfig.tsbuildinfo
packages/config/.tsbuildinfo/tsconfig.tsbuildinfo
packages/create-tsuzuru/.tsbuildinfo/tsconfig.tsbuildinfo
packages/plugin-std-visual/.tsbuildinfo/tsconfig.tsbuildinfo
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
- `packages/create-tsuzuru`
- `packages/plugin-std-visual`

This file is intentionally not wired into root scripts, CI, `check`, `typecheck`,
or `release-readiness:check`. The graph can now include core as an addressable
composite project and visual now explicitly references core. It is still not a
complete package dependency graph because the other workspace package dependency
edges have not been designed or validated. Today the visual plugin still
resolves `@tsuzuru/core` through package output under `packages/core/dist`,
matching the release-readiness flow.

Manual dry validation may be run with:

```sh
pnpm exec tsc -b tsconfig.packages.experimental.json --dry
pnpm exec tsc -b tsconfig.packages.experimental.json --dry --verbose
```

This validates that the current pilot projects can be addressed by `tsc -b`,
and that the explicit visual-to-core edge affects build order. It must not be
interpreted as a complete monorepo build graph until the remaining package
dependency references are added deliberately and their package-import behavior
is checked.

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

- `tsc -b` remains manual-only, but the visual-to-core project reference edge is
  now present as an isolated pilot.
- The current `build:self` / `typecheck:self` flow remains the release-readiness
  build strategy.
- Root `test` keeps the same clean-checkout assumption as root `typecheck`:
  build public package `dist` output before running package tests that resolve
  workspace imports through package `exports`.
- If project references are introduced, source tsconfig and test tsconfig must be
  split first; `@tsuzuru/core`, `@tsuzuru/config`, `create-tsuzuru`, and
  `@tsuzuru/plugin-std-visual` are the current pilots for that split.
- `@tsuzuru/core`, `@tsuzuru/config`, `create-tsuzuru`, and
  `@tsuzuru/plugin-std-visual` are the current `composite: true` pilots.
  `@tsuzuru/plugin-std-visual` is also the first explicit dependency-reference
  pilot through its reference to `../core`. Do not expand `composite` broadly
  until these packages keep publish layout stable under `pack:dry-run` and
  `publish-readiness:check`.
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
   a workspace dependency on `@tsuzuru/core`. `@tsuzuru/plugin-std-visual` is
   the current dependency-edge pilot.
6. Keep `tsconfig.packages.experimental.json` manual-only and use it for dry
   validation, not as a release gate.
7. Prepare `@tsuzuru/core` as a composite reference target before treating the
   graph as dependency-complete.
8. Keep the explicit dependency reference from the dependency-edge pilot to core
   and use it as the reference-resolution baseline for the next package edge.
9. Run an equivalent of `tsc -b --dry` / no-emit graph validation before using
   it as a gate.
10. If the package layout and publish-readiness checks remain stable, expand to
    the package graph.
11. Treat the examples graph as a separate design.

## Next Migration Candidates

1. `@tsuzuru/plugin-std-audio`
   - Reason: same simple package shape as visual and a narrow public export.
   - Condition: repeat the visual experiment pattern by first keeping source and
     tests split, then adding only the explicit `../core` reference and checking
     `@tsuzuru/core` package import resolution before broadening the graph.
2. `@tsuzuru/cli`
   - Reason: important release package with Node types and config/core
     dependencies.
   - Risk: higher blast radius because scenario checking and config loading tests
     depend on built workspace packages.
