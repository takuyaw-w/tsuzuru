import type { RuntimeState } from "@tsuzuru/core";
import { getStdEffectState, type StdEffectEvent } from "@tsuzuru/plugin-std-effect";
import { useEffect, useRef, useState } from "preact/hooks";

interface EffectLayerProps {
  readonly runtimeState: RuntimeState;
}

interface ActiveFlash {
  readonly sequence: number;
  readonly color: string;
  readonly durationMs: number;
}

type EffectTargetSelector = ".app__interaction-surface" | ".app__message-layer" | ".visual-layer__sprites";

export function EffectLayer({ runtimeState }: EffectLayerProps) {
  const effectState = getStdEffectState(runtimeState);
  const [flashes, setFlashes] = useState<readonly ActiveFlash[]>([]);
  const lastConsumedSequenceRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (effectState.events.length === 0 && effectState.nextSequence <= lastConsumedSequenceRef.current) {
      lastConsumedSequenceRef.current = effectState.nextSequence - 1;
    }

    for (const event of effectState.events) {
      if (event.sequence <= lastConsumedSequenceRef.current) {
        continue;
      }
      lastConsumedSequenceRef.current = event.sequence;
      if (event.type === "flash") {
        activateFlash(event);
      } else {
        activateElementEffect(event);
      }
    }
  }, [effectState.events, effectState.nextSequence]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  function activateFlash(event: Extract<StdEffectEvent, { readonly type: "flash" }>): void {
    setFlashes((current) => [
      ...current,
      { sequence: event.sequence, color: event.color, durationMs: event.durationMs },
    ]);
    const timer = window.setTimeout(
      () => {
        timersRef.current.delete(timer);
        setFlashes((current) => current.filter((flash) => flash.sequence !== event.sequence));
      },
      Math.max(1, event.durationMs),
    );
    timersRef.current.add(timer);
  }

  function activateElementEffect(event: Exclude<StdEffectEvent, { readonly type: "flash" }>): void {
    const selector = targetSelector(event.target);
    const element = document.querySelector<HTMLElement>(selector);
    if (element === null) {
      return;
    }

    const className = effectClassName(event);
    element.style.setProperty("--tzr-effect-duration", `${event.durationMs}ms`);
    if (event.type === "blur") {
      element.style.setProperty("--tzr-effect-blur-amount", `${event.amount}px`);
    }
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);

    const timer = window.setTimeout(
      () => {
        timersRef.current.delete(timer);
        element.classList.remove(className);
        element.style.removeProperty("--tzr-effect-duration");
        if (event.type === "blur") {
          element.style.removeProperty("--tzr-effect-blur-amount");
        }
      },
      Math.max(1, event.durationMs),
    );
    timersRef.current.add(timer);
  }

  if (flashes.length === 0) {
    return <div className="effect-layer" aria-hidden="true" />;
  }

  return (
    <div className="effect-layer" aria-hidden="true">
      {flashes.map((flash) => (
        <span
          key={flash.sequence}
          className="effect-layer__flash"
          style={{
            "--tzr-effect-duration": `${flash.durationMs}ms`,
            "--tzr-effect-flash-color": flash.color,
          }}
        />
      ))}
    </div>
  );
}

function targetSelector(target: Exclude<StdEffectEvent, { readonly type: "flash" }>["target"]): EffectTargetSelector {
  switch (target) {
    case "screen":
      return ".app__interaction-surface";
    case "message":
      return ".app__message-layer";
    case "sprites":
      return ".visual-layer__sprites";
  }
}

function effectClassName(event: Exclude<StdEffectEvent, { readonly type: "flash" }>): string {
  switch (event.type) {
    case "shake":
      return `std-effect--shake-${event.intensity}`;
    case "pulse":
      return `std-effect--pulse-${event.intensity}`;
    case "blur":
      return "std-effect--blur";
  }
}
