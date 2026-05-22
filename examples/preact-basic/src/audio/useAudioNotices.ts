import type { StdAudioLayerDiagnostic } from "@tsuzuru/standard-ui-preact";
import { useCallback, useRef, useState } from "preact/hooks";

const MAX_AUDIO_NOTICE_COUNT = 3;

export interface AudioNoticesState {
  readonly notices: readonly string[];
  readonly handleAudioDiagnostic: (diagnostic: StdAudioLayerDiagnostic) => void;
}

export function useAudioNotices(): AudioNoticesState {
  const [notices, setNotices] = useState<readonly string[]>([]);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  const handleAudioDiagnostic = useCallback((diagnostic: StdAudioLayerDiagnostic) => {
    const key = `${diagnostic.code}:${diagnostic.channel}:${diagnostic.assetId}`;
    if (notifiedKeysRef.current.has(key)) {
      return;
    }
    notifiedKeysRef.current.add(key);
    setNotices((current) => [...current.slice(-(MAX_AUDIO_NOTICE_COUNT - 1)), diagnostic.message]);
    console.warn(diagnostic.message);
  }, []);

  return { notices, handleAudioDiagnostic };
}
