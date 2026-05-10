import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import type { TsuzuruHtmlAssetEntry, TsuzuruHtmlAssets } from "./assets-loader.js";
import type { TsuzuruHtmlNoticeSink } from "./notices.js";

export interface TsuzuruHtmlAudioElement {
  loop: boolean;
  volume: number;
  currentTime: number;
  readonly error?: unknown;
  play: () => Promise<void> | void;
  pause: () => void;
  addEventListener?: (name: string, listener: () => void) => void;
}

export type TsuzuruHtmlAudioFactory = (src: string) => TsuzuruHtmlAudioElement;

export interface TsuzuruHtmlAudioLayerOptions {
  readonly assets: TsuzuruHtmlAssets | null;
  readonly notices: TsuzuruHtmlNoticeSink;
  readonly audioFactory?: TsuzuruHtmlAudioFactory;
}

export class TsuzuruHtmlAudioLayer {
  private bgmAudio: TsuzuruHtmlAudioElement | null = null;
  private bgmAssetId: string | null = null;
  private voiceAudio: TsuzuruHtmlAudioElement | null = null;
  private latestSeSequence = 0;
  private latestVoiceSequence = 0;

  public constructor(private readonly options: TsuzuruHtmlAudioLayerOptions) {}

  public sync(runtimeState: RuntimeState): void {
    let audioState: ReturnType<typeof getStdAudioState>;
    try {
      audioState = getStdAudioState(runtimeState);
    } catch {
      return;
    }

    this.syncBgm(audioState.bgm?.assetId ?? null);
    this.syncSe(audioState.seEvents, audioState.nextSeSequence);
    this.syncVoice(audioState.voiceEvents, audioState.nextVoiceSequence);
  }

  public destroy(): void {
    stopAudio(this.bgmAudio);
    stopAudio(this.voiceAudio);
    this.bgmAudio = null;
    this.voiceAudio = null;
    this.bgmAssetId = null;
  }

  private syncBgm(assetId: string | null): void {
    if (assetId === null) {
      stopAudio(this.bgmAudio);
      this.bgmAudio = null;
      this.bgmAssetId = null;
      return;
    }

    if (this.bgmAssetId === assetId && this.bgmAudio !== null) {
      return;
    }

    stopAudio(this.bgmAudio);
    this.bgmAudio = null;
    this.bgmAssetId = assetId;

    const asset = this.resolveAudioAsset("bgm", assetId);
    if (asset === null) {
      return;
    }

    const audio = this.createAudio(asset.src, "BGM", assetId);
    if (audio === null) {
      return;
    }
    audio.loop = true;
    audio.volume = 1;
    this.bgmAudio = audio;
    void playAudio(audio, "BGM", assetId, this.options.notices);
  }

  private syncSe(
    events: readonly { readonly assetId: string; readonly sequence: number }[],
    nextSequence: number,
  ): void {
    if (events.length === 0 && nextSequence <= this.latestSeSequence) {
      this.latestSeSequence = nextSequence - 1;
    }

    for (const event of events) {
      if (event.sequence <= this.latestSeSequence) {
        continue;
      }
      this.latestSeSequence = event.sequence;
      const asset = this.resolveAudioAsset("se", event.assetId);
      if (asset === null) {
        continue;
      }
      const audio = this.createAudio(asset.src, "SE", `${event.assetId} #${event.sequence}`);
      if (audio === null) {
        continue;
      }
      audio.loop = false;
      audio.volume = 1;
      void playAudio(audio, "SE", `${event.assetId} #${event.sequence}`, this.options.notices);
    }
  }

  private syncVoice(
    events: readonly { readonly assetId: string; readonly sequence: number }[],
    nextSequence: number,
  ): void {
    if (events.length === 0 && nextSequence <= this.latestVoiceSequence) {
      this.latestVoiceSequence = nextSequence - 1;
    }

    for (const event of events) {
      if (event.sequence <= this.latestVoiceSequence) {
        continue;
      }
      this.latestVoiceSequence = event.sequence;
      const asset = this.resolveAudioAsset("voice", event.assetId);
      if (asset === null) {
        continue;
      }
      stopAudio(this.voiceAudio);
      const audio = this.createAudio(asset.src, "Voice", `${event.assetId} #${event.sequence}`);
      if (audio === null) {
        continue;
      }
      audio.loop = false;
      audio.volume = 1;
      this.voiceAudio = audio;
      void playAudio(audio, "Voice", `${event.assetId} #${event.sequence}`, this.options.notices);
    }
  }

  private resolveAudioAsset(kind: "bgm" | "se" | "voice", assetId: string): TsuzuruHtmlAssetEntry | null {
    const asset = this.options.assets?.audio[kind][assetId];
    if (asset !== undefined) {
      return asset;
    }

    this.options.notices.add(
      `audio:${kind}:missing:${assetId}`,
      `${audioKindLabel(kind)} audio asset is not mapped: ${assetId}`,
    );
    return null;
  }

  private createAudio(src: string, kind: string, label: string): TsuzuruHtmlAudioElement | null {
    const factory = this.options.audioFactory ?? defaultAudioFactory();
    if (factory === null) {
      this.options.notices.add("audio:factory:missing", "Browser Audio API is not available.");
      return null;
    }

    const audio = factory(src);
    audio.addEventListener?.("error", () => {
      this.options.notices.add(
        `audio:${kind}:file-error:${label}`,
        `${kind} audio file could not be loaded: ${label}`,
        audio.error,
      );
    });
    return audio;
  }
}

async function playAudio(
  audio: TsuzuruHtmlAudioElement,
  kind: string,
  label: string,
  notices: TsuzuruHtmlNoticeSink,
): Promise<void> {
  try {
    await audio.play();
  } catch (error) {
    notices.add(`audio:${kind}:playback:${label}`, `${kind} playback was blocked or failed: ${label}`, error);
  }
}

function stopAudio(audio: TsuzuruHtmlAudioElement | null): void {
  if (audio === null) {
    return;
  }
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers reject seeking before media metadata is available.
  }
}

function defaultAudioFactory(): TsuzuruHtmlAudioFactory | null {
  const AudioConstructor = globalThis.Audio;
  if (typeof AudioConstructor !== "function") {
    return null;
  }
  return (src) => new AudioConstructor(src);
}

function audioKindLabel(kind: "bgm" | "se" | "voice"): string {
  switch (kind) {
    case "bgm":
      return "BGM";
    case "se":
      return "SE";
    case "voice":
      return "Voice";
  }
}
