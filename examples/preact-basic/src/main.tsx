import { render } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  clearClickWait,
  clearWait,
  compileTzr,
  createInitialRuntimeState,
  getRuntimeBlockReason,
  parseTzr,
  resolveChoice,
  stepRuntime,
  type CompiledTzrDocument,
  type RuntimeEvent,
  type RuntimePluginCommandHandler,
  type RuntimeState,
} from "@tsuzuru/core";
import { RuntimeView } from "@tsuzuru/preact";
import scenarioSource from "../scenario/main.tzr?raw";
import "./style.css";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };

const commandHandlers: Record<string, RuntimePluginCommandHandler> = {
  bg(state, instruction) {
    const background = instruction.args[0];
    const value =
      background?.type === "PositionalArgument" && background.value.type === "StringValue"
        ? background.value.value
        : "unknown";

    return {
      state,
      event: { type: "pluginCommand", name: `bg:${value}` },
    };
  },
};

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
  const [state, setState] = useState<RuntimeState>(() => createInitialRuntimeState(document));
  const [event, setEvent] = useState<RuntimeEvent | null>(null);

  const stepFrom = useCallback(
    (nextState: RuntimeState) => {
      const result = stepRuntime(document, nextState, { commandHandlers });
      setState(result.state);
      setEvent(result.event);
    },
    [document],
  );

  useEffect(() => {
    stepFrom(createInitialRuntimeState(document));
  }, [document, stepFrom]);

  useEffect(() => {
    if (event?.type !== "wait" || state.pendingWait === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      stepFrom(clearWait(state));
    }, state.pendingWait.durationMs);

    return () => window.clearTimeout(timer);
  }, [event, state, stepFrom]);

  const handleContinue = useCallback(() => {
    if (getRuntimeBlockReason(state) !== "click") {
      return;
    }

    stepFrom(clearClickWait(state));
  }, [state, stepFrom]);

  const handleChoice = useCallback(
    (itemIndex: number) => {
      if (state.pendingChoice === null) {
        return;
      }

      stepFrom(resolveChoice(document, state, itemIndex).state);
    },
    [document, state, stepFrom],
  );

  const handleStep = useCallback(() => {
    if (getRuntimeBlockReason(state) !== null || state.isStopped || event?.type === "end") {
      return;
    }

    stepFrom(state);
  }, [event, state, stepFrom]);

  return (
    <main className="app">
      <h1>Tsuzuru Preact Basic</h1>
      <div className="runtime-panel">
        {event === null ? (
          <p className="placeholder">No event yet.</p>
        ) : (
          <RuntimeView event={event} onChoice={handleChoice} onContinue={handleContinue} />
        )}
      </div>
      <button
        type="button"
        className="step-button"
        onClick={handleStep}
        disabled={getRuntimeBlockReason(state) !== null || state.isStopped || event?.type === "end"}
      >
        Step
      </button>
    </main>
  );
}

function compileScenario(source: string): DocumentResult {
  const parsed = parseTzr(source, { filePath: "examples/preact-basic/scenario/main.tzr" });
  if (!parsed.ok) {
    return { ok: false, message: formatDiagnostics(parsed.errors) };
  }

  const compiled = compileTzr(parsed.document);
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
