import type { StdAudioSeEvent, StdAudioVoiceEvent } from "@tsuzuru/plugin-std-audio";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STD_AUDIO_MISSING_DIAGNOSTIC_CODE,
  STD_AUDIO_PLAYBACK_DIAGNOSTIC_CODE,
  StdAudioLayer,
  type StdAudioLayerProps,
} from "../src/index.js";

interface MinimalElement {
  readonly nodeType: 1;
  readonly namespaceURI: string;
  readonly localName: string;
  readonly attributes: readonly [];
  readonly style: Record<string, string>;
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
  const element: MinimalElement = {
    nodeType: 1,
    namespaceURI,
    localName,
    attributes: [],
    style: {},
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
    setAttribute() {
      return undefined;
    },
    removeAttribute() {
      return undefined;
    },
    addEventListener() {
      return undefined;
    },
    removeEventListener() {
      return undefined;
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

function createSeEvent(assetId: string, sequence: number): StdAudioSeEvent {
  return { assetId, sequence } as StdAudioSeEvent;
}

function createVoiceEvent(assetId: string, sequence: number): StdAudioVoiceEvent {
  return { assetId, sequence } as StdAudioVoiceEvent;
}

describe("StdAudioLayer", () => {
  const roots: MinimalElement[] = [];

  beforeEach(() => {
    installMinimalDom();
    installMockAudio();
    MockAudio.instances = [];
    MockAudio.playImplementation = () => Promise.resolve();
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        render(null, root as unknown as Element);
      });
    }
    uninstallMockAudio();
    uninstallMinimalDom();
  });

  async function mountAudio(initialProps: StdAudioLayerProps): Promise<{
    readonly update: (nextProps: StdAudioLayerProps) => Promise<void>;
    readonly unmount: () => void;
  }> {
    const root = createMinimalElement("div");
    roots.push(root);

    const update = async (nextProps: StdAudioLayerProps) => {
      await act(async () => {
        render(h(StdAudioLayer, nextProps), root as unknown as Element);
      });
      await flushEffects();
    };

    await update(initialProps);

    return {
      update,
      unmount: () => {
        act(() => {
          render(null, root as unknown as Element);
        });
      },
    };
  }

  it("plays BGM with loop and configured volume", async () => {
    await mountAudio({
      bgm: { assetId: "daily_theme" },
      bgmAssets: { daily_theme: { src: "/assets/audio/bgm/daily_theme.mp3", volume: 0.4 } },
    });

    const audio = MockAudio.instances[0];
    expect(audio?.src).toBe("/assets/audio/bgm/daily_theme.mp3");
    expect(audio?.loop).toBe(true);
    expect(audio?.volume).toBe(0.4);
    expect(audio?.play).toHaveBeenCalledTimes(1);
  });

  it("pauses BGM when it becomes null", async () => {
    const harness = await mountAudio({
      bgm: { assetId: "daily_theme" },
      bgmAssets: { daily_theme: "/assets/audio/bgm/daily_theme.mp3" },
    });
    const audio = MockAudio.instances[0];

    await harness.update({
      bgm: null,
      bgmAssets: { daily_theme: "/assets/audio/bgm/daily_theme.mp3" },
    });

    expect(audio?.pause).toHaveBeenCalled();
  });

  it("reports a missing BGM asset", async () => {
    const onDiagnostic = vi.fn();

    await mountAudio({
      bgm: { assetId: "missing_bgm" },
      bgmAssets: {},
      onDiagnostic,
    });

    expect(onDiagnostic).toHaveBeenCalledWith({
      code: STD_AUDIO_MISSING_DIAGNOSTIC_CODE,
      channel: "BGM",
      assetId: "missing_bgm",
      message: 'Missing BGM audio asset "missing_bgm".',
    });
    expect(MockAudio.instances).toHaveLength(0);
  });

  it("plays only new SE sequences across renders", async () => {
    const firstEvent = createSeEvent("page", 1);
    const secondEvent = createSeEvent("page", 2);
    const harness = await mountAudio({
      seEvents: [firstEvent],
      seAssets: { page: "/assets/audio/se/page.mp3" },
    });

    expect(MockAudio.instances).toHaveLength(1);

    await harness.update({
      seEvents: [firstEvent],
      seAssets: { page: "/assets/audio/se/page.mp3" },
    });
    expect(MockAudio.instances).toHaveLength(1);

    await harness.update({
      seEvents: [firstEvent, secondEvent],
      seAssets: { page: "/assets/audio/se/page.mp3" },
    });
    expect(MockAudio.instances).toHaveLength(2);
    expect(MockAudio.instances[1]?.src).toBe("/assets/audio/se/page.mp3");
  });

  it("plays voice events", async () => {
    await mountAudio({
      voiceEvents: [createVoiceEvent("mio_001", 1)],
      voiceAssets: { mio_001: { src: "/assets/audio/voice/mio_001.mp3", volume: 0.8 } },
    });

    const audio = MockAudio.instances[0];
    expect(audio?.src).toBe("/assets/audio/voice/mio_001.mp3");
    expect(audio?.volume).toBe(0.8);
    expect(audio?.play).toHaveBeenCalledTimes(1);
  });

  it("reports playback failures", async () => {
    const onDiagnostic = vi.fn();
    MockAudio.playImplementation = () => Promise.reject(new Error("blocked"));

    await mountAudio({
      bgm: { assetId: "daily_theme" },
      bgmAssets: { daily_theme: "/assets/audio/bgm/daily_theme.mp3" },
      onDiagnostic,
    });
    await flushEffects();

    expect(onDiagnostic).toHaveBeenCalledWith({
      code: STD_AUDIO_PLAYBACK_DIAGNOSTIC_CODE,
      channel: "BGM",
      assetId: "daily_theme",
      message: "BGM playback was blocked or failed: daily_theme.",
    });
  });
});
