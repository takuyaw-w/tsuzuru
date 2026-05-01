---
name: tsuzuru-release-readiness
description: Use when checking Tsuzuru v0.1 readiness, quality gates, package builds, public exports, README/docs accuracy, examples, and TODO completion.
---

# Tsuzuru Release Readiness Skill

## Purpose

Use this skill when checking whether Tsuzuru v0.1 is ready, or when working on final quality gates before a release or milestone.

This skill is for verification, stabilization, and completion review. It should not introduce large new features.

## Read First

Before doing release-readiness work, read:

1. `AGENTS.md`
2. `TODOS.md`
3. root `package.json`
4. `pnpm-workspace.yaml`
5. package `package.json` files
6. public exports in package `src/index.ts` files
7. root `README.md` if it exists
8. docs under `docs/`
9. example README files
10. relevant Skills for touched areas

## Scope

This skill applies to:

- v0.1 completion checks
- quality gates
- package builds
- root scripts
- package scripts
- public exports
- README accuracy
- docs accuracy
- example build verification
- clean checkout verification
- TODO completion review
- release-blocking issues

## v0.1 Completion Definition

Tsuzuru v0.1 is ready only when the repository demonstrates:

- `.tzr` can express a small visual novel scenario
- `@tsuzuru/core` can parse, compile, and execute runtime flow
- compiler detects major DSL errors
- plugin commands can be registered and validated
- macros can expand safely at compile time
- Preact can display and operate runtime state
- save/load can be verified through the Preact example
- examples work from a clean checkout
- README and docs match current implementation
- quality gates pass

## Release-Readiness Principles

Do:

- verify current behavior
- fix release blockers
- keep changes small
- update docs when reality differs
- update TODOs only after verification
- report failed or skipped checks clearly

Do not:

- add speculative v0.2 features
- broaden scope into unrelated refactors
- hide failed checks
- mark TODOs complete without evidence
- document unimplemented features as implemented
- change DSL philosophy during final readiness
- introduce arbitrary JavaScript support in `.tzr`
- create large new architecture while stabilizing

## Quality Gates

Check these items before considering v0.1 ready:

```txt
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @tsuzuru/core build
pnpm --filter @tsuzuru/preact build
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

Browser/manual verification when required:

```txt
pnpm --filter @tsuzuru/example-preact-basic dev
```

Only mark browser/manual verification complete if it was actually performed.

## Package Checks

### Root

Verify root `package.json` scripts are accurate.

Expected useful root scripts:

```sh
pnpm test
pnpm typecheck
```

The root package should not pretend to publish a production package if it is private.

### Core

Verify:

- `@tsuzuru/core` builds
- `@tsuzuru/core` tests pass
- `@tsuzuru/core` typecheck passes
- public exports are intentional
- no obvious `any` leaks in public API
- parser / compiler / runtime APIs match docs

Commands:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/core build
```

### Preact

Verify:

- `@tsuzuru/preact` builds
- `@tsuzuru/preact` tests pass
- `@tsuzuru/preact` typecheck passes
- public exports are intentional
- Preact peer dependency is appropriate
- adapter APIs match docs and examples

Commands:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```

### Examples

Verify:

- examples build from repository root
- examples typecheck
- examples use package public APIs
- examples do not depend on hidden setup
- example README commands work

Commands:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

## Public Export Review

For each package, review `src/index.ts`.

Check:

- exported names are intentional
- public types are useful
- internal-only helpers are not accidentally exported
- removed APIs are not still documented
- documented APIs are actually exported
- public exports do not expose unstable implementation details
- public exports do not leak `any`

For `@tsuzuru/core`, review exports around:

- parser
- compiler
- AST
- IR
- diagnostics
- commands
- conditions
- macros
- runtime
- snapshot / restore

For `@tsuzuru/preact`, review exports around:

- `useRuntime`
- `RuntimeView`
- runtime save data
- visible event helpers
- auto-step helpers

## Documentation Readiness

Docs must match current implementation.

Review:

- root `README.md`
- `docs/dsl.md`
- `docs/runtime.md`
- `docs/plugin-api.md`
- `docs/macro-api.md`
- `docs/architecture.md`
- example README files

Docs should clearly distinguish:

- implemented behavior
- v0.1 limitations
- post-v0.1 candidates

Do not claim these are implemented unless verified:

- `create-tsuzuru`
- `@tsuzuru/vite`
- Vite plugin behavior
- cross-file jump existence validation
- GUI editor
- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility
- arbitrary JavaScript inside `.tzr`
- Live2D
- Pixi integration
- backlog
- auto mode
- skip mode
- gallery
- achievements
- cloud save

## DSL Readiness

Verify `.tzr` docs and examples match implemented syntax.

Check:

- `#scene("id")`
- `#label("id")`
- narration
- `:: Speaker`
- `@command(...)`
- `$macro(...)`
- `@if(...)`
- `@else`
- `@endif`
- choices with `?` and `- "Text" -> target`
- same-file jump validation
- current cross-file limitation
- supported value types
- unsupported arbitrary JS expressions

The DSL should remain constrained and statically analyzable.

## Runtime Readiness

Verify runtime behavior is covered by tests and examples.

Check:

- scene event
- label event
- narration event
- dialogue event
- choice event
- jump event
- if event
- state command behavior
- wait behavior
- waitClick behavior
- page behavior
- stop behavior
- plugin command event
- snapshot creation
- restore behavior

If runtime regression tests are missing, do not mark related TODOs complete.

## Save / Load Readiness

Verify save/load behavior is covered enough for v0.1.

Check:

- core snapshot creation
- core restore
- Preact save data creation
- Preact save data validation
- Preact view restoration
- choice save/load
- wait save/load
- waitClick/page save/load
- narration/dialogue display save/load
- example localStorage save/load behavior

If compatibility is not guaranteed, docs must say so.

## Plugin / Macro Readiness

Verify plugin and macro boundaries.

Plugin readiness:

- unknown commands are compiler errors
- registered plugin commands compile
- plugin command schemas validate arguments
- plugin command schema definitions are validated
- core commands remain core-owned

Macro readiness:

- unknown macros are compiler errors
- macros expand at compile time
- macro calls do not remain in runtime IR
- forbidden macro expansion results are rejected
- macro argument schema validation limitation is documented if not implemented

## Example Readiness

The Preact example should demonstrate:

- parsing scenario source
- compiling scenario source
- registering at least one plugin command
- handling at least one plugin command
- rendering runtime events
- clicking to advance
- making a choice
- save
- load
- clear save
- avoiding display of transient events via visible event behavior

The scenario should ideally demonstrate:

- narration
- dialogue
- choice
- jump
- if
- flag
- variable
- wait
- plugin command
- save/load-friendly flow

## Clean Checkout Verification

For clean checkout readiness, verify from repository root.

Minimum:

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @tsuzuru/core build
pnpm --filter @tsuzuru/preact build
pnpm --filter @tsuzuru/example-preact-basic build
```

If clean checkout cannot be fully reproduced in the current environment, state that clearly.

Do not mark clean checkout TODOs complete unless the relevant commands were actually run in an equivalent clean state.

## TODO Review Rules

When reviewing `TODOS.md`:

- check completed items only after verification
- keep partially completed parent items unchecked
- do not delete unresolved TODOs
- move items to post-v0.1 only when explicitly decided
- add short notes only when they clarify decisions
- avoid turning TODO review into feature implementation

A TODO item can be checked only when:

- behavior exists
- tests or verification exist when appropriate
- docs are updated when public behavior changed
- relevant checks pass

## Release Blocker Categories

Treat these as release blockers:

- `pnpm install` fails
- `pnpm test` fails
- `pnpm typecheck` fails
- core build fails
- preact build fails
- example build fails
- docs claim unimplemented behavior
- example README commands are wrong
- public exports are missing required APIs
- public exports expose clearly accidental internals
- `.tzr` examples use unsupported syntax
- save/load example is broken
- plugin/macro docs contradict implementation

Treat these as non-blockers if documented as limitations:

- cross-file jump existence validation not implemented
- `create-tsuzuru` not implemented
- `@tsuzuru/vite` not implemented
- advanced visual novel features deferred to post-v0.1

## Fix Strategy

When a release blocker is found:

1. Identify the smallest fix.
2. Avoid unrelated refactors.
3. Add or update tests when behavior changes.
4. Update docs if public behavior changes.
5. Re-run the failed check.
6. Re-run broader checks when necessary.
7. Report the blocker and resolution.

If the blocker is too large for the current task, document it in the final report and leave the TODO unchecked.

## Version / Package Readiness

Before changing versions or package metadata, verify:

- package names are correct
- package exports are correct
- `files` entries are correct
- package build output path matches exports
- peer dependencies are correct
- workspace dependencies are correct
- private packages are intentionally private
- examples remain private

Do not publish or prepare publishing metadata unless explicitly requested.

## Commands

Core:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/core build
```

Preact:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```

Example:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

Repository:

```sh
pnpm test
pnpm typecheck
```

Clean checkout style:

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @tsuzuru/core build
pnpm --filter @tsuzuru/preact build
pnpm --filter @tsuzuru/example-preact-basic build
```

Manual browser verification:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

## Final Review Checklist

Before declaring v0.1 ready, verify:

- `pnpm install` passes
- `pnpm test` passes
- `pnpm typecheck` passes
- `@tsuzuru/core` builds
- `@tsuzuru/preact` builds
- `@tsuzuru/example-preact-basic` builds
- example typecheck passes
- public exports reviewed
- README quickstart is accurate
- docs match implementation
- limitations are explicit
- examples use supported syntax
- TODOs reflect actual status
- no release blockers remain

## Completion Criteria

A release-readiness task is complete only when:

- requested checks were run or explicitly reported as skipped
- failed checks are reported honestly
- blockers are fixed or documented
- TODOs are updated only for verified completion
- docs are corrected if they overstated implementation
- examples are verified if relevant
- final report is concise and factual

## Final Report Format

Use this format:

```txt
実施内容:
- ...

確認:
- pnpm install: pass
- pnpm test: pass
- pnpm typecheck: pass
- pnpm --filter @tsuzuru/core build: pass
- pnpm --filter @tsuzuru/preact build: pass
- pnpm --filter @tsuzuru/example-preact-basic build: pass

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

If any check was skipped or failed, state it explicitly.

Keep the report short.
