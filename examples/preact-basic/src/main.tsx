import { render } from "preact";
import { useMemo } from "preact/hooks";
import {
  compileTzr,
  parseTzr,
  type CompiledTzrDocument,
  type RuntimePluginCommandHandler,
} from "@tsuzuru/core";
import { RuntimeView, useRuntime } from "@tsuzuru/preact";
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
  const runtime = useRuntime(document, {
    commandHandlers,
    autoClearWait: true,
  });

  return (
    <main className="app">
      <h1>Tsuzuru Preact Basic</h1>
      <div className="runtime-panel">
        {runtime.event === null ? (
          <p className="placeholder">No event yet.</p>
        ) : (
          <RuntimeView
            event={runtime.event}
            onChoice={runtime.choose}
            onContinue={runtime.continueClick}
          />
        )}
      </div>
      <button
        type="button"
        className="step-button"
        onClick={runtime.step}
        disabled={runtime.isBlocked || runtime.state.isStopped || runtime.event?.type === "end"}
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
