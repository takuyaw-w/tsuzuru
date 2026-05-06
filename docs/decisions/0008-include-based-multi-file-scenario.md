# 0008 Include-Based Multi-File Scenario

Status: accepted.

Tsuzuru supports multi-file scenario projects through `#include("./path.tzr")`.
The directive is compile-time only and never becomes a runtime command or
runtime event.

The public API is `compileTzrProject({ entryId, documents }, options)`, where
`documents` is an in-memory array of `{ id, source }`. Core does not read files.
Relative include paths resolve from the including document id.

The project compiler aggregates the entry document and included documents,
deduplicating documents that are included more than once. It reports validation
errors for missing include targets, circular includes, duplicate scene ids,
duplicate label ids, and missing `-> labelName` targets.

Title, settings, load, backlog, and gallery screens are application concerns.
They should be implemented in TSX / HTML host code, not inside `.tzr`. Scenario
files should stay focused on game-start narrative flow, branching, and
presentation commands.

Rejected for the initial implementation:

- `import`
- `@include`
- `@jump(...)`
- file-aware jumps such as `-> "./file.tzr#label"`
- label namespaces
- `tsuzuru.config.ts`
- runtime current-file tracking
