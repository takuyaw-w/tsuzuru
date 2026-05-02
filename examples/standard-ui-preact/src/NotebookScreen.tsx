import type { ComponentChildren } from "preact";
import type { ScreenComponentProps } from "@tsuzuru/standard-ui-preact";

type NotebookScreenParams = {
  readonly title?: string;
};

export function NotebookScreen({ params, onClose }: ScreenComponentProps): ComponentChildren {
  const notebookParams = readNotebookParams(params);
  const title = notebookParams.title ?? "Notebook";

  return (
    <section className="notebook-screen" aria-label={title}>
      <header className="notebook-screen__header">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="notebook-screen__body">
        <p>Custom screens are app-local Preact components registered with ScreenHost.</p>
        <ul>
          <li>Open and close state is connected to Tsuzuru runtime state.</li>
          <li>Scenario DSL can open, close, and wait for this screen.</li>
          <li>Screen content can use normal TypeScript and Preact.</li>
        </ul>
      </div>
    </section>
  );
}

function readNotebookParams(params: unknown): NotebookScreenParams {
  if (params === null || typeof params !== "object") {
    return {};
  }

  const title = "title" in params ? params.title : undefined;
  return typeof title === "string" ? { title } : {};
}
