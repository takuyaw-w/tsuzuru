import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { bgmAssets, seAssets, voiceAssets } from "./audio-assets.js";
import type { ExamplePreferences } from "./preferences.js";

interface AudioLayerProps {
  readonly runtimeState: RuntimeState;
  readonly preferences: ExamplePreferences;
}

type AudioAssetMap = Readonly<Record<string, string>>;
type AudioNoticeKind = "BGM" | "SE" | "Voice";

export function AudioLayer({ runtimeState, preferences }: AudioLayerProps) {
  const audioState = getStdAudioState(runtimeState);
  const latestSe = audioState.seEvents.at(-1);
  const latestVoice = audioState.voiceEvents.at(-1);
  const [notices, setNotices] = useState<readonly string[]>([]);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAssetIdRef = useRef<string | null>(null);
  const bgmVolumeRef = useRef(preferences.bgmVolume);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const latestSeSequenceRef = useRef(0);
  const latestVoiceSequenceRef = useRef(0);

  const addNotice = useCallback((key: string, message: string, detail?: unknown) => {
    if (notifiedKeysRef.current.has(key)) {
      return;
    }
    notifiedKeysRef.current.add(key);
    setNotices((current) => [...current.slice(-2), message]);
    if (detail === undefined) {
      console.warn(message);
    } else {
      console.warn(message, detail);
    }
  }, []);

  useEffect(() => {
    bgmVolumeRef.current = preferences.bgmVolume;
    if (bgmAudioRef.current !== null) {
      bgmAudioRef.current.volume = preferences.bgmVolume;
    }
  }, [preferences.bgmVolume]);

  useEffect(() => {
    if (voiceAudioRef.current !== null) {
      voiceAudioRef.current.volume = preferences.voiceVolume;
    }
  }, [preferences.voiceVolume]);

  useEffect(() => {
    const assetId = audioState.bgm?.assetId ?? null;

    if (assetId === null) {
      stopAudio(bgmAudioRef.current);
      bgmAudioRef.current = null;
      bgmAssetIdRef.current = null;
      return;
    }

    if (bgmAssetIdRef.current === assetId && bgmAudioRef.current !== null) {
      return;
    }

    stopAudio(bgmAudioRef.current);
    bgmAudioRef.current = null;
    bgmAssetIdRef.current = assetId;

    const src = resolveAudioAssetUrl(bgmAssets, "BGM", assetId, addNotice);
    if (src === null) {
      return;
    }

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = bgmVolumeRef.current;
    audio.addEventListener("error", () => {
      addNotice(
        `BGM:file-error:${assetId}`,
        `BGM audio file could not be loaded: ${assetId}`,
        audio.error ?? undefined,
      );
    });
    bgmAudioRef.current = audio;
    void playAudio(audio, "BGM", assetId, addNotice);

    return () => {
      stopAudio(audio);
      if (bgmAudioRef.current === audio) {
        bgmAudioRef.current = null;
      }
      if (bgmAssetIdRef.current === assetId) {
        bgmAssetIdRef.current = null;
      }
    };
  }, [addNotice, audioState.bgm?.assetId]);

  useEffect(() => {
    if (audioState.seEvents.length === 0 && audioState.nextSeSequence <= latestSeSequenceRef.current) {
      latestSeSequenceRef.current = audioState.nextSeSequence - 1;
    }

    for (const event of audioState.seEvents) {
      if (event.sequence <= latestSeSequenceRef.current) {
        continue;
      }
      latestSeSequenceRef.current = event.sequence;
      const src = resolveAudioAssetUrl(seAssets, "SE", event.assetId, addNotice);
      if (src === null) {
        continue;
      }
      const audio = new Audio(src);
      audio.volume = preferences.seVolume;
      audio.addEventListener("error", () => {
        addNotice(
          `SE:file-error:${event.assetId}:${event.sequence}`,
          `SE audio file could not be loaded: ${event.assetId} #${event.sequence}`,
          audio.error ?? undefined,
        );
      });
      void playAudio(audio, "SE", `${event.assetId} #${event.sequence}`, addNotice);
    }
  }, [addNotice, audioState.nextSeSequence, audioState.seEvents, preferences.seVolume]);

  useEffect(() => {
    if (audioState.voiceEvents.length === 0 && audioState.nextVoiceSequence <= latestVoiceSequenceRef.current) {
      latestVoiceSequenceRef.current = audioState.nextVoiceSequence - 1;
    }

    for (const event of audioState.voiceEvents) {
      if (event.sequence <= latestVoiceSequenceRef.current) {
        continue;
      }
      latestVoiceSequenceRef.current = event.sequence;
      const src = resolveAudioAssetUrl(voiceAssets, "Voice", event.assetId, addNotice);
      if (src === null) {
        continue;
      }
      stopAudio(voiceAudioRef.current);
      const audio = new Audio(src);
      audio.volume = preferences.voiceVolume;
      audio.addEventListener("error", () => {
        addNotice(
          `Voice:file-error:${event.assetId}:${event.sequence}`,
          `Voice audio file could not be loaded: ${event.assetId} #${event.sequence}`,
          audio.error ?? undefined,
        );
      });
      voiceAudioRef.current = audio;
      void playAudio(audio, "Voice", `${event.assetId} #${event.sequence}`, addNotice);
    }
  }, [addNotice, audioState.nextVoiceSequence, audioState.voiceEvents, preferences.voiceVolume]);

  useEffect(() => {
    return () => {
      stopAudio(bgmAudioRef.current);
      stopAudio(voiceAudioRef.current);
    };
  }, []);

  if (audioState.bgm === null && latestSe === undefined && latestVoice === undefined && notices.length === 0) {
    return null;
  }

  return (
    <aside className="audio-layer" aria-label="std-audio state">
      <div className="audio-layer__row">
        <span>BGM</span>
        <strong>{audioState.bgm?.assetId ?? "none"}</strong>
      </div>
      <div className="audio-layer__row">
        <span>SE</span>
        <strong>{latestSe === undefined ? "none" : `${latestSe.assetId} #${latestSe.sequence}`}</strong>
      </div>
      <div className="audio-layer__row">
        <span>Voice</span>
        <strong>{latestVoice === undefined ? "none" : `${latestVoice.assetId} #${latestVoice.sequence}`}</strong>
      </div>
      {notices.length === 0 ? null : (
        <ul className="audio-layer__notices" aria-label="Audio notices">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function resolveAudioAssetUrl(
  assets: AudioAssetMap,
  kind: AudioNoticeKind,
  assetId: string,
  addNotice: (key: string, message: string, detail?: unknown) => void,
): string | null {
  const url = assets[assetId];
  if (url !== undefined) {
    return url;
  }

  addNotice(`${kind}:missing-map:${assetId}`, `${kind} audio asset is not mapped: ${assetId}`);
  return null;
}

async function playAudio(
  audio: HTMLAudioElement,
  kind: AudioNoticeKind,
  label: string,
  addNotice: (key: string, message: string, detail?: unknown) => void,
): Promise<void> {
  try {
    await audio.play();
  } catch (error) {
    addNotice(`${kind}:play-blocked:${label}`, `${kind} playback was blocked or failed: ${label}`, error);
  }
}

function stopAudio(audio: HTMLAudioElement | null): void {
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
