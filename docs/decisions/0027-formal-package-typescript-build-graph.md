# 0027: Formal Package TypeScript Build Graph

## Status

Proposed

## Context

Tsuzuru now has several TypeScript project reference pilots:

- `@tsuzuru/core`
- `@tsuzuru/config`
- `@tsuzuru/cli -> @tsuzuru/config` / `@tsuzuru/core`
- `create-tsuzuru`
- `@tsuzuru/preact -> @tsuzuru/core`
- `@tsuzuru/vue -> @tsuzuru/core`
- `@tsuzuru/standard-ui-preact -> @tsuzuru/core`
- `@tsuzuru/plugin-std-visual -> @tsuzuru/core`
- `@tsuzuru/plugin-std-audio -> @tsuzuru/core`

`tsconfig.packages.experimental.json` can manually dry-validate those composite
projects and reference edges, but it is not a complete package graph. Remaining
publishable packages still need explicit design before the graph can be treated
as formal.

The existing release flow also does more than TypeScript emit. It preserves
package publish layouts, runs package-local build steps, packs tarballs, checks
exports, and exercises generated project smoke checks.

## Decision

Keep `build:self` as the package artifact build responsibility for now.

Use `tsc -b` as package TypeScript graph validation:

- verify that composite package projects can be addressed as a graph
- verify explicit dependency order such as `core -> preact`
- reveal missing or incorrect TypeScript project references
- observe package import and declaration resolution behavior

Do not rename or promote `tsconfig.packages.experimental.json` to
`tsconfig.packages.json` yet. The experimental graph may be exposed through the
explicit root script `packages:graph:check`, but that script is graph validation
only. Do not connect it to CI, `typecheck`, or `release-readiness:check` yet.

When a formal `tsconfig.packages.json` is introduced, its first responsibility
should be graph validation. It should not silently replace `packages:build` or
package `build:self` scripts.

## Rationale

`tsc -b` is useful for dependency order validation, but it only understands
TypeScript project emit. It does not guarantee that non-TypeScript publish
artifacts are present or correctly exported.

Tsuzuru packages have publish-facing responsibilities outside the TypeScript
compiler:

- `@tsuzuru/standard-ui-preact` copies `src/style.css` to `dist/style.css` and
  exports it as `./style.css`.
- `create-tsuzuru` publishes templates that must keep current DSL syntax and
  generated project layout stable.
- `@tsuzuru/cli` publishes a `tsuzuru` bin target that must keep pointing at
  `dist/src/index.js`.
- Package `types`, `exports`, `files`, and tarball contents are distribution
  contracts, not just TypeScript graph contracts.

Keeping `build:self` and `tsc -b` separate lets the project add formal graph
validation without weakening release and publish validation.

`packages:graph:check` runs:

```sh
pnpm exec tsc -b tsconfig.packages.experimental.json --dry --verbose
```

This makes the dependency-order validation easy to run locally without implying
that the graph emits release artifacts. `--dry` is part of the contract: the
script should report TypeScript build graph order and out-of-date status, not
produce package artifacts.

`release-readiness:check` stays focused on distribution validation and continues
to run `packages:build`, example self checks, `pack:dry-run`,
`publish-readiness:check`, and the local create-tsuzuru smoke. It does not call
`packages:graph:check`.

CI does not call `packages:graph:check` yet. The current graph is still a pilot
graph rather than a dependency-complete package graph, so a CI failure would be
too easy to misread as a release artifact failure.

## Formalization Criteria

`tsconfig.packages.experimental.json` can be promoted only when:

- the publishable package graph is dependency-complete, or every excluded
  package has a documented reason
- each participating package uses a source-only `composite: true` tsconfig and
  package-local `.tsbuildinfo/tsconfig.tsbuildinfo`
- all workspace package dependencies in the graph are represented by explicit
  `references`
- `tsc -b --dry --verbose` explains the expected package build order
- package imports still resolve through the intended `dist` declaration paths
- `packages:build`, `packages:typecheck:self`, `pack:dry-run`,
  `publish-readiness:check`, and `release-readiness:check` continue to pass
- the root script or CI entry point is named as graph validation rather than
  release artifact generation
- a follow-up decision explicitly chooses whether `packages:graph:check` stays
  local-only or becomes part of CI quality-fast

## Consequences

### Positive

- The project can validate TypeScript dependency order without changing the
  release build strategy.
- Publish layout checks remain authoritative for tarball contents, CSS assets,
  templates, and bin entries.
- A future formal graph can be introduced with a narrow, testable purpose.

### Negative

- The repository continues to have two related mechanisms: package artifact
  builds and TypeScript graph validation.
- Remaining package reference edges still need explicit design before the graph
  is dependency-complete.
- `tsc -b` speedups are deferred until a later build-strategy decision.

## Reconsideration Criteria

Revisit this decision when:

- every publishable package has a validated project reference shape
- `tsc -b` can either run the required non-TypeScript build steps through a
  deliberate wrapper or is intentionally limited to validation forever
- release-readiness needs a formal package graph gate and the gate name,
  ordering, and failure mode have been designed
- package import resolution no longer depends on built `dist` declaration
  output

## Related Documents

- `AGENTS.md`
- `docs/plans/typescript-build-graph.md`
- `tsconfig.packages.experimental.json`
- `package.json`
