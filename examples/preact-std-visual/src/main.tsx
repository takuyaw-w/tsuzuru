import { render } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import {
  compileTzr,
  parseTzr,
  type CompiledTzrDocument,
  type RuntimeDiagnostic,
} from "@tsuzuru/core";
import {
  createStdVisualCommandHandlers,
  createStdVisualPlugin,
  stdVisualPluginCommands,
} from "@tsuzuru/plugin-std-visual";
import {
  RuntimeView,
  useRuntime,
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
  const [diagnostics, setDiagnostics] = useState<readonly RuntimeDiagnostic[]>([]);
  const plugins = useMemo(() => [createStdVisualPlugin()], []);
  const commandHandlers = useMemo(() => createStdVisualCommandHandlers(), []);
  const recordDiagnostic = useCallback((diagnostic: RuntimeDiagnostic) => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);
  const runtime = useRuntime(document, {
    plugins,
    commandHandlers,
    onDiagnostic: recordDiagnostic,
    autoStepTransientEvents: true,
    autoStepMaxSteps: AUTO_STEP_MAX_STEPS,
  });
  const canAdvanceText =
    (runtime.visibleEvent?.type === "narration" || runtime.visibleEvent?.type === "dialogue") &&
    !runtime.isBlocked &&
    !runtime.state.isStopped;

  const advanceText = () => {
    if (canAdvanceText) {
      runtime.step();
    }
  };

  const reset = () => {
    setDiagnostics([]);
    runtime.reset();
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
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
      {runtime.autoStepError === null ? null : (
        <p className="runtime-error">{runtime.autoStepError}</p>
      )}
      {diagnostics.length === 0 ? null : (
        <ul className="runtime-diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}:${index}`}>{diagnostic.message}</li>
          ))}
        </ul>
      )}
    </main>
  );
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
