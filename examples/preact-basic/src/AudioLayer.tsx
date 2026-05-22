import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import { StdAudioLayer, type StdAudioLayerDiagnostic, type TsuzuruGameAudioAsset } from "@tsuzuru/standard-ui-preact";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { assets } from "../assets.js";
import type { ExamplePreferences } from "./preferences.js";

interface AudioLayerProps {
  readonly runtimeState: RuntimeState;
  readonly preferences: ExamplePreferences;
}

type AudioAssetMap = Readonly<Record<string, string>>;

export function AudioLayer({ runtimeState, preferences }: AudioLayerProps) {
  const audioState = getStdAudioState(runtimeState);
  const latestSe = audioState.seEvents.at(-1);
  const latestVoice = audioState.voiceEvents.at(-1);
  const [notices, setNotices] = useState<readonly string[]>([]);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const bgmAssets = useMemo(() => withVolume(assets.audio.bgm, preferences.bgmVolume), [preferences.bgmVolume]);
  const seAssets = useMemo(() => withVolume(assets.audio.se, preferences.seVolume), [preferences.seVolume]);
  const voiceAssets = useMemo(() => withVolume(assets.audio.voice, preferences.voiceVolume), [preferences.voiceVolume]);

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
  const handleAudioDiagnostic = useCallback(
    (diagnostic: StdAudioLayerDiagnostic) => {
      addNotice(`${diagnostic.code}:${diagnostic.channel}:${diagnostic.assetId}`, diagnostic.message);
    },
    [addNotice],
  );
  const shouldShowStatus =
    audioState.bgm !== null || latestSe !== undefined || latestVoice !== undefined || notices.length > 0;

  return (
    <>
      <StdAudioLayer
        bgm={audioState.bgm}
        seEvents={audioState.seEvents}
        voiceEvents={audioState.voiceEvents}
        bgmAssets={bgmAssets}
        seAssets={seAssets}
        voiceAssets={voiceAssets}
        onDiagnostic={handleAudioDiagnostic}
      />
      {shouldShowStatus ? (
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
      ) : null}
    </>
  );
}

function withVolume(assets: AudioAssetMap, volume: number): Readonly<Record<string, TsuzuruGameAudioAsset>> {
  return Object.fromEntries(Object.entries(assets).map(([assetId, src]) => [assetId, { src, volume }]));
}
