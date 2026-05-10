import type { RuntimeDocument, RuntimeEvent, RuntimeState } from "@tsuzuru/core";
import {
  createTsuzuruHtmlDomView,
  renderTsuzuruHtmlError,
  renderTsuzuruHtmlLoading,
  renderTsuzuruHtmlRuntime,
  renderTsuzuruHtmlShell,
} from "./dom-renderer.js";
import {
  createTsuzuruHtmlRuntimeController,
  type TsuzuruHtmlRuntimeController,
  type TsuzuruHtmlRuntimeControllerOptions,
} from "./runtime-controller.js";
import {
  formatScenarioDiagnostics,
  loadTsuzuruHtmlScenario,
  type TsuzuruHtmlFetch,
  TsuzuruHtmlScenarioLoadError,
  type TsuzuruHtmlScenarioSource,
} from "./scenario-loader.js";

export interface TsuzuruHtmlMountOptions {
  readonly title?: string;
  readonly className?: string;
  readonly scenario?: TsuzuruHtmlScenarioSource;
  readonly fetch?: TsuzuruHtmlFetch;
  readonly baseUrl?: string | URL;
  readonly plugins?: TsuzuruHtmlRuntimeControllerOptions["plugins"];
  readonly commandHandlers?: TsuzuruHtmlRuntimeControllerOptions["commandHandlers"];
  readonly onDiagnostic?: TsuzuruHtmlRuntimeControllerOptions["onDiagnostic"];
  readonly autoClearWait?: boolean;
  readonly autoStepTransientEvents?: boolean;
  readonly autoStepMaxSteps?: number;
}

export interface TsuzuruHtmlApp {
  readonly root: HTMLElement;
  readonly element: HTMLElement;
  readonly controller: TsuzuruHtmlRuntimeController | null;
  readonly step: () => void;
  readonly choose: (itemIndex: number) => void;
  readonly reset: () => void;
  readonly destroy: () => void;
  readonly getState: () => RuntimeState | null;
  readonly getEvent: () => RuntimeEvent | null;
  readonly getVisibleEvent: () => RuntimeEvent | null;
  readonly isDestroyed: () => boolean;
}

const DEFAULT_TITLE = "Tsuzuru";

export async function mountTsuzuruHtml(
  root: HTMLElement,
  options: TsuzuruHtmlMountOptions = {},
): Promise<TsuzuruHtmlApp> {
  const document = root.ownerDocument;
  const element = document.createElement("section");
  element.className = joinClassNames("tzr-html-player", options.className);
  element.setAttribute("data-tsuzuru-html-state", "mounted");
  element.setAttribute("tabindex", "0");

  const titleText = options.title ?? DEFAULT_TITLE;
  const view = createTsuzuruHtmlDomView(document, titleText);
  element.append(view.viewport);
  root.replaceChildren(element);

  let destroyed = false;
  let controller: TsuzuruHtmlRuntimeController | null = null;
  const removeListeners: Array<() => void> = [];

  const renderRuntime = () => {
    if (controller === null || destroyed) {
      return;
    }
    renderTsuzuruHtmlRuntime(view, controller, {
      title: titleText,
      ...(runtimeDocument === undefined ? {} : { document: runtimeDocument }),
      onChoose: (itemIndex) => {
        controller?.choose(itemIndex);
        renderRuntime();
      },
    });
  };

  let runtimeDocument: RuntimeDocument | undefined;

  if (options.scenario === undefined) {
    renderTsuzuruHtmlShell(view);
  } else {
    renderTsuzuruHtmlLoading(view);
    try {
      runtimeDocument = await loadTsuzuruHtmlScenario(options.scenario, {
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
        ...(options.plugins === undefined ? {} : { plugins: options.plugins }),
      });
      controller = createTsuzuruHtmlRuntimeController(runtimeDocument, {
        ...(options.plugins === undefined ? {} : { plugins: options.plugins }),
        ...(options.commandHandlers === undefined ? {} : { commandHandlers: options.commandHandlers }),
        ...(options.onDiagnostic === undefined ? {} : { onDiagnostic: options.onDiagnostic }),
        autoClearWait: options.autoClearWait ?? true,
        autoStepTransientEvents: options.autoStepTransientEvents ?? true,
        ...(options.autoStepMaxSteps === undefined ? {} : { autoStepMaxSteps: options.autoStepMaxSteps }),
        setTimeout: (callback, timeoutMs) =>
          globalThis.setTimeout(() => {
            callback();
            renderRuntime();
          }, timeoutMs),
        clearTimeout: (timerId) => {
          globalThis.clearTimeout(timerId as ReturnType<typeof globalThis.setTimeout>);
        },
      });
      attachRuntimeListeners(element, {
        onStep: () => {
          controller?.step();
          renderRuntime();
        },
        removeListeners,
      });
      renderRuntime();
    } catch (error) {
      element.setAttribute("data-tsuzuru-html-state", "error");
      renderTsuzuruHtmlError(view, formatMountError(error));
    }
  }

  return {
    root,
    element,
    get controller() {
      return controller;
    },
    step: () => {
      controller?.step();
      renderRuntime();
    },
    choose: (itemIndex: number) => {
      controller?.choose(itemIndex);
      renderRuntime();
    },
    reset: () => {
      controller?.reset();
      renderRuntime();
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const removeListener of removeListeners) {
        removeListener();
      }
      removeListeners.length = 0;
      controller?.destroy();
      element.setAttribute("data-tsuzuru-html-state", "destroyed");
      if (element.parentNode === root) {
        root.replaceChildren();
      }
    },
    getState: () => controller?.getState() ?? null,
    getEvent: () => controller?.getEvent() ?? null,
    getVisibleEvent: () => controller?.getVisibleEvent() ?? null,
    isDestroyed: () => destroyed,
  };
}

function joinClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className) => className !== undefined && className.length > 0).join(" ");
}

function attachRuntimeListeners(
  element: HTMLElement,
  options: { readonly onStep: () => void; readonly removeListeners: Array<() => void> },
): void {
  const handleClick = () => {
    options.onStep();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    options.onStep();
  };

  element.addEventListener("click", handleClick);
  element.addEventListener("keydown", handleKeyDown);
  options.removeListeners.push(() => element.removeEventListener("click", handleClick));
  options.removeListeners.push(() => element.removeEventListener("keydown", handleKeyDown));
}

function formatMountError(error: unknown): string {
  if (error instanceof TsuzuruHtmlScenarioLoadError) {
    return formatScenarioDiagnostics(error.diagnostics);
  }
  return error instanceof Error ? error.message : String(error);
}
