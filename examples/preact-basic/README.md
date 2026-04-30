# Preact Basic Example

This example combines `@tsuzuru/core` and `@tsuzuru/preact` in a minimal Vite + Preact app.

It parses and compiles `scenario/main.tzr` on startup, creates an initial runtime state, and passes each `RuntimeEvent` to `RuntimeView`.

Runtime control is intentionally small:

- non-blocking events advance with the `Step` button
- `waitClick` and `page` continue through `RuntimeView`'s continue button
- `wait` uses `setTimeout`, then calls `clearWait`
- `choice` calls `resolveChoice` from the clicked item index
- `@bg(...)` is handled by a minimal plugin command handler

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
