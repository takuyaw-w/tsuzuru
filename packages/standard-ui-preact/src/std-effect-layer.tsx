import type { StdEffectEvent, StdEffectTarget } from "@tsuzuru/plugin-std-effect";
import type { ComponentChildren, ComponentProps } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { joinClassNames } from "./class-name.js";

type SpanStyle = Extract<NonNullable<ComponentProps<"span">["style"]>, object>;
type EffectTimer = ReturnType<typeof setTimeout>;
type EffectCleanup = () => void;

export type StdEffectLayerTargetSelectors = Partial<Record<StdEffectTarget, string>>;

export interface StdEffectLayerDiagnostic {
  readonly code: string;
  readonly event: StdEffectEvent;
  readonly message: string;
}

export interface StdEffectLayerProps {
  readonly events?: readonly StdEffectEvent[] | undefined;
  readonly nextSequence?: number | undefined;
  readonly targetSelectors?: StdEffectLayerTargetSelectors | undefined;
  readonly className?: string | undefined;
  readonly onDiagnostic?: ((diagnostic: StdEffectLayerDiagnostic) => void) | undefined;
}

interface ActiveFlash {
  readonly sequence: number;
  readonly color: string;
  readonly durationMs: number;
}

const EMPTY_EFFECT_EVENTS: readonly StdEffectEvent[] = [];
const DEFAULT_TARGET_SELECTORS = {
  screen: ".tzr-tsuzuru-game__interaction-surface",
  message: ".tzr-tsuzuru-game__message-layer",
  sprites: ".tzr-tsuzuru-game__sprite-layer",
} satisfies Required<StdEffectLayerTargetSelectors>;

export const STD_EFFECT_TARGET_NOT_FOUND_DIAGNOSTIC_CODE = "standardUi.effectTargetNotFound";

export function StdEffectLayer({
  events = EMPTY_EFFECT_EVENTS,
  nextSequence,
  targetSelectors,
  className,
  onDiagnostic,
}: StdEffectLayerProps): ComponentChildren {
  const [flashes, setFlashes] = useState<readonly ActiveFlash[]>([]);
  const lastConsumedSequenceRef = useRef(0);
  const timersRef = useRef<Set<EffectTimer>>(new Set());
  const cleanupsRef = useRef<Set<EffectCleanup>>(new Set());

  useEffect(() => {
    const maxSequence = events.reduce((current, event) => Math.max(current, event.sequence), 0);
    if (events.length === 0 && nextSequence !== undefined && nextSequence <= lastConsumedSequenceRef.current) {
      lastConsumedSequenceRef.current = nextSequence - 1;
    } else if (maxSequence < lastConsumedSequenceRef.current && nextSequence === undefined) {
      lastConsumedSequenceRef.current = 0;
    }

    for (const event of events) {
      if (event.sequence <= lastConsumedSequenceRef.current) {
        continue;
      }
      lastConsumedSequenceRef.current = Math.max(lastConsumedSequenceRef.current, event.sequence);
      if (event.type === "flash") {
        activateFlash(event, timersRef.current, cleanupsRef.current, setFlashes);
      } else {
        activateTargetEffect(event, targetSelectors, timersRef.current, cleanupsRef.current, onDiagnostic);
      }
    }
  }, [events, nextSequence, onDiagnostic, targetSelectors]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        clearEffectTimeout(timer);
      }
      timersRef.current.clear();
      for (const cleanup of cleanupsRef.current) {
        cleanup();
      }
      cleanupsRef.current.clear();
    };
  }, []);

  return (
    <div className={joinClassNames("tzr-std-effect-layer", className)} aria-hidden="true">
      {flashes.map((flash) => (
        <span
          key={flash.sequence}
          className="tzr-std-effect-layer__flash"
          style={
            {
              "--tzr-effect-duration": `${flash.durationMs}ms`,
              "--tzr-effect-flash-color": flash.color,
            } as SpanStyle
          }
        />
      ))}
    </div>
  );
}

function activateFlash(
  event: Extract<StdEffectEvent, { readonly type: "flash" }>,
  timers: Set<EffectTimer>,
  cleanups: Set<EffectCleanup>,
  setFlashes: (updater: (current: readonly ActiveFlash[]) => readonly ActiveFlash[]) => void,
): void {
  setFlashes((current) => [...current, { sequence: event.sequence, color: event.color, durationMs: event.durationMs }]);

  const cleanup = () => {
    cleanups.delete(cleanup);
    setFlashes((current) => current.filter((flash) => flash.sequence !== event.sequence));
  };
  cleanups.add(cleanup);
  const timer = setEffectTimeout(() => {
    timers.delete(timer);
    cleanup();
  }, event.durationMs);
  timers.add(timer);
}

function activateTargetEffect(
  event: Exclude<StdEffectEvent, { readonly type: "flash" }>,
  targetSelectors: StdEffectLayerTargetSelectors | undefined,
  timers: Set<EffectTimer>,
  cleanups: Set<EffectCleanup>,
  onDiagnostic: ((diagnostic: StdEffectLayerDiagnostic) => void) | undefined,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const selector = targetSelector(event.target, targetSelectors);
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) {
    onDiagnostic?.({
      code: STD_EFFECT_TARGET_NOT_FOUND_DIAGNOSTIC_CODE,
      event,
      message: `Effect target "${event.target}" was not found for selector "${selector}".`,
    });
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

  const cleanup = () => {
    cleanups.delete(cleanup);
    element.classList.remove(className);
    element.style.removeProperty("--tzr-effect-duration");
    if (event.type === "blur") {
      element.style.removeProperty("--tzr-effect-blur-amount");
    }
  };
  cleanups.add(cleanup);
  const timer = setEffectTimeout(() => {
    timers.delete(timer);
    cleanup();
  }, event.durationMs);
  timers.add(timer);
}

function targetSelector(target: StdEffectTarget, targetSelectors: StdEffectLayerTargetSelectors | undefined): string {
  return targetSelectors?.[target] ?? DEFAULT_TARGET_SELECTORS[target];
}

function effectClassName(event: Exclude<StdEffectEvent, { readonly type: "flash" }>): string {
  switch (event.type) {
    case "shake":
      return `tzr-std-effect--shake-${event.intensity}`;
    case "pulse":
      return `tzr-std-effect--pulse-${event.intensity}`;
    case "blur":
      return "tzr-std-effect--blur";
  }
}

function setEffectTimeout(callback: () => void, durationMs: number): EffectTimer {
  const delay = Math.max(1, durationMs);
  if (typeof window !== "undefined") {
    return window.setTimeout(callback, delay);
  }
  return setTimeout(callback, delay);
}

function clearEffectTimeout(timer: EffectTimer): void {
  if (typeof window !== "undefined") {
    window.clearTimeout(timer);
    return;
  }
  clearTimeout(timer);
}
