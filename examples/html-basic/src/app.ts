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
  createHtmlBasicScreenTemplateLoader,
  HtmlBasicScreenTemplateError,
  requireHtmlBasicTemplateElement,
  type HtmlBasicScreenTemplateLoader,
} from "./screen-template.js";
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

export interface HtmlBasicAppOptions {
  readonly templates?: HtmlBasicScreenTemplateLoader;
}

export async function createHtmlBasicApp(root: HTMLElement, options: HtmlBasicAppOptions = {}): Promise<HtmlBasicApp> {
  const app = new HtmlBasicDomApp(root, options.templates ?? createHtmlBasicScreenTemplateLoader());
  await app.mount();
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

  public constructor(
    private readonly root: HTMLElement,
    private readonly templates: HtmlBasicScreenTemplateLoader,
  ) {
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

  public async mount(): Promise<void> {
    this.root.replaceChildren(this.appElement);
    this.applySettings();
    this.renderLoading();
    await this.renderMainScreen();
    void this.loadGalleryAssets();
  }

  public destroy(): void {
    this.cleanupMain();
    this.cleanupOverlay();
    this.destroyRuntime();
    this.root.replaceChildren();
  }

  private async renderMainScreen(): Promise<void> {
    this.cleanupMain();
    this.mainLayer.replaceChildren();

    try {
      if (this.mainScreen === "title") {
        this.mainLayer.append(await this.renderTitleScreen());
      } else {
        this.mainLayer.append(await this.renderRuntimeScreen());
      }
    } catch (error) {
      this.mainLayer.append(this.renderTemplateError(error));
    }
  }

  private async renderTitleScreen(): Promise<HTMLElement> {
    const screen = await this.templates.load("title");
    this.connectMainAction(screen, "start", () => {
      void this.startRuntime();
    });
    this.connectMainAction(screen, "open-backlog", () => {
      void this.openOverlay("backlog");
    });
    this.connectMainAction(screen, "open-settings", () => {
      void this.openOverlay("settings");
    });
    this.connectMainAction(screen, "open-gallery", () => {
      void this.openOverlay("gallery");
    });
    return screen;
  }

  private async renderRuntimeScreen(): Promise<HTMLElement> {
    const screen = this.createRuntimeScreen();
    const runtimeRoot = requireHtmlBasicTemplateElement(screen, '[data-slot="runtime-root"]', "runtime");
    const menuSlot = requireHtmlBasicTemplateElement(screen, '[data-slot="runtime-menu"]', "runtime");
    const menu = await this.templates.load("runtime-menu");
    this.connectRuntimeMenu(menu);
    menuSlot.replaceChildren(menu);

    this.runtimeRoot = runtimeRoot;
    void this.mountRuntime(runtimeRoot);
    return screen;
  }

  private createRuntimeScreen(): HTMLElement {
    const screen = this.document.createElement("section");
    screen.className = "html-basic-screen html-basic-runtime-screen";
    screen.setAttribute("aria-label", "Runtime");

    const runtimeRoot = this.document.createElement("div");
    runtimeRoot.className = "html-basic-runtime-root";
    runtimeRoot.setAttribute("data-slot", "runtime-root");

    const menuSlot = this.document.createElement("div");
    menuSlot.setAttribute("data-slot", "runtime-menu");

    screen.append(runtimeRoot, menuSlot);
    return screen;
  }

  private connectRuntimeMenu(menu: HTMLElement): void {
    this.connectMainAction(menu, "return-title", () => {
      void this.returnToTitle();
    });
    this.connectMainAction(menu, "open-backlog", () => {
      void this.openOverlay("backlog");
    });
    this.connectMainAction(menu, "open-settings", () => {
      void this.openOverlay("settings");
    });
    this.connectMainAction(menu, "open-gallery", () => {
      void this.openOverlay("gallery");
    });
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
      void this.renderOverlay();
    }
  }

  private async openOverlay(screen: OverlayScreen): Promise<void> {
    this.overlayScreen = screen;
    await this.renderOverlay();
  }

  private async closeOverlay(): Promise<void> {
    this.overlayScreen = null;
    await this.renderOverlay();
  }

  private async renderOverlay(): Promise<void> {
    this.cleanupOverlay();
    this.overlayLayer.replaceChildren();
    if (this.overlayScreen === null) {
      this.overlayLayer.setAttribute("hidden", "");
      return;
    }

    this.overlayLayer.removeAttribute("hidden");
    try {
      if (this.overlayScreen === "backlog") {
        this.overlayLayer.append(await this.renderBacklogScreen());
      } else if (this.overlayScreen === "settings") {
        this.overlayLayer.append(await this.renderSettingsScreen());
      } else {
        this.overlayLayer.append(await this.renderGalleryScreen());
      }
    } catch (error) {
      this.overlayLayer.append(this.renderTemplateError(error));
    }
  }

  private async renderBacklogScreen(): Promise<HTMLElement> {
    const screen = await this.templates.load("backlog");
    const slot = requireHtmlBasicTemplateElement(screen, '[data-slot="backlog-list"]', "backlog");
    slot.replaceChildren(this.createBacklogContent());
    this.connectOverlayAction(screen, "back", () => {
      void this.closeOverlay();
    });
    return screen;
  }

  private createBacklogContent(): HTMLElement {
    if (this.backlogEntries.length === 0) {
      return this.textElement("p", "html-basic-backlog__empty", "No backlog yet.");
    }

    const list = this.document.createElement("ol");
    list.className = "html-basic-backlog__list";
    for (const entry of this.backlogEntries) {
      const item = this.document.createElement("li");
      item.className = "html-basic-backlog__entry";
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
    return list;
  }

  private async renderSettingsScreen(): Promise<HTMLElement> {
    const screen = await this.templates.load("settings");
    requireHtmlBasicTemplateElement(screen, '[data-slot="settings-form"]', "settings");
    const textFontSize = this.requireInput(screen, '[data-field="text-font-size"]', "settings");
    const messageWindowOpacity = this.requireInput(screen, '[data-field="message-window-opacity"]', "settings");
    const audioNoticesVisible = this.requireInput(screen, '[data-field="audio-notices-visible"]', "settings");

    const syncTemplate = () => {
      textFontSize.value = String(this.settings.textFontSize);
      messageWindowOpacity.value = String(this.settings.messageWindowOpacity);
      audioNoticesVisible.checked = this.settings.audioNoticesVisible;
      this.setSlotText(screen, "text-font-size-value", `${this.settings.textFontSize.toFixed(2)}rem`, "settings");
      this.setSlotText(
        screen,
        "message-window-opacity-value",
        `${Math.round(this.settings.messageWindowOpacity * 100)}%`,
        "settings",
      );
      this.setSlotText(screen, "audio-notices-visible-value", this.settings.audioNoticesVisible ? "Shown" : "Hidden", "settings");
    };

    syncTemplate();
    this.addOverlayListener(textFontSize, "input", () => {
      this.updateSettings({ ...this.settings, textFontSize: textFontSize.valueAsNumber });
      syncTemplate();
    });
    this.addOverlayListener(messageWindowOpacity, "input", () => {
      this.updateSettings({ ...this.settings, messageWindowOpacity: messageWindowOpacity.valueAsNumber });
      syncTemplate();
    });
    this.addOverlayListener(audioNoticesVisible, "change", () => {
      this.updateSettings({ ...this.settings, audioNoticesVisible: audioNoticesVisible.checked });
      syncTemplate();
    });
    this.connectOverlayAction(screen, "back", () => {
      void this.closeOverlay();
    });
    return screen;
  }

  private async renderGalleryScreen(): Promise<HTMLElement> {
    const screen = await this.templates.load("gallery");
    const slot = requireHtmlBasicTemplateElement(screen, '[data-slot="gallery-content"]', "gallery");
    slot.replaceChildren(this.createGalleryContent());
    this.connectOverlayAction(screen, "back", () => {
      void this.closeOverlay();
    });
    return screen;
  }

  private createGalleryContent(): HTMLElement | DocumentFragment {
    if (this.galleryError !== null) {
      return this.textElement("p", "html-basic-gallery__empty", this.galleryError);
    }
    if (this.galleryAssets === null) {
      return this.textElement("p", "html-basic-gallery__empty", "Loading assets...");
    }

    const fragment = this.document.createDocumentFragment();
    for (const section of createHtmlBasicGallerySections(this.galleryAssets)) {
      const sectionElement = this.document.createElement("section");
      sectionElement.className = "html-basic-gallery__section";
      sectionElement.append(this.textElement("h2", "html-basic-gallery__heading", section.title));

      const grid = this.document.createElement("div");
      grid.className = "html-basic-gallery__grid";
      for (const item of section.items) {
        const card = this.document.createElement("article");
        card.className = "html-basic-gallery__item";
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
      fragment.append(sectionElement);
    }
    return fragment;
  }

  private updateSettings(settings: HtmlBasicSettings): void {
    this.settings = saveHtmlBasicSettings(settings);
    this.applySettings();
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
      await this.renderOverlay();
    }
  }

  private async startRuntime(): Promise<void> {
    this.destroyRuntime();
    await this.closeOverlay();
    this.mainScreen = "runtime";
    await this.renderMainScreen();
  }

  private async returnToTitle(): Promise<void> {
    await this.closeOverlay();
    this.destroyRuntime();
    this.mainScreen = "title";
    await this.renderMainScreen();
  }

  private destroyRuntime(): void {
    this.runtimeApp?.destroy();
    this.runtimeApp = null;
    this.runtimeRoot = null;
  }

  private renderLoading(): void {
    const screen = this.document.createElement("section");
    screen.className = "html-basic-screen html-basic-screen--panel";
    screen.setAttribute("aria-label", "Loading");
    const content = this.document.createElement("div");
    content.className = "html-basic-screen__content html-basic-screen__content--panel";
    content.append(this.textElement("h1", "html-basic-screen__heading", "Loading"));
    screen.append(content);
    this.mainLayer.replaceChildren(screen);
  }

  private renderTemplateError(error: unknown): HTMLElement {
    const screen = this.document.createElement("section");
    screen.className = "html-basic-screen html-basic-screen--panel";
    screen.setAttribute("aria-label", "Template Error");
    const content = this.document.createElement("div");
    content.className = "html-basic-screen__content html-basic-screen__content--panel";
    content.append(
      this.textElement("h1", "html-basic-screen__heading", "Template Error"),
      this.textElement("pre", "html-basic-template-error", formatError(error)),
    );
    screen.append(content);
    return screen;
  }

  private connectMainAction(root: HTMLElement, action: string, handler: (event: MouseEvent) => void): void {
    this.addMainListener(requireActionButton(root, action, "main"), "click", handler);
  }

  private connectOverlayAction(root: HTMLElement, action: string, handler: (event: MouseEvent) => void): void {
    this.addOverlayListener(requireActionButton(root, action, "overlay"), "click", handler);
  }

  private requireInput(root: HTMLElement, selector: string, templateName: string): HTMLInputElement {
    const element = requireHtmlBasicTemplateElement(root, selector, templateName);
    if (!(element instanceof HTMLInputElement)) {
      throw new HtmlBasicScreenTemplateError(`Template "${templateName}" selector must be an input: ${selector}`);
    }
    return element;
  }

  private setSlotText(root: HTMLElement, slot: string, text: string, templateName: string): void {
    requireHtmlBasicTemplateElement(root, `[data-slot="${slot}"]`, templateName).textContent = text;
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

  private textElement(tagName: string, className: string, text: string): HTMLElement {
    const element = this.document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }
}

function requireActionButton(root: HTMLElement, action: string, templateName: string): HTMLElement {
  return requireHtmlBasicTemplateElement(root, `[data-action="${action}"]`, templateName);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
