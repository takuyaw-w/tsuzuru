# @tsuzuru/plugin-std-camera

Standard camera plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene start:
  camera x=80 y=-20 zoom=1.15 duration=500
  camera focus mio_smile zoom=1.2 duration=400
  reset camera duration=300
```

## Usage

```ts
import {
  createStdCameraCommandHandlers,
  createStdCameraPlugin,
} from "@tsuzuru/plugin-std-camera";
```

The plugin owns durable camera state. It does not render transforms or resolve
focus target coordinates.
