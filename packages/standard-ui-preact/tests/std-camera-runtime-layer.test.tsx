import type { RuntimeState } from "@tsuzuru/core";
import type { StdCameraState } from "@tsuzuru/plugin-std-camera";
import { type ComponentChildren, type ComponentProps, isValidElement, type VNode } from "preact";
import { describe, expect, it } from "vitest";
import { StdCameraRuntimeLayer } from "../src/index.js";

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

function runtimeStateWithCamera(cameraState: StdCameraState): RuntimeState {
  return {
    plugins: {
      stdCamera: cameraState,
    },
  } as RuntimeState;
}

describe("StdCameraRuntimeLayer", () => {
  it("reads std camera state from runtime state", () => {
    const node = expectVNode(
      StdCameraRuntimeLayer({
        runtimeState: runtimeStateWithCamera(
          defaultCameraState({
            x: 20,
            y: 10,
            zoom: 1.1,
            transition: { durationMs: 180, easing: "easeIn" },
          }),
        ),
        className: "runtime-camera-layer",
        children: <span className="child-node" />,
      }),
    );
    const inner = findByClass(node, "tzr-std-camera-layer__inner")[0];

    expect(findByClass(node, "runtime-camera-layer")).toHaveLength(1);
    expect(inner?.props.style).toMatchObject({
      "--tzr-camera-x": "20px",
      "--tzr-camera-y": "10px",
      "--tzr-camera-zoom": "1.1",
      "--tzr-camera-duration": "180ms",
      "--tzr-camera-easing": "ease-in",
    });
  });

  it("resolves focus offsets with the provided visual state context", () => {
    const visualState = {
      background: null,
      sprites: {
        mio: { position: "right" },
      },
    } as const;
    const node = expectVNode(
      StdCameraRuntimeLayer({
        runtimeState: runtimeStateWithCamera(defaultCameraState({ focusTarget: "mio", zoom: 1.2 })),
        visualState,
        resolveFocusOffset: (focusTarget, context) => ({
          x: context.visualState?.sprites[focusTarget]?.position === "right" ? -160 : 0,
        }),
        children: <span className="child-node" />,
      }),
    );
    const inner = findByClass(node, "tzr-std-camera-layer__inner")[0];

    expect(inner?.props.style).toMatchObject({
      "--tzr-camera-x": "-160px",
      "--tzr-camera-y": "0px",
      "--tzr-camera-zoom": "1.2",
    });
  });

  it("uses the plugin state reader missing-plugin error", () => {
    expect(() =>
      StdCameraRuntimeLayer({
        runtimeState: { plugins: {} } as RuntimeState,
        children: null,
      }),
    ).toThrow("runtimeState.plugins.stdCamera is not initialized. Register createStdCameraPlugin().");
  });
});
