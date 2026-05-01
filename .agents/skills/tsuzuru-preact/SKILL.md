# Tsuzuru Preact Skill

## Purpose

Use this skill when working on `@tsuzuru/preact`.

`@tsuzuru/preact` is the Preact adapter for Tsuzuru runtime. It owns Preact hooks, convenience components, renderable runtime event handling, visible event handling, and save/load adapter utilities.

The Preact package must not take ownership of core scenario execution logic.

## Read First

Before editing, read:

1. `AGENTS.md`
2. `TODOS.md`
3. `packages/preact/package.json`
4. `packages/preact/src/index.ts`
5. Relevant files under `packages/preact/src/`
6. Relevant tests under `packages/preact/tests/`
7. Relevant core APIs under `packages/core/src/`
8. Relevant docs under `docs/`

## Scope

This skill applies to:

- `packages/preact/src/runtime-view.tsx`
- `packages/preact/src/use-runtime.ts`
- `packages/preact/src/runtime-save.ts`
- `packages/preact/src/index.ts`
- `packages/preact/tests/`
- `examples/preact-basic/` only when verifying adapter behavior

## Preact Responsibilities

`@tsuzuru/preact` owns:

- `useRuntime`
- `RuntimeView`
- renderable runtime event selection
- visible event handling
- transient runtime event suppression
- auto-step behavior
- auto-step loop protection
- click-to-advance wiring
- choice selection wiring
- save/load data adapter
- restore snapshot adapter for view state
- convenience UI for basic runtime rendering

## Non-Responsibilities

Do not implement the following in `@tsuzuru/preact`:

- `.tzr` parsing
- AST definitions
- compiler validation
- IR generation
- macro expansion
- plugin command schema validation
- condition evaluation
- jump target validation
- runtime stepping rules
- core runtime state semantics
- scenario execution logic
- DSL syntax changes
- Vite plugin behavior
- project scaffolding
- full game UI framework features

## Boundary with Core

Use `@tsuzuru/core` for:

- `stepRuntime`
- `resolveChoice`
- `createInitialRuntimeState`
- `createRuntimeSnapshot`
- `restoreRuntimeState`
- runtime event types
- runtime state types
- compiled document types

Do not duplicate core runtime logic in Preact.

If a behavior belongs to scenario execution, implement it in `@tsuzuru/core`, not in `@tsuzuru/preact`.

If a behavior belongs to rendering or user interaction, implement it in `@tsuzuru/preact`.

## Design Rules

- Keep `RuntimeView` as a convenience component.
- Do not turn `RuntimeView` into a full visual novel UI framework.
- Keep rendering replaceable by consumers.
- Keep hook state predictable.
- Avoid hidden mutation of core runtime state.
- Avoid example-specific assumptions in package source.
- Avoid browser-only APIs unless they are clearly part of the adapter boundary.
- Keep public APIs explicit and typed.
- Avoid `any`.
- Prefer small helper functions that can be tested independently.

## Runtime Event Handling Rules

Renderable events are events that can be displayed to the user.

Transient events should not flicker in the UI.

Auto-step should advance through events that do not need direct user interaction.

Auto-step must stop at events requiring user action, such as:

- narration
- dialogue
- choice
- waitClick
- page
- stop

Auto-step must have loop protection.

Use or maintain `autoStepMaxSteps` for preventing infinite auto-step loops.

## Visible Event Rules

`visibleEvent` should represent the latest meaningful renderable event for the UI.

Do not expose transient internal events as visible UI state unless explicitly required.

Save/load should preserve enough view state so that restoring during dialogue, narration, choice, wait, or waitClick behaves predictably.

## Click and Choice Rules

Click-to-advance belongs to Preact adapter behavior.

Choice rendering belongs to Preact adapter behavior.

Choice resolution itself belongs to core runtime.

When handling a choice:

1. UI receives a user selection.
2. Preact calls the appropriate core API.
3. Core updates runtime state.
4. Preact reflects the next renderable event.

## Save / Load Rules

`@tsuzuru/preact` may define adapter-level save data for view restoration.

It should rely on core snapshot APIs for runtime state.

Do not invent an incompatible runtime state format in Preact.

Save/load utilities should be explicit about:

- runtime snapshot
- visible event
- pending choice
- pending wait
- version or scenario identity if introduced later

## RuntimeView Rules

`RuntimeView` should remain small.

Allowed responsibilities:

- display narration
- display dialogue
- display choices
- expose basic advance interaction
- expose basic choice selection interaction
- provide a usable default renderer

Avoid adding:

- backlog
- auto mode UI
- skip mode UI
- config screen
- gallery
- achievements
- advanced layout system
- theme engine
- asset loading policy
- complex save slot UI

These can be separate packages or userland components later.

## Testing Requirements

When behavior changes, add or update tests.

Prioritize tests for:

- `useRuntime`
- auto-step behavior
- auto-step stopping conditions
- autoStepMaxSteps loop protection
- visibleEvent behavior
- transient event filtering
- narration click-to-advance
- dialogue click-to-advance
- choice selection
- save data creation
- save data validation
- restore snapshot behavior

## Commands

Run focused checks first:

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
```

When relevant, also run:

```sh
pnpm --filter @tsuzuru/preact build
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm test
pnpm typecheck
```

For example verification:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
```

## Completion Criteria

A task is complete only when:

- The requested adapter behavior is implemented.
- Relevant tests are added or updated.
- `pnpm --filter @tsuzuru/preact test` passes.
- `pnpm --filter @tsuzuru/preact typecheck` passes.
- Relevant core checks are run if core behavior was touched.
- Public API changes are reflected in `packages/preact/src/index.ts`.
- Public behavior changes are reflected in docs or example README when needed.
- Completed TODO items are checked in `TODOS.md`.
- The final report lists changed files, executed commands, results, and remaining concerns.

## Final Report Format

Use this format:

```txt
実施内容:
- ...

確認:
- pnpm --filter @tsuzuru/preact test: pass
- pnpm --filter @tsuzuru/preact typecheck: pass

更新したTODO:
- ...

未対応 / 懸念:
- ...
```

Keep the report short.
