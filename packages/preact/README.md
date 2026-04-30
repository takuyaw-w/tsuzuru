# @tsuzuru/preact

Minimal Preact components for displaying `@tsuzuru/core` runtime events.

This package is intentionally small. It does not manage runtime state, load assets, provide save/load UI, or integrate with Vite. Hosts are expected to call `stepRuntime` from `@tsuzuru/core` and pass the latest `RuntimeEvent` into `RuntimeView`.

## RuntimeView

```tsx
import { RuntimeView } from "@tsuzuru/preact";
import type { RuntimeEvent } from "@tsuzuru/core";

interface AppProps {
  event: RuntimeEvent;
  onChoice: (itemIndex: number) => void;
  onContinue: () => void;
}

export function App({ event, onChoice, onContinue }: AppProps) {
  return <RuntimeView event={event} onChoice={onChoice} onContinue={onContinue} />;
}
```

`RuntimeView` renders minimal output for narration, dialogue, choice, wait, scene, label, plugin command, unsupported, and end events. Choice buttons call `onChoice(itemIndex)`. `waitClick` and `page` events call `onContinue()` from their continue button.

## useRuntime

`useRuntime` wraps the core runtime step/control functions for Preact hosts.

```tsx
import { RuntimeView, useRuntime } from "@tsuzuru/preact";
import type { CompiledTzrDocument } from "@tsuzuru/core";

interface AppProps {
  document: CompiledTzrDocument;
}

export function App({ document }: AppProps) {
  const runtime = useRuntime(document, {
    autoClearWait: true,
    autoStepTransientEvents: true,
    autoStepMaxSteps: 1000,
  });

  return (
    <>
      {runtime.event === null ? null : (
        <RuntimeView
          event={runtime.event}
          onChoice={runtime.choose}
          onContinue={runtime.continueClick}
        />
      )}
      <button type="button" onClick={runtime.step} disabled={runtime.isBlocked}>
        Step
      </button>
    </>
  );
}
```

The hook returns `state`, `event`, `step`, `continueClick`, `choose`, `reset`, `createSnapshot`, `restoreSnapshot`, `createSaveData`, `restoreSaveData`, `blockReason`, `isBlocked`, and `autoStepError`. When `autoClearWait` is enabled, `wait` events are cleared with `setTimeout` and the runtime advances after the wait duration.

`autoStepTransientEvents` defaults to `false`. When enabled, auto-steppable, non-blocking runtime events advance automatically one browser tick at a time. `scene`, `label`, `state`, `jump`, and `pluginCommand` are currently auto-steppable. Blocking or inspectable events such as narration, dialogue, choice, waitClick, page, wait, stop, end, and unsupported are not skipped.

`if` events are auto-steppable only when their nested event is also auto-steppable. For example, an `if` event that immediately produces a nested `state` or `jump` event advances automatically, but an `if` event that produces nested narration, dialogue, choice, wait, stop, end, or unsupported output stops so the host can render or inspect it.

`autoStepMaxSteps` defaults to `1000`. It limits consecutive automatic steps so a label/jump loop cannot keep scheduling timers forever. When the limit is reached, auto-step stops and `autoStepError` contains a message.

`RuntimeSnapshot` is state-only data created from `RuntimeState`. It does not include `RuntimeEvent`, which remains a transient rendering signal. `createSnapshot()` and `restoreSnapshot(snapshot)` are low-level APIs for state persistence. When restoring a state-only snapshot, `restoreSnapshot` can recover blocking events such as choice, wait, or waitClick from the restored state, but it cannot recover a non-blocking narration or dialogue event that was visible when the snapshot was created.

For save/load that should restore the current screen, use `createSaveData()` and `restoreSaveData(saveData)`. `RuntimeSaveData` contains `{ version, snapshot, event }`, so it keeps the state-only `RuntimeSnapshot` separate from the current renderable event. Host applications own where save data is stored, such as `localStorage`, IndexedDB, or a remote save service.

## Scripts

```sh
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
pnpm --filter @tsuzuru/preact test
```
