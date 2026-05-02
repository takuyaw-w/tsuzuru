import { useCallback, useMemo, useState } from "preact/hooks";
import {
  compileTzr,
  parseTzr,
  type CompiledTzrDocument,
  type RuntimeDiagnostic,
} from "@tsuzuru/core";
import {
  createStdAudioCommandHandlers,
  createStdAudioPlugin,
  stdAudioPluginCommands,
} from "@tsuzuru/plugin-std-audio";
import {
  createStdVisualCommandHandlers,
  createStdVisualPlugin,
  stdVisualPluginCommands,
} from "@tsuzuru/plugin-std-visual";
import { useRuntime } from "@tsuzuru/preact";
import { GameShell, RuntimeMessageLayer } from "@tsuzuru/standard-ui-preact";
import scenarioSource from "../scenario/main.tzr?raw";
import { AudioLayer } from "./AudioLayer.js";
import { VisualLayer } from "./VisualLayer.js";

type DocumentResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument }
  | { readonly ok: false; readonly message: string };

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
  const [diagnostics, setDiagnostics] = useState<readonly RuntimeDiagnostic[]>([]);
  const plugins = useMemo(() => [createStdVisualPlugin(), createStdAudioPlugin()], []);
  const commandHandlers = useMemo(
    () => ({
      ...createStdVisualCommandHandlers(),
      ...createStdAudioCommandHandlers(),
    }),
    [],
  );
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
      <header className="app__header">
        <h1>Tsuzuru standard-ui-preact</h1>
        <p>Standard message UI with example-local visual and audio layers.</p>
      </header>
      <GameShell className="app__shell">
        <VisualLayer runtimeState={runtime.state} />
        <AudioLayer runtimeState={runtime.state} />
        <div className="app__message-layer">
          {runtime.visibleEvent === null ? (
            <p className="app__placeholder">Press Debug Step to start.</p>
          ) : (
            <RuntimeMessageLayer
              event={runtime.visibleEvent}
              onChoice={runtime.choose}
              onContinue={runtime.continueClick}
              onAdvance={advanceText}
              canAdvance={canAdvanceText}
            />
          )}
        </div>
      </GameShell>
      <div className="app__controls">
        <button
          type="button"
          onClick={runtime.step}
          disabled={runtime.isBlocked || runtime.state.isStopped || runtime.event?.type === "end"}
        >
          Debug Step
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
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

function compileScenario(source: string): DocumentResult {
  const parsed = parseTzr(source, { filePath: "examples/standard-ui-preact/scenario/main.tzr" });
  if (!parsed.ok) {
    return { ok: false, message: formatDiagnostics(parsed.errors) };
  }

  const compiled = compileTzr(parsed.document, {
    pluginCommands: {
      ...stdVisualPluginCommands,
      ...stdAudioPluginCommands,
    },
  });
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
