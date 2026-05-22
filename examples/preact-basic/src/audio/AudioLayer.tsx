import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import { StdAudioLayer } from "@tsuzuru/standard-ui-preact";
import { useMemo } from "preact/hooks";
import { assets } from "../../assets.js";
import type { ExamplePreferences } from "../preferences.js";
import { AudioStatusPanel } from "./AudioStatusPanel.js";
import { createAudioAssetsWithVolume } from "./audio-assets.js";
import { useAudioNotices } from "./useAudioNotices.js";

interface AudioLayerProps {
  readonly runtimeState: RuntimeState;
  readonly preferences: ExamplePreferences;
}

export function AudioLayer({ runtimeState, preferences }: AudioLayerProps) {
  const audioState = getStdAudioState(runtimeState);
  const latestSe = audioState.seEvents.at(-1);
  const latestVoice = audioState.voiceEvents.at(-1);
  const { notices, handleAudioDiagnostic } = useAudioNotices();
  const bgmAssets = useMemo(
    () => createAudioAssetsWithVolume(assets.audio.bgm, preferences.bgmVolume),
    [preferences.bgmVolume],
  );
  const seAssets = useMemo(
    () => createAudioAssetsWithVolume(assets.audio.se, preferences.seVolume),
    [preferences.seVolume],
  );
  const voiceAssets = useMemo(
    () => createAudioAssetsWithVolume(assets.audio.voice, preferences.voiceVolume),
    [preferences.voiceVolume],
  );

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
      <AudioStatusPanel
        bgmAssetId={audioState.bgm?.assetId}
        latestSe={latestSe}
        latestVoice={latestVoice}
        notices={notices}
      />
    </>
  );
}
