import { describe, expect, it } from "vitest";
import { getParticleSpecs, particleLayerClassName, particleStyleProperties } from "../src/particle-presentation.js";

describe("preact-basic particle presentation", () => {
  it("maps current particle state to stable layer classes", () => {
    expect(particleLayerClassName({ type: "rain", intensity: "normal" })).toBe(
      "particle-layer particle-layer--rain particle-layer--normal",
    );
    expect(particleLayerClassName({ type: "dust", intensity: "light" })).toBe(
      "particle-layer particle-layer--dust particle-layer--light",
    );
  });

  it("uses bounded fixed particle counts per intensity", () => {
    expect(getParticleSpecs("rain", "light")).toHaveLength(22);
    expect(getParticleSpecs("snow", "normal")).toHaveLength(38);
    expect(getParticleSpecs("sakura", "strong")).toHaveLength(56);
    expect(getParticleSpecs("dust", "strong")).toHaveLength(56);
  });

  it("keeps generated particle specs deterministic", () => {
    const first = getParticleSpecs("sakura", "normal");
    const second = getParticleSpecs("sakura", "normal");

    expect(second).toBe(first);
    expect(first[0]).toMatchObject({
      id: "sakura-normal-0",
    });
  });

  it("generates CSS custom properties for per-particle variation", () => {
    const [particle] = getParticleSpecs("snow", "normal");
    const style = particleStyleProperties(particle);

    expect(style["--x"]).toMatch(/%$/);
    expect(style["--duration"]).toMatch(/s$/);
    expect(style["--size"]).toBeGreaterThan(0);
    expect(style["--opacity"]).toBeGreaterThan(0);
    expect(style["--sway"]).toMatch(/px$/);
  });

  it("keeps rain faster than snow on average", () => {
    const averageDuration = (durations: readonly number[]) =>
      durations.reduce((total, duration) => total + duration, 0) / durations.length;

    const rainAverage = averageDuration(getParticleSpecs("rain", "normal").map((particle) => particle.duration));
    const snowAverage = averageDuration(getParticleSpecs("snow", "normal").map((particle) => particle.duration));

    expect(rainAverage).toBeLessThan(snowAverage);
  });

  it("keeps rain and dust visible enough for the example backgrounds", () => {
    const rain = getParticleSpecs("rain", "normal");
    const dust = getParticleSpecs("dust", "light");
    const averageDuration = (durations: readonly number[]) =>
      durations.reduce((total, duration) => total + duration, 0) / durations.length;

    expect(Math.min(...rain.map((particle) => particle.opacity))).toBeGreaterThanOrEqual(0.38);
    expect(Math.min(...rain.map((particle) => particle.size))).toBeGreaterThanOrEqual(0.86);
    expect(averageDuration(rain.map((particle) => particle.duration))).toBeGreaterThanOrEqual(1.1);
    expect(Math.min(...dust.map((particle) => particle.opacity))).toBeGreaterThanOrEqual(0.36);
    expect(Math.min(...dust.map((particle) => particle.size))).toBeGreaterThanOrEqual(0.9);
    expect(Math.max(...dust.map((particle) => Math.abs(particle.sway)))).toBeGreaterThanOrEqual(20);
  });
});
