import {
  type CompiledTzrDocument,
  compileTzr,
  createInitialRuntimeState,
  getRuntimeBlockReason,
  parseTzr,
  type RuntimeDiagnostic,
  type RuntimeEvent,
  type RuntimePluginDefinition,
  type RuntimeState,
  type RuntimeStepOptions,
  resolveChoice,
  stepRuntime,
} from "@tsuzuru/core";
import { createStdAudioCommandHandlers, createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdVisualCommandHandlers, createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";
import { isAutoSteppableRuntimeEvent } from "@tsuzuru/preact";
import {
  GameShell,
  GameViewport,
  type MessageWindowRenderLineContext,
  RuntimeMessageLayer,
  useTextReveal,
} from "@tsuzuru/standard-ui-preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import scenarioSource from "../scenario/main.tzr?raw";
import { AudioLayer } from "./AudioLayer.js";
import { VisualLayer } from "./VisualLayer.js";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };

interface RuntimeRunResult {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
  readonly visibleEvent: RuntimeEvent | null;
  readonly autoStepError: string | null;
}

const AUTO_STEP_MAX_STEPS = 1000;

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
  const [state, setState] = useState<RuntimeState>(() => createInitialRuntimeState(document, { plugins }));
  const [event, setEvent] = useState<RuntimeEvent | null>(null);
  const [visibleEvent, setVisibleEvent] = useState<RuntimeEvent | null>(null);
  const [autoStepError, setAutoStepError] = useState<string | null>(null);
  const recordDiagnostic = useCallback((diagnostic: RuntimeDiagnostic) => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);
  const stepOptions = useMemo<RuntimeStepOptions>(
    () => ({
      commandHandlers,
      onDiagnostic: recordDiagnostic,
    }),
    [commandHandlers, recordDiagnostic],
  );
  const canAdvanceText =
    (visibleEvent?.type === "narration" || visibleEvent?.type === "dialogue") &&
    getRuntimeBlockReason(state) === null &&
    !state.isStopped;

  const applyRunResult = (result: RuntimeRunResult) => {
    setState(result.state);
    setEvent(result.event);
    setAutoStepError(result.autoStepError);
    if (result.visibleEvent !== null) {
      setVisibleEvent(result.visibleEvent);
    }
  };

  const step = () => {
    if (getRuntimeBlockReason(state) !== null || state.isStopped) {
      return;
    }
    applyRunResult(runUntilVisible(document, state, stepOptions));
  };

  const choose = (itemIndex: number) => {
    if (state.pendingChoice === null) {
      return;
    }

    const resolved = resolveChoice(document, state, itemIndex);
    if (resolved.event.type === "error") {
      setState(resolved.state);
      setEvent(resolved.event);
      setVisibleEvent(resolved.event);
      setAutoStepError(null);
      return;
    }

    applyRunResult(runUntilVisible(document, resolved.state, stepOptions));
  };

  const reset = () => {
    setDiagnostics([]);
    setState(createInitialRuntimeState(document, { plugins }));
    setEvent(null);
    setVisibleEvent(null);
    setAutoStepError(null);
  };

  return (
    <main className="app">
      <header className="app__header">
        <h1>{document.metadata.title ?? "DSL v2 Basic"}</h1>
        <p>parseTzr -&gt; compileTzr -&gt; runtime</p>
      </header>
      <GameViewport aspectRatio="16:9" maxWidth={960}>
        <GameShell className="app__shell">
          <VisualLayer runtimeState={state} />
          <AudioLayer runtimeState={state} />
          <div className="app__message-layer">
            {visibleEvent === null ? (
              <p className="app__placeholder">Press Step to start.</p>
            ) : (
              <RevealRuntimeMessageLayer
                key={presentationKey(visibleEvent, state)}
                event={visibleEvent}
                onChoice={choose}
                onStep={step}
                canAdvance={canAdvanceText}
                showTransientStatus
              />
            )}
          </div>
        </GameShell>
      </GameViewport>
      <div className="app__controls">
        <button
          type="button"
          onClick={step}
          disabled={getRuntimeBlockReason(state) !== null || state.isStopped || event?.type === "end"}
        >
          Step
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
      <RuntimeDebug state={state} event={event} />
      {autoStepError === null ? null : <p className="app__runtime-error">{autoStepError}</p>}
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

interface RevealRuntimeMessageLayerProps {
  readonly event: RuntimeEvent;
  readonly onChoice: (itemIndex: number) => void;
  readonly onStep: () => void;
  readonly canAdvance: boolean;
  readonly showTransientStatus: boolean;
}

function RevealRuntimeMessageLayer({
  event,
  onChoice,
  onStep,
  canAdvance,
  showTransientStatus,
}: RevealRuntimeMessageLayerProps) {
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
      renderMessageLine={messageLines === null ? undefined : renderMessageLine}
      canAdvance={canAdvance}
      showTransientStatus={showTransientStatus}
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

function presentationKey(event: RuntimeEvent, state: RuntimeState): string {
  return `${event.type}:${state.pointer.filePath}:${state.pointer.instructionIndex}:${getRuntimeEventTextKey(event)}`;
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

function runUntilVisible(
  document: CompiledTzrDocument,
  initialState: RuntimeState,
  options: RuntimeStepOptions,
): RuntimeRunResult {
  let state = initialState;
  let event: RuntimeEvent | null = null;

  for (let index = 0; index < AUTO_STEP_MAX_STEPS; index += 1) {
    const result = stepRuntime(document, state, options);
    state = result.state;
    event = result.event;

    if (!isAutoSteppableRuntimeEvent(event) || getRuntimeBlockReason(state) !== null || state.isStopped) {
      return {
        state,
        event,
        visibleEvent: event,
        autoStepError: null,
      };
    }
  }

  return {
    state,
    event,
    visibleEvent: event,
    autoStepError: `Auto-step stopped after ${AUTO_STEP_MAX_STEPS} consecutive runtime events.`,
  };
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

function RuntimeDebug({ state, event }: { readonly state: RuntimeState; readonly event: RuntimeEvent | null }) {
  return (
    <section className="debug-panel" aria-label="runtime debug">
      <div>
        <span>Event</span>
        <strong>{event?.type ?? "none"}</strong>
      </div>
      <div>
        <span>Pointer</span>
        <strong>{state.pointer.instructionIndex}</strong>
      </div>
      <div>
        <span>Variables</span>
        <strong>{formatVariables(state.variables)}</strong>
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
