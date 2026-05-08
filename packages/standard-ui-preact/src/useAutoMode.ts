import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const DEFAULT_AUTO_MODE_DELAY_MS = 1200;

export interface UseAutoModeOptions {
  readonly canAdvance: boolean;
  readonly onAdvance: () => void;
  readonly delayMs?: number;
}

export interface AutoModeState {
  readonly enabled: boolean;
  readonly setEnabled: (enabled: boolean) => void;
  readonly toggle: () => void;
}

export function useAutoMode(options: UseAutoModeOptions): AutoModeState {
  const delayMs = options.delayMs ?? DEFAULT_AUTO_MODE_DELAY_MS;
  const [enabled, setEnabled] = useState(false);
  const onAdvanceRef = useRef(options.onAdvance);

  useEffect(() => {
    onAdvanceRef.current = options.onAdvance;
  }, [options.onAdvance]);

  // Refresh the timer after every render so host-derived presentation changes can clear pending advances.
  useEffect(() => {
    if (!enabled || !options.canAdvance) {
      return undefined;
    }

    const timer = globalThis.setTimeout(() => {
      onAdvanceRef.current();
    }, delayMs);

    return () => {
      globalThis.clearTimeout(timer);
    };
  });

  const toggle = useCallback(() => {
    setEnabled((current) => !current);
  }, []);

  return {
    enabled,
    setEnabled,
    toggle,
  };
}
