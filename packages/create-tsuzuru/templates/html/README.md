# Tsuzuru HTML Project

This project uses Tsuzuru with plain HTML and Vanilla DOM.

It does not use Preact, React, Vue, TSX, or JSX.

## Commands

```sh
pnpm install
pnpm check:scenario
pnpm dev
pnpm build
```

## Files To Edit

- `index.html`: title, runtime, backlog, settings, and gallery screen markup
- `assets.ts`: asset ID to browser URL mapping
- `scenario/**/*.tzr`: scenario text and flow
- `src/screens/*.html`: source screen fragments such as Settings
- `src/style.css`: app styling
- `public/assets/images`: background and sprite image files
- `public/assets/audio`: BGM, sound effect, and voice files

`src/main.ts` only wires the HTML files, screen fragments, and asset manifest
into `@tsuzuru/html`. Most projects can leave it alone.

## Scenario Files

Scenario source files live in `scenario/`.

`tsuzuru.config.ts` validates:

```txt
scenario/main.tzr
scenario/**/*.tzr
```

The Vite config serves those files as `/scenario/...` during development and
copies them to `dist/scenario` during build.

## Assets

`assets.ts` maps scenario asset IDs such as `room`, `mio_smile`,
`daily_theme`, `page`, and `mio_001` to browser paths under `/assets/`.

The template includes generated SVG image assets. Audio entries are already
listed in `assets.ts`, but audio files are not included. Add your own files
under:

```txt
public/assets/audio/bgm/
public/assets/audio/se/
public/assets/audio/voice/
```

Missing audio files and browser autoplay failures are shown as non-fatal
notices by `@tsuzuru/html`; they do not stop scenario playback.
