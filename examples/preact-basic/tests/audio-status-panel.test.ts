import { type ComponentChildren, isValidElement, type VNode } from "preact";
import { describe, expect, it } from "vitest";
import { AudioStatusPanel } from "../src/audio/AudioStatusPanel.js";

interface TestNodeProps {
  readonly className?: string | undefined;
  readonly "aria-label"?: string | undefined;
  readonly children?: ComponentChildren;
}

function expectVNode(value: ComponentChildren): VNode<TestNodeProps> {
  expect(isValidElement(value)).toBe(true);
  if (!isValidElement(value)) {
    throw new Error("expected VNode");
  }
  return value as VNode<TestNodeProps>;
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
    return getNodeText((value as VNode<TestNodeProps>).props.children);
  }
  return "";
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
  const matches = String(vnode.props.className ?? "")
    .split(" ")
    .includes(className)
    ? [vnode]
    : [];
  return [...matches, ...findByClass(vnode.props.children, className)];
}

describe("AudioStatusPanel", () => {
  it("returns null when there is no audio state or notice to show", () => {
    expect(AudioStatusPanel({ notices: [] })).toBeNull();
  });

  it("renders current BGM and latest one-shot audio events", () => {
    const node = expectVNode(
      AudioStatusPanel({
        bgmAssetId: "daily_theme",
        latestSe: { assetId: "page", sequence: 2 },
        latestVoice: { assetId: "mio_001", sequence: 3 },
        notices: [],
      }),
    );

    expect(node.type).toBe("aside");
    expect(node.props.className).toBe("audio-layer");
    expect(node.props["aria-label"]).toBe("std-audio state");
    expect(findByClass(node, "audio-layer__row")).toHaveLength(3);
    expect(getNodeText(node)).toContain("BGM");
    expect(getNodeText(node)).toContain("daily_theme");
    expect(getNodeText(node)).toContain("SE");
    expect(getNodeText(node)).toContain("page #2");
    expect(getNodeText(node)).toContain("Voice");
    expect(getNodeText(node)).toContain("mio_001 #3");
  });

  it("renders none for missing channels when another channel is active", () => {
    const node = expectVNode(AudioStatusPanel({ latestSe: { assetId: "page", sequence: 4 }, notices: [] }));

    expect(getNodeText(node)).toContain("BGMnone");
    expect(getNodeText(node)).toContain("SEpage #4");
    expect(getNodeText(node)).toContain("Voicenone");
  });

  it("renders notices only when present", () => {
    const node = expectVNode(
      AudioStatusPanel({
        notices: ['Missing BGM audio asset "daily_theme".'],
      }),
    );

    expect(findByClass(node, "audio-layer__notices")).toHaveLength(1);
    expect(getNodeText(node)).toContain('Missing BGM audio asset "daily_theme".');
  });
});
