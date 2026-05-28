# Tsuzuru Preact Basic Example

This example runs a short visual-novel style browser game from
`scenario/main.tzr`. The app imports the `.tzr` entry through
`@tsuzuru/vite-plugin`, then drives the compiled document with
`@tsuzuru/preact`'s `useRuntime`.

The bundled scenario is `放課後の栞`, a 2-5 minute starter-scale story. It uses
the current DSL v2 only: `include`, `scene`, `bg`, `show`, dialogue, narration,
state updates, `if`, choices, jumps, plugin commands, waits, and `end`.

The app opens on a title screen and uses the `TitleScreen`, `GameViewport`,
`GameShell`, `RuntimeControlBar`, `RuntimeMessageLayer`, `ChoiceLayer`,
`StdVisualRuntimeLayer`, `StdAudioRuntimeLayer`, `StdEffectLayer`,
`StdCameraRuntimeLayer`, and `StdParticleRuntimeLayer` components from
`@tsuzuru/standard-ui-preact`.

Title, load, settings, backlog, gallery, save, and load screens remain
example-side TSX under `src/screens`. They are intentionally small so the
example stays useful as a starter reference instead of becoming a framework.

The example includes a Save / Load MVP. It uses three localStorage-backed save
slots, enables Title Continue when a latest save exists, and shows Save / Load
as runtime overlays so the runtime is not unmounted while those screens are
open. Storage options are declared in `tsuzuru.config.ts` and wired through
`createStandardGameStorageFromConfig`.

Settings are a full-screen CONFIG-style screen inside the 16:9 viewport. They
are connected only to existing standard preferences: text reveal, text speed,
text sound on/off, text sound volume, BGM volume, SE volume, and voice volume.
Preferences are stored with the same config-driven storage setup.

The example does not bundle real audio files. `assets.ts` maps BGM / SE / Voice
IDs to host-owned public paths, and the browser may report missing audio files
without stopping the app. Text sound uses the browser helper from
`@tsuzuru/plugin-std-text-sound` and generated Web Audio profiles.

Scenario files live under `scenario/`. Add new `.tzr` files there, then
reference them from `scenario/main.tzr` with `include "./path.tzr"`. Asset IDs
and example-side presentation mapping live in `assets.ts`. Example-specific
background SVGs live under `public/assets/backgrounds/`.

Controls:

- The example opens on the title screen. Click Start to enter the game.
- Click, Enter, or Space advances messages. While text is revealing, the first
  advance request reveals the full message.
- Runtime menu actions open Save, Load, Backlog, Settings, or return to Title.
- Auto advances dialogue and narration after the full text is visible, and stops
  at choices.
- Skip advances only messages already read in the current session, and stops at
  choices.

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
pnpm --filter @tsuzuru/example-preact-basic check:scenario
pnpm --filter @tsuzuru/example-preact-basic test
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic test:ui
```

The Playwright UI check starts the example dev server at
`http://127.0.0.1:5173/`, captures a title-screen screenshot, runs title /
settings / runtime / choice smoke checks, and verifies the localStorage-backed
Save -> Load -> Restore path.
