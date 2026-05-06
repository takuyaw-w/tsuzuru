import {
  type CompiledTzrDocument,
  compileTzr,
  parseTzr,
  type RuntimeDiagnostic,
  type RuntimeEvent,
  type RuntimePluginDefinition,
  type RuntimeState,
} from "@tsuzuru/core";
import { createStdAudioCommandHandlers, createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { getRenderableRuntimeEvent, type UseRuntimeResult, useRuntime } from "@tsuzuru/preact";
import {
  GameShell,
  GameViewport,
  type MessageWindowRenderLineContext,
  RuntimeMessageLayer,
  useTextReveal,
} from "@tsuzuru/standard-ui-preact";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
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
  const presentationKey = useVisibleEventPresentationKey(runtime.visibleEvent);
  const currentRenderableEvent = runtime.event === null ? null : getRenderableRuntimeEvent(runtime.event);
  const canAdvanceText =
    (runtime.visibleEvent?.type === "narration" || runtime.visibleEvent?.type === "dialogue") &&
    currentRenderableEvent === runtime.visibleEvent &&
    runtime.blockReason === null &&
    !runtime.state.isStopped;

  const reset = () => {
    setDiagnostics([]);
    runtime.reset();
  };

  return (
    <main className="app">
      <header className="app__header">
        <h1>{document.metadata.title ?? "DSL v2 Basic"}</h1>
        <p>parseTzr -&gt; compileTzr -&gt; useRuntime</p>
      </header>
      <GameViewport aspectRatio="16:9" maxWidth={960}>
        <GameShell className="app__shell">
          <VisualLayer runtimeState={runtime.state} />
          <AudioLayer runtimeState={runtime.state} />
          <div className="app__message-layer">
            {runtime.visibleEvent === null ? (
              <p className="app__placeholder">Press Step to start.</p>
            ) : (
              <RevealRuntimeMessageLayer
                key={presentationKey}
                event={runtime.visibleEvent}
                onChoice={runtime.choose}
                onStep={runtime.step}
                canAdvance={canAdvanceText}
              />
            )}
          </div>
        </GameShell>
      </GameViewport>
      <div className="app__controls">
        <button
          type="button"
          onClick={runtime.step}
          disabled={runtime.isBlocked || runtime.state.isStopped || runtime.event?.type === "end"}
        >
          Step
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
      <RuntimeDebug runtime={runtime} />
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

interface RevealRuntimeMessageLayerProps {
  readonly event: RuntimeEvent;
  readonly onChoice: (itemIndex: number) => void;
  readonly onStep: () => void;
  readonly canAdvance: boolean;
}

function RevealRuntimeMessageLayer({ event, onChoice, onStep, canAdvance }: RevealRuntimeMessageLayerProps) {
  const messageLines = useMemo(() => getMessageLines(event), [event]);
  const revealText = messageLines?.join("\n") ?? "";
  const lineRanges = useMemo(() => (messageLines === null ? [] : buildLineRanges(messageLines)), [messageLines]);
  const reveal = useTextReveal(revealText, {
    enabled: messageLines !== null,
    charactersPerSecond: 60,
  });
  const handleAdvanceRequest = useCallback(() => {
    if (reveal.isRevealing) {
      reveal.revealAll();
      return;
    }
    onStep();
  }, [onStep, reveal]);
  const renderMessageLine = useCallback(
    ({ line, lineIndex }: MessageWindowRenderLineContext) => {
      const range = lineRanges[lineIndex];
      if (range === undefined) {
        return line;
      }
      return <span>{reveal.visibleText.slice(range.start, Math.min(range.end, reveal.visibleText.length))}</span>;
    },
    [lineRanges, reveal.visibleText],
  );

  return (
    <RuntimeMessageLayer
      event={event}
      onChoice={onChoice}
      onAdvance={handleAdvanceRequest}
      {...(messageLines === null ? {} : { renderMessageLine })}
      canAdvance={canAdvance}
    />
  );
}

interface LineRange {
  readonly start: number;
  readonly end: number;
}

function getMessageLines(event: RuntimeEvent): readonly string[] | null {
  if (event.type !== "narration" && event.type !== "dialogue") {
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

function RuntimeDebug({ runtime }: { readonly runtime: UseRuntimeResult }) {
  return (
    <section className="debug-panel" aria-label="runtime debug">
      <div>
        <span>Event</span>
        <strong>{runtime.event?.type ?? "none"}</strong>
      </div>
      <div>
        <span>Pointer</span>
        <strong>{runtime.state.pointer.instructionIndex}</strong>
      </div>
      <div>
        <span>Variables</span>
        <strong>{formatVariables(runtime.state.variables)}</strong>
      </div>
      <div>
        <span>Block</span>
        <strong>{runtime.blockReason ?? "none"}</strong>
      </div>
      <div>
        <span>Auto-step</span>
        <strong>{runtime.autoStepError ?? "ok"}</strong>
      </div>
    </section>
  );
}

function formatVariables(variables: RuntimeState["variables"]): string {
  const entries = Object.entries(variables);
  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}
