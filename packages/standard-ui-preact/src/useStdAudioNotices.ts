import { useCallback, useRef, useState } from "preact/hooks";
import type { StdAudioLayerDiagnostic } from "./std-audio-layer.js";

const DEFAULT_STD_AUDIO_NOTICE_COUNT = 3;

export interface StdAudioNoticesState {
  readonly notices: readonly string[];
  readonly handleAudioDiagnostic: (diagnostic: StdAudioLayerDiagnostic) => void;
}

export interface UseStdAudioNoticesOptions {
  readonly maxCount?: number | undefined;
  readonly onWarn?: ((message: string, diagnostic: StdAudioLayerDiagnostic) => void) | undefined;
}

export function useStdAudioNotices(options: UseStdAudioNoticesOptions = {}): StdAudioNoticesState {
  const [notices, setNotices] = useState<readonly string[]>([]);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const maxCount = Math.max(1, Math.floor(options.maxCount ?? DEFAULT_STD_AUDIO_NOTICE_COUNT));
  const onWarn = options.onWarn ?? warnAudioDiagnostic;

  const handleAudioDiagnostic = useCallback(
    (diagnostic: StdAudioLayerDiagnostic) => {
      const key = `${diagnostic.code}:${diagnostic.channel}:${diagnostic.assetId}`;
      if (notifiedKeysRef.current.has(key)) {
        return;
      }
      notifiedKeysRef.current.add(key);
      setNotices((current) => [...current.slice(-(maxCount - 1)), diagnostic.message]);
      onWarn(diagnostic.message, diagnostic);
    },
    [maxCount, onWarn],
  );

  return { notices, handleAudioDiagnostic };
}

function warnAudioDiagnostic(message: string): void {
  globalThis.console?.warn(message);
}
