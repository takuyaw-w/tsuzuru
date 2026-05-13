import type { RuntimeState } from "@tsuzuru/core";
import { getStdParticleState } from "@tsuzuru/plugin-std-particle";
import {
  getParticleSpecs,
  type ParticleStyleProperties,
  particleLayerClassName,
  particleStyleProperties,
} from "./particle-presentation.js";

interface ParticleLayerProps {
  readonly runtimeState: RuntimeState;
}

export function ParticleLayer({ runtimeState }: ParticleLayerProps) {
  const particleState = getStdParticleState(runtimeState);
  const current = particleState.current;

  if (current === null) {
    return null;
  }

  const particles = getParticleSpecs(current.type, current.intensity);

  return (
    <div className={particleLayerClassName(current)} aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="particle-layer__particle"
          style={particleStyleProperties(particle) as ParticleStyleProperties}
        />
      ))}
    </div>
  );
}
