# TypeScript Build Graph Plan

This note records the current decision for TypeScript project references in the
Tsuzuru monorepo.

## Current State

- The repository has `tsconfig.base.json`, but no root `tsconfig.json`,
  `tsconfig.packages.json`, or `tsconfig.examples.json`.
- Package and example `tsconfig.json` files extend `tsconfig.base.json`.
- `packages/config` and `packages/create-tsuzuru` are the current
  `composite: true` pilots and write TypeScript build info to
  `.tsbuildinfo/tsconfig.tsbuildinfo`.
- Other package `tsconfig.json` files do not use `composite`, `references`,
  `incremental`, or `tsBuildInfoFile`.
- Root `packages:build` builds public publishable packages in explicit order
  with package `build:self` scripts.
- Root `packages:typecheck:self` runs public package `typecheck:self` scripts
  after `packages:build` has produced dependency `dist` output.
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
- `packages/core`, `packages/cli`, and standard plugin packages still use
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

## .tsbuildinfo Placement

Current pilots use a package-local cache directory that is outside publish
`files` patterns:

```txt
packages/config/.tsbuildinfo/tsconfig.tsbuildinfo
packages/create-tsuzuru/.tsbuildinfo/tsconfig.tsbuildinfo
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

- `tsc -b` / project references are not introduced yet.
- The current `build:self` / `typecheck:self` flow remains the release-readiness
  build strategy.
- If project references are introduced, source tsconfig and test tsconfig must be
  split first; `@tsuzuru/config` and `create-tsuzuru` are the current pilots for
  that split.
- `@tsuzuru/config` and `create-tsuzuru` are the current `composite: true`
  pilots. Do not expand `composite` broadly until these packages keep publish
  layout stable under `pack:dry-run` and `publish-readiness:check`.
- `.tsbuildinfo` should stay in package-local `.tsbuildinfo/` cache directories,
  not under `dist`.
- Examples should be designed as a separate graph from the packages graph.
- The next pilot should likely be one standard plugin package after confirming
  the two dependency-free pilots stay stable.

## Migration steps

1. Trial source/test tsconfig split in representative packages. `@tsuzuru/config`
   and `create-tsuzuru` are the current dependency-free pilots.
2. Confirm each pilot keeps publish layout stable and does not emit test output.
3. Keep `.tsbuildinfo` placement in package-local
   `.tsbuildinfo/tsconfig.tsbuildinfo` paths outside `dist`.
4. Check the impact of `composite: true` in both current pilots.
5. Move one small standard plugin package next, so the migration tests a package
   with a workspace dependency on `@tsuzuru/core`.
6. Add an experimental `tsconfig.packages.json` only after dependency-free and
   single-dependency pilots keep `publish-readiness:check` passing.
7. Run an equivalent of `tsc -b --dry` / no-emit graph validation before using
   it as a gate.
8. If the package layout and publish-readiness checks remain stable, expand to
   the package graph.
9. Treat the examples graph as a separate design.

## Next Migration Candidates

1. `@tsuzuru/plugin-std-visual`
   - Reason: small public plugin package with one workspace dependency on
     `@tsuzuru/core`.
   - Risk: validates the first dependency-edge pilot but still depends on core
     dist output rather than project references.
2. `@tsuzuru/plugin-std-audio`
   - Reason: same simple package shape as visual and a narrow public export.
   - Risk: similar to visual; should be moved after one plugin proves the shape.
3. `@tsuzuru/cli`
   - Reason: important release package with Node types and config/core
     dependencies.
   - Risk: higher blast radius because scenario checking and config loading tests
     depend on built workspace packages.
