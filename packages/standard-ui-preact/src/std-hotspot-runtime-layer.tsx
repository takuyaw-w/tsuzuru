import { getStdHotspotState, resolveStdHotspotAction } from "@tsuzuru/plugin-std-hotspot";
import type { UseRuntimeResult } from "@tsuzuru/preact";
import type { ComponentChildren } from "preact";
import { StdHotspotLayer } from "./std-hotspot-layer.js";

export interface StdHotspotRuntimeLayerProps {
  readonly runtime: Pick<UseRuntimeResult, "state" | "jump">;
  readonly className?: string | undefined;
}

export function StdHotspotRuntimeLayer({ runtime, className }: StdHotspotRuntimeLayerProps): ComponentChildren {
  const hotspotState = getStdHotspotState(runtime.state);
  const handleHotspot = (id: string) => {
    const resolved = resolveStdHotspotAction(runtime.state, id);
    if (resolved.action?.type !== "jump") {
      return;
    }
    runtime.jump(resolved.action.target, {
      prepareState: () => resolved.state,
    });
  };

  return (
    <StdHotspotLayer
      hotspots={hotspotState.hotspots}
      waiting={hotspotState.waiting}
      onHotspot={handleHotspot}
      className={className}
    />
  );
}
