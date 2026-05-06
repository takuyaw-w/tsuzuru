import type { CompiledTzrDocument, RuntimeDiagnostic, RuntimeEvent, RuntimePluginDefinition } from "@tsuzuru/core";
import { createStdAudioCommandHandlers, createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { getRenderableRuntimeEvent, useRuntime } from "@tsuzuru/preact";
import {
  ChoiceLayer,
  GameShell,
  GameViewport,
  type MessageWindowRenderLineContext,
  RuntimeMessageLayer,
  useTextReveal,
} from "@tsuzuru/standard-ui-preact";
import type { ComponentChildren, ComponentProps } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AudioLayer } from "./AudioLayer.js";
import { scenarioProject } from "./scenario.js";
import { BacklogScreen } from "./screens/BacklogScreen.js";
import { GalleryScreen } from "./screens/GalleryScreen.js";
import { LoadScreen } from "./screens/LoadScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";
import { TitleScreen } from "./screens/TitleScreen.js";
import { VisualLayer } from "./VisualLayer.js";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };
type DivClickHandler = NonNullable<ComponentProps<"div">["onClick"]>;
type AppScreen = "title" | "runtime" | "load" | "settings" | "backlog" | "gallery";

export function App() {
  const documentResult = useMemo((): DocumentResult => {
    if (!scenarioProject.ok) {
      return { ok: false, message: formatDiagnostics(scenarioProject.errors) };
    }
    return { ok: true, document: scenarioProject.document };
  }, []);
  const [screen, setScreen] = useState<AppScreen>("title");

  if (!documentResult.ok) {
    return <pre className="app app--error">{documentResult.message}</pre>;
  }

  if (screen === "runtime") {
    return (
      <RuntimeApp
        document={documentResult.document}
        onTitle={() => setScreen("title")}
        onSettings={() => setScreen("settings")}
        onBacklog={() => setScreen("backlog")}
      />
    );
  }

  return (
    <ScreenFrame>
      {screen === "title" ? (
        <TitleScreen
          onStart={() => setScreen("runtime")}
          onLoad={() => setScreen("load")}
          onSettings={() => setScreen("settings")}
          onBacklog={() => setScreen("backlog")}
          onGallery={() => setScreen("gallery")}
        />
      ) : screen === "load" ? (
        <LoadScreen onBack={() => setScreen("title")} />
      ) : screen === "settings" ? (
        <SettingsScreen onBack={() => setScreen("title")} />
      ) : screen === "backlog" ? (
        <BacklogScreen onBack={() => setScreen("title")} />
      ) : (
        <GalleryScreen onBack={() => setScreen("title")} />
      )}
    </ScreenFrame>
  );
}

interface RuntimeAppProps {
  readonly document: CompiledTzrDocument;
  readonly onTitle: () => void;
  readonly onSettings: () => void;
  readonly onBacklog: () => void;
}

function ScreenFrame({ children }: { readonly children: ComponentChildren }) {
  return (
    <main className="app">
      <GameViewport aspectRatio="16:9" className="app__viewport" maxWidth="100vw">
        <GameShell className="app__shell">{children}</GameShell>
      </GameViewport>
    </main>
  );
}

function RuntimeApp({ document, onTitle, onSettings, onBacklog }: RuntimeAppProps) {
  const plugins = useMemo<readonly RuntimePluginDefinition[]>(
    () => [createStdVisualPlugin(), createStdAudioPlugin()],
    [],
  );
  const commandHandlers = useMemo(
    () => ({
      ...createStdVisualCommandHandlers(),
      ...createStdAudioCommandHandlers(),
    }),
    [],
  );
  const [diagnostics, setDiagnostics] = useState<readonly RuntimeDiagnostic[]>([]);
  const recordDiagnostic = useCallback((diagnostic: RuntimeDiagnostic) => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);
  const runtime = useRuntime(document, {
    plugins,
    commandHandlers,
    onDiagnostic: recordDiagnostic,
    autoStart: true,
    autoClearWait: true,
    autoStepTransientEvents: true,
  });
  const [lastMessageEvent, setLastMessageEvent] = useState<RuntimeEvent | null>(null);
  const visiblePresentationEvent = toExamplePresentationEvent(runtime.visibleEvent);
  const choiceEvent = runtime.visibleEvent?.type === "choice" ? runtime.visibleEvent : null;
  const retainedMessageEvent = runtime.visibleEvent?.type === "wait" ? lastMessageEvent : null;
  const presentationKey = useVisibleEventPresentationKey(runtime.visibleEvent);
  const currentRenderableEvent = runtime.event === null ? null : getRenderableRuntimeEvent(runtime.event);
  const messageLines = useMemo(
    () => (visiblePresentationEvent === null ? null : getMessageLines(visiblePresentationEvent)),
    [visiblePresentationEvent],
  );
  const revealText = messageLines?.join("\n") ?? "";
  const lineRanges = useMemo(() => (messageLines === null ? [] : buildLineRanges(messageLines)), [messageLines]);
  const textReveal = useTextReveal(revealText, {
    enabled: messageLines !== null,
    charactersPerSecond: 60,
  });
  const canAdvanceText =
    visiblePresentationEvent !== null &&
    isMessageEvent(visiblePresentationEvent) &&
    currentRenderableEvent === runtime.visibleEvent &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;
  const canStart =
    runtime.visibleEvent === null && runtime.event === null && runtime.blockReason === null && !runtime.state.isStopped;
  const handleAdvanceRequest = useCallback(() => {
    if (choiceEvent !== null) {
      return;
    }
    if (messageLines !== null) {
      if (textReveal.isRevealing) {
        textReveal.revealAll();
        return;
      }
      if (canAdvanceText) {
        runtime.step();
      }
      return;
    }
    if (canStart) {
      runtime.step();
    }
  }, [canAdvanceText, canStart, choiceEvent, messageLines, runtime, textReveal.isRevealing, textReveal.revealAll]);
  const handleViewportClick = useCallback<DivClickHandler>(
    (event) => {
      if (isInteractiveClickTarget(event.target)) {
        return;
      }
      handleAdvanceRequest();
    },
    [handleAdvanceRequest],
  );
  const renderMessageLine = useCallback(
    ({ line, lineIndex }: MessageWindowRenderLineContext) => {
      const range = lineRanges[lineIndex];
      if (range === undefined) {
        return line;
      }
      return (
        <span>{textReveal.visibleText.slice(range.start, Math.min(range.end, textReveal.visibleText.length))}</span>
      );
    },
    [lineRanges, textReveal.visibleText],
  );

  useEffect(() => {
    textReveal.reset();
  }, [presentationKey, textReveal.reset]);

  useEffect(() => {
    if (runtime.visibleEvent !== null && isMessageEvent(runtime.visibleEvent)) {
      setLastMessageEvent(runtime.visibleEvent);
    }
  }, [runtime.visibleEvent]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isKeyboardHandledTarget(event.target)) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      handleAdvanceRequest();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleAdvanceRequest]);

  return (
    <main className="app">
      <GameViewport aspectRatio="16:9" className="app__viewport" maxWidth="100vw">
        <GameShell className="app__shell">
          <div className="app__interaction-surface" onClick={handleViewportClick}>
            <VisualLayer runtimeState={runtime.state} />
            <AudioLayer runtimeState={runtime.state} />
            <nav className="app__runtime-menu" aria-label="Runtime menu">
              <button type="button" onClick={onBacklog}>
                Backlog
              </button>
              <button type="button" onClick={onSettings}>
                Settings
              </button>
              <button type="button" onClick={onTitle}>
                Title
              </button>
            </nav>
            <div className="app__message-layer">
              {canStart ? null : choiceEvent !== null ? (
                <>
                  <ChoiceLayer
                    className="app__choice-layer"
                    question={choiceEvent.question}
                    choices={choiceEvent.items.map((item) => ({ text: item.text }))}
                    onChoice={runtime.choose}
                  />
                  {lastMessageEvent === null ? null : (
                    <RuntimeMessageLayer
                      key={getRuntimeEventTextKey(lastMessageEvent)}
                      className="app__retained-message"
                      event={lastMessageEvent}
                      canAdvance={false}
                    />
                  )}
                </>
              ) : retainedMessageEvent !== null ? (
                <RuntimeMessageLayer
                  key={getRuntimeEventTextKey(retainedMessageEvent)}
                  className="app__retained-message"
                  event={retainedMessageEvent}
                  canAdvance={false}
                />
              ) : visiblePresentationEvent === null ? null : (
                <RuntimeMessageLayer
                  key={presentationKey}
                  event={visiblePresentationEvent}
                  onAdvance={handleAdvanceRequest}
                  {...(messageLines === null ? {} : { renderMessageLine })}
                  canAdvance={canAdvanceText}
                />
              )}
            </div>
          </div>
        </GameShell>
      </GameViewport>
      {runtime.autoStepError === null ? null : <p className="app__runtime-error">{runtime.autoStepError}</p>}
      {diagnostics.length === 0 ? null : (
        <ul className="app__diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}:${index}`}>{diagnostic.message}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

function useVisibleEventPresentationKey(event: RuntimeEvent | null): string {
  const keyRef = useRef<{
    readonly event: RuntimeEvent | null;
    readonly sequence: number;
  }>({ event: null, sequence: 0 });

  if (keyRef.current.event !== event) {
    keyRef.current = {
      event,
      sequence: keyRef.current.sequence + 1,
    };
  }

  return `${keyRef.current.sequence}:${event === null ? "none" : getRuntimeEventTextKey(event)}`;
}

interface LineRange {
  readonly start: number;
  readonly end: number;
}

function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(".tzr-message-window, .tzr-choice-layer, button, a, input, select, textarea") !== null
  );
}

function isKeyboardHandledTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(".tzr-message-window, .tzr-choice-layer, button, a, input, select, textarea") !== null
  );
}

function toExamplePresentationEvent(event: RuntimeEvent | null): RuntimeEvent | null {
  if (event?.type === "wait") {
    return null;
  }
  return event;
}

function isMessageEvent(
  event: RuntimeEvent,
): event is Extract<RuntimeEvent, { readonly type: "narration" | "dialogue" }> {
  return event.type === "narration" || event.type === "dialogue";
}

function getMessageLines(event: RuntimeEvent): readonly string[] | null {
  if (!isMessageEvent(event)) {
    return null;
  }
  return event.lines.map((line) => line.text);
}

function buildLineRanges(lines: readonly string[]): readonly LineRange[] {
  const ranges: LineRange[] = [];
  let start = 0;
  for (const line of lines) {
    const end = start + line.length;
    ranges.push({ start, end });
    start = end + 1;
  }
  return ranges;
}

function getRuntimeEventTextKey(event: RuntimeEvent): string {
  if (event.type === "narration" || event.type === "dialogue") {
    return event.lines.map((line) => line.text).join("\u0000");
  }
  if (event.type === "choice") {
    return event.items.map((item) => item.text).join("\u0000");
  }
  return "";
}

interface DiagnosticLike {
  readonly message: string;
}

function formatDiagnostics(diagnostics: readonly DiagnosticLike[]): string {
  return diagnostics.map((diagnostic) => diagnostic.message).join("\n");
}
