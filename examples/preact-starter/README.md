# Tsuzuru Preact Starter

A small creator-facing starter for a Tsuzuru game built with Vite and Preact.

Edit the story in `scenario/main.tzr`.

Register backgrounds, character sprites, and optional audio in `src/assets.ts`.

The app entry stays intentionally small:

```tsx
return <TsuzuruGame scenario={scenario} assets={assets} />;
```

```sh
pnpm --filter @tsuzuru/example-preact-starter dev
pnpm --filter @tsuzuru/example-preact-starter check:scenario
pnpm --filter @tsuzuru/example-preact-starter build
```
