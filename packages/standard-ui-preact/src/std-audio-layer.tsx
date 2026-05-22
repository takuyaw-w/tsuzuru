import type { StdAudioBgm, StdAudioSeEvent, StdAudioVoiceEvent } from "@tsuzuru/plugin-std-audio";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { type ResolvedAudioAsset, resolveAudioAsset, type TsuzuruGameAudioAsset } from "./assets.js";

export type StdAudioLayerChannel = "BGM" | "SE" | "Voice";

export interface StdAudioLayerDiagnostic {
  readonly code: string;
  readonly channel: StdAudioLayerChannel;
  readonly assetId: string;
  readonly message: string;
}

export interface StdAudioLayerProps {
  readonly bgm?: StdAudioBgm | null | undefined;
  readonly seEvents?: readonly StdAudioSeEvent[] | undefined;
  readonly voiceEvents?: readonly StdAudioVoiceEvent[] | undefined;
  readonly bgmAssets?: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined;
  readonly seAssets?: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined;
  readonly voiceAssets?: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined;
  readonly onDiagnostic?: ((diagnostic: StdAudioLayerDiagnostic) => void) | undefined;
}

export const STD_AUDIO_MISSING_DIAGNOSTIC_CODE = "standardUi.audioAssetMissing";
export const STD_AUDIO_PLAYBACK_DIAGNOSTIC_CODE = "standardUi.audioPlaybackFailed";

const EMPTY_SE_EVENTS: readonly StdAudioSeEvent[] = [];
const EMPTY_VOICE_EVENTS: readonly StdAudioVoiceEvent[] = [];

export function StdAudioLayer({
  bgm,
  seEvents,
  voiceEvents,
  bgmAssets,
  seAssets,
  voiceAssets,
  onDiagnostic,
}: StdAudioLayerProps): ComponentChildren {
  useBgmAudio(bgm?.assetId, bgmAssets, onDiagnostic);
  useOneShotAudioEvents(seEvents ?? EMPTY_SE_EVENTS, seAssets, "SE", onDiagnostic);
  useOneShotAudioEvents(voiceEvents ?? EMPTY_VOICE_EVENTS, voiceAssets, "Voice", onDiagnostic);

  return null;
}

function useBgmAudio(
  assetId: string | undefined,
  assets: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined,
  onDiagnostic: ((diagnostic: StdAudioLayerDiagnostic) => void) | undefined,
): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;

    if (assetId === undefined) {
      return;
    }

    const resolved = resolveAudioAsset(assets, assetId);
    if (resolved === null) {
      onDiagnostic?.({
        code: STD_AUDIO_MISSING_DIAGNOSTIC_CODE,
        channel: "BGM",
        assetId,
        message: `Missing BGM audio asset "${assetId}".`,
      });
      return;
    }
    if (typeof Audio === "undefined") {
      return;
    }

    const audio = new Audio(resolved.src);
    audio.loop = true;
    audio.volume = resolved.volume ?? 1;
    audioRef.current = audio;
    void audio.play().catch(() => {
      onDiagnostic?.({
        code: STD_AUDIO_PLAYBACK_DIAGNOSTIC_CODE,
        channel: "BGM",
        assetId,
        message: `BGM playback was blocked or failed: ${assetId}.`,
      });
    });

    return () => {
      audio.pause();
    };
  }, [assetId, assets, onDiagnostic]);
}

function useOneShotAudioEvents(
  events: readonly (StdAudioSeEvent | StdAudioVoiceEvent)[],
  assets: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined,
  channel: "SE" | "Voice",
  onDiagnostic: ((diagnostic: StdAudioLayerDiagnostic) => void) | undefined,
): void {
  const lastSequenceRef = useRef(0);

  useEffect(() => {
    const maxSequence = events.reduce((current, event) => Math.max(current, event.sequence), 0);
    if (maxSequence < lastSequenceRef.current) {
      lastSequenceRef.current = 0;
    }

    for (const event of events) {
      if (event.sequence <= lastSequenceRef.current) {
        continue;
      }

      const resolved = resolveAudioAsset(assets, event.assetId);
      if (resolved === null) {
        onDiagnostic?.({
          code: STD_AUDIO_MISSING_DIAGNOSTIC_CODE,
          channel,
          assetId: event.assetId,
          message: `Missing ${channel} audio asset "${event.assetId}".`,
        });
        continue;
      }

      playOneShotAudio(resolved, channel, event.assetId, onDiagnostic);
    }

    lastSequenceRef.current = maxSequence;
  }, [assets, events, channel, onDiagnostic]);
}

function playOneShotAudio(
  asset: ResolvedAudioAsset,
  channel: "SE" | "Voice",
  assetId: string,
  onDiagnostic: ((diagnostic: StdAudioLayerDiagnostic) => void) | undefined,
): void {
  if (typeof Audio === "undefined") {
    return;
  }

  const audio = new Audio(asset.src);
  audio.volume = asset.volume ?? 1;
  void audio.play().catch(() => {
    onDiagnostic?.({
      code: STD_AUDIO_PLAYBACK_DIAGNOSTIC_CODE,
      channel,
      assetId,
      message: `${channel} playback was blocked or failed: ${assetId}.`,
    });
  });
}
