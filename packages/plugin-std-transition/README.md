# @tsuzuru/plugin-std-transition

Standard one-shot screen transition plugin for Tsuzuru.

```ts
import {
  createStdTransitionCommandHandlers,
  createStdTransitionPlugin,
  getStdTransitionState,
  prepareStdTransitionStateForSnapshot,
} from "@tsuzuru/plugin-std-transition";
import { ScreenTransitionLayer } from "@tsuzuru/plugin-std-transition/preact";
```

The runtime plugin stores renderer-neutral transition events under
`runtimeState.plugins.stdTransition`. The Preact layer consumes unplayed events
by sequence and renders a screen-wide overlay for `fade`, `wipe`, `flash`,
`pageTurn`, `blurFade`, and `slide`.

Screen transitions do not block runtime stepping. Use the DSL `wait` statement
when a scenario needs deterministic timing after a standalone `transition`
command or `bg ... with <transitionEffect>(...)`.
