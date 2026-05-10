# 0019: Audio Playback MVP

## Status

Accepted

## Context

`@tsuzuru/plugin-std-audio` records standard audio runtime state for BGM and
sequence events for SE and Voice. It intentionally does not load files or control
browser playback.

`examples/preact-basic` previously displayed that std-audio state for debugging,
but did not attempt actual playback. The example needs a small browser playback
MVP without changing public APIs in core, Preact, standard UI, or the std-audio
plugin.

## Decision

Implement audio playback in `examples/preact-basic` as host-owned presentation
behavior.

The example's `AudioLayer` reads std-audio runtime state, resolves asset IDs
through an example-local asset map, and attempts BGM / SE / Voice playback with
browser audio elements. BGM / SE / Voice volume preferences are also
example-owned Settings preferences.

Audio files are not bundled. Users can place files under
`examples/preact-basic/public/assets/audio/...` matching the example asset map.

Missing asset mappings, missing files, and browser autoplay failures are reported
with notices or console warnings. They must not stop the app.

## Rationale

This keeps the std-audio plugin focused on runtime state and event emission. File
URLs, host asset layout, volume policy, and browser playback behavior vary by
application and should not become core or plugin policy at this stage.

Keeping playback in the example also proves the integration path while preserving
the current package boundaries and public APIs.

## Responsibility boundaries

`@tsuzuru/core` owns runtime stepping, scenario state, and plugin command
dispatch.

`@tsuzuru/plugin-std-audio` owns std-audio command handlers and plugin state:
current BGM asset ID, SE events, Voice events, and event sequences.

`@tsuzuru/preact` and `@tsuzuru/standard-ui-preact` do not own audio playback or
asset resolution.

`examples/preact-basic` owns the playback controller, asset ID to URL map,
browser audio element lifecycle, volume preferences, and fallback behavior for
missing or blocked audio.

## Current limitations

The MVP does not persist volume preferences in save data.

The MVP does not save or restore audio playback position.

The MVP does not include audio files, IndexedDB storage, audio sprites, fades,
crossfades, or a channel system.

Browser autoplay policy can block playback until the page has enough user
activation. This is treated as a non-fatal host playback issue.

## Future work

Consider a reusable example-side audio controller hook or standard helper once
more host requirements are known.

Future work may add fades, crossfades, channel policy, better asset resolvers,
or save/load integration for presentation state. Those should be designed without
moving host playback policy into core runtime semantics.

## Related Documents

- `AGENTS.md`
- `docs/decisions/0005-std-audio-plugin.md`
- `examples/preact-basic/README.md`
