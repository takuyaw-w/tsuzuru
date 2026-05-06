# Tsuzuru DSL v2 Basic Fullscreen Example

This example runs a multi-file scenario project from `scenario/main.tzr` as a fullscreen visual-novel style browser screen. It compiles the project with `compileTzrProject` and drives the compiled document through `@tsuzuru/preact`'s `useRuntime`.

It demonstrates the current runnable DSL v2 subset: `include "./path.tzr"` compile-time directives, cross-file scene jumps with `jump targetScene`, visual sugar including clear commands and transition metadata, audio sugar, dialogue, narration, state updates, `if` / `else`, conditional body choices, waits, and `end`.

Title, load, settings, backlog, and gallery screens are ordinary TSX components under `src/screens`. The `.tzr` files focus on the scenario body after Start.

Scenario files live under `scenario/`. Add new `.tzr` files there, then reference
them from `scenario/main.tzr` with `include "./path.tzr"`. `src/scenario.ts`
automatically collects `scenario/**/*.tzr` with Vite and usually does not need
editing. Title, load, settings, backlog, and gallery UI belong in `src/screens`.

`tsuzuru.config.ts` is consumed by the first CLI command, `tsuzuru check`.
The command reads `scenario.entry`, expands `scenario.files`, loads the matched
`.tzr` files, and validates the scenario project with `compileTzrProject`.
`dev`, `build`, Vite integration, and create-tsuzuru wiring remain future work;
the running example still collects scenario files through `src/scenario.ts`.

The runtime hook is configured with `autoClearWait: true` and `autoStepTransientEvents: true`, so waits continue after their duration and transient events such as `if`, state updates, jumps, and plugin commands are not rendered as message text. Waits are treated as internal timing and the example does not show `Waiting ...` status text.

The visual layer reads std-visual transition metadata and renders `fade` and `dissolve` entrance/update transitions with example-side CSS. Transition execution is not part of the core runtime. Exit transitions for `hide`, `clear bg`, and `clear sprites` remain future scope because those operations remove the surviving visual state.

Controls:

- The example opens on the TSX title screen. Click Start, then click, Enter, or Space to start and advance scenario messages.
- While text is revealing, Click, Enter, or Space reveals the full message.
- After the full message is visible, Click, Enter, or Space advances to the next event.
- Choices are shown above the message window while the previous message remains visible. Click a choice button to select it.

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic dev
pnpm --filter @tsuzuru/example-dsl-v2-basic check:scenario
pnpm --filter @tsuzuru/example-dsl-v2-basic build
pnpm --filter @tsuzuru/example-dsl-v2-basic test:ui
```

The UI check uses Playwright to start the example dev server at `http://127.0.0.1:5173/`, capture a title-screen screenshot under `test-results`, and run a short click-through smoke check.
If Chromium has not been installed for Playwright yet, run:

```sh
pnpm exec playwright install chromium
```

The visual and audio layers intentionally use asset IDs as placeholders, so no image or audio files are required.
