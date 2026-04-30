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

## Scripts

```sh
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```
