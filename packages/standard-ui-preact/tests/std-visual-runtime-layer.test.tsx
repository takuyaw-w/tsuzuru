import type { RuntimeState } from "@tsuzuru/core";
import { type ComponentChildren, type ComponentProps, isValidElement, type VNode } from "preact";
import { describe, expect, it } from "vitest";
import { StdVisualRuntimeLayer } from "../src/index.js";

type TestNodeProps = ComponentProps<"div"> &
  ComponentProps<"img"> & {
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

function getNodeText(value: ComponentChildren): string {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((child) => getNodeText(child)).join("");
  }
  if (isValidElement(value)) {
    const vnode = value as VNode<TestNodeProps>;
    if (typeof vnode.type === "function") {
      return getNodeText(renderFunctionVNode(vnode));
    }
    return getNodeText(vnode.props.children);
  }
  return "";
}

function runtimeStateWithVisual(): RuntimeState {
  return {
    plugins: {
      stdVisual: {
        background: { assetId: "station" },
        sprites: {
          mio_smile: { position: "center" },
        },
      },
    },
  } as RuntimeState;
}

describe("StdVisualRuntimeLayer", () => {
  it("reads std visual state from runtime state and renders asset-backed images", () => {
    const node = expectVNode(
      StdVisualRuntimeLayer({
        runtimeState: runtimeStateWithVisual(),
        backgroundAssets: { station: "/assets/backgrounds/station.svg" },
        spriteAssets: { mio_smile: { src: "/assets/sprites/mio_smile.svg", alt: "Mio" } },
        className: "runtime-visual-layer",
      }),
    );
    const background = findByClass(node, "tzr-tsuzuru-game__background")[0];
    const sprite = findByClass(node, "tzr-tsuzuru-game__sprite")[0];

    expect(findByClass(node, "runtime-visual-layer")).toHaveLength(1);
    expect(background?.type).toBe("img");
    expect(background?.props.src).toBe("/assets/backgrounds/station.svg");
    expect(sprite?.type).toBe("img");
    expect(sprite?.props.src).toBe("/assets/sprites/mio_smile.svg");
    expect(sprite?.props.alt).toBe("Mio");
    expect(sprite?.props.className).toContain("tzr-tsuzuru-game__sprite--center");
  });

  it("uses StdVisualLayer placeholders when assets are missing", () => {
    const node = expectVNode(StdVisualRuntimeLayer({ runtimeState: runtimeStateWithVisual() }));

    expect(findByClass(node, "tzr-tsuzuru-game__background-placeholder")).toHaveLength(1);
    expect(findByClass(node, "tzr-tsuzuru-game__sprite-placeholder")).toHaveLength(1);
    expect(getNodeText(node)).toContain("station");
    expect(getNodeText(node)).toContain("mio_smile");
  });

  it("uses the plugin state reader missing-plugin error", () => {
    expect(() => StdVisualRuntimeLayer({ runtimeState: { plugins: {} } as RuntimeState })).toThrow(
      "runtimeState.plugins.stdVisual is not initialized. Register createStdVisualPlugin().",
    );
  });
});
