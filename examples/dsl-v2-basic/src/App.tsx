import {
  type CompiledTzrDocument,
  compileTzr,
  parseTzr,
  type RuntimeDiagnostic,
  type RuntimeEvent,
  type RuntimePluginDefinition,
} from "@tsuzuru/core";
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
import type { JSX } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import scenarioSource from "../scenario/main.tzr?raw";
import { AudioLayer } from "./AudioLayer.js";
import { VisualLayer } from "./VisualLayer.js";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };

export function App() {
  const documentResult = useMemo(() => compileScenario(scenarioSource), []);

  if (!documentResult.ok) {
    return <pre className="app app--error">{documentResult.message}</pre>;
  }

  return <RuntimeApp document={documentResult.document} />;
}

interface RuntimeAppProps {
  readonly document: CompiledTzrDocument;
}

function RuntimeApp({ document }: RuntimeAppProps) {
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
    autoClearWait: true,
    autoStepTransientEvents: true,
  });
  const [lastMessageEvent, setLastMessageEvent] = useState<RuntimeEvent | null>(null);
  const presentationKey = useVisibleEventPresentationKey(runtime.visibleEvent);
  const currentRenderableEvent = runtime.event === null ? null : getRenderableRuntimeEvent(runtime.event);
  const messageLines = useMemo(
    () => (runtime.visibleEvent === null ? null : getMessageLines(runtime.visibleEvent)),
    [runtime.visibleEvent],
  );
  const revealText = messageLines?.join("\n") ?? "";
  const lineRanges = useMemo(() => (messageLines === null ? [] : buildLineRanges(messageLines)), [messageLines]);
  const textReveal = useTextReveal(revealText, {
    enabled: messageLines !== null,
    charactersPerSecond: 60,
  });
  const canAdvanceText =
    (runtime.visibleEvent?.type === "narration" || runtime.visibleEvent?.type === "dialogue") &&
    currentRenderableEvent === runtime.visibleEvent &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;
  const canStart =
    runtime.visibleEvent === null && runtime.event === null && runtime.blockReason === null && !runtime.state.isStopped;
  const choiceEvent = runtime.visibleEvent?.type === "choice" ? runtime.visibleEvent : null;
  const handleAdvanceRequest = useCallback(() => {
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
  }, [canAdvanceText, canStart, messageLines, runtime, textReveal.isRevealing, textReveal.revealAll]);
  const handleViewportClick = useCallback(
    (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
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
            <div className="app__message-layer">
              {canStart ? (
                <StartOverlay title={formatStartTitle(document.metadata.title)} />
              ) : choiceEvent !== null ? (
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
              ) : runtime.visibleEvent === null ? null : (
                <RuntimeMessageLayer
                  key={presentationKey}
                  event={runtime.visibleEvent}
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

function StartOverlay({ title }: { readonly title: string }) {
  return (
    <div className="app__start-overlay" aria-label="start screen">
      <h1>{title}</h1>
      <p>Click / Enter / Space to Start</p>
    </div>
  );
}

function formatStartTitle(title: string | undefined): string {
  if (title === undefined || title.startsWith("Tsuzuru ")) {
    return title ?? "Tsuzuru DSL v2 Basic";
  }
  return `Tsuzuru ${title}`;
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

function compileScenario(source: string): DocumentResult {
  const plugins = [createStdVisualPlugin(), createStdAudioPlugin()];
  const parsed = parseTzr(source, { filePath: "examples/dsl-v2-basic/scenario/main.tzr" });
  if (!parsed.ok) {
    return { ok: false, message: formatDiagnostics(parsed.errors) };
  }

  const compiled = compileTzr(parsed.document, { plugins });
  if (!compiled.ok) {
    return { ok: false, message: formatDiagnostics(compiled.errors) };
  }

  return { ok: true, document: compiled.document };
}

interface DiagnosticLike {
  readonly message: string;
}

function formatDiagnostics(diagnostics: readonly DiagnosticLike[]): string {
  return diagnostics.map((diagnostic) => diagnostic.message).join("\n");
}
