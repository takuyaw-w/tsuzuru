# Tsuzuru Vue Basic

Vue 3 example for Tsuzuru.

This example uses:

- `@tsuzuru/vue` for runtime state and stepping
- Vue SFC components for the title, runtime, backlog, settings, and gallery
- `@tsuzuru/plugin-std-visual` for background and sprite state
- `@tsuzuru/plugin-std-audio` for BGM, SE, and voice state

The primary runnable example remains `examples/preact-basic`. This example shows
that Tsuzuru's core runtime can be connected to another framework without
changing `.tzr` semantics.

## Commands

```sh
pnpm --filter @tsuzuru/example-vue-basic check:scenario
pnpm --filter @tsuzuru/example-vue-basic test
pnpm --filter @tsuzuru/example-vue-basic typecheck
pnpm --filter @tsuzuru/example-vue-basic build
pnpm --filter @tsuzuru/example-vue-basic dev
```

Audio files are intentionally represented by `.gitkeep` placeholders. Missing
audio playback is reported as a non-fatal browser notice by `AudioLayer.vue`.

`create-tsuzuru --template vue` is not implemented yet.
