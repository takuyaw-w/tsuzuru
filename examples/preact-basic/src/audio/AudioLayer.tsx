import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import {
  createAudioAssetsWithVolume,
  StdAudioLayer,
  StdAudioStatusPanel,
  useStdAudioNotices,
} from "@tsuzuru/standard-ui-preact";
import { useMemo } from "preact/hooks";
import { assets } from "../../assets.js";
import type { ExamplePreferences } from "../preferences.js";

interface AudioLayerProps {
  readonly runtimeState: RuntimeState;
  readonly preferences: ExamplePreferences;
}

export function AudioLayer({ runtimeState, preferences }: AudioLayerProps) {
  const audioState = getStdAudioState(runtimeState);
  const latestSe = audioState.seEvents.at(-1);
  const latestVoice = audioState.voiceEvents.at(-1);
  const { notices, handleAudioDiagnostic } = useStdAudioNotices();
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
      <StdAudioStatusPanel
        className="audio-layer"
        bgmAssetId={audioState.bgm?.assetId}
        latestSe={latestSe}
        latestVoice={latestVoice}
        notices={notices}
      />
    </>
  );
}
