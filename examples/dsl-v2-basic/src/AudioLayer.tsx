import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";

interface AudioLayerProps {
  readonly runtimeState: RuntimeState;
}

export function AudioLayer({ runtimeState }: AudioLayerProps) {
  const audioState = getStdAudioState(runtimeState);
  const latestSe = audioState.seEvents.at(-1);
  const latestVoice = audioState.voiceEvents.at(-1);

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
    </aside>
  );
}
