# @tsuzuru/plugin-std-particle

Standard particle plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene start:
  particle rain intensity=normal
  particle snow intensity=light
  stopParticle
```

## Usage

```ts
import {
  createStdParticleCommandHandlers,
  createStdParticlePlugin,
} from "@tsuzuru/plugin-std-particle";
```

The plugin owns durable particle overlay state. It does not render particles or
resolve visual assets.
