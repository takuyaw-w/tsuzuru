import { render } from "preact";
import { useMemo, useState } from "preact/hooks";
import {
  compileTzr,
  parseTzr,
  type CompiledTzrDocument,
  type RuntimePluginCommandHandler,
} from "@tsuzuru/core";
import { RuntimeView, isRuntimeSaveData, useRuntime } from "@tsuzuru/preact";
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

const SNAPSHOT_STORAGE_KEY = "tsuzuru:examples:preact-basic:snapshot";

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
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const runtime = useRuntime(document, {
    commandHandlers,
    autoClearWait: true,
    autoStepTransientEvents: true,
  });
  const canAdvanceText =
    (runtime.visibleEvent?.type === "narration" || runtime.visibleEvent?.type === "dialogue") &&
    !runtime.isBlocked &&
    !runtime.state.isStopped;

  const advanceText = () => {
    if (!canAdvanceText) {
      return;
    }

    runtime.step();
  };

  const saveSnapshot = () => {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(runtime.createSaveData()));
    setSaveStatus("Saved");
  };

  const loadSnapshot = () => {
    const savedSnapshot = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (savedSnapshot === null) {
      setSaveStatus("Failed to load save data");
      return;
    }

    try {
      const saveData = JSON.parse(savedSnapshot) as unknown;
      if (!isRuntimeSaveData(saveData)) {
        setSaveStatus("Failed to load save data");
        return;
      }

      runtime.restoreSaveData(saveData);
      setSaveStatus("Loaded");
    } catch {
      setSaveStatus("Failed to load save data");
    }
  };

  const clearSnapshot = () => {
    localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
    setSaveStatus("Save cleared");
  };

  return (
    <main className="app">
      <h1>Tsuzuru Preact Basic</h1>
      <div className="runtime-panel">
        {runtime.visibleEvent === null ? (
          <p className="placeholder">No event yet.</p>
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
      <button
        type="button"
        className="step-button"
        onClick={runtime.step}
        disabled={runtime.isBlocked || runtime.state.isStopped || runtime.event?.type === "end"}
      >
        Debug Step
      </button>
      <div className="save-controls" aria-label="Save controls">
        <button type="button" onClick={saveSnapshot}>
          Save
        </button>
        <button type="button" onClick={loadSnapshot}>
          Load
        </button>
        <button type="button" onClick={clearSnapshot}>
          Clear Save
        </button>
      </div>
      {saveStatus === null ? null : <p className="save-status">{saveStatus}</p>}
      {runtime.autoStepError === null ? null : (
        <p className="runtime-error">{runtime.autoStepError}</p>
      )}
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
