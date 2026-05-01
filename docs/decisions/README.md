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

| ID | Title | Status |
|---|---|---|
| 0001 | `.tzr` is not JavaScript | Accepted |
| 0002 | Core and Preact Boundary | Accepted |
| 0003 | Macro vs Plugin | Accepted |

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

When changing plugin or macro behavior, read:

1. `0003-macro-vs-plugin.md`
2. `../plugin-api.md`
3. `../macro-api.md`
4. `../dsl.md`

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
