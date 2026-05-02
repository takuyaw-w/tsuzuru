# Tsuzuru standard-ui-preact example

This example shows how to combine `@tsuzuru/preact`, `@tsuzuru/standard-ui-preact`, `@tsuzuru/plugin-std-visual`, and `@tsuzuru/plugin-std-audio`.

`@tsuzuru/standard-ui-preact` provides the shell, message, choice, and status UI. Visual and audio behavior is connected by example-local `VisualLayer` and `AudioLayer` components so the UI package stays independent from visual/audio plugins.

## Assets

Image files are not bundled. To see real images, place files at:

```txt
public/assets/backgrounds/classroom.png
public/assets/sprites/alice_smile.png
public/assets/sprites/bob_normal.png
```

Audio files are not bundled. To test playback, place files at:

```txt
public/assets/audio/bgm/main_theme.mp3
public/assets/audio/se/click.mp3
public/assets/audio/voice/alice_001.mp3
```

Missing files, load errors, and browser autoplay restrictions are handled as best effort. The app shows notices and writes console warnings instead of crashing.

## Commands

```sh
pnpm --filter @tsuzuru/example-standard-ui-preact dev
pnpm --filter @tsuzuru/example-standard-ui-preact build
pnpm --filter @tsuzuru/example-standard-ui-preact typecheck
```
