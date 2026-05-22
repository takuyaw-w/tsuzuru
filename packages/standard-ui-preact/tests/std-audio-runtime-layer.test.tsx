import type { StdAudioSeEvent, StdAudioState, StdAudioVoiceEvent } from "@tsuzuru/plugin-std-audio";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STD_AUDIO_MISSING_DIAGNOSTIC_CODE,
  StdAudioRuntimeLayer,
  type StdAudioRuntimeLayerProps,
} from "../src/index.js";

interface MinimalElement {
  readonly nodeType: 1;
  readonly namespaceURI: string;
  readonly localName: string;
  readonly attributes: readonly [];
  style: Record<string, string>;
  className: string;
  parentNode: MinimalElement | null;
  childNodes: MinimalNode[];
  readonly firstChild: MinimalNode | null;
  readonly nextSibling: MinimalNode | null;
  appendChild(node: MinimalNode): MinimalNode;
  insertBefore(node: MinimalNode, before: MinimalNode | null): MinimalNode;
  removeChild(node: MinimalNode): MinimalNode;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(name: string, listener: EventListener): void;
  removeEventListener(name: string, listener: EventListener): void;
  getAttribute(name: string): string | null;
}

interface MinimalText {
  readonly nodeType: 3;
  data: string;
  parentNode: MinimalElement | null;
  readonly nextSibling: MinimalNode | null;
}

type MinimalNode = MinimalElement | MinimalText;

interface MinimalDocument {
  readonly documentElement: MinimalElement;
  createElementNS(namespaceURI: string, localName: string): MinimalElement;
  createTextNode(data: string): MinimalText;
}

class MockAudio {
  static instances: MockAudio[] = [];
  static playImplementation: () => Promise<void> = () => Promise.resolve();

  readonly src: string;
  loop = false;
  volume = 1;
  readonly play = vi.fn(() => MockAudio.playImplementation());
  readonly pause = vi.fn();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }
}

let originalAudio: typeof Audio | undefined;

function createMinimalElement(localName: string, namespaceURI = "http://www.w3.org/1999/xhtml"): MinimalElement {
  const attributes = new Map<string, string>();
  const element: MinimalElement = {
    nodeType: 1,
    namespaceURI,
    localName,
    attributes: [],
    style: {},
    className: "",
    parentNode: null,
    childNodes: [],
    get firstChild() {
      return this.childNodes[0] ?? null;
    },
    get nextSibling() {
      return nextSiblingOf(this);
    },
    appendChild(node) {
      node.parentNode = this;
      this.childNodes.push(node);
      return node;
    },
    insertBefore(node, before) {
      node.parentNode = this;
      const index = before === null ? -1 : this.childNodes.indexOf(before);
      if (index === -1) {
        this.childNodes.push(node);
      } else {
        this.childNodes.splice(index, 0, node);
      }
      return node;
    },
    removeChild(node) {
      this.childNodes = this.childNodes.filter((child) => child !== node);
      node.parentNode = null;
      return node;
    },
    setAttribute(name, value) {
      attributes.set(name, value);
      if (name === "class") {
        this.className = value;
      }
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "class") {
        this.className = "";
      }
    },
    addEventListener() {
      return undefined;
    },
    removeEventListener() {
      return undefined;
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
  };
  return element;
}

function createMinimalText(data: string): MinimalText {
  return {
    nodeType: 3,
    data,
    parentNode: null,
    get nextSibling() {
      return nextSiblingOf(this);
    },
  };
}

function nextSiblingOf(node: MinimalNode): MinimalNode | null {
  const siblings = node.parentNode?.childNodes;
  if (siblings === undefined) {
    return null;
  }
  const index = siblings.indexOf(node);
  return index === -1 ? null : (siblings[index + 1] ?? null);
}

function createMinimalDocument(): MinimalDocument {
  return {
    documentElement: createMinimalElement("html"),
    createElementNS: (namespaceURI, localName) => createMinimalElement(localName, namespaceURI),
    createTextNode: createMinimalText,
  };
}

function installMinimalDom(): void {
  const minimalDocument = createMinimalDocument();
  Object.assign(globalThis, {
    document: minimalDocument,
    window: {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
  });
}

function uninstallMinimalDom(): void {
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "window");
}

function installMockAudio(): void {
  originalAudio = globalThis.Audio;
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    writable: true,
    value: MockAudio,
  });
}

function uninstallMockAudio(): void {
  if (originalAudio === undefined) {
    Reflect.deleteProperty(globalThis, "Audio");
    return;
  }
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    writable: true,
    value: originalAudio,
  });
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

interface AudioRuntimeLayerHarness {
  readonly root: MinimalElement;
  readonly update: (props: StdAudioRuntimeLayerProps) => Promise<void>;
  readonly unmount: () => void;
}

async function mountAudioRuntimeLayer(props: StdAudioRuntimeLayerProps): Promise<AudioRuntimeLayerHarness> {
  const root = createMinimalElement("div");
  const update = async (nextProps: StdAudioRuntimeLayerProps) => {
    await act(async () => {
      render(h(StdAudioRuntimeLayer, nextProps), root as unknown as Element);
    });
    await flushEffects();
  };

  await update(props);

  return {
    root,
    update,
    unmount: () => {
      act(() => {
        render(null, root as unknown as Element);
      });
    },
  };
}

function getNodeText(value: MinimalNode | readonly MinimalNode[]): string {
  if (Array.isArray(value)) {
    return value.map((node) => getNodeText(node)).join("");
  }
  if (value.nodeType === 3) {
    return value.data;
  }
  return value.childNodes.map((node) => getNodeText(node)).join("");
}

function findByClass(value: MinimalNode | readonly MinimalNode[], className: string): readonly MinimalElement[] {
  if (Array.isArray(value)) {
    return value.flatMap((node) => findByClass(node, className));
  }
  if (value.nodeType !== 1) {
    return [];
  }
  const matches = value.className.split(" ").includes(className) ? [value] : [];
  return [...matches, ...value.childNodes.flatMap((node) => findByClass(node, className))];
}

function createAudioState(partial: Partial<StdAudioState> = {}): StdAudioState {
  return {
    bgm: null,
    seEvents: [],
    voiceEvents: [],
    nextSeSequence: 1,
    nextVoiceSequence: 1,
    ...partial,
  };
}

function createSeEvent(assetId: string, sequence: number): StdAudioSeEvent {
  return { assetId, sequence } as StdAudioSeEvent;
}

function createVoiceEvent(assetId: string, sequence: number): StdAudioVoiceEvent {
  return { assetId, sequence } as StdAudioVoiceEvent;
}

describe("StdAudioRuntimeLayer", () => {
  const harnesses: AudioRuntimeLayerHarness[] = [];

  beforeEach(() => {
    installMinimalDom();
    installMockAudio();
    MockAudio.instances = [];
    MockAudio.playImplementation = () => Promise.resolve();
  });

  afterEach(() => {
    for (const harness of harnesses.splice(0)) {
      harness.unmount();
    }
    uninstallMockAudio();
    uninstallMinimalDom();
  });

  it("connects std-audio state to playback and the status panel", async () => {
    const harness = await mountAudioRuntimeLayer({
      audioState: createAudioState({
        bgm: { assetId: "daily_theme" },
        seEvents: [createSeEvent("page", 2)],
        voiceEvents: [createVoiceEvent("mio_001", 3)],
      }),
      bgmAssets: { daily_theme: { src: "/assets/audio/bgm/daily_theme.mp3", volume: 0.4 } },
      seAssets: { page: { src: "/assets/audio/se/page.mp3", volume: 0.5 } },
      voiceAssets: { mio_001: { src: "/assets/audio/voice/mio_001.mp3", volume: 0.6 } },
      statusPanelClassName: "audio-layer",
    });
    harnesses.push(harness);

    expect(MockAudio.instances.map((audio) => audio.src)).toEqual([
      "/assets/audio/bgm/daily_theme.mp3",
      "/assets/audio/se/page.mp3",
      "/assets/audio/voice/mio_001.mp3",
    ]);
    expect(MockAudio.instances[0]?.loop).toBe(true);
    expect(MockAudio.instances[0]?.volume).toBe(0.4);
    expect(MockAudio.instances[1]?.volume).toBe(0.5);
    expect(MockAudio.instances[2]?.volume).toBe(0.6);

    const panels = findByClass(harness.root.childNodes, "audio-layer");
    expect(panels).toHaveLength(1);
    expect(panels[0]?.className).toBe("tzr-std-audio-status-panel audio-layer");
    expect(getNodeText(harness.root.childNodes)).toContain("daily_theme");
    expect(getNodeText(harness.root.childNodes)).toContain("page #2");
    expect(getNodeText(harness.root.childNodes)).toContain("mio_001 #3");
  });

  it("can hide the status panel while keeping playback active", async () => {
    const harness = await mountAudioRuntimeLayer({
      audioState: createAudioState({ bgm: { assetId: "daily_theme" } }),
      bgmAssets: { daily_theme: "/assets/audio/bgm/daily_theme.mp3" },
      showStatus: false,
    });
    harnesses.push(harness);

    expect(MockAudio.instances[0]?.src).toBe("/assets/audio/bgm/daily_theme.mp3");
    expect(findByClass(harness.root.childNodes, "tzr-std-audio-status-panel")).toHaveLength(0);
    expect(getNodeText(harness.root.childNodes)).toBe("");
  });

  it("turns audio diagnostics into notices and also calls onDiagnostic", async () => {
    const onDiagnostic = vi.fn();
    const onWarn = vi.fn();
    const harness = await mountAudioRuntimeLayer({
      audioState: createAudioState({ bgm: { assetId: "missing_theme" } }),
      noticeOptions: { onWarn },
      onDiagnostic,
    });
    harnesses.push(harness);
    await flushEffects();

    expect(onDiagnostic).toHaveBeenCalledWith({
      code: STD_AUDIO_MISSING_DIAGNOSTIC_CODE,
      channel: "BGM",
      assetId: "missing_theme",
      message: 'Missing BGM audio asset "missing_theme".',
    });
    expect(onWarn).toHaveBeenCalledWith('Missing BGM audio asset "missing_theme".', expect.any(Object));
    expect(getNodeText(harness.root.childNodes)).toContain('Missing BGM audio asset "missing_theme".');
  });

  it("updates playback and status without replaying already consumed one-shot sequences", async () => {
    const firstAudioState = createAudioState({
      bgm: { assetId: "daily_theme" },
      seEvents: [createSeEvent("page", 1)],
      voiceEvents: [createVoiceEvent("mio_001", 1)],
    });
    const secondAudioState = createAudioState({
      bgm: { assetId: "night_theme" },
      seEvents: [createSeEvent("page", 1), createSeEvent("door", 2)],
      voiceEvents: [createVoiceEvent("mio_001", 1), createVoiceEvent("mio_002", 2)],
    });
    const harness = await mountAudioRuntimeLayer({
      audioState: firstAudioState,
      bgmAssets: {
        daily_theme: "/assets/audio/bgm/daily_theme.mp3",
        night_theme: "/assets/audio/bgm/night_theme.mp3",
      },
      seAssets: {
        page: "/assets/audio/se/page.mp3",
        door: "/assets/audio/se/door.mp3",
      },
      voiceAssets: {
        mio_001: "/assets/audio/voice/mio_001.mp3",
        mio_002: "/assets/audio/voice/mio_002.mp3",
      },
    });
    harnesses.push(harness);

    const firstBgm = MockAudio.instances[0];
    expect(MockAudio.instances.map((audio) => audio.src)).toEqual([
      "/assets/audio/bgm/daily_theme.mp3",
      "/assets/audio/se/page.mp3",
      "/assets/audio/voice/mio_001.mp3",
    ]);

    await harness.update({
      audioState: secondAudioState,
      bgmAssets: {
        daily_theme: "/assets/audio/bgm/daily_theme.mp3",
        night_theme: "/assets/audio/bgm/night_theme.mp3",
      },
      seAssets: {
        page: "/assets/audio/se/page.mp3",
        door: "/assets/audio/se/door.mp3",
      },
      voiceAssets: {
        mio_001: "/assets/audio/voice/mio_001.mp3",
        mio_002: "/assets/audio/voice/mio_002.mp3",
      },
    });

    expect(firstBgm?.pause).toHaveBeenCalled();
    expect(MockAudio.instances.map((audio) => audio.src)).toEqual([
      "/assets/audio/bgm/daily_theme.mp3",
      "/assets/audio/se/page.mp3",
      "/assets/audio/voice/mio_001.mp3",
      "/assets/audio/bgm/night_theme.mp3",
      "/assets/audio/se/door.mp3",
      "/assets/audio/voice/mio_002.mp3",
    ]);
    expect(getNodeText(harness.root.childNodes)).toContain("night_theme");
    expect(getNodeText(harness.root.childNodes)).toContain("door #2");
    expect(getNodeText(harness.root.childNodes)).toContain("mio_002 #2");
  });

  it("passes custom status panel labels through", async () => {
    const harness = await mountAudioRuntimeLayer({
      audioState: createAudioState({ bgm: { assetId: "daily_theme" } }),
      bgmAssets: { daily_theme: "/assets/audio/bgm/daily_theme.mp3" },
      statusPanelLabels: { bgm: "Music", panel: "audio state" },
    });
    harnesses.push(harness);

    const panels = findByClass(harness.root.childNodes, "tzr-std-audio-status-panel");
    expect(panels[0]?.getAttribute("aria-label")).toBe("audio state");
    expect(getNodeText(harness.root.childNodes)).toContain("Music");
  });
});
