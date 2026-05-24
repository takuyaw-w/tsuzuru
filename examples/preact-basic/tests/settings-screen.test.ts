import { type ComponentChildren, isValidElement, type VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "../src/screens/SettingsScreen.js";

interface TestNodeProps {
  readonly children?: ComponentChildren;
  readonly className?: string;
  readonly id?: string;
  readonly value?: string | number;
  readonly htmlFor?: string;
  readonly "aria-describedby"?: string;
  readonly onChange?: (event: { readonly currentTarget: { readonly value: string } }) => void;
}

const defaultPreferences = {
  textRevealEnabled: true,
  textSpeedCharactersPerSecond: 60,
  textSoundEnabled: true,
  textSoundVolume: 0.55,
  bgmVolume: 0.6,
  seVolume: 0.8,
  voiceVolume: 0.9,
} as const;

describe("SettingsScreen", () => {
  it("renders message presentation controls with associated labels", () => {
    const screen = SettingsScreen({
      preferences: defaultPreferences,
      textSpeedOptions: [30, 60, 120],
      messagePresentationMode: "dialogue",
      messagePresentationSpeakerMode: "inline",
      onChangePreferences: vi.fn(),
      onChangeMessagePresentationMode: vi.fn(),
      onChangeMessagePresentationSpeakerMode: vi.fn(),
      onBack: vi.fn(),
    });

    const presentationSelect = findById(screen, "settings-message-presentation-control");
    const speakerSelect = findById(screen, "settings-novel-speaker-mode-control");
    const presentationLabel = findLabelFor(screen, "settings-message-presentation-control");
    const speakerLabel = findLabelFor(screen, "settings-novel-speaker-mode-control");

    expect(presentationLabel).not.toBeNull();
    expect(presentationSelect?.props.value).toBe("dialogue");
    expect(getNodeText(presentationSelect)).toContain("Dialogue window");
    expect(getNodeText(presentationSelect)).toContain("Novel text");
    expect(speakerLabel).not.toBeNull();
    expect(speakerSelect?.props.value).toBe("inline");
    expect(speakerSelect?.props["aria-describedby"]).toBe("settings-novel-speaker-mode-hint");
    expect(getNodeText(speakerSelect)).toContain("Inline");
    expect(getNodeText(speakerSelect)).toContain("Block");
    expect(getNodeText(speakerSelect)).toContain("Hidden");
  });

  it("calls message presentation change callbacks", () => {
    const onChangeMessagePresentationMode = vi.fn();
    const onChangeMessagePresentationSpeakerMode = vi.fn();
    const screen = SettingsScreen({
      preferences: defaultPreferences,
      textSpeedOptions: [30, 60, 120],
      messagePresentationMode: "dialogue",
      messagePresentationSpeakerMode: "inline",
      onChangePreferences: vi.fn(),
      onChangeMessagePresentationMode,
      onChangeMessagePresentationSpeakerMode,
      onBack: vi.fn(),
    });

    findById(screen, "settings-message-presentation-control")?.props.onChange?.({
      currentTarget: { value: "novel" },
    });
    findById(screen, "settings-novel-speaker-mode-control")?.props.onChange?.({
      currentTarget: { value: "block" },
    });

    expect(onChangeMessagePresentationMode).toHaveBeenCalledWith("novel");
    expect(onChangeMessagePresentationSpeakerMode).toHaveBeenCalledWith("block");
  });
});

function findById(value: ComponentChildren, id: string): VNode<TestNodeProps> | null {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findById(child, id);
      if (match !== null) {
        return match;
      }
    }
    return null;
  }
  if (!isValidElement(value)) {
    return null;
  }

  const vnode = value as VNode<TestNodeProps>;
  if (typeof vnode.type === "function") {
    return findById(vnode.type(vnode.props), id);
  }
  if (vnode.props.id === id) {
    return vnode;
  }
  return findById(vnode.props.children, id);
}

function findLabelFor(value: ComponentChildren, controlId: string): VNode<TestNodeProps> | null {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findLabelFor(child, controlId);
      if (match !== null) {
        return match;
      }
    }
    return null;
  }
  if (!isValidElement(value)) {
    return null;
  }

  const vnode = value as VNode<TestNodeProps>;
  if (typeof vnode.type === "function") {
    return findLabelFor(vnode.type(vnode.props), controlId);
  }
  if (vnode.type === "label" && vnode.props.htmlFor === controlId) {
    return vnode;
  }
  return findLabelFor(vnode.props.children, controlId);
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
  if (!isValidElement(value)) {
    return "";
  }

  const vnode = value as VNode<TestNodeProps>;
  if (typeof vnode.type === "function") {
    return getNodeText(vnode.type(vnode.props));
  }
  return getNodeText(vnode.props.children);
}
