import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const DEFAULT_CHARACTERS_PER_SECOND = 30;

export interface UseTextRevealOptions {
  readonly enabled?: boolean;
  readonly charactersPerSecond?: number;
  readonly onCharacterReveal?: (event: TextRevealCharacterEvent) => void;
  readonly onComplete?: () => void;
}

export interface TextRevealCharacterEvent {
  readonly character: string;
  readonly index: number;
  readonly text: string;
}

export interface TextRevealState {
  readonly visibleText: string;
  readonly isComplete: boolean;
  readonly isRevealing: boolean;
  readonly revealAll: () => void;
  readonly reset: () => void;
}

export function useTextReveal(text: string, options: UseTextRevealOptions = {}): TextRevealState {
  const enabled = options.enabled ?? true;
  const charactersPerSecond = options.charactersPerSecond ?? DEFAULT_CHARACTERS_PER_SECOND;
  const shouldRevealOverTime = enabled && charactersPerSecond > 0;
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(() =>
    initialVisibleCharacterCount(text, shouldRevealOverTime),
  );
  const callbacksRef = useRef<{
    readonly onCharacterReveal?: (event: TextRevealCharacterEvent) => void;
    readonly onComplete?: () => void;
  }>({});
  const hasCompletedRef = useRef(!shouldRevealOverTime || text.length === 0);

  const completeCurrentReveal = useCallback(() => {
    if (hasCompletedRef.current) {
      return;
    }
    hasCompletedRef.current = true;
    callbacksRef.current.onComplete?.();
  }, []);

  useEffect(() => {
    callbacksRef.current = {
      ...(options.onCharacterReveal === undefined ? {} : { onCharacterReveal: options.onCharacterReveal }),
      ...(options.onComplete === undefined ? {} : { onComplete: options.onComplete }),
    };
  }, [options.onCharacterReveal, options.onComplete]);

  useEffect(() => {
    const nextVisibleCharacterCount = initialVisibleCharacterCount(text, shouldRevealOverTime);
    hasCompletedRef.current = nextVisibleCharacterCount >= text.length;
    setVisibleCharacterCount(nextVisibleCharacterCount);
  }, [text, shouldRevealOverTime]);

  useEffect(() => {
    if (!shouldRevealOverTime || visibleCharacterCount >= text.length) {
      return undefined;
    }

    const delayMs = 1000 / charactersPerSecond;
    const timeout = globalThis.setTimeout(() => {
      const nextIndex = visibleCharacterCount;
      const nextVisibleCharacterCount = Math.min(text.length, visibleCharacterCount + 1);
      callbacksRef.current.onCharacterReveal?.({
        character: text.charAt(nextIndex),
        index: nextIndex,
        text,
      });
      setVisibleCharacterCount(nextVisibleCharacterCount);
      if (nextVisibleCharacterCount >= text.length) {
        completeCurrentReveal();
      }
    }, delayMs);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [charactersPerSecond, completeCurrentReveal, shouldRevealOverTime, text, visibleCharacterCount]);

  const revealAll = useCallback(() => {
    setVisibleCharacterCount((current) => {
      if (current < text.length) {
        completeCurrentReveal();
      }
      return text.length;
    });
  }, [completeCurrentReveal, text]);

  const reset = useCallback(() => {
    const nextVisibleCharacterCount = initialVisibleCharacterCount(text, shouldRevealOverTime);
    hasCompletedRef.current = nextVisibleCharacterCount >= text.length;
    setVisibleCharacterCount(nextVisibleCharacterCount);
  }, [shouldRevealOverTime, text]);

  const visibleText = text.slice(0, visibleCharacterCount);
  const isComplete = visibleCharacterCount >= text.length;
  return {
    visibleText,
    isComplete,
    isRevealing: shouldRevealOverTime && !isComplete,
    revealAll,
    reset,
  };
}

function initialVisibleCharacterCount(text: string, shouldRevealOverTime: boolean): number {
  return shouldRevealOverTime ? 0 : text.length;
}
