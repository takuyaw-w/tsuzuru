# TypeScript Build Graph Plan

This note records the current decision for TypeScript project references in the
Tsuzuru monorepo.

## Current State

- The repository has `tsconfig.base.json`, but no root `tsconfig.json`,
  `tsconfig.packages.json`, or `tsconfig.examples.json`.
- Package and example `tsconfig.json` files extend `tsconfig.base.json`.
- Package `tsconfig.json` files do not use `composite`, `references`,
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

- `packages/core`, `packages/config`, `packages/cli`,
  `packages/create-tsuzuru`, and standard plugin packages use `rootDir: "."`,
  `outDir: "dist"`, and include both `src/**/*.ts` and `tests/**/*.ts`.
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

## .tsbuildinfo Placement

No `.tsbuildinfo` files exist today.

When `composite` / incremental build is introduced, prefer a package-local cache
directory that is outside publish `files` patterns:

```txt
packages/foo/.tsbuildinfo/tsconfig.tsbuildinfo
```

Do not put `.tsbuildinfo` directly under `dist`, because `dist` is publish-facing
and is inspected by `pack:dry-run` / `publish-readiness:check`. A package-local
cache directory is easy to clean, does not collide across packages, and can be
made cacheable in CI later.

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
  split first.
- `.tsbuildinfo` placement must be decided before enabling `composite` /
  incremental builds.
- Examples should be designed as a separate graph from the packages graph.

## Migration steps

1. Trial source/test tsconfig split in one representative package.
2. Decide `.tsbuildinfo` placement.
3. Check the impact of `composite: true`.
4. Add an experimental `tsconfig.packages.json`.
5. Run an equivalent of `tsc -b --dry` / no-emit graph validation before using
   it as a gate.
6. If the package layout and publish-readiness checks remain stable, expand to
   the package graph.
7. Treat the examples graph as a separate design.
