# Tsuzuru Examples Skill

## Purpose

Use this skill when creating, updating, verifying, or debugging Tsuzuru examples.

Examples are not just demos. They are integration checks that prove `@tsuzuru/core`, `@tsuzuru/preact`, `.tzr` scenarios, plugin commands, runtime behavior, and save/load behavior work together from a clean checkout.

## Read First

Before editing examples, read:

1. `AGENTS.md`
2. `TODOS.md`
3. `docs/dsl.md`
4. `docs/runtime.md`
5. `docs/plugin-api.md`
6. `docs/macro-api.md`
7. `packages/core/src/index.ts`
8. `packages/preact/src/index.ts`
9. the target example's `package.json`
10. the target example's `README.md`

## Scope

This skill applies to:

- `examples/basic/`
- `examples/preact-basic/`
- `examples/preact-basic/scenario/main.tzr`
- `examples/preact-basic/src/`
- `examples/preact-basic/README.md`
- example package scripts
- example verification tasks in `TODOS.md`

## Example Responsibilities

Examples should demonstrate current Tsuzuru behavior with minimal complexity.

Examples should verify:

- `.tzr` parsing
- compilation
- runtime execution
- narration
- dialogue
- choices
- jumps
- conditionals
- flags
- variables
- wait / waitClick / page / stop behavior when relevant
- plugin command registration
- plugin command handling
- Preact rendering
- click-to-advance
- choice selection
- save/load behavior
- clean build from repository root

## Current Example Packages

The known Preact example package is:

```txt
@tsuzuru/example-preact-basic
```

Useful commands:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

The build script already builds `@tsuzuru/core` and `@tsuzuru/preact` before running Vite.

## Design Rules

Examples should be:

- small
- readable
- executable
- aligned with current docs
- useful as manual verification
- useful as integration verification
- easy to inspect in a browser
- free of speculative future features

Examples should not become:

- a full production game template
- a GUI editor
- a theme framework
- a complex asset pipeline
- a plugin marketplace
- a showcase of unimplemented roadmap items

## Scenario Rules

Example `.tzr` files should exercise v0.1 behavior without becoming noisy.

A good v0.1 scenario should include:

- `#scene(...)`
- `#label(...)`
- narration
- speaker dialogue
- at least one choice
- same-file jump
- conditional branch
- flag usage
- variable usage
- at least one wait-related command
- at least one plugin command
- a flow that makes save/load easy to test manually

Avoid:

- arbitrary JavaScript
- overly long story text
- complex branching not needed for verification
- cross-file references unless the task is specifically about cross-file behavior
- unimplemented syntax
- hidden macro-generated narrative flow

## Preact Example Rules

The Preact example should demonstrate how consumers use `@tsuzuru/preact`.

It may use:

- `useRuntime`
- `RuntimeView`
- `runtime.visibleEvent`
- `runtime.choose`
- `runtime.continueClick`
- `createRuntimeSaveData`
- `restoreRuntimeSnapshotForView`
- `isRuntimeSaveData`
- minimal plugin command handlers
- `localStorage` for example-only save/load

It should not move package behavior into the example.

If the example needs behavior that belongs in `@tsuzuru/core` or `@tsuzuru/preact`, implement it in the package first and keep the example as a consumer.

## Plugin Command Rules in Examples

Examples may register simple plugin commands to prove plugin integration works.

Good example plugin commands:

```txt
@bg("school_evening")
@bgm("daily")
@se("door")
@show(character="haruka", pose="smile", at="center")
@hide(character="haruka")
```

Plugin handlers in examples should be minimal.

Do not build a full presentation engine inside the example.

Do not use plugin commands for core flow control.

## Save / Load Rules in Examples

Example save/load should be explicit and small.

It may use `localStorage` in the example app.

It should explain:

- the localStorage key
- what data is saved
- that compatibility is not guaranteed yet if that is still true
- how to test Save / Load / Clear Save manually

Do not imply that example save data is a stable public format unless the core docs explicitly guarantee it.

## README Rules

Each example README should include:

- what the example demonstrates
- how to run it
- how to build it
- how to typecheck it
- what runtime behavior to expect
- what save/load behavior to expect if applicable
- known limitations

Keep example README files practical.

Do not duplicate all architecture docs inside example README files.

## Clean Checkout Verification

When asked to verify examples from a clean checkout, use repository-root commands.

Minimum useful checks:

```sh
pnpm install
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

If repository-wide verification is requested:

```sh
pnpm test
pnpm typecheck
```

For browser/manual verification:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

Only mark browser/manual verification complete if it was actually performed.

## Example Build Rules

A production build should pass without requiring unpublished global packages or hidden local setup.

If an example requires a package build first, encode that in the package script.

Do not rely on manual build order unless documented.

## Example Typecheck Rules

Example typecheck should catch public API mismatch.

Run:

```sh
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

If package public APIs changed, also run:

```sh
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/preact typecheck
```

## Example Update Checklist

Before finalizing an example change, verify:

- Does the example still build?
- Does the example still typecheck?
- Does the scenario use only supported DSL syntax?
- Does the README match actual behavior?
- Does it avoid unimplemented roadmap features?
- Does it demonstrate the intended v0.1 behavior?
- Does it keep core logic out of the example?
- Does it keep Preact adapter behavior in `@tsuzuru/preact`?
- Does it keep plugin handlers minimal?
- Does it make save/load behavior testable if relevant?

## TODO Handling

When working on example TODOs:

- check only completed example items
- do not check clean checkout verification unless commands were actually run
- do not check browser verification unless the dev server was actually used and manually inspected
- keep sub-items unchecked if the scenario does not yet demonstrate them
- update README if run instructions changed
- mention skipped verification in the final report

## Commands

Focused example checks:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

Runtime package checks when example depends on package changes:

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
```

Repository checks:

```sh
pnpm test
pnpm typecheck
```

Manual dev server:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

## Completion Criteria

An example task is complete only when:

- the example demonstrates the requested behavior
- the scenario uses supported `.tzr` syntax
- the example builds
- the example typechecks
- package checks are run if package source changed
- README is updated when behavior or commands changed
- TODO items are checked only when actually completed
- skipped manual verification is clearly reported
- remaining limitations are reported

## Final Report Format

Use this format:

```txt
実施内容:
- ...

確認:
- pnpm --filter @tsuzuru/example-preact-basic build: pass
- pnpm --filter @tsuzuru/example-preact-basic typecheck: pass

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

Keep the report short.
