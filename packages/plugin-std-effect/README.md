# @tsuzuru/plugin-std-effect

Standard one-shot effect plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene start:
  shake screen intensity=strong duration=400
  flash color="#ffffff" duration=120
  pulse message intensity=light duration=180
  blur screen amount=6 duration=300
```

## Usage

```ts
import {
  createStdEffectCommandHandlers,
  createStdEffectPlugin,
  prepareStdEffectStateForSnapshot,
} from "@tsuzuru/plugin-std-effect";
```

The plugin owns transient effect events. It does not render animations or own
persistent visual state.
