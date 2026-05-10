import type { RuntimeState } from "@tsuzuru/core";
import { describe, expect, it, vi } from "vitest";
import type { TsuzuruHtmlAssets } from "../src/index.js";
import { createTsuzuruHtmlNoticeSink } from "../src/notices.js";
import { type TsuzuruHtmlAudioElement, TsuzuruHtmlAudioLayer } from "../src/std-audio-layer.js";

describe("TsuzuruHtmlAudioLayer", () => {
  it("starts and stops managed BGM audio", async () => {
    const created: FakeAudio[] = [];
    const layer = new TsuzuruHtmlAudioLayer({
      assets: testAssets,
      notices: createTsuzuruHtmlNoticeSink(() => undefined),
      audioFactory: (src) => {
        const audio = new FakeAudio(src);
        created.push(audio);
        return audio;
      },
    });

    layer.sync(runtimeState({ bgm: { assetId: "daily_theme" } }));
    await Promise.resolve();

    expect(created).toHaveLength(1);
    expect(created[0]?.src).toBe("https://example.test/audio/bgm.mp3");
    expect(created[0]?.loop).toBe(true);
    expect(created[0]?.playCount).toBe(1);

    layer.sync(runtimeState({ bgm: null }));

    expect(created[0]?.pauseCount).toBe(1);
    expect(created[0]?.currentTime).toBe(0);
  });

  it("plays SE and voice events once by sequence", async () => {
    const created: FakeAudio[] = [];
    const layer = new TsuzuruHtmlAudioLayer({
      assets: testAssets,
      notices: createTsuzuruHtmlNoticeSink(() => undefined),
      audioFactory: (src) => {
        const audio = new FakeAudio(src);
        created.push(audio);
        return audio;
      },
    });
    const state = runtimeState({
      seEvents: [{ assetId: "page", sequence: 1 }],
      voiceEvents: [{ assetId: "mio_001", sequence: 1 }],
      nextSeSequence: 2,
      nextVoiceSequence: 2,
    });

    layer.sync(state);
    layer.sync(state);
    await Promise.resolve();

    expect(created.map((audio) => audio.src)).toEqual([
      "https://example.test/audio/page.mp3",
      "https://example.test/audio/mio.mp3",
    ]);
    expect(created.map((audio) => audio.playCount)).toEqual([1, 1]);
  });

  it("reports missing audio assets as non-fatal notices", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const notices = createTsuzuruHtmlNoticeSink(() => undefined);
    const layer = new TsuzuruHtmlAudioLayer({ assets: testAssets, notices });

    layer.sync(runtimeState({ bgm: { assetId: "missing" } }));

    expect(notices.values()).toEqual([
      { key: "audio:bgm:missing:missing", message: "BGM audio asset is not mapped: missing" },
    ]);
    warn.mockRestore();
  });
});

const testAssets: TsuzuruHtmlAssets = {
  version: 1,
  visual: { backgrounds: {}, sprites: {} },
  audio: {
    bgm: { daily_theme: { src: "https://example.test/audio/bgm.mp3" } },
    se: { page: { src: "https://example.test/audio/page.mp3" } },
    voice: { mio_001: { src: "https://example.test/audio/mio.mp3" } },
  },
};

interface TestStdAudioState {
  readonly bgm: { readonly assetId: string } | null;
  readonly seEvents: readonly { readonly assetId: string; readonly sequence: number }[];
  readonly voiceEvents: readonly { readonly assetId: string; readonly sequence: number }[];
  readonly nextSeSequence: number;
  readonly nextVoiceSequence: number;
}

function runtimeState(stdAudio: Partial<TestStdAudioState>): RuntimeState {
  return {
    pointer: { filePath: "scenario/main.tzr", instructionIndex: 0 },
    variables: {},
    plugins: {
      stdAudio: {
        bgm: null,
        seEvents: [],
        voiceEvents: [],
        nextSeSequence: 1,
        nextVoiceSequence: 1,
        ...stdAudio,
      },
    },
    branchFrames: [],
    pendingChoice: null,
    pendingWait: null,
    isStopped: false,
    isWaitingForClick: false,
  };
}

class FakeAudio implements TsuzuruHtmlAudioElement {
  public loop = false;
  public volume = 1;
  public currentTime = 1;
  public playCount = 0;
  public pauseCount = 0;

  public constructor(public readonly src: string) {}

  public play(): void {
    this.playCount += 1;
  }

  public pause(): void {
    this.pauseCount += 1;
  }
}
