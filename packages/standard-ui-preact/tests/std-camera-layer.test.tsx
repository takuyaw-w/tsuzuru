import type { StdCameraState } from "@tsuzuru/plugin-std-camera";
import { type ComponentChildren, type ComponentProps, isValidElement, type VNode } from "preact";
import { describe, expect, it } from "vitest";
import { StdCameraLayer } from "../src/index.js";

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

function defaultCameraState(overrides: Partial<StdCameraState> = {}): StdCameraState {
  return {
    x: 0,
    y: 0,
    zoom: 1,
    focusTarget: null,
    transition: null,
    ...overrides,
  };
}

describe("StdCameraLayer", () => {
  it("renders a namespaced transform wrapper around children", () => {
    const node = expectVNode(
      StdCameraLayer({
        cameraState: defaultCameraState({
          x: 12,
          y: -8,
          zoom: 1.25,
          transition: { durationMs: 240, easing: "easeOut" },
        }),
        focusOffset: { x: 30, y: 6 },
        className: "custom-camera-layer",
        children: <span className="child-node">camera child</span>,
      }),
    );
    const inner = findByClass(node, "tzr-std-camera-layer__inner")[0];

    expect(node.props.className).toBe("tzr-std-camera-layer custom-camera-layer");
    expect(node.props["aria-hidden"]).toBe("true");
    expect(inner?.props.style).toMatchObject({
      "--tzr-camera-x": "42px",
      "--tzr-camera-y": "-2px",
      "--tzr-camera-zoom": "1.25",
      "--tzr-camera-duration": "240ms",
      "--tzr-camera-easing": "ease-out",
    });
    expect(findByClass(node, "child-node")).toHaveLength(1);
  });

  it("uses stable default transition variables when no camera transition exists", () => {
    const node = expectVNode(
      StdCameraLayer({
        cameraState: defaultCameraState({ x: -4, y: 9, zoom: 0.95 }),
        children: <span className="child-node" />,
      }),
    );
    const inner = findByClass(node, "tzr-std-camera-layer__inner")[0];

    expect(inner?.props.style).toMatchObject({
      "--tzr-camera-x": "-4px",
      "--tzr-camera-y": "9px",
      "--tzr-camera-zoom": "0.95",
      "--tzr-camera-duration": "0ms",
      "--tzr-camera-easing": "ease",
    });
  });
});
