import type { RuntimeState } from "@tsuzuru/core";
import { getStdParticleState } from "@tsuzuru/plugin-std-particle";

interface ParticleLayerProps {
  readonly runtimeState: RuntimeState;
}

export function ParticleLayer({ runtimeState }: ParticleLayerProps) {
  const particleState = getStdParticleState(runtimeState);
  const current = particleState.current;

  if (current === null) {
    return null;
  }

  return (
    <div
      className={`particle-layer particle-layer--${current.type} particle-layer--${current.intensity}`}
      aria-hidden="true"
    />
  );
}
