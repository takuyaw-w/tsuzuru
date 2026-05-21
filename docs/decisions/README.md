# Architecture Decision Records

This directory contains architecture and product decisions for Tsuzuru.

Decision records explain why important design choices were made. They are not task checklists.

Use `TODOS.md` for operational work tracking.

## Purpose

Decision records help prevent the same design debates from being reopened without new information.

They should clarify:

- context
- decision
- rationale
- consequences
- boundaries
- reconsideration criteria

## Current Decisions

ADR 0003 records the historical macro/plugin boundary. The public macro API was
removed during DSL v2 cleanup; use it as rationale only unless macro support is
reintroduced.

| ID | Title | Status |
|---|---|---|
| 0001 | [`.tzr` is not JavaScript](0001-dsl-is-not-js.md) | Accepted |
| 0002 | [Core and Preact Boundary](0002-core-preact-boundary.md) | Accepted |
| 0003 | [Macro vs Plugin](0003-macro-vs-plugin.md) | Accepted |
| 0004 | [Standard Visual Plugin](0004-std-visual-plugin.md) | Accepted |
| 0005 | [Standard Audio Plugin](0005-std-audio-plugin.md) | Accepted |
| 0006 | [Standard UI Preact Package](0006-standard-ui-preact.md) | Accepted |
| 0007 | [Standard UI Viewport](0007-standard-ui-viewport.md) | Accepted |
| 0008 | [Screen Host](0008-screen-host.md) | Accepted |
| 0009 | [Tsuzuru Project Config](0009-tsuzuru-config.md) | Accepted |
| 0010 | [create-tsuzuru Package](0010-create-tsuzuru.md) | Accepted |
| 0011 | [Include-Based Multi-File Scenario](0011-include-based-multi-file-scenario.md) | Accepted |
| 0012 | [Text Preferences MVP](0012-text-preferences-mvp.md) | Accepted |
| 0013 | [Backlog / Message History MVP](0013-backlog-message-history-mvp.md) | Accepted |
| 0014 | [Save / Load MVP](0014-save-load-mvp.md) | Accepted |
| 0015 | [Auto Mode MVP](0015-auto-mode-mvp.md) | Accepted |
| 0016 | [Read Tracking MVP](0016-read-tracking-mvp.md) | Accepted |
| 0017 | [Skip Mode MVP](0017-skip-mode-mvp.md) | Accepted |
| 0018 | [Retained Message Save / Load](0018-retained-message-save-load.md) | Accepted |
| 0019 | [Audio Playback MVP](0019-audio-playback-mvp.md) | Accepted |
| 0020 | [Read Tracking Persistence](0020-read-tracking-persistence.md) | Accepted |
| 0022 | [Standard Text Sound Plugin](0022-std-text-sound-plugin.md) | Accepted |
| 0023 | [Standard Effect Plugin](0023-std-effect-plugin.md) | Accepted |
| 0024 | [Standard Camera Plugin](0024-std-camera-plugin.md) | Accepted |
| 0025 | [Standard System Plugin](0025-std-system-plugin.md) | Accepted |
| 0026 | [Standard Particle Plugin](0026-std-particle-plugin.md) | Accepted |
| 0027 | [Formal Package TypeScript Build Graph](0027-formal-package-typescript-build-graph.md) | Proposed |
| 0028 | [RuntimeSnapshot Compatibility](0028-runtime-snapshot-compatibility.md) | Accepted |
| 0029 | [Host-Facing Save / Load Helper](0029-host-facing-save-load-helper.md) | Accepted |
| 0030 | [Runtime Save Slot Envelope](0030-runtime-save-slot-envelope.md) | Accepted |
| 0031 | [v1.0 Save / Load Compatibility Promise](0031-v1-save-load-compatibility-promise.md) | Accepted |
| 0032 | [Preact-Based Official UI Stack](0032-preact-based-official-ui-stack.md) | Accepted |

## Reading Order

When changing DSL behavior, read:

1. `0001-dsl-is-not-js.md`
2. `0003-macro-vs-plugin.md`
3. `../dsl.md`
4. `../architecture.md`

When changing package boundaries, read:

1. `0002-core-preact-boundary.md`
2. `../architecture.md`
3. `../runtime.md`

When changing plugin behavior or revisiting historical macro decisions, read:

1. `0003-macro-vs-plugin.md`
2. `../plugin-api.md`
3. `../dsl.md`
4. `../plans/legacy-dsl-cleanup.md`

## File Naming

Use this format:

```txt
NNNN-short-title.md
```

Examples:

```txt
0001-dsl-is-not-js.md
0002-core-preact-boundary.md
0003-macro-vs-plugin.md
```

Use a monotonically increasing number.

Do not renumber existing decision records.

## Status Values

Use one of:

```txt
Proposed
Accepted
Superseded
Deprecated
Rejected
```

Meaning:

- `Proposed`: being considered
- `Accepted`: current project decision
- `Superseded`: replaced by a newer decision
- `Deprecated`: no longer recommended, but not directly replaced
- `Rejected`: explicitly not adopted

## Template

Use this structure for new decision records:

```md
# NNNN: Title

## Status

Proposed

## Context

What problem or design pressure led to this decision?

## Decision

What is the decision?

## Rationale

Why is this the chosen direction?

## Consequences

### Positive

- ...

### Negative

- ...

## Reconsideration Criteria

When should this decision be revisited?

## Related Documents

- `AGENTS.md`
- `docs/architecture.md`
```

## Rules

- Keep decisions focused.
- Do not use decision records as TODO lists.
- Do not document unimplemented features as implemented behavior.
- Prefer explicit boundaries over vague guidance.
- Link related docs when relevant.
- If a decision changes, add a new record or mark the old one as superseded.
- Do not silently rewrite accepted decisions to mean something different.

## Relationship to Other Docs

Use these files for different purposes:

```txt
AGENTS.md
  -> repository-wide agent instructions and product principles

TODOS.md
  -> operational task list

docs/architecture.md
  -> package and runtime architecture map

docs/roadmap.md
  -> milestone scope and future candidates

docs/decisions/*.md
  -> accepted design decisions and rationale
```
