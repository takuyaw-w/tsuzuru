# 0018: Retained Message Save / Load

## Status

Accepted

## Context

The Save / Load MVP in `examples/preact-basic` restored runtime progress through
`RuntimeSaveData`. When a player saved while a choice was visible, loading the
slot restored the choice itself, but the previous message window retained behind
the choice disappeared.

The retained message is not core runtime state. It is example UI presentation
state held by `lastMessageEvent` so the choice screen can keep the prior
narration or dialogue visible.

## Decision

Keep `@tsuzuru/preact`'s `RuntimeSaveData` unchanged.

`examples/preact-basic` wraps runtime save data in an example-owned
`ExampleSaveData` payload:

- `runtime`: the existing `RuntimeSaveData`
- `retainedMessageEvent`: the retained narration or dialogue event, or `null`

The example storage loader accepts both the new wrapper and legacy slots whose
`data` field is directly a `RuntimeSaveData` payload. Legacy payloads are
normalized with `retainedMessageEvent: null`.

## Rationale

This fixes the visible Save / Load issue without expanding core or Preact
runtime responsibilities. The choice state already belongs to runtime save data;
the retained message belongs to the host UI that renders the choice chrome.

Keeping the retained message in the example wrapper also keeps the storage shape
explicit. Hosts can choose which presentation state belongs in their own save
format without making every host accept the same policy.

## Responsibility boundaries

`@tsuzuru/core` owns runtime state, stepping, choices, and snapshot / restore
primitives.

`@tsuzuru/preact` owns `RuntimeSaveData`, `createSaveData`, `restoreSaveData`,
and adapter-level runtime restore wiring.

`examples/preact-basic` owns save slots, localStorage persistence, title
Continue policy, and presentation state that is not part of runtime state.

The retained message is persisted only as example-side presentation state.

## Current limitations

The example save wrapper does not persist backlog, message history, read
tracking, text preferences, Auto Mode state, or Skip Mode state.

Legacy `RuntimeSaveData` slots remain loadable, but they cannot restore retained
messages because they never stored that presentation state.

Validation is intentionally lightweight. Invalid or unsupported slot payloads
are ignored instead of crashing the app.

## Future work

Presentation state persistence may need a broader design if the example starts
persisting backlog, read tracking, thumbnails, UI mode, or scenario identity.

That future design should still keep host storage policy separate from core
runtime semantics unless a concrete cross-host API requirement emerges.

## Related Documents

- `AGENTS.md`
- `docs/history/decisions/0014-save-load-mvp.md`
- `examples/preact-basic/README.md`
