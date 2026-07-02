# 0019: Audio Playback MVP

## Status

Accepted, updated by the standard audio runtime layer

## Context

`@tsuzuru/plugin-std-audio` records standard audio runtime state for BGM and
sequence events for SE and Voice. It intentionally does not load files or control
browser playback.

`examples/preact-basic` originally proved browser playback with an example-local
`AudioLayer`. After that behavior stabilized, the reusable browser playback and
status bridge moved to `@tsuzuru/standard-ui-preact` as `StdAudioRuntimeLayer`.

## Decision

Provide reusable standard audio playback/status presentation in
`@tsuzuru/standard-ui-preact`.

`StdAudioRuntimeLayer` accepts `StdAudioState`, volume-aware asset maps, and
optional status/notice configuration. It composes `StdAudioLayer`,
`StdAudioStatusPanel`, and `useStdAudioNotices`.

Applications still own asset ID to URL maps, file bundling policy, and volume
preferences. `examples/preact-basic` keeps those example-specific concerns in
`assets.ts` and Settings preferences, then passes the prepared asset maps to
`StdAudioRuntimeLayer`.

Audio files are not bundled. Users can place files under
`examples/preact-basic/public/assets/audio/...` matching the example asset map.

Missing asset mappings, missing files, and browser autoplay failures are reported
with notices or console warnings. They must not stop the app.

## Rationale

This keeps the std-audio plugin focused on runtime state and event emission. File
URLs, host asset layout, and volume policy vary by application and should not
become core or plugin policy at this stage.

Keeping the reusable browser playback/status bridge in `standard-ui-preact`
lets examples and starter-style apps share the same UI behavior without moving
host asset policy into core or plugins.

## Responsibility boundaries

`@tsuzuru/core` owns runtime stepping, scenario state, and plugin command
dispatch.

`@tsuzuru/plugin-std-audio` owns std-audio command handlers and plugin state:
current BGM asset ID, SE events, Voice events, and event sequences.

`@tsuzuru/preact` does not own audio playback or asset resolution.

`@tsuzuru/standard-ui-preact` owns the reusable browser playback/status bridge:
audio element lifecycle, playback diagnostics, notices, and optional status
display.

`examples/preact-basic` owns the asset ID to URL map, volume preferences, and
the decision to show the standard audio status panel in its fullscreen layout.

## Current limitations

The MVP does not persist volume preferences in save data.

The MVP does not save or restore audio playback position.

The MVP does not include audio files, IndexedDB storage, audio sprites, fades,
crossfades, or a channel system.

Browser autoplay policy can block playback until the page has enough user
activation. This is treated as a non-fatal host playback issue.

## Future work

Continue keeping host-specific asset resolution and preferences outside
`standard-ui-preact`.

Future work may add fades, crossfades, channel policy, better asset resolvers,
or save/load integration for presentation state. Those should be designed without
moving host playback policy into core runtime semantics.

## Related Documents

- `AGENTS.md`
- `docs/history/decisions/0005-std-audio-plugin.md`
- `examples/preact-basic/README.md`
