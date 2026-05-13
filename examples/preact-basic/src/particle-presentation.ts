import type { StdParticleCurrent, StdParticleIntensity, StdParticleType } from "@tsuzuru/plugin-std-particle";

export interface ParticleSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly delay: number;
  readonly duration: number;
  readonly size: number;
  readonly opacity: number;
  readonly drift: number;
  readonly sway: number;
  readonly blur: number;
  readonly spin: number;
  readonly halfSpin: number;
}

export type ParticleStyleProperties = Readonly<Record<string, string | number>>;

const PARTICLE_COUNTS = {
  light: 22,
  normal: 38,
  strong: 56,
} as const satisfies Record<StdParticleIntensity, number>;

const INTENSITY_INDEX = {
  light: 0,
  normal: 1,
  strong: 2,
} as const satisfies Record<StdParticleIntensity, number>;

const particleSpecCache = new Map<string, readonly ParticleSpec[]>();

export function particleLayerClassName(current: StdParticleCurrent): string {
  return `particle-layer particle-layer--${current.type} particle-layer--${current.intensity}`;
}

export function getParticleSpecs(type: StdParticleType, intensity: StdParticleIntensity): readonly ParticleSpec[] {
  const cacheKey = `${type}:${intensity}`;
  const cached = particleSpecCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const random = createSeededRandom(cacheKey);
  const count = PARTICLE_COUNTS[intensity];
  const specs = Array.from({ length: count }, (_, index) => createParticleSpec(type, intensity, index, random));
  particleSpecCache.set(cacheKey, specs);
  return specs;
}

export function particleStyleProperties(spec: ParticleSpec): ParticleStyleProperties {
  return {
    "--x": `${spec.x}%`,
    "--y": `${spec.y}%`,
    "--delay": `${spec.delay}s`,
    "--duration": `${spec.duration}s`,
    "--size": spec.size,
    "--opacity": spec.opacity,
    "--drift": `${spec.drift}px`,
    "--drift-soft": `${round(spec.drift * -0.2)}px`,
    "--sway": `${spec.sway}px`,
    "--sway-back": `${round(spec.sway * -0.55)}px`,
    "--sway-cross": `${round(spec.sway * -0.35)}px`,
    "--sway-soft": `${round(spec.sway * -0.25)}px`,
    "--blur": `${spec.blur}px`,
    "--spin": `${spec.spin}deg`,
    "--half-spin": `${spec.halfSpin}deg`,
  };
}

function createParticleSpec(
  type: StdParticleType,
  intensity: StdParticleIntensity,
  index: number,
  random: () => number,
): ParticleSpec {
  const intensityIndex = INTENSITY_INDEX[intensity];
  const depth = random();
  const size = sizeFor(type, depth, random);
  const duration = durationFor(type, intensityIndex, depth, random);

  return {
    id: `${type}-${intensity}-${index}`,
    x: round(random() * 106 - 3),
    y: round(type === "dust" ? random() * 82 + 8 : random() * 24 - 28),
    delay: round(-random() * duration),
    duration,
    size,
    opacity: opacityFor(type, intensityIndex, depth, random),
    drift: round(driftFor(type, random)),
    sway: round(swayFor(type, random)),
    blur: round(type === "rain" ? random() * 0.7 : random() * 1.2),
    spin: round((random() > 0.5 ? 1 : -1) * (300 + random() * 260)),
    halfSpin: round((random() > 0.5 ? 1 : -1) * (150 + random() * 140)),
  };
}

function sizeFor(type: StdParticleType, depth: number, random: () => number): number {
  switch (type) {
    case "rain":
      return round(0.86 + depth * 0.78);
    case "snow":
      return round(0.65 + depth * 1.55);
    case "sakura":
      return round(0.72 + depth * 0.9);
    case "dust":
      return round(0.9 + depth * 0.82 + random() * 0.16);
  }
}

function durationFor(type: StdParticleType, intensityIndex: number, depth: number, random: () => number): number {
  const depthSpeed = 1.12 - depth * 0.24;
  switch (type) {
    case "rain":
      return round((1.34 - intensityIndex * 0.14 + random() * 0.28) * depthSpeed);
    case "snow":
      return round((10.5 - intensityIndex * 1.35 + random() * 2.4) * depthSpeed);
    case "sakura":
      return round((9.8 - intensityIndex * 1.1 + random() * 2.8) * depthSpeed);
    case "dust":
      return round(13.5 - intensityIndex * 1.1 + random() * 5.2);
  }
}

function opacityFor(type: StdParticleType, intensityIndex: number, depth: number, random: () => number): number {
  switch (type) {
    case "rain":
      return round(0.38 + intensityIndex * 0.06 + depth * 0.22 + random() * 0.08);
    case "snow":
      return round(0.46 + intensityIndex * 0.04 + depth * 0.22 + random() * 0.1);
    case "sakura":
      return round(0.5 + intensityIndex * 0.04 + depth * 0.18 + random() * 0.08);
    case "dust":
      return round(0.36 + intensityIndex * 0.035 + depth * 0.18 + random() * 0.08);
  }
}

function driftFor(type: StdParticleType, random: () => number): number {
  switch (type) {
    case "rain":
      return 48 + random() * 74;
    case "snow":
      return random() * 90 - 45;
    case "sakura":
      return random() * 170 - 85;
    case "dust":
      return random() * 54 - 27;
  }
}

function swayFor(type: StdParticleType, random: () => number): number {
  switch (type) {
    case "rain":
      return random() * 22 - 8;
    case "snow":
      return random() * 76 - 38;
    case "sakura":
      return random() * 140 - 70;
    case "dust":
      return random() * 62 - 31;
  }
}

function createSeededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
