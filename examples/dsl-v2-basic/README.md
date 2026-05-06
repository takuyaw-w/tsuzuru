# Tsuzuru DSL v2 Basic Fullscreen Example

This example runs `scenario/main.tzr` as a fullscreen visual-novel style browser screen. It parses the scenario with `parseTzr`, compiles it with `compileTzr`, and drives the compiled document through `@tsuzuru/preact`'s `useRuntime`.

It demonstrates the current runnable DSL v2 subset: a `.tzr` title scene, visual sugar including clear commands and transition metadata, audio sugar, dialogue, narration, state updates, `if` / `else`, conditional body choices, scene jumps, waits, and `end`.

The runtime hook is configured with `autoClearWait: true` and `autoStepTransientEvents: true`, so waits continue after their duration and transient events such as `if`, state updates, jumps, and plugin commands are not rendered as message text. Waits are treated as internal timing and the example does not show `Waiting ...` status text.

The visual layer reads std-visual transition metadata and renders `fade` and `dissolve` entrance/update transitions with example-side CSS. Transition execution is not part of the core runtime. Exit transitions for `hide`, `clear bg`, and `clear sprites` remain future scope because those operations remove the surviving visual state.

Controls:

- The example opens into the `.tzr` title scene. Click, Enter, or Space to start and advance messages.
- While text is revealing, Click, Enter, or Space reveals the full message.
- After the full message is visible, Click, Enter, or Space advances to the next event.
- Choices are shown above the message window while the previous message remains visible. Click a choice button to select it.

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic dev
pnpm --filter @tsuzuru/example-dsl-v2-basic build
pnpm --filter @tsuzuru/example-dsl-v2-basic test:ui
```

The UI check uses Playwright to start the example dev server, capture a title-scene screenshot under `test-results`, and run a short click-through smoke check.
If Chromium has not been installed for Playwright yet, run:

```sh
pnpm exec playwright install chromium
```

The visual and audio layers intentionally use asset IDs as placeholders, so no image or audio files are required.
