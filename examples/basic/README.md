# Basic Runtime Example

This example runs a small `.tzr` scenario with `@tsuzuru/core` only. It does not use Preact, Vite, asset loading, browser storage, or real rendering.

The sample demonstrates:

- `parseTzr`
- `compileTzr`
- `createInitialRuntimeState`
- `stepRuntime`
- `waitClick` and `page` handling with `clearClickWait`
- `@wait(ms)` handling with `clearWait`
- choice handling with `resolveChoice`
- compile-time registration and a small runtime plugin command handler for `@bg(...)`

## Files

- `scenario/main.tzr`: the scenario script
- `src/run.ts`: the TypeScript runtime driver

## Run

From the repository root:

```sh
pnpm --filter @tsuzuru/example-basic start
```

The script builds `@tsuzuru/core`, compiles this example, and runs `dist/run.js` with Node.

For build verification only:

```sh
pnpm --filter @tsuzuru/example-basic build
```

Expected output includes:

```txt
#scene prologue
plugin command: bg:school_evening
waitClick
wait 300ms
choice: What do you do?
host: choose item 0 for this CLI example
final variables: { haruka_affection: 1 }
```

For type checking only:

```sh
pnpm --filter @tsuzuru/example-basic typecheck
```

The CLI driver clears waits immediately and always chooses item `0`. A real host or UI layer would decide when to clear waits and which choice item to resolve.
