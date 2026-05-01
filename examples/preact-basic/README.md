# Preact Basic Example

This example combines `@tsuzuru/core` and `@tsuzuru/preact` in a minimal Vite + Preact app.

It imports `scenario/main.tzr` with Vite's `?raw` suffix, parses and compiles the source on startup, passes the compiled document to `useRuntime`, and renders each `RuntimeEvent` with `RuntimeView`. v0.1 does not include `@tsuzuru/vite`.

The scenario is intentionally small, but it exercises v0.1 features: narration, dialogue, a choice, same-file jumps, flags, variables, `@if` branches, `@wait`, `@waitClick`, `@page`, and the example `@bg(...)` plugin command. The line before the page break is a convenient point to try Save and Load.

Runtime control is intentionally small:

- narration and dialogue advance when the message area is clicked
- `Debug Step` remains available for runtime inspection
- `waitClick` and `page` continue through `runtime.continueClick` from the continue button, not message-area clicks
- `wait` is handled by `useRuntime` with `autoClearWait: true`
- transient events such as scene, label, state, jump, if, and pluginCommand advance through `autoStepTransientEvents: true`
- `RuntimeView` receives `runtime.visibleEvent`, so auto-stepped transient events are not shown in the normal UI
- `choice` calls `runtime.choose` from the clicked item index
- `@bg(...)` is registered during compilation and handled by a minimal plugin command handler at runtime
- `Save`, `Load`, and `Clear Save` persist runtime save data in `localStorage`

Save data uses the fixed `localStorage` key `tsuzuru:examples:preact-basic:snapshot`. The stored value is `RuntimeSaveData`, which contains the state-only runtime snapshot and the current `RuntimeEvent` so the visible screen can be restored after loading. The example checks parsed data with `isRuntimeSaveData` before restoring it. It is example-only data for demonstrating `useRuntime` save/load, and compatibility is not guaranteed yet.

## Run

From the repository root:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

For a production build:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
```

For type checking only:

```sh
pnpm --filter @tsuzuru/example-preact-basic typecheck
```
