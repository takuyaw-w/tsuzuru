import type { RuntimeState } from "@tsuzuru/core";
import type { StdParticleCurrent } from "@tsuzuru/plugin-std-particle";
import { type ComponentChildren, type ComponentProps, isValidElement, type VNode } from "preact";
import { describe, expect, it } from "vitest";
import { StdParticleLayer, StdParticleRuntimeLayer } from "../src/index.js";
import {
  getStdParticleSpecs,
  stdParticleLayerClassName,
  stdParticleStyleProperties,
} from "../src/std-particle-presentation.js";

type TestNodeProps = ComponentProps<"div"> &
  ComponentProps<"span"> & {
    readonly children?: ComponentChildren;
  };

function expectVNode(value: ComponentChildren): VNode<TestNodeProps> {
  expect(isValidElement(value)).toBe(true);
  if (!isValidElement(value)) {
    throw new Error("expected VNode");
  }
  return value as VNode<TestNodeProps>;
}

function renderFunctionVNode(vnode: VNode<TestNodeProps>): ComponentChildren {
  return (vnode.type as (props: TestNodeProps) => ComponentChildren)(vnode.props);
}

function findByClass(value: ComponentChildren, className: string): readonly VNode<TestNodeProps>[] {
  if (value === null || value === undefined || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child) => findByClass(child, className));
  }
  if (!isValidElement(value)) {
    return [];
  }

  const vnode = value as VNode<TestNodeProps>;
  if (typeof vnode.type === "function") {
    return findByClass(renderFunctionVNode(vnode), className);
  }
  const matches = String(vnode.props.className ?? "")
    .split(" ")
    .includes(className)
    ? [vnode]
    : [];
  return [...matches, ...findByClass(vnode.props.children, className)];
}

function runtimeStateWithParticle(current: StdParticleCurrent | null): RuntimeState {
  return {
    plugins: {
      stdParticle: { current },
    },
  } as RuntimeState;
}

describe("StdParticleLayer", () => {
  it("returns null when current is null or undefined", () => {
    expect(StdParticleLayer({ current: null })).toBeNull();
    expect(StdParticleLayer({})).toBeNull();
  });

  it("renders a namespaced non-interactive particle layer", () => {
    const node = expectVNode(
      StdParticleLayer({
        current: { type: "rain", intensity: "normal" },
        className: "custom-particle-layer",
      }),
    );

    expect(node.type).toBe("div");
    expect(node.props.className).toBe(
      "tzr-std-particle-layer tzr-std-particle-layer--rain tzr-std-particle-layer--normal custom-particle-layer",
    );
    expect(node.props["aria-hidden"]).toBe("true");
    expect(findByClass(node, "tzr-std-particle-layer__particle")).toHaveLength(38);
  });

  it("uses bounded fixed particle counts per intensity", () => {
    expect(
      findByClass(
        StdParticleLayer({ current: { type: "rain", intensity: "light" } }),
        "tzr-std-particle-layer__particle",
      ),
    ).toHaveLength(22);
    expect(
      findByClass(
        StdParticleLayer({ current: { type: "snow", intensity: "normal" } }),
        "tzr-std-particle-layer__particle",
      ),
    ).toHaveLength(38);
    expect(
      findByClass(
        StdParticleLayer({ current: { type: "sakura", intensity: "strong" } }),
        "tzr-std-particle-layer__particle",
      ),
    ).toHaveLength(56);
    expect(
      findByClass(
        StdParticleLayer({ current: { type: "dust", intensity: "strong" } }),
        "tzr-std-particle-layer__particle",
      ),
    ).toHaveLength(56);
  });

  it("maps current particle state to stable standard layer classes", () => {
    expect(stdParticleLayerClassName({ type: "rain", intensity: "normal" })).toBe(
      "tzr-std-particle-layer tzr-std-particle-layer--rain tzr-std-particle-layer--normal",
    );
    expect(stdParticleLayerClassName({ type: "dust", intensity: "light" })).toBe(
      "tzr-std-particle-layer tzr-std-particle-layer--dust tzr-std-particle-layer--light",
    );
  });

  it("keeps generated particle specs deterministic", () => {
    const first = getStdParticleSpecs("sakura", "normal");
    const second = getStdParticleSpecs("sakura", "normal");

    expect(second).toBe(first);
    expect(first[0]).toMatchObject({
      id: "sakura-normal-0",
    });
  });

  it("generates CSS custom properties for per-particle variation", () => {
    const [particle] = getStdParticleSpecs("snow", "normal");
    if (particle === undefined) {
      throw new Error("missing particle");
    }
    const style = stdParticleStyleProperties(particle);

    expect(style["--x"]).toMatch(/%$/);
    expect(style["--duration"]).toMatch(/s$/);
    expect(style["--size"]).toBeGreaterThan(0);
    expect(style["--opacity"]).toBeGreaterThan(0);
    expect(style["--sway"]).toMatch(/px$/);
  });

  it("keeps rain faster than snow on average", () => {
    const averageDuration = (durations: readonly number[]) =>
      durations.reduce((total, duration) => total + duration, 0) / durations.length;

    const rainAverage = averageDuration(getStdParticleSpecs("rain", "normal").map((particle) => particle.duration));
    const snowAverage = averageDuration(getStdParticleSpecs("snow", "normal").map((particle) => particle.duration));

    expect(rainAverage).toBeLessThan(snowAverage);
  });

  it("keeps rain and dust visible enough for the standard backgrounds", () => {
    const rain = getStdParticleSpecs("rain", "normal");
    const dust = getStdParticleSpecs("dust", "light");
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

describe("StdParticleRuntimeLayer", () => {
  it("reads std particle state from runtime state", () => {
    const node = expectVNode(
      StdParticleRuntimeLayer({
        runtimeState: runtimeStateWithParticle({ type: "dust", intensity: "light" }),
        className: "runtime-particle-layer",
      }),
    );

    expect(findByClass(node, "tzr-std-particle-layer--dust")).toHaveLength(1);
    expect(findByClass(node, "tzr-std-particle-layer--light")).toHaveLength(1);
    expect(findByClass(node, "runtime-particle-layer")).toHaveLength(1);
    expect(findByClass(node, "tzr-std-particle-layer__particle")).toHaveLength(22);
  });

  it("returns null when runtime particle state is empty", () => {
    expect(StdParticleRuntimeLayer({ runtimeState: runtimeStateWithParticle(null) })).toBeNull();
  });

  it("uses the plugin state reader missing-plugin error", () => {
    expect(() => StdParticleRuntimeLayer({ runtimeState: { plugins: {} } as RuntimeState })).toThrow(
      "runtimeState.plugins.stdParticle is not initialized. Register createStdParticlePlugin().",
    );
  });
});
