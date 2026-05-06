# Tsuzuru DSL v2 Basic Example

This example parses `scenario/main.tzr` with `parseTzr`, compiles it with `compileTzr`, and runs the compiled document through `@tsuzuru/preact`'s `useRuntime`.

It demonstrates the current runnable DSL v2 subset: visual sugar including clear commands and transition metadata, audio sugar, dialogue, narration, state updates, `if` / `else`, conditional body choices, scene jumps, and `end`.

The runtime hook is configured with `autoClearWait: true` and `autoStepTransientEvents: true`, so waits continue after their duration and transient events such as `if`, state updates, jumps, and plugin commands are not rendered as message text. The example keeps text reveal advance control in the UI layer: click / Enter / Space reveals the current message first, then advances after the text is fully visible.

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic dev
pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

The visual and audio layers intentionally use asset IDs as placeholders, so no image or audio files are required.
