import type { StdParticleCurrent } from "@tsuzuru/plugin-std-particle";
import type { ComponentChildren, ComponentProps } from "preact";
import { joinClassNames } from "./class-name.js";
import {
  getStdParticleSpecs,
  type StdParticleStyleProperties,
  stdParticleLayerClassName,
  stdParticleStyleProperties,
} from "./std-particle-presentation.js";

type SpanStyle = Extract<NonNullable<ComponentProps<"span">["style"]>, object>;

export interface StdParticleLayerProps {
  readonly current?: StdParticleCurrent | null | undefined;
  readonly className?: string | undefined;
}

export function StdParticleLayer({ current, className }: StdParticleLayerProps): ComponentChildren {
  if (current === null || current === undefined) {
    return null;
  }

  const particles = getStdParticleSpecs(current.type, current.intensity);

  return (
    <div className={joinClassNames(stdParticleLayerClassName(current), className)} aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="tzr-std-particle-layer__particle"
          style={stdParticleStyleProperties(particle) as StdParticleStyleProperties & SpanStyle}
        />
      ))}
    </div>
  );
}
