import { type ComponentChildren, isValidElement, type VNode } from "preact";
import { describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "../src/screens/SettingsScreen.js";

interface TestNodeProps {
  readonly children?: ComponentChildren;
  readonly className?: string;
  readonly id?: string;
  readonly role?: string;
  readonly value?: string | number;
  readonly htmlFor?: string;
  readonly "aria-label"?: string;
  readonly "aria-pressed"?: boolean;
  readonly "aria-describedby"?: string;
  readonly onClick?: () => void;
  readonly onChange?: (event: {
    readonly currentTarget: {
      readonly checked: boolean;
      readonly value: string;
      readonly valueAsNumber: number;
    };
  }) => void;
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
  it("renders standard dialogue game settings with associated labels", () => {
    const screen = SettingsScreen({
      preferences: defaultPreferences,
      textSpeedOptions: [30, 60, 120],
      onChangePreferences: vi.fn(),
      onBack: vi.fn(),
    });

    expect(getNodeText(screen)).toContain("CONFIG");
    expect(findLabelFor(screen, "settings-tab-text")).not.toBeNull();
    expect(findLabelFor(screen, "settings-tab-sound")).not.toBeNull();
    expect(findByRoleAndName(screen, "group", "Text reveal")).not.toBeNull();
    expect(findByRoleAndName(screen, "group", "Text speed")).not.toBeNull();
    expect(findByRoleAndName(screen, "group", "Text sound")).not.toBeNull();
    expect(findLabelFor(screen, "settings-text-sound-volume-control")).not.toBeNull();
    expect(findLabelFor(screen, "settings-bgm-volume-control")).not.toBeNull();
    expect(findLabelFor(screen, "settings-se-volume-control")).not.toBeNull();
    expect(findLabelFor(screen, "settings-voice-volume-control")).not.toBeNull();

    expect(findById(screen, "settings-message-presentation-control")).toBeNull();
    expect(findById(screen, "settings-novel-speaker-mode-control")).toBeNull();
    expect(getNodeText(screen)).not.toContain("Novel");
  });

  it("calls preference change callbacks", () => {
    const onChangePreferences = vi.fn();
    const screen = SettingsScreen({
      preferences: defaultPreferences,
      textSpeedOptions: [30, 60, 120],
      onChangePreferences,
      onBack: vi.fn(),
    });

    findButtonByText(screen, "Off")?.props.onClick?.();
    findButtonByText(screen, "Fast")?.props.onClick?.();

    expect(onChangePreferences).toHaveBeenCalledWith({
      ...defaultPreferences,
      textRevealEnabled: false,
    });
    expect(onChangePreferences).toHaveBeenCalledWith({
      ...defaultPreferences,
      textSpeedCharactersPerSecond: 120,
    });
  });
});

function findByRoleAndName(value: ComponentChildren, role: string, name: string): VNode<TestNodeProps> | null {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findByRoleAndName(child, role, name);
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
    return findByRoleAndName(vnode.type(vnode.props), role, name);
  }
  const nodeRole = vnode.props.role ?? (vnode.type === "fieldset" ? "group" : undefined);
  if (nodeRole === role && vnode.props["aria-label"] === name) {
    return vnode;
  }
  return findByRoleAndName(vnode.props.children, role, name);
}

function findButtonByText(value: ComponentChildren, text: string): VNode<TestNodeProps> | null {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findButtonByText(child, text);
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
    return findButtonByText(vnode.type(vnode.props), text);
  }
  if (vnode.type === "button" && getNodeText(vnode) === text) {
    return vnode;
  }
  return findButtonByText(vnode.props.children, text);
}

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
