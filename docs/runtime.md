# Tsuzuru Runtime

> Status: DSL v2-first. The runtime still provides shared execution, snapshot,
> plugin dispatch, and current command primitives. Legacy label jump syntax,
> runtime flags, old target-label choices, and low-level `inc` / `dec` / `flag` /
> `unflag` state commands have been removed. DSL v2 uses scene jumps, body
> choices, scenario variables, project-level label jumps, and the current
> `IfInstruction`.

This document describes the currently implemented DSL v2 runtime surface in `@tsuzuru/core`.

## Role

The runtime executes compiled Tsuzuru instructions. It owns scenario flow, runtime state, waits, choices, variables, DSL v2 scene jumps, label jumps, conditional execution, plugin command dispatch, and minimal snapshot creation.

The core runtime does not render UI and does not manage real time. It has no dependency on `setTimeout`, DOM APIs, Preact, browser storage, asset loading, or plugin lifecycle code. A host or UI layer observes runtime events and calls the appropriate resume or resolve function.

## Input

Runtime execution uses a `RuntimeDocument`. DSL v2 compilation returns a `CompiledTzrDocument`, which extends that runtime document shape.

```ts
const state = createInitialRuntimeState(compiledDocument);
const result = stepRuntime(compiledDocument, state);
```

The runtime reads `document.instructions`, `document.scenes`, optional `document.labels`, and `document.filePath`. DSL v2 scene jumps resolve through `document.scenes`. `-> labelName` jumps resolve through `document.labels` when a compiled document contains label declarations.

The runtime still has no current-file concept. Cross-file authoring is handled by `compileTzrProject` before runtime execution.

## RuntimeState

`RuntimeState` is immutable by convention. Runtime functions return a new state when state changes.

Important fields:

- `pointer`: current top-level file path and instruction index
- `variables`: runtime values set by DSL v2 `set` and `add`
- `plugins`: plugin-owned runtime state
- `branchFrames`: active nested instruction lists for DSL v2 `if` branches and body choices
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
  plugins: {},
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
- `narration`: emitted for narration text
- `dialogue`: emitted for speaker dialogue
- `waitClick`: emitted for `@waitClick()` and repeated while click wait is active
- `page`: emitted for `@page()`
- `stop`: emitted for `@stop()`
- `state`: emitted for DSL v2 `set` and `add`
- `jump`: emitted for `SceneJumpInstruction`
- `if`: emitted when evaluating an `IfInstruction`
- `choice`: emitted for `BodyChoiceInstruction` and repeated while a choice is pending
- `wait`: emitted for DSL v2 `wait 1000` and repeated while timed wait is pending
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

DSL v2 `wait 500` compiles to the core timed wait command. It advances the
instruction pointer, sets:

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

A `BodyChoiceInstruction` advances the top-level pointer and sets `pendingChoice`.

`choice` events include the question and items:

```ts
{
  type: "choice",
  question: "Choose",
  items: [
    { text: "手帳を見る" }
  ]
}
```

While `pendingChoice` is set, `stepRuntime` repeats the same choice event and does not advance.

Choices are resolved only with `resolveChoice(document, state, itemIndex)`. For DSL v2 body choices, this clears `pendingChoice`, pushes the selected item body onto `branchFrames`, and emits `choiceResolve`.

If no choice is pending or `itemIndex` is outside the pending choice items, `resolveChoice` returns an `error` event and the original state. It does not throw and does not silently ignore the invalid index.

Scene jumps from inside a selected body are handled by the normal `SceneJumpInstruction` path. Cross-file choice targets are not part of the current DSL v2 runtime model.

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

## Variables and State Commands

Runtime state commands are core-owned.

DSL v2 `set scenario.route = "mio"` stores a string, number, boolean, or null value in `variables`.

DSL v2 `set scenario.currentSpeaker = scenario.name` copies an existing
`scenario.*` variable value at runtime. If the source variable is missing, the
runtime emits an `error` event with `code: "state_reference_missing"` and does
not write the target variable. `system.*` variable references remain deferred
and are not compile-supported for `set`.

DSL v2 `add scenario.affection += 1` updates numeric variables. Missing variables are treated as `0`, and adding to an existing non-number value emits a runtime `error`.

Scenario boolean variables cover flag-like authoring needs:

```txt
set scenario.metMio = true
```

`RuntimeState.flags` was removed. The legacy-shaped `inc`, `dec`, `flag`, and `unflag` names are no longer core runtime commands. A manually constructed `CommandInstruction` using one of those names is treated like any other non-core command: it is dispatched only if the host supplies a plugin handler, otherwise it emits `unsupported`.

Each state command emits a `state` event.

## Branch Frames

`branchFrames` represent active instruction lists from conditional branches. Each frame stores:

```ts
{
  instructions: TzrInstruction[],
  instructionIndex: number
}
```

When an `IfInstruction` or selected body choice has a non-empty branch, the runtime pushes a frame and immediately executes the first instruction in that branch. Subsequent calls to `stepRuntime` continue executing the frame until it reaches the end. Then the frame is popped and execution returns to the already-advanced top-level pointer.

For current v0.x snapshots, branch frames are included directly in snapshots.

## If, Jump, and Choice Model

`IfInstruction` and conditional body choice items evaluate DSL v2 condition expressions with the DSL v2 condition evaluator.

- true: push and execute `thenBranch`
- false with `elseBranch`: push and execute `elseBranch`
- false without `elseBranch`: advance to the next top-level instruction

`SceneJumpInstruction` resolves against `RuntimeDocument.scenes`. It moves `pointer.instructionIndex` to the scene's `statementIndex` and does not apply an extra `+1` advance. Jump clears branch frames, pending choice, pending wait, and click wait.

`LabelJumpInstruction` resolves against optional `RuntimeDocument.labels`.
Cross-file authoring targets are validated and aggregated before runtime by
`compileTzrProject`; runtime does not track a current file.

Body choices produce a blocked `pendingChoice` state and are resolved separately by `resolveChoice`.

## Plugin Command Dispatch

DSL v2 compiles its supported std visual/audio statements to shared `CommandInstruction` values. Runtime dispatch uses command handlers supplied to `stepRuntime`.

DSL v2 compile-time plugin command validation is available through `compileTzr(document, { plugins })` or `compileTzr(document, { pluginCommands })`. Runtime dispatch remains separate: compile-time metadata validates command names and argument shapes, while runtime command handlers execute command effects.

When metadata validation is enabled, every emitted non-core command must be present in the compile-time registry. A scenario that uses std visual/audio commands should pass `createStdVisualPlugin()` / `createStdAudioPlugin()` to `compileTzr`; without metadata, existing std visual/audio sugar remains compatible and compiles without metadata validation.

`call namespace.command(...)` is only a custom plugin command authoring form when metadata validation is enabled. It does not introduce runtime subroutine calls, a call stack, or return semantics.

Runtime handlers should use the same command names emitted by the compiler.

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
  version: 2,
  pointer,
  variables,
  plugins,
  branchFrames,
  pendingChoice,
  pendingWait,
  isStopped,
  isWaitingForClick
}
```

`restoreRuntimeState(snapshot)` returns a `RuntimeState`.

`RuntimeSnapshot` stores core runtime state directly and plainly. It includes `variables`, generic plugin state, active `branchFrames`, `pendingChoice`, `pendingWait`, stopped state, and click-wait state. This keeps restore logic simple and matches the current runtime model.

One important constraint is `branchFrames`. Current branch frames include the branch `instructions` themselves:

```ts
{
  instructions,
  instructionIndex
}
```

This is straightforward to restore because the runtime can resume branch execution without re-resolving anything from `RuntimeDocument`. It also fits the current implementation, where active branches are represented as instruction lists.

The tradeoffs are:

- save data can become larger because branch instructions are embedded
- compatibility is weak if the scenario document changes after the snapshot is created

`RuntimeSaveData` does not include scenario identity, scenario version, or migration metadata in current v0.x releases. Save data compatibility is not guaranteed before v1.0, and compatibility is especially weak if the scenario document, compiled instruction order, runtime model, or event shape changes after saving.

Plugin state is saved as generic JSON-compatible runtime state. Plugin-specific save policy remains plugin-owned. For example, std-audio provides `prepareStdAudioStateForSnapshot(runtimeState)` so BGM state is retained while one-shot SE and voice events are cleared before the core snapshot is created.

A future snapshot format may store a scenario identity, scenario version, migration version, branch path, frame id, instruction index, or similar reference instead of embedding instructions. Restore would then re-resolve branch instructions from the current `RuntimeDocument`.

Migration, compatibility handling, compression, and encryption are outside the current runtime API. Snapshots also do not write to storage. LocalStorage, IndexedDB, and save slot management are host/UI layer responsibilities.
