# @tsuzuru/plugin-std-hotspot

Standard hotspot plugin state and command handlers for Tsuzuru.

## DSL v2 commands

```tzr
scene room_search:
  hotspot desk rect(x=160, y=260, width=220, height=120) jump inspect_desk
  wait hotspot

scene inspect_desk:
  clear hotspots
  end
```

## Usage

```ts
import {
  createStdHotspotCommandHandlers,
  createStdHotspotPlugin,
} from "@tsuzuru/plugin-std-hotspot";
```

The plugin owns durable hotspot state. It does not render clickable regions;
UI adapters render `runtimeState.plugins.stdHotspot.hotspots`.
