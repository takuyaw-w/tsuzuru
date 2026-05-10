import {
  loadTsuzuruHtmlAssets,
  mountTsuzuruHtml,
  type TsuzuruHtmlApp,
  type TsuzuruHtmlAssets,
  type TsuzuruHtmlMountOptions,
} from "@tsuzuru/html";
import { createHtmlBasicBacklogEntry, type HtmlBasicBacklogEntry } from "./backlog.js";
import { createHtmlBasicGallerySections } from "./gallery.js";
import {
  loadHtmlBasicSettings,
  saveHtmlBasicSettings,
  toHtmlBasicSettingsStyle,
  type HtmlBasicSettings,
} from "./settings.js";

type MainScreen = "title" | "runtime";
type OverlayScreen = "backlog" | "settings" | "gallery";
type VisibleRuntimeEvent = Parameters<NonNullable<TsuzuruHtmlMountOptions["onVisibleEventChange"]>>[0];

const SPEAKER_NAMES: Readonly<Record<string, string>> = {
  mio: "美緒",
};

export interface HtmlBasicApp {
  readonly destroy: () => void;
}

export function createHtmlBasicApp(root: HTMLElement): HtmlBasicApp {
  const app = new HtmlBasicDomApp(root);
  app.mount();
  return app;
}

class HtmlBasicDomApp implements HtmlBasicApp {
  private readonly document: Document;
  private readonly appElement: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly mainLayer: HTMLElement;
  private readonly overlayLayer: HTMLElement;
  private mainScreen: MainScreen = "title";
  private overlayScreen: OverlayScreen | null = null;
  private runtimeRoot: HTMLElement | null = null;
  private runtimeApp: TsuzuruHtmlApp | null = null;
  private galleryAssets: TsuzuruHtmlAssets | null = null;
  private galleryError: string | null = null;
  private settings: HtmlBasicSettings = loadHtmlBasicSettings();
  private readonly backlogEntries: HtmlBasicBacklogEntry[] = [];
  private nextBacklogId = 1;
  private readonly mainCleanup: Array<() => void> = [];
  private readonly overlayCleanup: Array<() => void> = [];

  public constructor(private readonly root: HTMLElement) {
    this.document = root.ownerDocument;
    this.appElement = this.document.createElement("main");
    this.appElement.className = "html-basic-app";
    this.viewport = this.document.createElement("div");
    this.viewport.className = "html-basic-app__viewport";
    this.mainLayer = this.document.createElement("div");
    this.mainLayer.className = "html-basic-main-layer";
    this.overlayLayer = this.document.createElement("div");
    this.overlayLayer.className = "html-basic-overlay-layer";
    this.overlayLayer.setAttribute("hidden", "");
    this.viewport.append(this.mainLayer, this.overlayLayer);
    this.appElement.append(this.viewport);
  }

  public mount(): void {
    this.root.replaceChildren(this.appElement);
    this.applySettings();
    this.renderMainScreen();
    this.loadGalleryAssets();
  }

  public destroy(): void {
    this.cleanupMain();
    this.cleanupOverlay();
    this.destroyRuntime();
    this.root.replaceChildren();
  }

  private renderMainScreen(): void {
    this.cleanupMain();
    this.mainLayer.replaceChildren();

    if (this.mainScreen === "title") {
      this.mainLayer.append(this.renderTitleScreen());
      return;
    }

    this.mainLayer.append(this.renderRuntimeScreen());
  }

  private renderTitleScreen(): HTMLElement {
    const screen = this.createScreen("Title", "html-basic-screen--title");
    const art = this.element("div", "html-basic-title-art");
    art.setAttribute("aria-hidden", "true");
    art.append(
      this.element("span", "html-basic-title-art__sun"),
      this.element("span", "html-basic-title-art__platform"),
      this.element("span", "html-basic-title-art__rail html-basic-title-art__rail--front"),
      this.element("span", "html-basic-title-art__rail html-basic-title-art__rail--back"),
    );

    const content = this.element("div", "html-basic-screen__content html-basic-screen__content--title");
    const copy = this.element("div", "html-basic-title-copy");
    copy.append(
      this.textElement("p", "html-basic-screen__eyebrow", "Tsuzuru"),
      this.textElement("h1", "html-basic-screen__title", "Tsuzuru HTML Basic"),
      this.textElement("p", "html-basic-screen__subtitle", "Preact なしで .tzr を再生する HTML adapter example。"),
    );

    const menu = this.element("div", "html-basic-title-menu");
    const primaryActions = this.element("div", "html-basic-screen__actions html-basic-screen__actions--primary");
    primaryActions.append(
      this.actionButton("Start", () => this.startRuntime(), "html-basic-screen__button--primary", false, "main"),
      this.actionButton("Continue", undefined, "", true),
    );
    const secondaryActions = this.element("div", "html-basic-screen__actions html-basic-screen__actions--secondary");
    secondaryActions.append(
      this.actionButton("Backlog", () => this.openOverlay("backlog"), "", false, "main"),
      this.actionButton("Settings", () => this.openOverlay("settings"), "", false, "main"),
      this.actionButton("Gallery", () => this.openOverlay("gallery"), "", false, "main"),
    );
    menu.append(primaryActions, secondaryActions);
    content.append(copy, menu);
    screen.append(art, content);
    return screen;
  }

  private renderRuntimeScreen(): HTMLElement {
    const screen = this.createScreen("Runtime", "html-basic-runtime-screen");
    const runtimeRoot = this.element("div", "html-basic-runtime-root");
    this.runtimeRoot = runtimeRoot;

    const menu = this.element("nav", "html-basic-runtime-menu");
    menu.setAttribute("aria-label", "Runtime menu");
    menu.append(
      this.runtimeMenuButton("Title", () => this.returnToTitle()),
      this.runtimeMenuButton("Backlog", () => this.openOverlay("backlog")),
      this.runtimeMenuButton("Settings", () => this.openOverlay("settings")),
      this.runtimeMenuButton("Gallery", () => this.openOverlay("gallery")),
    );

    screen.append(runtimeRoot, menu);
    this.mountRuntime(runtimeRoot);
    return screen;
  }

  private async mountRuntime(runtimeRoot: HTMLElement): Promise<void> {
    const mountedApp = await mountTsuzuruHtml(runtimeRoot, {
      title: "Tsuzuru HTML Basic",
      className: "html-basic-player",
      scenario: {
        entryUrl: "/scenario/main.tzr",
        entryId: "public/scenario/main.tzr",
      },
      assetsUrl: "/assets/assets.json",
      onVisibleEventChange: (event) => {
        this.recordBacklogEvent(event);
      },
    });

    if (this.runtimeRoot !== runtimeRoot || this.mainScreen !== "runtime") {
      mountedApp.destroy();
      return;
    }

    this.runtimeApp = mountedApp;
  }

  private recordBacklogEvent(event: VisibleRuntimeEvent): void {
    const entry = createHtmlBasicBacklogEntry(event, this.nextBacklogId, SPEAKER_NAMES);
    if (entry === null) {
      return;
    }

    this.nextBacklogId += 1;
    this.backlogEntries.push(entry);
    if (this.overlayScreen === "backlog") {
      this.renderOverlay();
    }
  }

  private openOverlay(screen: OverlayScreen): void {
    this.overlayScreen = screen;
    this.renderOverlay();
  }

  private closeOverlay(): void {
    this.overlayScreen = null;
    this.renderOverlay();
  }

  private renderOverlay(): void {
    this.cleanupOverlay();
    this.overlayLayer.replaceChildren();
    if (this.overlayScreen === null) {
      this.overlayLayer.setAttribute("hidden", "");
      return;
    }

    this.overlayLayer.removeAttribute("hidden");
    if (this.overlayScreen === "backlog") {
      this.overlayLayer.append(this.renderBacklogScreen());
    } else if (this.overlayScreen === "settings") {
      this.overlayLayer.append(this.renderSettingsScreen());
    } else {
      this.overlayLayer.append(this.renderGalleryScreen());
    }
  }

  private renderBacklogScreen(): HTMLElement {
    const { screen, content } = this.createPanelScreen("Backlog");
    const backlog = this.element("div", "html-basic-backlog");

    if (this.backlogEntries.length === 0) {
      backlog.append(this.textElement("p", "html-basic-backlog__empty", "No backlog yet."));
    } else {
      const list = this.element("ol", "html-basic-backlog__list");
      for (const entry of this.backlogEntries) {
        const item = this.element("li", "html-basic-backlog__entry");
        item.append(
          this.textElement(
            "p",
            "html-basic-backlog__speaker",
            entry.kind === "dialogue" && entry.speakerName !== null ? entry.speakerName : "Narration",
          ),
          this.textElement("p", "html-basic-backlog__text", entry.text),
        );
        list.append(item);
      }
      backlog.append(list);
    }

    content.append(backlog, this.actionButton("Back", () => this.closeOverlay()));
    return screen;
  }

  private renderSettingsScreen(): HTMLElement {
    const { screen, content } = this.createPanelScreen("Settings");
    const settings = this.element("div", "html-basic-settings");
    settings.append(
      this.renderRangeSetting("Text font size", this.settings.textFontSize, 0.95, 1.35, 0.05, (value) => {
        this.updateSettings({ ...this.settings, textFontSize: value });
      }),
      this.renderRangeSetting(
        "Message window opacity",
        this.settings.messageWindowOpacity,
        0.55,
        0.95,
        0.05,
        (value) => {
          this.updateSettings({ ...this.settings, messageWindowOpacity: value });
        },
        (value) => `${Math.round(value * 100)}%`,
      ),
      this.renderCheckboxSetting("Audio notices", this.settings.audioNoticesVisible, (checked) => {
        this.updateSettings({ ...this.settings, audioNoticesVisible: checked });
      }),
    );

    content.append(settings, this.actionButton("Back", () => this.closeOverlay()));
    return screen;
  }

  private renderGalleryScreen(): HTMLElement {
    const { screen, content } = this.createPanelScreen("Gallery");
    const gallery = this.element("div", "html-basic-gallery");

    if (this.galleryError !== null) {
      gallery.append(this.textElement("p", "html-basic-gallery__empty", this.galleryError));
    } else if (this.galleryAssets === null) {
      gallery.append(this.textElement("p", "html-basic-gallery__empty", "Loading assets..."));
    } else {
      for (const section of createHtmlBasicGallerySections(this.galleryAssets)) {
        const sectionElement = this.element("section", "html-basic-gallery__section");
        sectionElement.append(this.textElement("h2", "html-basic-gallery__heading", section.title));
        const grid = this.element("div", "html-basic-gallery__grid");
        for (const item of section.items) {
          const card = this.element("article", "html-basic-gallery__item");
          if (section.kind === "visual") {
            const image = this.document.createElement("img");
            image.className = "html-basic-gallery__image";
            image.src = item.src;
            image.alt = item.alt;
            card.append(image);
          }
          card.append(this.textElement("p", "html-basic-gallery__id", item.id));
          grid.append(card);
        }
        sectionElement.append(grid);
        gallery.append(sectionElement);
      }
    }

    content.append(gallery, this.actionButton("Back", () => this.closeOverlay()));
    return screen;
  }

  private renderRangeSetting(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
    formatValue: (value: number) => string = (nextValue) => `${nextValue.toFixed(2)}rem`,
  ): HTMLElement {
    const field = this.element("label", "html-basic-settings__field");
    const input = this.document.createElement("input");
    input.className = "html-basic-settings__control";
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute("aria-label", label);
    this.addOverlayListener(input, "input", () => {
      onChange(input.valueAsNumber);
    });
    field.append(
      this.textElement("span", "html-basic-settings__label", label),
      input,
      this.textElement("span", "html-basic-settings__hint", formatValue(value)),
    );
    return field;
  }

  private renderCheckboxSetting(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const field = this.element("label", "html-basic-settings__field");
    const input = this.document.createElement("input");
    input.className = "html-basic-settings__control";
    input.type = "checkbox";
    input.checked = checked;
    input.setAttribute("aria-label", label);
    this.addOverlayListener(input, "change", () => {
      onChange(input.checked);
    });
    field.append(
      this.textElement("span", "html-basic-settings__label", label),
      input,
      this.textElement("span", "html-basic-settings__hint", checked ? "Shown" : "Hidden"),
    );
    return field;
  }

  private updateSettings(settings: HtmlBasicSettings): void {
    this.settings = saveHtmlBasicSettings(settings);
    this.applySettings();
    if (this.overlayScreen === "settings") {
      this.renderOverlay();
    }
  }

  private applySettings(): void {
    for (const [name, value] of Object.entries(toHtmlBasicSettingsStyle(this.settings))) {
      this.appElement.style.setProperty(name, value);
    }
    this.appElement.classList.toggle("html-basic-app--hide-audio-notices", !this.settings.audioNoticesVisible);
  }

  private async loadGalleryAssets(): Promise<void> {
    try {
      this.galleryAssets = await loadTsuzuruHtmlAssets("/assets/assets.json");
      this.galleryError = null;
    } catch (error) {
      this.galleryAssets = null;
      this.galleryError = error instanceof Error ? error.message : String(error);
    }

    if (this.overlayScreen === "gallery") {
      this.renderOverlay();
    }
  }

  private startRuntime(): void {
    this.destroyRuntime();
    this.closeOverlay();
    this.mainScreen = "runtime";
    this.renderMainScreen();
  }

  private returnToTitle(): void {
    this.closeOverlay();
    this.destroyRuntime();
    this.mainScreen = "title";
    this.renderMainScreen();
  }

  private destroyRuntime(): void {
    this.runtimeApp?.destroy();
    this.runtimeApp = null;
    this.runtimeRoot = null;
  }

  private cleanupMain(): void {
    for (const cleanup of this.mainCleanup.splice(0)) {
      cleanup();
    }
  }

  private cleanupOverlay(): void {
    for (const cleanup of this.overlayCleanup.splice(0)) {
      cleanup();
    }
  }

  private createPanelScreen(title: string): { readonly screen: HTMLElement; readonly content: HTMLElement } {
    const screen = this.createScreen(title, "html-basic-screen--panel");
    const content = this.element("div", "html-basic-screen__content html-basic-screen__content--panel");
    content.append(this.textElement("h1", "html-basic-screen__heading", title));
    screen.append(content);
    return { screen, content };
  }

  private createScreen(label: string, className: string): HTMLElement {
    const screen = this.element("section", `html-basic-screen ${className}`);
    screen.setAttribute("aria-label", label);
    return screen;
  }

  private actionButton(
    label: string,
    onClick?: () => void,
    className = "",
    disabled = false,
    scope: "main" | "overlay" = "overlay",
  ): HTMLButtonElement {
    const button = this.document.createElement("button");
    const extraClassName = className ?? "";
    button.type = "button";
    button.className = `html-basic-screen__button${extraClassName.length > 0 ? ` ${extraClassName}` : ""}`;
    button.textContent = label;
    button.disabled = disabled;
    if (onClick !== undefined) {
      if (scope === "main") {
        this.addMainListener(button, "click", onClick);
      } else {
        this.addOverlayListener(button, "click", onClick);
      }
    }
    return button;
  }

  private runtimeMenuButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = this.document.createElement("button");
    button.type = "button";
    button.textContent = label;
    this.addMainListener(button, "click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private addMainListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ): void {
    element.addEventListener(type, listener);
    this.mainCleanup.push(() => element.removeEventListener(type, listener));
  }

  private addOverlayListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ): void {
    element.addEventListener(type, listener);
    this.overlayCleanup.push(() => element.removeEventListener(type, listener));
  }

  private element(tagName: string, className: string): HTMLElement {
    const element = this.document.createElement(tagName);
    element.className = className;
    return element;
  }

  private textElement(tagName: string, className: string, text: string): HTMLElement {
    const element = this.element(tagName, className);
    element.textContent = text;
    return element;
  }
}
