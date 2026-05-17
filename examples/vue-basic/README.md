# Tsuzuru Vue Basic

Vue 3 example for Tsuzuru.

This example uses:

- `@tsuzuru/vue` for runtime state and stepping
- Vue SFC components for the title, runtime, backlog, settings, and gallery
- `@tsuzuru/plugin-std-visual` for background and sprite state
- `@tsuzuru/plugin-std-audio` for BGM, SE, and voice state
- `@tsuzuru/plugin-std-text-sound` for text blip profile defaults and playback helpers

The primary runnable example remains `examples/preact-basic`. This example shows
that Tsuzuru's core runtime can be connected to another framework without
changing `.tzr` semantics.

## Commands

```sh
pnpm --filter @tsuzuru/example-vue-basic check:scenario
pnpm --filter @tsuzuru/example-vue-basic test
pnpm --filter @tsuzuru/example-vue-basic test:ui
pnpm --filter @tsuzuru/example-vue-basic typecheck
pnpm --filter @tsuzuru/example-vue-basic build
pnpm --filter @tsuzuru/example-vue-basic dev
```

The UI check uses Playwright to start the example dev server at
`http://127.0.0.1:5174/` and run a Save -> Load -> Restore smoke test. The
browser test verifies that the example-owned localStorage payload contains a
`RuntimeSaveSlot` envelope with a version 2 runtime snapshot and that loading the
slot restores the visible runtime message.

Audio files are intentionally represented by `.gitkeep` placeholders. Missing
audio playback is reported as a non-fatal browser notice by `AudioLayer.vue`.
Text Sound Lab uses three characters, `tone`, `noize`, and `mix`, to demonstrate
generated Web Audio `tone`, `noise`, and `mix` profiles from `assets.ts`.
Profiles are resolved from narration / character defaults during text reveal. No
real text sound assets are bundled.

`create-tsuzuru --template vue` is not implemented yet.
