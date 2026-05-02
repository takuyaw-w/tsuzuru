import { useEffect, useRef, useState } from "preact/hooks";
import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import { bgmAssets, seAssets, voiceAssets } from "./assets.js";

interface AudioLayerProps {
  readonly runtimeState: RuntimeState;
}

interface Notice {
  readonly sequence: number;
  readonly message: string;
}

export function AudioLayer({ runtimeState }: AudioLayerProps) {
  const audioState = getStdAudioState(runtimeState);
  const [lastConsumedSeSequence, setLastConsumedSeSequence] = useState(0);
  const [lastConsumedVoiceSequence, setLastConsumedVoiceSequence] = useState(0);
  const [notices, setNotices] = useState<readonly Notice[]>([
    {
      sequence: 0,
      message: "Audio files are not bundled. Playback is best effort.",
    },
  ]);
  const noticeSequenceRef = useRef(1);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const latestSe = audioState.seEvents.at(-1);
  const latestVoice = audioState.voiceEvents.at(-1);

  const addNotice = (message: string) => {
    console.warn(`[standard-ui-preact example] ${message}`);
    const notice = { sequence: noticeSequenceRef.current, message };
    noticeSequenceRef.current += 1;
    setNotices((current) => [notice, ...current].slice(0, 4));
  };

  useEffect(() => {
    if (audioState.nextSeSequence === 1 && audioState.seEvents.length === 0) {
      setLastConsumedSeSequence(0);
    }
  }, [audioState.nextSeSequence, audioState.seEvents.length]);

  useEffect(() => {
    if (audioState.nextVoiceSequence === 1 && audioState.voiceEvents.length === 0) {
      setLastConsumedVoiceSequence(0);
    }
  }, [audioState.nextVoiceSequence, audioState.voiceEvents.length]);

  useEffect(() => {
    if (bgmRef.current !== null) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }

    if (audioState.bgm === null) {
      return;
    }

    const assetId = audioState.bgm.assetId;
    const path = resolveBgmPath(assetId);
    if (path === null) {
      addNotice(`Missing BGM asset mapping: ${assetId}`);
      return;
    }

    const element = new Audio(path);
    element.loop = true;
    element.addEventListener("error", () => {
      addNotice(`BGM could not be loaded: ${assetId} (${path})`);
    });
    bgmRef.current = element;
    void element.play().catch((error: unknown) => {
      addNotice(`BGM playback was rejected or failed: ${formatUnknownError(error)}`);
    });

    return () => {
      element.pause();
      if (bgmRef.current === element) {
        bgmRef.current = null;
      }
    };
  }, [audioState.bgm?.assetId]);

  useEffect(() => {
    const unconsumedEvents = audioState.seEvents.filter((event) => event.sequence > lastConsumedSeSequence);
    if (unconsumedEvents.length === 0) {
      return;
    }

    for (const event of unconsumedEvents) {
      const path = resolveSePath(event.assetId);
      if (path === null) {
        addNotice(`Missing SE asset mapping: ${event.assetId}`);
        continue;
      }
      playOneShot(path, `SE ${event.assetId}`, addNotice);
    }

    setLastConsumedSeSequence(Math.max(...unconsumedEvents.map((event) => event.sequence)));
  }, [audioState.seEvents, lastConsumedSeSequence]);

  useEffect(() => {
    const unconsumedEvents = audioState.voiceEvents.filter((event) => event.sequence > lastConsumedVoiceSequence);
    if (unconsumedEvents.length === 0) {
      return;
    }

    for (const event of unconsumedEvents) {
      const path = resolveVoicePath(event.assetId);
      if (path === null) {
        addNotice(`Missing Voice asset mapping: ${event.assetId}`);
        continue;
      }
      playOneShot(path, `Voice ${event.assetId}`, addNotice);
    }

    setLastConsumedVoiceSequence(Math.max(...unconsumedEvents.map((event) => event.sequence)));
  }, [audioState.voiceEvents, lastConsumedVoiceSequence]);

  return (
    <aside className="audio-layer" aria-label="std-audio layer">
      <div className="audio-layer__row">
        <span>BGM</span>
        <strong>{audioState.bgm?.assetId ?? "none"}</strong>
      </div>
      <div className="audio-layer__row">
        <span>Latest SE</span>
        <strong>{latestSe === undefined ? "none" : `${latestSe.assetId} #${latestSe.sequence}`}</strong>
      </div>
      <div className="audio-layer__row">
        <span>Latest Voice</span>
        <strong>{latestVoice === undefined ? "none" : `${latestVoice.assetId} #${latestVoice.sequence}`}</strong>
      </div>
      <div className="audio-layer__notice-list" aria-label="audio notices">
        {notices.map((notice) => (
          <p key={notice.sequence}>{notice.message}</p>
        ))}
      </div>
    </aside>
  );
}

function playOneShot(path: string, label: string, addNotice: (message: string) => void): void {
  const element = new Audio(path);
  element.addEventListener("error", () => {
    addNotice(`${label} could not be loaded: ${path}`);
  });
  void element.play().catch((error: unknown) => {
    addNotice(`${label} playback was rejected or failed: ${formatUnknownError(error)}`);
  });
}

function resolveBgmPath(assetId: string): string | null {
  return isBgmAssetId(assetId) ? bgmAssets[assetId] : null;
}

function resolveSePath(assetId: string): string | null {
  return isSeAssetId(assetId) ? seAssets[assetId] : null;
}

function resolveVoicePath(assetId: string): string | null {
  return isVoiceAssetId(assetId) ? voiceAssets[assetId] : null;
}

function isBgmAssetId(assetId: string): assetId is keyof typeof bgmAssets {
  return Object.hasOwn(bgmAssets, assetId);
}

function isSeAssetId(assetId: string): assetId is keyof typeof seAssets {
  return Object.hasOwn(seAssets, assetId);
}

function isVoiceAssetId(assetId: string): assetId is keyof typeof voiceAssets {
  return Object.hasOwn(voiceAssets, assetId);
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
