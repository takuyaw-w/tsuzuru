import type { RuntimeDocument, RuntimeEvent } from "@tsuzuru/core";
import type { TsuzuruHtmlNotice } from "./notices.js";
import type { TsuzuruHtmlRuntimeController } from "./runtime-controller.js";
import { createTsuzuruHtmlVisualLayer, type TsuzuruHtmlVisualLayer } from "./std-visual-layer.js";

export interface TsuzuruHtmlDomView {
  readonly viewport: HTMLElement;
  readonly visualLayer: TsuzuruHtmlVisualLayer;
  readonly title: HTMLElement;
  readonly status: HTMLElement;
  readonly messageWindow: HTMLElement;
  readonly speaker: HTMLElement;
  readonly message: HTMLElement;
  readonly choices: HTMLElement;
  readonly notices: HTMLElement;
  readonly error: HTMLElement;
}

export interface TsuzuruHtmlDomRenderOptions {
  readonly title: string;
  readonly document?: RuntimeDocument;
  readonly onChoose: (itemIndex: number) => void;
}

export function createTsuzuruHtmlDomView(document: Document, titleText: string): TsuzuruHtmlDomView {
  const viewport = document.createElement("div");
  viewport.className = "tzr-html-viewport";

  const visualLayer = createTsuzuruHtmlVisualLayer(document);

  const title = document.createElement("h1");
  title.className = "tzr-html-title";
  title.textContent = titleText;

  const status = document.createElement("p");
  status.className = "tzr-html-status";

  const messageWindow = document.createElement("section");
  messageWindow.className = "tzr-html-message-window";

  const speaker = document.createElement("p");
  speaker.className = "tzr-html-speaker";

  const message = document.createElement("div");
  message.className = "tzr-html-message";

  const choices = document.createElement("div");
  choices.className = "tzr-html-choice-layer";

  const notices = document.createElement("ul");
  notices.className = "tzr-html-notice";
  notices.setAttribute("hidden", "");

  const error = document.createElement("pre");
  error.className = "tzr-html-error";
  error.setAttribute("hidden", "");

  messageWindow.append(speaker, message);
  viewport.append(visualLayer.layer, title, status, messageWindow, choices, notices, error);

  return { viewport, visualLayer, title, status, messageWindow, speaker, message, choices, notices, error };
}

export function renderTsuzuruHtmlRuntime(
  view: TsuzuruHtmlDomView,
  controller: TsuzuruHtmlRuntimeController,
  options: TsuzuruHtmlDomRenderOptions,
): void {
  const event = controller.getVisibleEvent();
  view.title.textContent = options.title;
  view.status.textContent = getStatusText(event);
  view.speaker.textContent = getSpeakerText(event, options.document);
  view.message.textContent = getMessageText(event);
  view.choices.replaceChildren(...createChoiceButtons(view.choices.ownerDocument, event, options.onChoose));

  const autoStepError = controller.getAutoStepError();
  const errorText = getErrorText(event, autoStepError);
  if (errorText === null) {
    view.error.textContent = "";
    view.error.setAttribute("hidden", "");
  } else {
    view.error.textContent = errorText;
    view.error.removeAttribute("hidden");
  }
}

export function renderTsuzuruHtmlNotices(view: TsuzuruHtmlDomView, notices: readonly TsuzuruHtmlNotice[]): void {
  view.notices.replaceChildren(
    ...notices.map((notice) => {
      const item = view.notices.ownerDocument.createElement("li");
      item.textContent = notice.message;
      return item;
    }),
  );

  if (notices.length === 0) {
    view.notices.setAttribute("hidden", "");
  } else {
    view.notices.removeAttribute("hidden");
  }
}

export function renderTsuzuruHtmlLoading(view: TsuzuruHtmlDomView): void {
  view.status.textContent = "Loading scenario...";
  view.speaker.textContent = "";
  view.message.textContent = "Loading scenario...";
  view.choices.replaceChildren();
  renderTsuzuruHtmlNotices(view, []);
  view.error.textContent = "";
  view.error.setAttribute("hidden", "");
}

export function renderTsuzuruHtmlShell(view: TsuzuruHtmlDomView): void {
  view.status.textContent = "HTML adapter mounted.";
  view.speaker.textContent = "";
  view.message.textContent = "HTML adapter mounted.";
  view.choices.replaceChildren();
  renderTsuzuruHtmlNotices(view, []);
  view.error.textContent = "";
  view.error.setAttribute("hidden", "");
}

export function renderTsuzuruHtmlError(view: TsuzuruHtmlDomView, message: string): void {
  view.status.textContent = "Error";
  view.speaker.textContent = "";
  view.message.textContent = "Scenario could not be loaded.";
  view.choices.replaceChildren();
  renderTsuzuruHtmlNotices(view, []);
  view.error.textContent = message;
  view.error.removeAttribute("hidden");
}

function createChoiceButtons(
  document: Document,
  event: RuntimeEvent | null,
  onChoose: (itemIndex: number) => void,
): readonly HTMLElement[] {
  if (event?.type !== "choice") {
    return [];
  }

  return event.items.map((item, itemIndex) => {
    const button = document.createElement("button");
    button.className = "tzr-html-choice-button";
    button.type = "button";
    button.textContent = item.text;
    button.addEventListener("click", (clickEvent) => {
      clickEvent.stopPropagation();
      onChoose(itemIndex);
    });
    return button;
  });
}

function getStatusText(event: RuntimeEvent | null): string {
  switch (event?.type) {
    case undefined:
      return "Ready";
    case "narration":
      return "Narration";
    case "dialogue":
      return "Dialogue";
    case "choice":
      return event.question;
    case "wait":
      return `Waiting ${event.durationMs}ms`;
    case "waitClick":
    case "page":
      return "Waiting";
    case "end":
    case "stop":
      return "Finished";
    case "unsupported":
      return "Unsupported runtime event";
    case "error":
      return "Runtime error";
    default:
      return "Runtime";
  }
}

function getSpeakerText(event: RuntimeEvent | null, document: RuntimeDocument | undefined): string {
  if (event?.type !== "dialogue") {
    return "";
  }

  return getCharacterName(document, event.speaker) ?? event.speaker;
}

function getMessageText(event: RuntimeEvent | null): string {
  switch (event?.type) {
    case undefined:
      return "Click, Enter, or Space to start.";
    case "narration":
    case "dialogue":
      return event.lines.map((line) => line.text).join("\n");
    case "choice":
      return event.question;
    case "wait":
      return "Waiting...";
    case "waitClick":
    case "page":
      return "Waiting for input...";
    case "end":
    case "stop":
      return "End.";
    case "unsupported":
      return `Unsupported instruction: ${event.instructionType}`;
    case "error":
      return event.message;
    default:
      return "";
  }
}

function getErrorText(event: RuntimeEvent | null, autoStepError: string | null): string | null {
  if (autoStepError !== null) {
    return autoStepError;
  }
  if (event?.type === "error") {
    return event.message;
  }
  if (event?.type === "unsupported") {
    return `Unsupported instruction: ${event.instructionType}`;
  }
  return null;
}

function getCharacterName(document: RuntimeDocument | undefined, speaker: string): string | undefined {
  const metadata = (document as { readonly metadata?: { readonly characters?: Record<string, { name: string }> } })
    ?.metadata;
  return metadata?.characters?.[speaker]?.name;
}
