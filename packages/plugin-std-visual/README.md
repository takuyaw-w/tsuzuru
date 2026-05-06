# @tsuzuru/plugin-std-visual

Standard visual plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene start:
  bg station
  show mio_smile at center
  hide mio_smile
  clear bg
```

## Usage

```ts
import {
  createStdVisualCommandHandlers,
  createStdVisualPlugin,
} from "@tsuzuru/plugin-std-visual";
```

The plugin owns background and sprite state. It does not resolve asset paths or
load images.
