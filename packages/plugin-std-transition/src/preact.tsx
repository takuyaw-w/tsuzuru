import type { RuntimeState } from "@tsuzuru/core";
import gsap from "gsap";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { getStdTransitionState, type StdTransitionEvent } from "./index.js";

export interface ScreenTransitionLayerProps {
  readonly runtimeState: RuntimeState;
  readonly className?: string;
  readonly style?: JSX.CSSProperties;
}

interface ActiveTransition {
  readonly event: StdTransitionEvent;
  readonly style?: JSX.CSSProperties;
}

export function ScreenTransitionLayer({ runtimeState, className, style }: ScreenTransitionLayerProps) {
  const transitionState = getStdTransitionState(runtimeState);
  const layerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const lastConsumedSequenceRef = useRef(0);
  const queueRef = useRef<StdTransitionEvent[]>([]);
  const activeTransitionRef = useRef<ActiveTransition | null>(null);
  const [activeTransition, setActiveTransition] = useState<ActiveTransition | null>(null);
  const isActive = activeTransition !== null;

  useEffect(() => {
    if (transitionState.events.length === 0 && transitionState.nextSequence <= lastConsumedSequenceRef.current) {
      lastConsumedSequenceRef.current = transitionState.nextSequence - 1;
    }

    const nextEvents = transitionState.events.filter((event) => event.sequence > lastConsumedSequenceRef.current);
    if (nextEvents.length === 0) {
      return;
    }

    lastConsumedSequenceRef.current = nextEvents[nextEvents.length - 1]?.sequence ?? lastConsumedSequenceRef.current;
    queueRef.current = [...queueRef.current, ...nextEvents];
    playNextQueuedTransition();
  }, [transitionState.events, transitionState.nextSequence]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const transition = activeTransition?.event;
    if (overlay === null || transition === undefined) {
      return undefined;
    }

    timelineRef.current?.kill();
    gsap.set(overlay, initialTransitionVars(transition));
    const timeline = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null;
        setCurrentTransition(null);
        playNextQueuedTransition();
      },
    });
    timelineRef.current = timeline;
    addTransitionAnimation(timeline, overlay, transition);

    return () => {
      timeline.kill();
      if (timelineRef.current === timeline) {
        timelineRef.current = null;
      }
    };
  }, [activeTransition]);

  useEffect(() => {
    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      queueRef.current = [];
      activeTransitionRef.current = null;
    };
  }, []);

  function playNextQueuedTransition(): void {
    if (timelineRef.current !== null || activeTransitionRef.current !== null) {
      return;
    }

    const [next, ...rest] = queueRef.current;
    if (next === undefined) {
      return;
    }
    queueRef.current = rest;
    const nextStyle = transitionOverlayStyle(next);
    setCurrentTransition({
      event: next,
      ...(nextStyle === undefined ? {} : { style: nextStyle }),
    });
  }

  function setCurrentTransition(transition: ActiveTransition | null): void {
    activeTransitionRef.current = transition;
    setActiveTransition(transition);
  }

  return (
    <div
      ref={layerRef}
      className={className}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        overflow: "hidden",
        pointerEvents: isActive ? "auto" : "none",
        ...style,
      }}
    >
      {activeTransition === null ? null : (
        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            background: activeTransition.event.color ?? "#000000",
            willChange: "opacity, transform",
            pointerEvents: "none",
            ...activeTransition.style,
          }}
        />
      )}
    </div>
  );
}

function addTransitionAnimation(timeline: gsap.core.Timeline, overlay: HTMLElement, event: StdTransitionEvent): void {
  const durationSeconds = Math.max(1, event.durationMs) / 1000;
  switch (event.effect) {
    case "fade":
    case "flash":
      timeline.to(overlay, { opacity: 1, duration: durationSeconds / 2 });
      timeline.to(overlay, { opacity: 0, duration: durationSeconds / 2 });
      return;
    case "wipe":
      timeline.to(overlay, {
        xPercent: 0,
        yPercent: 0,
        duration: durationSeconds / 2,
      });
      timeline.to(overlay, {
        ...wipeExitVars(event.direction ?? "left"),
        duration: durationSeconds / 2,
      });
      return;
  }
}

function initialTransitionVars(event: StdTransitionEvent): gsap.TweenVars {
  switch (event.effect) {
    case "fade":
    case "flash":
      return { opacity: 0, xPercent: 0, yPercent: 0 };
    case "wipe":
      return {
        opacity: 1,
        ...wipeEnterVars(event.direction ?? "left"),
      };
  }
}

function transitionOverlayStyle(event: StdTransitionEvent): JSX.CSSProperties | undefined {
  if (event.effect !== "wipe") {
    return undefined;
  }

  switch (event.direction ?? "left") {
    case "left":
    case "right":
      return { width: "100%", height: "100%" };
    case "up":
    case "down":
      return { width: "100%", height: "100%" };
  }
}

function wipeEnterVars(direction: NonNullable<StdTransitionEvent["direction"]>): gsap.TweenVars {
  switch (direction) {
    case "left":
      return { xPercent: -100, yPercent: 0 };
    case "right":
      return { xPercent: 100, yPercent: 0 };
    case "up":
      return { xPercent: 0, yPercent: -100 };
    case "down":
      return { xPercent: 0, yPercent: 100 };
  }
}

function wipeExitVars(direction: NonNullable<StdTransitionEvent["direction"]>): gsap.TweenVars {
  switch (direction) {
    case "left":
      return { xPercent: 100, yPercent: 0 };
    case "right":
      return { xPercent: -100, yPercent: 0 };
    case "up":
      return { xPercent: 0, yPercent: 100 };
    case "down":
      return { xPercent: 0, yPercent: -100 };
  }
}
