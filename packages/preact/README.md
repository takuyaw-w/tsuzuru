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

The hook returns `state`, `event`, `step`, `continueClick`, `choose`, `reset`, `blockReason`, and `isBlocked`. When `autoClearWait` is enabled, `wait` events are cleared with `setTimeout` and the runtime advances after the wait duration.

## Scripts

```sh
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```
