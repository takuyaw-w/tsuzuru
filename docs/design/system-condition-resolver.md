# System Condition Resolver Design

> Status: design proposal for post-v1 implementation.
> This document does not change current runtime behavior. Current stable
> scenarios still cannot compile `if system.*` or conditional choices using
> `system.*`.

## Purpose

This design defines the first supported shape for `system.*` condition reads.
The target is intentionally narrow:

- read the current `@tsuzuru/plugin-std-system` runtime plugin state
- allow `.tzr` branches to check endings, CGs, and achievements unlocked during
  the current runtime state
- keep core independent from std-system, browser persistence, gallery UI, and
  host storage policy

The first implementation should not read localStorage, IndexedDB, remote
profiles, or application-level gallery state. Those can be composed by hosts in
a later resolver if they need that behavior.

## Current State

Parser support already exists for condition references such as:

```txt
if system.endings.trueEnd.unlocked:
  narration:
    True end is already unlocked.
```

Current compiler and runtime behavior is deliberately rejecting:

- `TzrCompiler.validateSupportedCondition` reports
  `system condition references are not compile-supported yet.`
- `evaluateTzrCondition` reports
  `condition_system_reference_unsupported` if a `system.*` condition reaches
  runtime

The std-system plugin already owns durable runtime state:

```ts
interface StdSystemState {
  readonly endings: Readonly<Record<string, { readonly unlocked: boolean }>>;
  readonly cgs: Readonly<Record<string, { readonly unlocked: boolean }>>;
  readonly achievements: Readonly<Record<string, { readonly unlocked: boolean }>>;
}
```

It also exposes helpers such as `isEndingUnlocked`, `isCgUnlocked`, and
`isAchievementUnlocked`.

## Goals

- Support `system.*` reads in `if` statements and conditional choice items.
- Keep mutation through existing `call system.unlock...` plugin commands.
- Keep direct `set system.*` and `add system.*` invalid.
- Let core evaluate non-`scenario.*` condition references through a generic
  resolver interface.
- Let std-system provide a resolver without core importing
  `@tsuzuru/plugin-std-system`.
- Make missing compile-time namespace support and missing runtime resolver
  deterministic errors.
- Preserve snapshot / restore behavior by reading from `runtimeState.plugins`.

## Non-Goals

- No browser persistence reads.
- No gallery or achievement UI.
- No save data migration framework.
- No arbitrary plugin state path access by default.
- No JavaScript / TypeScript expressions in `.tzr`.
- No direct system state mutation syntax.
- No dedicated DSL sugar such as `unlock ending trueEnd`.

## Supported Syntax

The first supported syntax is property-style reads rooted at `system`.

```txt
if system.endings.trueEnd.unlocked:
  narration:
    True ending is already unlocked.

choice "Bonus":
  "Open gallery" id=gallery if system.cgs.mainVisual.unlocked:
    jump gallery
```

Supported path forms:

```txt
system.endings.<id>.unlocked
system.cgs.<id>.unlocked
system.achievements.<id>.unlocked
```

The `<id>` segment follows the existing condition-reference identifier rules.
String-key access is not part of the first design. If authors need ids that
cannot be expressed as path segments, they should use normalized ids in
std-system or wait for a later explicit indexed-reference design.

## Core API Design

Core should introduce a small condition resolver contract. The resolver returns
runtime values, not plugin-specific objects.

```ts
export type RuntimeConditionNamespace = "system" | (string & {});

export type RuntimeConditionResolveResult =
  | { readonly ok: true; readonly value: RuntimeValue | null | undefined }
  | { readonly ok: false; readonly error: RuntimeConditionResolveError };

export interface RuntimeConditionResolveError {
  readonly code: RuntimeErrorCode;
  readonly message: string;
}

export interface RuntimeConditionResolver {
  readonly namespace: RuntimeConditionNamespace;
  readonly resolve: (
    path: readonly string[],
    state: RuntimeState,
  ) => RuntimeConditionResolveResult;
}
```

`RuntimeStepOptions` should accept resolvers:

```ts
export interface RuntimeStepOptions {
  readonly commandHandlers?: Readonly<Record<string, RuntimePluginCommandHandler>>;
  readonly conditionResolvers?: readonly RuntimeConditionResolver[];
  readonly onDiagnostic?: RuntimeDiagnosticReporter;
}
```

`evaluateTzrCondition` should receive condition resolvers from
`stepIfInstruction` and `stepBodyChoiceInstruction`. Scenario variables remain
the built-in path:

- `scenario.*` reads `RuntimeState.variables`
- `system.*` and any future namespace read registered resolvers

Core should not special-case std-system state shape.

## Compile-Time Design

Compiler validation should keep catching unsupported namespaces before runtime.
The current `TzrCompileOptions.plugins` shape can grow an optional condition
namespace declaration.

```ts
export interface TzrCompilePluginDefinition {
  readonly name: string;
  readonly commands?: PluginCommandMap;
  readonly conditionNamespaces?: readonly string[];
}
```

For std-system, `createStdSystemPlugin()` should include:

```ts
conditionNamespaces: ["system"]
```

Compiler behavior:

- `scenario.*` remains always allowed.
- `system.*` is allowed only when compile options include a plugin or explicit
  compile support declaring `conditionNamespaces: ["system"]`.
- Unknown roots produce a compile diagnostic.
- `set system.*` and `add system.*` remain parser errors.
- `$system.*` variable references in `set` remain unsupported unless a separate
  design explicitly adds copy semantics.

This keeps compile success aligned with the runtime surface the host opted into.

## Runtime Behavior

When a `ConditionReference` root is not `scenario`, core should:

1. Find exactly one resolver whose `namespace` matches the reference root.
2. Pass the path segments after the root to `resolve`.
3. Convert the returned value through existing condition truthiness and
   comparison rules.

For `system.endings.trueEnd.unlocked`, the resolver receives:

```ts
["endings", "trueEnd", "unlocked"]
```

Missing resolver:

- runtime returns an error event
- error code should be `condition_resolver_missing`
- message should include the namespace and full reference path

Duplicate resolver namespace:

- runtime returns an error event
- error code should be `condition_resolver_duplicate`
- message should include the namespace

Resolver failure:

- runtime returns the resolver error as a runtime error event
- std-system resolver should use stable, namespace-specific error codes

Unknown std-system path:

- for known collection and missing id, return `false`
- for unknown collection or property, return a resolver error

This means `system.endings.missing.unlocked` is false, but
`system.endings.trueEnd.title` is an error because `title` is not a supported
std-system condition field.

## Std-System Resolver Design

`@tsuzuru/plugin-std-system` should export:

```ts
export function createStdSystemConditionResolver(): RuntimeConditionResolver;
```

Resolver behavior:

| Path | Result |
| --- | --- |
| `endings.<id>.unlocked` | `isEndingUnlocked(state, id)` |
| `cgs.<id>.unlocked` | `isCgUnlocked(state, id)` |
| `achievements.<id>.unlocked` | `isAchievementUnlocked(state, id)` |
| unknown collection | resolver error |
| unknown field | resolver error |
| invalid stdSystem state shape | resolver error |

The resolver should call `getStdSystemState(runtimeState)` or an equivalent
non-throwing helper. If the plugin state is not initialized, runtime should
produce a condition error rather than throwing through the host.

Recommended exported helpers:

```ts
export function tryGetStdSystemState(
  runtimeState: RuntimeState,
): StdSystemState | undefined;

export function createStdSystemConditionResolver(): RuntimeConditionResolver;
```

`getStdSystemState` can keep throwing for direct application use; resolver code
should use the non-throwing path to produce runtime errors.

## Save / Load Interaction

The first resolver reads only `RuntimeState.plugins.stdSystem`.
Therefore:

- runtime snapshots already contain the source state
- restore does not need a new snapshot shape
- no plugin migration is promised
- no browser persistence is consulted

If a host wants to merge persisted gallery state, it can later provide its own
`system` resolver, but duplicate namespace registration should be rejected so
the host must choose one source explicitly.

## Example Flow

```txt
scene start:
  if system.endings.trueEnd.unlocked:
    narration:
      True end clear bonus is available.
  else:
    narration:
      True end is still locked.

  call system.unlockEnding(id=trueEnd)

  if system.endings.trueEnd.unlocked:
    narration:
      True end is now unlocked.
```

Compile setup:

```ts
compileTzr(document, {
  plugins: [createStdSystemPlugin()],
});
```

Runtime setup:

```ts
stepRuntime(document, state, {
  commandHandlers: createStdSystemCommandHandlers(),
  conditionResolvers: [createStdSystemConditionResolver()],
});
```

The explicit split is intentional: compile-time metadata validates the DSL
surface, while runtime options provide executable behavior.

## Diagnostics

Suggested runtime error codes:

```ts
type RuntimeErrorCode =
  | "condition_resolver_missing"
  | "condition_resolver_duplicate"
  | "condition_resolver_failed"
  | "condition_system_state_missing"
  | "condition_system_path_unsupported";
```

Existing `condition_system_reference_unsupported` can remain for compatibility
or be retired once no code path reports it. During migration, tests should
verify that `system.*` without a resolver has a clearer missing-resolver error.

Compile diagnostics should remain user-facing and source-location aware:

- `Condition namespace "system" is not compile-supported. Register a plugin that declares conditionNamespaces: ["system"].`
- `Condition namespace "foo" is not compile-supported.`

## Test Plan

Core tests:

- compiler rejects `if system.*` without a condition namespace
- compiler accepts `if system.*` with `conditionNamespaces: ["system"]`
- compiler accepts conditional choice items using `system.*`
- runtime returns missing-resolver error when `system.*` reaches runtime without resolver
- runtime returns duplicate-resolver error for duplicate namespaces
- runtime evaluates resolver-returned booleans, equality comparisons, and logical expressions
- runtime propagates resolver errors

Std-system tests:

- resolver returns true after `system.unlockEnding`
- resolver returns false for missing ending / CG / achievement ids
- resolver supports conditional choice filtering
- resolver reports unsupported collection and unsupported field
- resolver reports missing or malformed `stdSystem` plugin state without throwing
- snapshot / restore preserves unlock state visible to resolver

Example tests:

- add a small `examples/preact-basic` or focused core integration scenario only
  after the core and plugin contracts are stable
- avoid making browser persistence part of the example

## Documentation Updates

When implemented, update:

- `docs/dsl.md`
- `docs/design/dsl-support-matrix.md`
- `docs/plugins/std-system.md`
- `docs/runtime.md`
- `README.md` and `README.ja.md` limitations
- relevant example README if an example uses `system.*`

Do not update v1.0 release notes as if this existed in v1.0. Historical release
records may mention it as deferred.

## Implementation Sequence

1. Add core resolver types and `RuntimeStepOptions.conditionResolvers`.
2. Pass resolvers from runtime control into `evaluateTzrCondition`.
3. Add compiler condition namespace validation.
4. Extend `RuntimePluginDefinition` / `TzrCompilePluginDefinition` with
   `conditionNamespaces`.
5. Add std-system non-throwing state helper and condition resolver.
6. Add focused core and std-system tests.
7. Update current docs and examples only after tests prove the supported shape.

This sequence keeps parser syntax unchanged and avoids moving std-system state
knowledge into core.
