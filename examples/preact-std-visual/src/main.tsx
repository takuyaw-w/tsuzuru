import { render } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  clearClickWait,
  clearWait,
  compileTzr,
  createInitialRuntimeState,
  getRuntimeBlockReason,
  isRuntimeBlocked,
  parseTzr,
  resolveChoice,
  stepRuntime,
  type CompiledTzrDocument,
  type RuntimeDiagnostic,
  type RuntimeEvent,
  type RuntimeState,
  type RuntimeStepOptions,
} from "@tsuzuru/core";
import {
  createStdVisualCommandHandlers,
  createStdVisualPlugin,
  stdVisualPluginCommands,
} from "@tsuzuru/plugin-std-visual";
import {
  RuntimeView,
  getAutoClearWaitDuration,
  getRenderableRuntimeEvent,
  isAutoSteppableRuntimeEvent,
} from "@tsuzuru/preact";
import scenarioSource from "../scenario/main.tzr?raw";
import { VisualLayer } from "./VisualLayer.js";
import "./style.css";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };

const AUTO_STEP_MAX_STEPS = 1000;

function App() {
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
  const runtime = useStdVisualRuntime(document);
  const canAdvanceText =
    (runtime.visibleEvent?.type === "narration" || runtime.visibleEvent?.type === "dialogue") &&
    !runtime.isBlocked &&
    !runtime.state.isStopped;

  const advanceText = () => {
    if (canAdvanceText) {
      runtime.step();
    }
  };

  return (
    <main className="app">
      <h1>Tsuzuru Preact std-visual</h1>
      <div className="stage-panel">
        <VisualLayer runtimeState={runtime.state} />
        <div className="message-panel">
          {runtime.visibleEvent === null ? (
            <p className="placeholder">Press Debug Step to start.</p>
          ) : (
            <RuntimeView
              event={runtime.visibleEvent}
              onChoice={runtime.choose}
              onContinue={runtime.continueClick}
              onAdvance={advanceText}
              canAdvance={canAdvanceText}
            />
          )}
        </div>
      </div>
      <div className="controls">
        <button
          type="button"
          className="step-button"
          onClick={runtime.step}
          disabled={runtime.isBlocked || runtime.state.isStopped || runtime.event?.type === "end"}
        >
          Debug Step
        </button>
        <button type="button" onClick={runtime.reset}>
          Reset
        </button>
      </div>
      {runtime.autoStepError === null ? null : (
        <p className="runtime-error">{runtime.autoStepError}</p>
      )}
      {runtime.diagnostics.length === 0 ? null : (
        <ul className="runtime-diagnostics">
          {runtime.diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}:${index}`}>{diagnostic.message}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

interface StdVisualRuntime {
  readonly state: RuntimeState;
  readonly event: RuntimeEvent | null;
  readonly visibleEvent: RuntimeEvent | null;
  readonly step: () => void;
  readonly continueClick: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly isBlocked: boolean;
  readonly autoStepError: string | null;
  readonly diagnostics: readonly RuntimeDiagnostic[];
}

function useStdVisualRuntime(document: CompiledTzrDocument): StdVisualRuntime {
  const createInitialState = useCallback(
    () =>
      createInitialRuntimeState(document, {
        plugins: [createStdVisualPlugin()],
      }),
    [document],
  );
  const [state, setState] = useState<RuntimeState>(createInitialState);
  const [event, setEvent] = useState<RuntimeEvent | null>(null);
  const [visibleEvent, setVisibleEvent] = useState<RuntimeEvent | null>(null);
  const [autoStepCount, setAutoStepCount] = useState(0);
  const [autoStepError, setAutoStepError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<readonly RuntimeDiagnostic[]>([]);

  const commandHandlers = useMemo(() => createStdVisualCommandHandlers(), []);
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

  const applyResult = useCallback((result: ReturnType<typeof stepRuntime>) => {
    setState(result.state);
    setEvent(result.event);
    const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
    if (nextVisibleEvent !== null) {
      setVisibleEvent(nextVisibleEvent);
    }
  }, []);

  const stepFrom = useCallback(
    (nextState: RuntimeState) => {
      applyResult(stepRuntime(document, nextState, stepOptions));
    },
    [applyResult, document, stepOptions],
  );

  const step = useCallback(() => {
    setAutoStepCount(0);
    setAutoStepError(null);
    setState((currentState) => {
      if (isRuntimeBlocked(currentState) || currentState.isStopped) {
        return currentState;
      }

      const result = stepRuntime(document, currentState, stepOptions);
      setEvent(result.event);
      const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
      if (nextVisibleEvent !== null) {
        setVisibleEvent(nextVisibleEvent);
      }
      return result.state;
    });
  }, [document, stepOptions]);

  const continueClick = useCallback(() => {
    setAutoStepCount(0);
    setAutoStepError(null);
    setState((currentState) => {
      if (getRuntimeBlockReason(currentState) !== "click") {
        return currentState;
      }

      const result = stepRuntime(document, clearClickWait(currentState), stepOptions);
      setEvent(result.event);
      const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
      if (nextVisibleEvent !== null) {
        setVisibleEvent(nextVisibleEvent);
      }
      return result.state;
    });
  }, [document, stepOptions]);

  const choose = useCallback(
    (itemIndex: number) => {
      setAutoStepCount(0);
      setAutoStepError(null);
      setState((currentState) => {
        if (currentState.pendingChoice === null) {
          return currentState;
        }

        const resolved = resolveChoice(document, currentState, itemIndex);
        if (resolved.event.type === "error") {
          setEvent(resolved.event);
          setVisibleEvent(resolved.event);
          return resolved.state;
        }

        const result = stepRuntime(document, resolved.state, stepOptions);
        setEvent(result.event);
        const nextVisibleEvent = getRenderableRuntimeEvent(result.event);
        if (nextVisibleEvent !== null) {
          setVisibleEvent(nextVisibleEvent);
        }
        return result.state;
      });
    },
    [document, stepOptions],
  );

  const reset = useCallback(() => {
    setState(createInitialState());
    setEvent(null);
    setVisibleEvent(null);
    setAutoStepCount(0);
    setAutoStepError(null);
    setDiagnostics([]);
  }, [createInitialState]);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    const waitDurationMs = getAutoClearWaitDuration(event, state, true);
    if (waitDurationMs === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      stepFrom(clearWait(state));
    }, waitDurationMs);

    return () => window.clearTimeout(timer);
  }, [event, state, stepFrom]);

  useEffect(() => {
    if (
      event === null ||
      !isAutoSteppableRuntimeEvent(event) ||
      isRuntimeBlocked(state) ||
      state.isStopped
    ) {
      return;
    }

    if (autoStepCount >= AUTO_STEP_MAX_STEPS) {
      setAutoStepError(`Auto-step stopped after ${AUTO_STEP_MAX_STEPS} consecutive runtime events.`);
      return;
    }

    const timer = window.setTimeout(() => {
      setAutoStepCount((currentCount) => currentCount + 1);
      stepFrom(state);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [autoStepCount, event, state, stepFrom]);

  useEffect(() => {
    if (event === null || isAutoSteppableRuntimeEvent(event)) {
      return;
    }

    setAutoStepCount(0);
    setAutoStepError(null);
  }, [event]);

  return {
    state,
    event,
    visibleEvent,
    step,
    continueClick,
    choose,
    reset,
    isBlocked: getRuntimeBlockReason(state) !== null,
    autoStepError,
    diagnostics,
  };
}

function compileScenario(source: string): DocumentResult {
  const parsed = parseTzr(source, { filePath: "examples/preact-std-visual/scenario/main.tzr" });
  if (!parsed.ok) {
    return { ok: false, message: formatDiagnostics(parsed.errors) };
  }

  const compiled = compileTzr(parsed.document, { pluginCommands: stdVisualPluginCommands });
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

const root = document.querySelector("#app");
if (root === null) {
  throw new Error("Missing #app root element.");
}

render(<App />, root);
