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

  useEffect(() => {
    callbacksRef.current = {
      ...(options.onCharacterReveal === undefined ? {} : { onCharacterReveal: options.onCharacterReveal }),
      ...(options.onComplete === undefined ? {} : { onComplete: options.onComplete }),
    };
  }, [options.onCharacterReveal, options.onComplete]);

  useEffect(() => {
    setVisibleCharacterCount(initialVisibleCharacterCount(text, shouldRevealOverTime));
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
        callbacksRef.current.onComplete?.();
      }
    }, delayMs);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [charactersPerSecond, shouldRevealOverTime, text, visibleCharacterCount]);

  const revealAll = useCallback(() => {
    setVisibleCharacterCount((current) => {
      if (current < text.length) {
        callbacksRef.current.onComplete?.();
      }
      return text.length;
    });
  }, [text]);

  const reset = useCallback(() => {
    setVisibleCharacterCount(initialVisibleCharacterCount(text, shouldRevealOverTime));
  }, [shouldRevealOverTime, text]);

  const visibleText = text.slice(0, visibleCharacterCount);
  return {
    visibleText,
    isComplete: visibleCharacterCount >= text.length,
    revealAll,
    reset,
  };
}

function initialVisibleCharacterCount(text: string, shouldRevealOverTime: boolean): number {
  return shouldRevealOverTime ? 0 : text.length;
}
