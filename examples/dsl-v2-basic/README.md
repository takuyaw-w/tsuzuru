# Tsuzuru DSL v2 Basic Example

This example parses `scenario/main.tzr` with `parseTzrV2`, compiles it with `compileTzrV2`, and runs the compiled document through the core runtime.

It demonstrates the current runnable DSL v2 subset: visual sugar, audio sugar, dialogue, narration, state updates, `if` / `else`, conditional body choices, scene jumps, and `end`.

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic dev
pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

The visual and audio layers intentionally use asset IDs as placeholders, so no image or audio files are required.
