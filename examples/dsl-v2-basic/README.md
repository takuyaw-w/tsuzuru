# Tsuzuru DSL v2 Basic Fullscreen Example

This example runs `scenario/main.tzr` as a fullscreen visual-novel style browser screen. It parses the scenario with `parseTzr`, compiles it with `compileTzr`, and drives the compiled document through `@tsuzuru/preact`'s `useRuntime`.

It demonstrates the current runnable DSL v2 subset: visual sugar including clear commands and transition metadata, audio sugar, dialogue, narration, state updates, `if` / `else`, conditional body choices, scene jumps, and `end`.

The runtime hook is configured with `autoClearWait: true` and `autoStepTransientEvents: true`, so waits continue after their duration and transient events such as `if`, state updates, jumps, and plugin commands are not rendered as message text.

Controls:

- Click, Enter, or Space to start and advance messages.
- While text is revealing, Click, Enter, or Space reveals the full message.
- After the full message is visible, Click, Enter, or Space advances to the next event.
- Click a choice button to select it.

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic dev
pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

The visual and audio layers intentionally use asset IDs as placeholders, so no image or audio files are required.
