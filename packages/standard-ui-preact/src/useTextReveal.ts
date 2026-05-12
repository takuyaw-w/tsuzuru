import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const DEFAULT_CHARACTERS_PER_SECOND = 30;

export interface UseTextRevealOptions {
  readonly enabled?: boolean;
  readonly charactersPerSecond?: number;
  readonly resetKey?: unknown;
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

interface TextRevealProgress {
  readonly text: string;
  readonly resetKey: unknown;
  readonly shouldRevealOverTime: boolean;
  readonly visibleCharacterCount: number;
}

export function useTextReveal(text: string, options: UseTextRevealOptions = {}): TextRevealState {
  const enabled = options.enabled ?? true;
  const charactersPerSecond = options.charactersPerSecond ?? DEFAULT_CHARACTERS_PER_SECOND;
  const resetKey = options.resetKey;
  const shouldRevealOverTime = enabled && charactersPerSecond > 0;
  const [progress, setProgress] = useState<TextRevealProgress>(() =>
    createInitialProgress(text, resetKey, shouldRevealOverTime),
  );
  const shouldResetProgress =
    progress.text !== text ||
    !Object.is(progress.resetKey, resetKey) ||
    progress.shouldRevealOverTime !== shouldRevealOverTime;
  const visibleCharacterCount = shouldResetProgress
    ? initialVisibleCharacterCount(text, shouldRevealOverTime)
    : progress.visibleCharacterCount;
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
    if (!shouldResetProgress) {
      return;
    }
    const nextProgress = createInitialProgress(text, resetKey, shouldRevealOverTime);
    hasCompletedRef.current = nextProgress.visibleCharacterCount >= text.length;
    setProgress(nextProgress);
  }, [resetKey, shouldResetProgress, shouldRevealOverTime, text]);

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
      setProgress({
        text,
        resetKey,
        shouldRevealOverTime,
        visibleCharacterCount: nextVisibleCharacterCount,
      });
      if (nextVisibleCharacterCount >= text.length) {
        completeCurrentReveal();
      }
    }, delayMs);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [charactersPerSecond, completeCurrentReveal, resetKey, shouldRevealOverTime, text, visibleCharacterCount]);

  const revealAll = useCallback(() => {
    setProgress((current) => {
      const currentVisibleCharacterCount = shouldResetProgress ? visibleCharacterCount : current.visibleCharacterCount;
      if (currentVisibleCharacterCount < text.length) {
        completeCurrentReveal();
      }
      return {
        text,
        resetKey,
        shouldRevealOverTime,
        visibleCharacterCount: text.length,
      };
    });
  }, [completeCurrentReveal, resetKey, shouldResetProgress, shouldRevealOverTime, text, visibleCharacterCount]);

  const reset = useCallback(() => {
    const nextProgress = createInitialProgress(text, resetKey, shouldRevealOverTime);
    hasCompletedRef.current = nextProgress.visibleCharacterCount >= text.length;
    setProgress(nextProgress);
  }, [resetKey, shouldRevealOverTime, text]);

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

function createInitialProgress(text: string, resetKey: unknown, shouldRevealOverTime: boolean): TextRevealProgress {
  return {
    text,
    resetKey,
    shouldRevealOverTime,
    visibleCharacterCount: initialVisibleCharacterCount(text, shouldRevealOverTime),
  };
}

function initialVisibleCharacterCount(text: string, shouldRevealOverTime: boolean): number {
  return shouldRevealOverTime ? 0 : text.length;
}
