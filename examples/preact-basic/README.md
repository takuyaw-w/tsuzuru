# Preact Basic Example

This example combines `@tsuzuru/core` and `@tsuzuru/preact` in a minimal Vite + Preact app.

It parses and compiles `scenario/main.tzr` on startup, passes the compiled document to `useRuntime`, and renders each `RuntimeEvent` with `RuntimeView`.

Runtime control is intentionally small:

- non-blocking events advance with the `Step` button
- `waitClick` and `page` continue through `runtime.continueClick`
- `wait` is handled by `useRuntime` with `autoClearWait: true`
- transient events such as scene, label, state, jump, if, and pluginCommand advance through `autoStepTransientEvents: true`
- `choice` calls `runtime.choose` from the clicked item index
- `@bg(...)` is handled by a minimal plugin command handler
- `Save`, `Load`, and `Clear Save` persist a runtime snapshot in `localStorage`

Save data uses the fixed `localStorage` key `tsuzuru:examples:preact-basic:snapshot`. It is example-only data for demonstrating `useRuntime` snapshots, and compatibility is not guaranteed yet.

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
