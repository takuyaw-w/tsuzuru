# Tsuzuru Runtime

This document describes the currently implemented runtime surface in `@tsuzuru/core`.

## Role

The runtime executes compiled Tsuzuru instructions. It owns scenario flow, runtime state, waits, choices, variables, flags, jumps, conditional execution, plugin command dispatch, and minimal snapshot creation.

The core runtime does not render UI and does not manage real time. It has no dependency on `setTimeout`, DOM APIs, Preact, browser storage, asset loading, or plugin lifecycle code. A host or UI layer observes runtime events and calls the appropriate resume or resolve function.

## Input

Runtime execution uses a `CompiledTzrDocument`.

```ts
const state = createInitialRuntimeState(compiledDocument);
const result = stepRuntime(compiledDocument, state);
```

The runtime reads `document.instructions`, `document.labels`, and `document.filePath`. Cross-file runtime jumps are not implemented.

For v0.1, compile-time jump validation is limited to target shape and same-file label existence within one `CompiledTzrDocument`. Cross-file target existence validation is deferred to post-v0.1 and belongs with a project graph, file resolver, or Vite/project loading layer rather than the single-document runtime.

## RuntimeState

`RuntimeState` is immutable by convention. Runtime functions return a new state when state changes.

Important fields:

- `pointer`: current top-level file path and instruction index
- `variables`: runtime values set by `@set`, `@inc`, and `@dec`
- `flags`: boolean flags set by `@flag` and `@unflag`
- `branchFrames`: active nested instruction lists for `@if` branches
- `pendingChoice`: active choice waiting for host resolution, or `null`
- `pendingWait`: active timed wait request, or `null`
- `isStopped`: set by `@stop()` or script end
- `isWaitingForClick`: set by `@waitClick()` and `@page()`

## Initial State

`createInitialRuntimeState(document)` creates a JSON-serializable initial state:

```ts
{
  pointer: { filePath: document.filePath, instructionIndex: 0 },
  variables: {},
  flags: {},
  branchFrames: [],
  pendingChoice: null,
  pendingWait: null,
  isStopped: false,
  isWaitingForClick: false
}
```

## Stepping

`stepRuntime(document, state, options?)` executes one runtime step and returns:

```ts
{
  state: RuntimeState,
  event: RuntimeEvent
}
```

If the runtime is blocked by `pendingWait`, `pendingChoice`, or `isWaitingForClick`, `stepRuntime` returns the same state and repeats the corresponding event. The host must clear or resolve the block before execution continues.

If a branch frame is active, `stepRuntime` executes the next branch instruction before returning to top-level instructions. When a branch frame reaches its end, it is popped and execution resumes at the current top-level pointer.

## Runtime Events

Current `RuntimeEvent` variants:

- `scene`: emitted for `SceneInstruction`
- `label`: emitted for `LabelInstruction`
- `narration`: emitted for narration text
- `dialogue`: emitted for speaker dialogue
- `waitClick`: emitted for `@waitClick()` and repeated while click wait is active
- `page`: emitted for `@page()`
- `stop`: emitted for `@stop()`
- `state`: emitted for `@set`, `@inc`, `@dec`, `@flag`, and `@unflag`
- `jump`: emitted for `@jump("#label")` and `resolveChoice`
- `if`: emitted when evaluating an `IfInstruction`
- `choice`: emitted for `ChoiceInstruction` and repeated while a choice is pending
- `wait`: emitted for `@wait(ms)` and repeated while timed wait is pending
- `pluginCommand`: emitted by plugin command handlers
- `unsupported`: emitted for unsupported instruction or command handling
- `error`: emitted for runtime operation errors such as invalid choice resolution
- `end`: emitted when the pointer is past the end of top-level instructions

## Text Flow Commands

`@waitClick()` advances the instruction pointer and sets `isWaitingForClick: true`. While this is set, `stepRuntime` returns `waitClick` and does not advance.

`@page()` also advances the instruction pointer and sets `isWaitingForClick: true`. It emits `page` when executed. The host should clear the click wait before continuing.

`@stop()` advances the instruction pointer, sets `isStopped: true`, and emits `stop`.

Use `clearClickWait(state)` to clear click waiting:

```ts
const nextState = clearClickWait(result.state);
```

## Timed Wait

`@wait(500)` advances the instruction pointer, sets:

```ts
pendingWait: { durationMs: 500 }
```

and emits:

```ts
{ type: "wait", durationMs: 500 }
```

The core runtime does not start timers. The host or UI layer waits for the desired duration and then calls:

```ts
const nextState = clearWait(state);
```

## Choices

A `ChoiceInstruction` advances the top-level pointer and sets `pendingChoice`.

`choice` events include the question and items:

```ts
{
  type: "choice",
  question: "Choose",
  items: [
    { text: "Stay", targetRaw: "#stay", targetLabel: "stay" }
  ]
}
```

While `pendingChoice` is set, `stepRuntime` repeats the same choice event and does not advance.

Choices are resolved only with `resolveChoice(document, state, itemIndex)`. For same-file label targets, this moves the pointer to the target label, clears `pendingChoice`, clears branch frames, and emits `jump`.

If no choice is pending or `itemIndex` is outside the pending choice items, `resolveChoice` returns an `error` event and the original state. It does not throw and does not silently ignore the invalid index.

Cross-file choice targets are not handled by the runtime yet.

## Blocking Helpers

`isRuntimeBlocked(state)` returns `true` when the runtime is blocked by:

- `pendingWait`
- `pendingChoice`
- `isWaitingForClick`

`getRuntimeBlockReason(state)` returns:

- `"wait"`
- `"choice"`
- `"click"`
- `null`

`isStopped` is stateful execution status, but it is not currently reported as a block reason.

## Variables and Flags

Runtime state commands are core-owned.

`@set(name="route", value="haruka")` stores a string, number, or boolean value.

`@inc(name="affection", by=1)` and `@dec(name="affection", by=1)` update numeric variables. Missing variables are treated as `0`.

`@flag("met_haruka")` stores `true`; `@unflag("met_haruka")` stores `false`.

Each state command emits a `state` event.

## Branch Frames

`branchFrames` represent active instruction lists from conditional branches. Each frame stores:

```ts
{
  instructions: TzrInstruction[],
  instructionIndex: number
}
```

When an `IfInstruction` selects a non-empty branch, the runtime pushes a frame and immediately executes the first instruction in that branch. Subsequent calls to `stepRuntime` continue executing the frame until it reaches the end. Then the frame is popped and execution returns to the already-advanced top-level pointer.

For v0.1, branch frames are included directly in snapshots.

## If, Jump, and Choice Model

`IfInstruction` evaluates its compiled `conditionExpression` with `evaluateCondition`.

- true: push and execute `thenBranch`
- false with `elseBranch`: push and execute `elseBranch`
- false without `elseBranch`: advance to the next top-level instruction

`@jump("#label")` resolves against `CompiledTzrDocument.labels`. It moves `pointer.instructionIndex` to the label's `statementIndex` and does not apply an extra `+1` advance. Jump clears branch frames, pending choice, pending wait, and click wait.

Cross-file jump targets may be parsed and compiled, but the current runtime does not load another document or resolve labels outside the current compiled document.

Choices produce a blocked `pendingChoice` state and are resolved separately by `resolveChoice`.

## Plugin Command Dispatch

Plugin commands must be registered at compile time. Core commands are always available, but non-core commands such as `@bg(...)` or `@show(...)` are compile-time errors unless they are listed in `compileTzr` options.

Plugin command definitions may include argument schemas. The compiler validates:

- plugin command registration
- registry key and definition name consistency
- plugin command schema definitions
- plugin command arguments when a schema is registered

Example:

```ts
import { compileTzr, definePluginCommand } from "@tsuzuru/core";

const compiled = compileTzr(parsed.document, {
  pluginCommands: {
    bg: definePluginCommand("bg", {
      kind: "positional",
      arguments: [{ type: "string" }],
    }),
    show: definePluginCommand("show", {
      kind: "named",
      arguments: [
        { name: "character", type: "string" },
        { name: "pose", type: "string", optional: true },
        { name: "at", type: ["string", "identifier"], optional: true },
      ],
    }),
  },
});
```

The registry key must match the definition name. For example, `bg: definePluginCommand("bg", ...)` is valid, but registering `bg` with a definition named `show` is a compile-time error.

Runtime handlers should use the same command names as the compile-time registry. Runtime dispatch assumes plugin commands have already passed compiler validation.

`stepRuntime` accepts optional command handlers:

```ts
stepRuntime(document, state, {
  commandHandlers: {
    bg(state, instruction) {
      return {
        state,
        event: { type: "pluginCommand", name: instruction.name }
      };
    }
  }
});
```

Only non-core `CommandInstruction` names are dispatched to plugin handlers. Core commands always use the core runtime implementation first.

If a compiled plugin command has no matching runtime handler, the runtime returns an `unsupported` event rather than a runtime error:

```ts
{ type: "unsupported", instructionType: "CommandInstruction" }
```

Plugin handlers are synchronous. They receive the already-advanced state and the original `CommandInstruction`, and return a `RuntimeStepResult`.

## Snapshots

`createRuntimeSnapshot(state)` creates a JSON-serializable snapshot:

```ts
{
  version: 1,
  pointer,
  variables,
  flags,
  branchFrames,
  pendingChoice,
  pendingWait,
  isStopped,
  isWaitingForClick
}
```

`restoreRuntimeState(snapshot)` returns a `RuntimeState`.

For v0.1, `RuntimeSnapshot` intentionally stores `RuntimeState` directly and plainly. This keeps restore logic simple and matches the current runtime model.

One important constraint is `branchFrames`. Current branch frames include the branch `instructions` themselves:

```ts
{
  instructions,
  instructionIndex
}
```

This is straightforward to restore because the runtime can resume branch execution without re-resolving anything from `CompiledTzrDocument`. It also fits the current implementation, where active branches are represented as instruction lists.

The tradeoffs are:

- save data can become larger because branch instructions are embedded
- compatibility is weak if the scenario document changes after the snapshot is created

`RuntimeSaveData` does not include scenario identity, scenario version, or migration metadata in v0.1. Save data compatibility is not guaranteed if the scenario document, compiled instruction order, runtime model, or event shape changes after saving.

A future snapshot format may store a scenario identity, scenario version, migration version, branch path, frame id, instruction index, or similar reference instead of embedding instructions. Restore would then re-resolve branch instructions from the current `CompiledTzrDocument`.

Migration, compatibility handling, compression, and encryption are outside the current runtime API. Snapshots also do not write to storage. LocalStorage, IndexedDB, and save slot management are host/UI layer responsibilities.
