# 0009 Tsuzuru Project Config

Status: accepted.

Tsuzuru will use `tsuzuru.config.ts` as the project configuration entrypoint
for future create-tsuzuru, CLI, and Vite integration work.

Initial scope is intentionally small:

- `scenario.entry` names the starting `.tzr` document.
- `scenario.files` lists candidate `.tzr` document collection patterns.
- `plugins` accepts existing plugin objects such as `createStdVisualPlugin()`
  and `createStdAudioPlugin()`.
- `defineTsuzuruConfig()` is an identity function for type inference and editor
  completion.

The config package does not load files, resolve defaults, expand globs, or
validate config yet. Those are follow-up tasks. Core remains file-system
independent, and scenario collection in Vite examples can still use
`import.meta.glob`.

Title, settings, load, backlog, and gallery screens remain TSX / HTML host
responsibilities. `.tzr` files should stay focused on scenario text, branching,
and presentation commands after game start.

Out of scope for this decision:

- config loader / resolver
- glob expansion implementation
- Vite plugin
- CLI
- create-tsuzuru package
- DSL syntax changes
