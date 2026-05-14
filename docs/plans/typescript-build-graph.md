# TypeScript Build Graph Plan

This note records the current decision for TypeScript project references in the
Tsuzuru monorepo.

## Current Strategy

- Root `packages:build` builds public publishable packages in explicit order
  with package `build:self` scripts.
- Root `packages:typecheck:self` runs public package `typecheck:self` scripts
  after `packages:build` has produced dependency `dist` output.
- Package-level `build` and `typecheck` scripts keep dependency builds so
  filtered package work still works from a clean checkout.
- Examples keep standalone `typecheck` / `build` scripts with dependency builds,
  while `examples:check:self` is used after `packages:build` for release
  readiness.

## Deferred `tsc -b` Questions

Do not introduce TypeScript project references until these are designed:

- whether package tests belong in the same referenced project as package source
- where `.tsbuildinfo` files should live
- whether `composite: true` changes declaration emit or `dist` layout
- how framework packages and examples should be split between package graph and
  Vite application builds
- whether examples should be references in the same graph or a separate check

Until those questions are settled, root build and typecheck flows should keep
the explicit `build:self` / `typecheck:self` gates.
