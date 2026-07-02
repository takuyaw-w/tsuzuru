# System Condition Resolver Design

> Status: implemented for runtime std-system plugin state reads.
> Current scenarios can compile `system.*` condition reads when std-system
> condition namespace metadata is registered, and can evaluate them at runtime
> when `createStdSystemConditionResolver()` is provided.

## Purpose

This document records the first supported shape for `system.*` condition reads.
The implemented scope is intentionally narrow:

- read the current `@tsuzuru/plugin-std-system` runtime plugin state
- allow `.tzr` branches to check endings, CGs, and achievements unlocked during
  the current runtime state
- keep core independent from std-system, browser persistence, gallery UI, and
  host storage policy

The current implementation does not read localStorage, IndexedDB, remote
profiles, or application-level gallery state. Those remain out of scope and can
be composed by hosts through a later resolver or host policy if needed.

## Implementation State

Parser, compiler, and runtime support exist for condition references such as:

```txt
if system.endings.trueEnd.unlocked:
  narration:
    True end is already unlocked.
```

Compile support requires a plugin definition that declares the `system`
condition namespace, such as `createStdSystemPlugin()`. Without that metadata,
the compiler reports:

```txt
Condition namespace "system" is not compile-supported. Register a plugin that declares conditionNamespaces: ["system"].
```

Runtime support requires exactly one resolver for the namespace, such as
`createStdSystemConditionResolver()`. Missing or duplicate resolvers produce
runtime error events instead of implicit property access.

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

The supported syntax is property-style reads rooted at `system`.

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
String-key or indexed access is not implemented. If authors need ids that
cannot be expressed as path segments, they should use normalized ids in
std-system or wait for a later explicit indexed-reference design.

## Core API Design

Core provides a small condition resolver contract. The resolver returns
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

`RuntimeStepOptions` accepts resolvers:

```ts
export interface RuntimeStepOptions {
  readonly commandHandlers?: Readonly<Record<string, RuntimePluginCommandHandler>>;
  readonly conditionResolvers?: readonly RuntimeConditionResolver[];
  readonly onDiagnostic?: RuntimeDiagnosticReporter;
}
```

`evaluateTzrCondition` receives condition resolvers from
`stepIfInstruction` and `stepBodyChoiceInstruction`. Scenario variables remain
the built-in path:

- `scenario.*` reads `RuntimeState.variables`
- `system.*` and any future namespace read registered resolvers

Core does not special-case std-system state shape.

## Compile-Time Design

Compiler validation catches unsupported namespaces before runtime.
`TzrCompileOptions.plugins` accepts optional condition namespace declarations.

```ts
export interface TzrCompilePluginDefinition {
  readonly name: string;
  readonly commands?: PluginCommandMap;
  readonly conditionNamespaces?: readonly string[];
}
```

For std-system, `createStdSystemPlugin()` includes:

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

When a `ConditionReference` root is not `scenario`, core:

1. Finds exactly one resolver whose `namespace` matches the reference root.
2. Passes the path segments after the root to `resolve`.
3. Converts the returned value through existing condition truthiness and
   comparison rules.

For `system.endings.trueEnd.unlocked`, the resolver receives:

```ts
["endings", "trueEnd", "unlocked"]
```

Missing resolver:

- runtime returns an error event
- error code is `condition_resolver_missing`
- message includes the namespace and full reference path

Duplicate resolver namespace:

- runtime returns an error event
- error code is `condition_resolver_duplicate`
- message includes the namespace

Resolver failure:

- runtime returns the resolver error as a runtime error event
- std-system resolver uses stable, namespace-specific error codes

Unknown std-system path:

- for known collection and missing id, return `false`
- for unknown collection or property, return a resolver error

This means `system.endings.missing.unlocked` is false, but
`system.endings.trueEnd.title` is an error because `title` is not a supported
std-system condition field.

## Std-System Resolver Design

`@tsuzuru/plugin-std-system` exports:

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

The resolver uses the non-throwing helper so missing or malformed plugin state
produces a condition error rather than throwing through the host.

Exported helpers:

```ts
export function tryGetStdSystemState(
  runtimeState: RuntimeState,
): StdSystemState | undefined;

export function createStdSystemConditionResolver(): RuntimeConditionResolver;
```

`getStdSystemState` still throws for direct application use; resolver code uses
the non-throwing path to produce runtime errors.

## Save / Load Interaction

The current resolver reads only `RuntimeState.plugins.stdSystem`.
Therefore:

- runtime snapshots already contain the source state
- restore does not need a new snapshot shape
- no plugin migration is promised
- no browser persistence is consulted

If a host wants to merge persisted gallery state, it can later provide its own
`system` resolver or host policy, but duplicate namespace registration is
rejected so the host must choose one source explicitly.

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

Runtime error codes:

```ts
type RuntimeErrorCode =
  | "condition_resolver_missing"
  | "condition_resolver_duplicate"
  | "condition_resolver_failed"
  | "condition_system_state_missing"
  | "condition_system_path_unsupported";
```

`condition_system_reference_unsupported` remains in the public error-code union
for compatibility, but the supported setup path reports missing or duplicate
resolver errors when resolver registration is wrong.

Compile diagnostics are user-facing and source-location aware:

- `Condition namespace "system" is not compile-supported. Register a plugin that declares conditionNamespaces: ["system"].`
- `Condition namespace "foo" is not compile-supported.`

## Test Coverage

Core tests cover:

- compiler rejects `if system.*` without a condition namespace
- compiler accepts `if system.*` with `conditionNamespaces: ["system"]`
- compiler accepts conditional choice items using `system.*`
- runtime returns missing-resolver error when `system.*` reaches runtime without resolver
- runtime returns duplicate-resolver error for duplicate namespaces
- runtime evaluates resolver-returned booleans, equality comparisons, and logical expressions
- runtime propagates resolver errors

Std-system tests cover:

- resolver returns true after `system.unlockEnding`
- resolver returns false for missing ending / CG / achievement ids
- resolver supports conditional choice filtering
- resolver reports unsupported collection and unsupported field
- resolver reports missing or malformed `stdSystem` plugin state without throwing
- snapshot / restore preserves unlock state visible to resolver

Example guidance:

- no example update is required unless an example starts using `system.*`
- avoid making browser persistence part of the example

## Documentation Updates

The implementation promotion updated:

- `docs/dsl.md`
- `docs/design/dsl-support-matrix.md`
- `docs/plugins/std-system.md`
- `docs/runtime.md`
- `README.md` and `README.ja.md` limitations
- relevant example README if an example uses `system.*`

Do not update v1.0 release notes as if this existed in v1.0. Historical release
records may mention it as deferred.

## Remaining Out of Scope

- Browser persistence and IndexedDB reads.
- Gallery, achievement, or profile UI.
- Host storage merge policy.
- Indexed key syntax or string-key condition paths.
- Save data migration guarantees.

The implementation keeps parser syntax unchanged and avoids moving std-system
state knowledge into core.
