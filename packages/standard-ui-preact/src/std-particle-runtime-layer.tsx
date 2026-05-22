import type { RuntimeState } from "@tsuzuru/core";
import { getStdParticleState } from "@tsuzuru/plugin-std-particle";
import type { ComponentChildren } from "preact";
import { StdParticleLayer } from "./std-particle-layer.js";

export interface StdParticleRuntimeLayerProps {
  readonly runtimeState: RuntimeState;
  readonly className?: string | undefined;
}

export function StdParticleRuntimeLayer({ runtimeState, className }: StdParticleRuntimeLayerProps): ComponentChildren {
  const particleState = getStdParticleState(runtimeState);
  if (particleState.current === null) {
    return null;
  }

  return <StdParticleLayer current={particleState.current} className={className} />;
}
