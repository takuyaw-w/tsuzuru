# Tsuzuru Preact Basic Fullscreen Example

This example runs a multi-file scenario project from `scenario/main.tzr` as a fullscreen visual-novel style browser screen. The app imports the `.tzr` entry directly through `@tsuzuru/vite-plugin`, then drives the compiled document through `@tsuzuru/preact`'s `useRuntime`.

It demonstrates the current runnable DSL v2 subset: `include "./path.tzr"` compile-time directives, cross-file scene jumps with `jump targetScene`, visual sugar including clear commands and transition metadata, audio sugar, dialogue, narration, state updates, `if` / `else`, conditional body choices, waits, and `end`.

Title, load, settings, backlog, and gallery screens are ordinary TSX components under `src/screens`. The `.tzr` files focus on the scenario body after Start.

The example also includes a Save / Load MVP. It uses three localStorage-backed
save slots, enables Title Continue when a latest save exists, and shows Save /
Load as runtime overlays so the runtime is not unmounted while those screens are
open. This localStorage storage is example-side host behavior, not Tsuzuru's
engine-wide storage policy.

If the player saves and loads while choices are visible, the choice and the
retained previous message window behind the choices are restored. The retained
message is persisted in the example-side save data wrapper as host-owned
presentation state; the `RuntimeSaveData` payload itself is unchanged.

The runtime overlay Backlog screen records displayed narration and dialogue as
message history. This is also example-side presentation state, not core runtime
state, and it is not persisted in save data yet.

The Settings screen includes a Text Preferences MVP. It can turn text reveal on
or off and choose slow, normal, or fast text speed. These preferences are
example-side host state persisted with localStorage; `@tsuzuru/core`,
`@tsuzuru/preact`, and `@tsuzuru/standard-ui-preact` do not own this preference
policy.

The example also includes an Audio Playback MVP. The std-audio plugin records
BGM, SE, and Voice state/events, and the example-side `AudioLayer` resolves
those asset IDs through `assets.ts`, then delegates browser playback to
`StdAudioLayer` from `@tsuzuru/standard-ui-preact`. BGM / SE / Voice volume can
be changed from Settings. Audio files are not bundled; place files under
`public/assets/audio/...` to match the asset map. Playback and asset resolution
are host-owned presentation behavior, not core or plugin behavior.

Text Sound Lab is the bundled scenario. It uses three characters, `tone`,
`noize`, and `mix`, to demonstrate `tone`, `noise`, and `mix` profiles from
`@tsuzuru/plugin-std-text-sound`. Narration and character defaults are resolved
from `assets.ts`, and the package browser helper is called from the text reveal
character callback. Settings can turn text sound on or off and adjust volume.
No real text sound audio files are bundled.

The runtime menu also includes an Auto Mode MVP. Auto Mode can be toggled from
the `Auto` button and advances narration or dialogue after the full text is
visible. It stops at choices and never selects an option automatically. This is
example-side presentation behavior, not a core runtime feature.

Read Tracking MVP records narration and dialogue shown during the current
runtime session as read. The runtime UI shows a read count, and Backlog entries
show a `Read` badge. This is example-side host state, not a core runtime
feature, is not stored in save data yet, and is intended as a future Skip Mode
building block.

The runtime menu also includes a Skip Mode MVP. Skip Mode can be toggled from
the `Skip` button and quickly advances narration or dialogue that was already
read before it became visible. A first-time message is marked read when shown,
but it is not skipped during that same display. Choices are never selected
automatically. Skip Mode is example-side presentation behavior, not a core
runtime feature, and the MVP uses only current-session Read Tracking rather than
persistent read state.

Scenario files live under `scenario/`. Add new `.tzr` files there, then reference
them from `scenario/main.tzr` with `include "./path.tzr"`. The app imports
`scenario/main.tzr` directly, and `@tsuzuru/vite-plugin` follows those include
directives during Vite dev/build. Asset IDs and their example-side presentation
mapping live in `assets.ts`, with CSS placeholder presentation in addition to
audio URLs. Title, load, settings, backlog, and gallery UI belong in
`src/screens`.

`tsuzuru.config.ts` is consumed by the first CLI command, `tsuzuru check`.
The command reads `scenario.entry`, expands `scenario.files`, loads the matched
`.tzr` files, and validates the scenario project. Vite dev/build use the same
creator-facing entry file through `@tsuzuru/vite-plugin`.

The runtime hook is configured with `autoClearWait: true` and `autoStepTransientEvents: true`, so waits continue after their duration and transient events such as `if`, state updates, jumps, and plugin commands are not rendered as message text. Waits are treated as internal timing and the example does not show `Waiting ...` status text.

The visual layer reads std-visual transition metadata and renders `fade` and `dissolve` entrance/update transitions with example-side CSS. Transition execution is not part of the core runtime. Exit transitions for `hide`, `clear bg`, and `clear sprites` remain future scope because those operations remove the surviving visual state.

Controls:

- The example opens on the TSX title screen. Click Start, then click, Enter, or Space to start and advance scenario messages.
- While text is revealing, Click, Enter, or Space reveals the full message.
- After the full message is visible, Click, Enter, or Space advances to the next event.
- The runtime `Auto` button toggles Auto Mode. When enabled, narration and
  dialogue advance automatically after full text display.
- The runtime `Skip` button toggles Skip Mode. When enabled, narration and
  dialogue that were read earlier in the current session advance quickly.
- Choices are shown above the message window while the previous message remains visible. Click a choice button to select it.

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
pnpm --filter @tsuzuru/example-preact-basic check:scenario
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic test:ui
```

The UI check uses Playwright to start the example dev server at
`http://127.0.0.1:5173/`, capture a title-screen screenshot under
`test-results`, run short click-through smoke checks, and verify the
localStorage-backed Save -> Load -> Restore path. The save/load smoke confirms
that the example stores a `RuntimeSaveSlot` envelope with a version 2 runtime
snapshot before loading the saved runtime view back into the browser UI.
If Chromium has not been installed for Playwright yet, run:

```sh
pnpm exec playwright install chromium
```

The visual layer intentionally uses asset IDs as placeholders, so no image files
are required. Audio asset IDs are mapped by the example, but audio files are not
required for the smoke test; missing files are reported without stopping the app.
