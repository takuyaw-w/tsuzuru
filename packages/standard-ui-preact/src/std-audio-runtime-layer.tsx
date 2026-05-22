import type { StdAudioState } from "@tsuzuru/plugin-std-audio";
import type { ComponentChildren } from "preact";
import { useCallback } from "preact/hooks";
import type { TsuzuruGameAudioAsset } from "./assets.js";
import { StdAudioLayer, type StdAudioLayerDiagnostic } from "./std-audio-layer.js";
import { StdAudioStatusPanel, type StdAudioStatusPanelLabels } from "./std-audio-status-panel.js";
import { type UseStdAudioNoticesOptions, useStdAudioNotices } from "./useStdAudioNotices.js";

export interface StdAudioRuntimeLayerProps {
  readonly audioState: StdAudioState;
  readonly bgmAssets?: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined;
  readonly seAssets?: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined;
  readonly voiceAssets?: Readonly<Record<string, TsuzuruGameAudioAsset>> | undefined;
  readonly showStatus?: boolean | undefined;
  readonly statusPanelClassName?: string | undefined;
  readonly statusPanelLabels?: Partial<StdAudioStatusPanelLabels> | undefined;
  readonly noticeOptions?: UseStdAudioNoticesOptions | undefined;
  readonly onDiagnostic?: ((diagnostic: StdAudioLayerDiagnostic) => void) | undefined;
}

export function StdAudioRuntimeLayer({
  audioState,
  bgmAssets,
  seAssets,
  voiceAssets,
  showStatus = true,
  statusPanelClassName,
  statusPanelLabels,
  noticeOptions,
  onDiagnostic,
}: StdAudioRuntimeLayerProps): ComponentChildren {
  const latestSe = audioState.seEvents.at(-1);
  const latestVoice = audioState.voiceEvents.at(-1);
  const { notices, handleAudioDiagnostic } = useStdAudioNotices(noticeOptions);
  const handleDiagnostic = useCallback(
    (diagnostic: StdAudioLayerDiagnostic) => {
      handleAudioDiagnostic(diagnostic);
      onDiagnostic?.(diagnostic);
    },
    [handleAudioDiagnostic, onDiagnostic],
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
        onDiagnostic={handleDiagnostic}
      />
      {showStatus ? (
        <StdAudioStatusPanel
          className={statusPanelClassName}
          bgmAssetId={audioState.bgm?.assetId}
          latestSe={latestSe}
          latestVoice={latestVoice}
          notices={notices}
          labels={statusPanelLabels}
        />
      ) : null}
    </>
  );
}
