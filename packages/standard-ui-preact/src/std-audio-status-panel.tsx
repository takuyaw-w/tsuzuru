import type { StdAudioSeEvent, StdAudioVoiceEvent } from "@tsuzuru/plugin-std-audio";
import type { ComponentChildren } from "preact";
import { joinClassNames } from "./class-name.js";

export interface StdAudioStatusPanelLabels {
  readonly panel: string;
  readonly bgm: string;
  readonly se: string;
  readonly voice: string;
  readonly none: string;
  readonly notices: string;
}

export interface StdAudioStatusPanelProps {
  readonly bgmAssetId?: string | undefined;
  readonly latestSe?: StdAudioSeEvent | undefined;
  readonly latestVoice?: StdAudioVoiceEvent | undefined;
  readonly notices?: readonly string[] | undefined;
  readonly labels?: Partial<StdAudioStatusPanelLabels> | undefined;
  readonly className?: string | undefined;
}

const DEFAULT_STD_AUDIO_STATUS_PANEL_LABELS = {
  panel: "std-audio state",
  bgm: "BGM",
  se: "SE",
  voice: "Voice",
  none: "none",
  notices: "Audio notices",
} satisfies StdAudioStatusPanelLabels;

export function StdAudioStatusPanel({
  bgmAssetId,
  latestSe,
  latestVoice,
  notices = [],
  labels,
  className,
}: StdAudioStatusPanelProps): ComponentChildren {
  const resolvedLabels = { ...DEFAULT_STD_AUDIO_STATUS_PANEL_LABELS, ...labels };
  const shouldShowStatus =
    bgmAssetId !== undefined || latestSe !== undefined || latestVoice !== undefined || notices.length > 0;
  if (!shouldShowStatus) {
    return null;
  }

  return (
    <aside className={joinClassNames("tzr-std-audio-status-panel", className)} aria-label={resolvedLabels.panel}>
      <div className="tzr-std-audio-status-panel__row">
        <span>{resolvedLabels.bgm}</span>
        <strong>{bgmAssetId ?? resolvedLabels.none}</strong>
      </div>
      <div className="tzr-std-audio-status-panel__row">
        <span>{resolvedLabels.se}</span>
        <strong>{latestSe === undefined ? resolvedLabels.none : `${latestSe.assetId} #${latestSe.sequence}`}</strong>
      </div>
      <div className="tzr-std-audio-status-panel__row">
        <span>{resolvedLabels.voice}</span>
        <strong>
          {latestVoice === undefined ? resolvedLabels.none : `${latestVoice.assetId} #${latestVoice.sequence}`}
        </strong>
      </div>
      {notices.length === 0 ? null : (
        <ul className="tzr-std-audio-status-panel__notices" aria-label={resolvedLabels.notices}>
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
