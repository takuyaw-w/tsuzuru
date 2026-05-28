import type { RuntimeState } from "@tsuzuru/core";
import type { StdHotspotState, StdHotspots } from "@tsuzuru/plugin-std-hotspot";
import { type ComponentChildren, type ComponentProps, isValidElement, type VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import { StdHotspotLayer, StdHotspotRuntimeLayer } from "../src/index.js";

type TestNodeProps = ComponentProps<"div"> &
  ComponentProps<"button"> & {
    readonly children?: ComponentChildren;
  };

const hotspots = {
  desk: {
    shape: { type: "rect", x: 160, y: 270, width: 240, height: 108 },
    action: { type: "jump", target: "inspect_desk" },
  },
  door: {
    shape: { type: "rect", x: 720, y: 180, width: 120, height: 360 },
    action: { type: "jump", target: "hallway" },
  },
} satisfies StdHotspots;

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

function runtimeStateWithHotspots(stdHotspot: StdHotspotState): RuntimeState {
  return {
    plugins: {
      stdHotspot,
    },
  } as RuntimeState;
}

describe("StdHotspotLayer", () => {
  it("returns null when no hotspots exist", () => {
    expect(StdHotspotLayer({ hotspots: {}, waiting: true })).toBeNull();
  });

  it("renders transparent hotspot buttons with percentage coordinates", () => {
    const node = expectVNode(
      StdHotspotLayer({
        hotspots,
        waiting: true,
        className: "custom-hotspots",
      }),
    );
    const buttons = findByClass(node, "tzr-std-hotspot-layer__button");

    expect(node.props.className).toBe("tzr-std-hotspot-layer custom-hotspots");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].props["aria-label"]).toBe("Hotspot desk");
    expect(buttons[0].props.disabled).toBe(false);
    expect(buttons[0].props.style).toMatchObject({
      left: "16.666666666666664%",
      top: "50%",
      width: "25%",
      height: "20%",
    });
  });

  it("does not attach click handlers while not waiting", () => {
    const onHotspot = vi.fn();
    const node = expectVNode(StdHotspotLayer({ hotspots, waiting: false, onHotspot }));
    const button = findByClass(node, "tzr-std-hotspot-layer__button")[0];

    expect(button.props.disabled).toBe(true);
    expect(button.props.onClick).toBeUndefined();
  });

  it("calls onHotspot while waiting", () => {
    const onHotspot = vi.fn();
    const stopPropagation = vi.fn();
    const node = expectVNode(StdHotspotLayer({ hotspots, waiting: true, onHotspot }));
    const button = findByClass(node, "tzr-std-hotspot-layer__button")[0];

    button.props.onClick?.({ stopPropagation } as Parameters<NonNullable<TestNodeProps["onClick"]>>[0]);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onHotspot).toHaveBeenCalledWith("desk", hotspots.desk);
  });
});

describe("StdHotspotRuntimeLayer", () => {
  it("reads std hotspot state from runtime state and jumps on click", () => {
    const jump = vi.fn();
    const runtime = {
      state: runtimeStateWithHotspots({ hotspots, waiting: true }),
      jump,
    };
    const node = expectVNode(StdHotspotRuntimeLayer({ runtime, className: "runtime-hotspots" }));
    const button = findByClass(node, "tzr-std-hotspot-layer__button")[0];

    button.props.onClick?.({ stopPropagation: vi.fn() } as Parameters<NonNullable<TestNodeProps["onClick"]>>[0]);

    expect(findByClass(node, "runtime-hotspots")).toHaveLength(1);
    expect(jump).toHaveBeenCalledWith("inspect_desk", { prepareState: expect.any(Function) });
  });

  it("does not jump when hotspot state is not waiting", () => {
    const jump = vi.fn();
    const node = expectVNode(
      StdHotspotRuntimeLayer({
        runtime: {
          state: runtimeStateWithHotspots({ hotspots, waiting: false }),
          jump,
        },
      }),
    );
    const button = findByClass(node, "tzr-std-hotspot-layer__button")[0];

    expect(button.props.disabled).toBe(true);
    expect(button.props.onClick).toBeUndefined();
    expect(jump).not.toHaveBeenCalled();
  });

  it("uses the plugin state reader missing-plugin error", () => {
    expect(() =>
      StdHotspotRuntimeLayer({
        runtime: {
          state: { plugins: {} } as RuntimeState,
          jump: vi.fn(),
        },
      }),
    ).toThrow("runtimeState.plugins.stdHotspot is not initialized. Register createStdHotspotPlugin().");
  });
});
