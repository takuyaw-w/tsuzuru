import type { StdAudioSeEvent, StdAudioVoiceEvent } from "@tsuzuru/plugin-std-audio";
import type { ComponentChildren } from "preact";

interface AudioStatusPanelProps {
  readonly bgmAssetId?: string | undefined;
  readonly latestSe?: StdAudioSeEvent | undefined;
  readonly latestVoice?: StdAudioVoiceEvent | undefined;
  readonly notices: readonly string[];
}

export function AudioStatusPanel({
  bgmAssetId,
  latestSe,
  latestVoice,
  notices,
}: AudioStatusPanelProps): ComponentChildren {
  const shouldShowStatus =
    bgmAssetId !== undefined || latestSe !== undefined || latestVoice !== undefined || notices.length > 0;
  if (!shouldShowStatus) {
    return null;
  }

  return (
    <aside className="audio-layer" aria-label="std-audio state">
      <div className="audio-layer__row">
        <span>BGM</span>
        <strong>{bgmAssetId ?? "none"}</strong>
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
