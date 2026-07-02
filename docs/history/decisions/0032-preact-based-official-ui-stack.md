# ADR 0032: Preact-Based Official UI Stack

Status: Accepted

## Context

Tsuzuru Core, the DSL, runtime, and plugin system are designed to stay
framework-neutral. At the same time, maintaining multiple official UI adapters,
examples, templates, docs, and tests in the v0.x phase increases coordination
cost while the official UI experience is still stabilizing.

## Decision

For v0.x, Tsuzuru's official UI stack, examples, and `create-tsuzuru` templates
are focused on Preact-based JSX.

The current official packages remain:

- `@tsuzuru/preact`
- `@tsuzuru/standard-ui-preact`

The official runnable browser example remains:

- `examples/preact-basic`

The current `create-tsuzuru` template remains the Preact-based `basic` template,
with `preact` as an alias.

## Rationale

This keeps the standard UI, generated project path, examples, tests, docs, and
release checks aligned around one official browser UI stack. It reduces
duplicate adapter and example maintenance while v0.x work prioritizes the core
runtime, DSL, plugin system, and first-run project experience.

## Maintained Boundary

`@tsuzuru/core` remains framework-neutral. Core must not depend on Preact, DOM,
CSS, browser storage, Vite-specific behavior, or application assets.

Framework-specific UI behavior belongs in framework adapters, official UI
packages, examples, or userland apps. Core continues to own narrative execution,
choices, jumps, conditions, runtime stepping, snapshot / restore, and plugin
command dispatch infrastructure.

## Non-Goals

This decision does not:

- rename `@tsuzuru/preact`
- rename `@tsuzuru/standard-ui-preact`
- introduce `@tsuzuru/jsx`
- introduce a custom JSX runtime
- introduce a GSAP transition package
- move framework-specific behavior into `@tsuzuru/core`

## Future Reconsideration

Vue adapter support may be reconsidered later as an optional package if demand
and maintenance ownership become clear. Reintroducing it should be handled as a
separate design and implementation task rather than as incidental repository
cleanup.
