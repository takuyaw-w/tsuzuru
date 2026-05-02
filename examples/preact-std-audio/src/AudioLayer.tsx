import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { RuntimeState } from "@tsuzuru/core";
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";
import { bgmAssets, seAssets, voiceAssets } from "./assets.js";

interface AudioLayerProps {
  readonly runtimeState: RuntimeState;
}

interface Notice {
  readonly sequence: number;
  readonly message: string;
}

export function AudioLayer({ runtimeState }: AudioLayerProps) {
  const audioState = getStdAudioState(runtimeState);
  const [lastConsumedSeSequence, setLastConsumedSeSequence] = useState(0);
  const [lastConsumedVoiceSequence, setLastConsumedVoiceSequence] = useState(0);
  const [notices, setNotices] = useState<readonly Notice[]>([
    {
      sequence: 0,
      message: "Audio files are not bundled. Place your own files under public/assets/audio/...",
    },
  ]);
  const noticeSequenceRef = useRef(1);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const addNotice = (message: string) => {
    console.warn(`[preact-std-audio] ${message}`);
    const notice = { sequence: noticeSequenceRef.current, message };
    noticeSequenceRef.current += 1;
    setNotices((current) => [notice, ...current].slice(0, 6));
  };

  useEffect(() => {
    if (audioState.nextSeSequence === 1 && audioState.seEvents.length === 0) {
      setLastConsumedSeSequence(0);
    }
  }, [audioState.nextSeSequence, audioState.seEvents.length]);

  useEffect(() => {
    if (audioState.nextVoiceSequence === 1 && audioState.voiceEvents.length === 0) {
      setLastConsumedVoiceSequence(0);
    }
  }, [audioState.nextVoiceSequence, audioState.voiceEvents.length]);

  useEffect(() => {
    if (bgmRef.current !== null) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }

    if (audioState.bgm === null) {
      return;
    }

    const path = resolveBgmPath(audioState.bgm.assetId);
    if (path === null) {
      addNotice(`Missing BGM asset mapping: ${audioState.bgm.assetId}`);
      return;
    }

    const element = new Audio(path);
    element.loop = true;
    element.addEventListener("error", () => {
      addNotice(`BGM could not be loaded: ${audioState.bgm?.assetId} (${path})`);
    });
    bgmRef.current = element;
    void element.play().catch((error: unknown) => {
      addNotice(`BGM playback was rejected or failed: ${formatUnknownError(error)}`);
    });

    return () => {
      element.pause();
      if (bgmRef.current === element) {
        bgmRef.current = null;
      }
    };
  }, [audioState.bgm?.assetId]);

  useEffect(() => {
    const unconsumedEvents = audioState.seEvents.filter((event) => event.sequence > lastConsumedSeSequence);
    if (unconsumedEvents.length === 0) {
      return;
    }

    for (const event of unconsumedEvents) {
      const path = resolveSePath(event.assetId);
      if (path === null) {
        addNotice(`Missing SE asset mapping: ${event.assetId}`);
        continue;
      }
      playOneShot(path, `SE ${event.assetId}`, addNotice);
    }

    setLastConsumedSeSequence(Math.max(...unconsumedEvents.map((event) => event.sequence)));
  }, [audioState.seEvents, lastConsumedSeSequence]);

  useEffect(() => {
    const unconsumedEvents = audioState.voiceEvents.filter((event) => event.sequence > lastConsumedVoiceSequence);
    if (unconsumedEvents.length === 0) {
      return;
    }

    for (const event of unconsumedEvents) {
      const path = resolveVoicePath(event.assetId);
      if (path === null) {
        addNotice(`Missing Voice asset mapping: ${event.assetId}`);
        continue;
      }
      playOneShot(path, `Voice ${event.assetId}`, addNotice);
    }

    setLastConsumedVoiceSequence(Math.max(...unconsumedEvents.map((event) => event.sequence)));
  }, [audioState.voiceEvents, lastConsumedVoiceSequence]);

  return (
    <section className="audio-layer" aria-label="std-audio layer">
      <div className="audio-layer__header">
        <h2>std-audio state</h2>
        <p>Audio files are not bundled. Add your own files under public/assets/audio/.</p>
      </div>
      <div className="audio-layer__grid">
        <StatePanel title="Current BGM">
          {audioState.bgm === null ? (
            <p className="audio-layer__empty">null</p>
          ) : (
            <dl className="audio-layer__definition">
              <dt>assetId</dt>
              <dd>{audioState.bgm.assetId}</dd>
              <dt>path</dt>
              <dd>{resolveBgmPath(audioState.bgm.assetId) ?? "missing asset mapping"}</dd>
            </dl>
          )}
        </StatePanel>
        <StatePanel title="Sequences">
          <dl className="audio-layer__definition">
            <dt>nextSeSequence</dt>
            <dd>{audioState.nextSeSequence}</dd>
            <dt>nextVoiceSequence</dt>
            <dd>{audioState.nextVoiceSequence}</dd>
            <dt>consumed SE sequence</dt>
            <dd>{lastConsumedSeSequence}</dd>
            <dt>consumed Voice sequence</dt>
            <dd>{lastConsumedVoiceSequence}</dd>
          </dl>
        </StatePanel>
        <StatePanel title="SE Events">
          <EventList
            events={audioState.seEvents}
            lastConsumedSequence={lastConsumedSeSequence}
            resolvePath={resolveSePath}
          />
        </StatePanel>
        <StatePanel title="Voice Events">
          <EventList
            events={audioState.voiceEvents}
            lastConsumedSequence={lastConsumedVoiceSequence}
            resolvePath={resolveVoicePath}
          />
        </StatePanel>
      </div>
      <div className="audio-layer__notices" aria-label="audio notices">
        <h2>Notices</h2>
        <ul>
          {notices.map((notice) => (
            <li key={notice.sequence}>{notice.message}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

interface StatePanelProps {
  readonly title: string;
  readonly children: ComponentChildren;
}

function StatePanel({ title, children }: StatePanelProps) {
  return (
    <section className="audio-layer__panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

interface EventListProps {
  readonly events: readonly { readonly assetId: string; readonly sequence: number }[];
  readonly lastConsumedSequence: number;
  readonly resolvePath: (assetId: string) => string | null;
}

function EventList({ events, lastConsumedSequence, resolvePath }: EventListProps) {
  if (events.length === 0) {
    return <p className="audio-layer__empty">[]</p>;
  }

  return (
    <ol className="audio-layer__events">
      {events.map((event) => (
        <li key={event.sequence}>
          <span className="audio-layer__sequence">#{event.sequence}</span>
          <span>{event.assetId}</span>
          <span className={event.sequence <= lastConsumedSequence ? "audio-layer__badge" : "audio-layer__badge audio-layer__badge--pending"}>
            {event.sequence <= lastConsumedSequence ? "consumed" : "pending"}
          </span>
          <span className="audio-layer__path">{resolvePath(event.assetId) ?? "missing asset mapping"}</span>
        </li>
      ))}
    </ol>
  );
}

function playOneShot(path: string, label: string, addNotice: (message: string) => void): void {
  const element = new Audio(path);
  element.addEventListener("error", () => {
    addNotice(`${label} could not be loaded: ${path}`);
  });
  void element.play().catch((error: unknown) => {
    addNotice(`${label} playback was rejected or failed: ${formatUnknownError(error)}`);
  });
}

function resolveBgmPath(assetId: string): string | null {
  return isBgmAssetId(assetId) ? bgmAssets[assetId] : null;
}

function resolveSePath(assetId: string): string | null {
  return isSeAssetId(assetId) ? seAssets[assetId] : null;
}

function resolveVoicePath(assetId: string): string | null {
  return isVoiceAssetId(assetId) ? voiceAssets[assetId] : null;
}

function isBgmAssetId(assetId: string): assetId is keyof typeof bgmAssets {
  return Object.hasOwn(bgmAssets, assetId);
}

function isSeAssetId(assetId: string): assetId is keyof typeof seAssets {
  return Object.hasOwn(seAssets, assetId);
}

function isVoiceAssetId(assetId: string): assetId is keyof typeof voiceAssets {
  return Object.hasOwn(voiceAssets, assetId);
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
