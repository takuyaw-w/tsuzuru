import type { RuntimeEvent } from "@tsuzuru/core";
import {
  loadTsuzuruHtmlDeclarativeAppConfig,
  type TsuzuruHtmlDeclarativeAppConfig,
  type TsuzuruHtmlDeclarativeAppConfigLoadOptions,
} from "./app-config.js";
import { loadTsuzuruHtmlAssets, type TsuzuruHtmlAssets } from "./assets-loader.js";
import { mountTsuzuruHtml, type TsuzuruHtmlApp } from "./mount.js";
import type { TsuzuruHtmlFetch } from "./scenario-loader.js";

export interface TsuzuruHtmlDeclarativeAppMountOptions {
  readonly config?: TsuzuruHtmlDeclarativeAppConfig;
  readonly configUrl?: string | URL;
  readonly assets?: TsuzuruHtmlAssets;
  readonly screenFragments?: Readonly<Record<string, string>>;
  readonly fetch?: TsuzuruHtmlFetch;
  readonly baseUrl?: string | URL;
}

export interface TsuzuruHtmlDeclarativeApp {
  readonly root: HTMLElement;
  readonly config: TsuzuruHtmlDeclarativeAppConfig;
  readonly destroy: () => void;
  readonly getActiveScreen: () => string;
}

interface DeclarativeBacklogEntry {
  readonly id: number;
  readonly kind: "narration" | "dialogue";
  readonly speakerName: string | null;
  readonly text: string;
}

interface DeclarativeSettings {
  readonly textFontSize: number;
  readonly messageWindowOpacity: number;
  readonly audioNoticesVisible: boolean;
}

const DEFAULT_SETTINGS: DeclarativeSettings = {
  textFontSize: 1.08,
  messageWindowOpacity: 0.78,
  audioNoticesVisible: true,
};

export async function mountTsuzuruHtmlApp(
  root: HTMLElement,
  options: TsuzuruHtmlDeclarativeAppMountOptions = {},
): Promise<TsuzuruHtmlDeclarativeApp> {
  const config =
    options.config ??
    (await loadTsuzuruHtmlDeclarativeAppConfig(options.configUrl ?? root.getAttribute("data-config") ?? "/tsuzuru.app.json", {
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    }));

  const app = new DeclarativeApp(root, config, options);
  await app.mount();
  return app;
}

export async function mountTsuzuruHtmlAppFromConfig(
  root: HTMLElement,
  configUrl: string | URL,
  options: Omit<TsuzuruHtmlDeclarativeAppMountOptions, "config" | "configUrl"> = {},
): Promise<TsuzuruHtmlDeclarativeApp> {
  return mountTsuzuruHtmlApp(root, { ...options, configUrl });
}

export async function mountTsuzuruHtmlAppsFromDocument(
  document: Document = globalThis.document,
  options: Omit<TsuzuruHtmlDeclarativeAppMountOptions, "config" | "configUrl"> = {},
): Promise<readonly TsuzuruHtmlDeclarativeApp[]> {
  const roots = [...document.querySelectorAll("[data-tsuzuru-html-app]")].filter(isHtmlElement);
  return Promise.all(
    roots.map((root) =>
      mountTsuzuruHtmlApp(root, {
        ...options,
        configUrl: root.getAttribute("data-config") ?? "/tsuzuru.app.json",
      }),
    ),
  );
}

class DeclarativeApp implements TsuzuruHtmlDeclarativeApp {
  private readonly document: Document;
  private readonly window: Window | null;
  private readonly removeListeners: Array<() => void> = [];
  private readonly backlog: DeclarativeBacklogEntry[] = [];
  private settings: DeclarativeSettings;
  private nextBacklogId = 1;
  private activeScreen = "";
  private runtimeApp: TsuzuruHtmlApp | null = null;
  private assets: TsuzuruHtmlAssets | null = null;
  private assetsError: string | null = null;

  public constructor(
    public readonly root: HTMLElement,
    public readonly config: TsuzuruHtmlDeclarativeAppConfig,
    private readonly options: TsuzuruHtmlDeclarativeAppMountOptions,
  ) {
    this.document = root.ownerDocument;
    this.window = this.document.defaultView;
    this.settings = this.loadSettings();
  }

  public async mount(): Promise<void> {
    await this.loadExternalScreenFragments();
    this.connectSettings();
    this.applySettings();
    this.renderBacklog();
    this.renderGallery();
    void this.loadAssets();

    const handleHashChange = () => {
      this.activateScreen(this.screenFromHash());
    };
    this.window?.addEventListener("hashchange", handleHashChange);
    this.removeListeners.push(() => this.window?.removeEventListener("hashchange", handleHashChange));

    this.activateScreen(this.screenFromHash());
  }

  public destroy(): void {
    for (const removeListener of this.removeListeners.splice(0)) {
      removeListener();
    }
    this.destroyRuntime();
  }

  public getActiveScreen(): string {
    return this.activeScreen;
  }

  private async loadExternalScreenFragments(): Promise<void> {
    const screens = this.getScreens();
    await Promise.all(
      screens.map(async (screen) => {
        const registryHtml = this.options.screenFragments?.[screen.id];
        if (registryHtml !== undefined) {
          this.replaceScreenWithHtml(screen, registryHtml);
          return;
        }

        const fragmentUrl = screen.getAttribute("data-src");
        if (fragmentUrl === null || fragmentUrl.length === 0) {
          return;
        }

        try {
          const html = await this.fetchText(fragmentUrl, "screen fragment");
          this.replaceScreenWithHtml(screen, html);
        } catch (error) {
          renderInlineError(this.document, screen, formatError(error));
        }
      }),
    );
  }

  private activateScreen(requestedScreen: string): void {
    const screens = this.getScreens();
    const screenIds = new Set(screens.map((screen) => screen.id));
    const fallbackScreen = screenIds.has(this.config.initialScreen) ? this.config.initialScreen : "title";
    const activeScreen = screenIds.has(requestedScreen) ? requestedScreen : fallbackScreen;
    this.activeScreen = activeScreen;
    this.root.setAttribute("data-tsuzuru-active-screen", activeScreen);

    for (const screen of screens) {
      if (screen.id === activeScreen) {
        screen.removeAttribute("hidden");
        screen.setAttribute("data-tsuzuru-screen-active", "");
      } else {
        screen.setAttribute("hidden", "");
        screen.removeAttribute("data-tsuzuru-screen-active");
      }
    }

    if (activeScreen === "runtime") {
      void this.mountRuntime();
    } else if (activeScreen === "title") {
      this.destroyRuntime();
    }

    if (activeScreen === "backlog") {
      this.renderBacklog();
    }
    if (activeScreen === "settings") {
      this.syncSettingsControls();
    }
    if (activeScreen === "gallery") {
      this.renderGallery();
    }
  }

  private async mountRuntime(): Promise<void> {
    if (this.runtimeApp !== null) {
      return;
    }

    const runtimeRoot = this.root.querySelector("[data-tsuzuru-runtime]");
    if (!isHtmlElement(runtimeRoot)) {
      renderInlineError(this.document, this.root, "Declarative Tsuzuru app is missing [data-tsuzuru-runtime].");
      return;
    }

    const mountedApp = await mountTsuzuruHtml(runtimeRoot, {
      title: this.config.title,
      scenario: this.config.scenario,
      ...(this.options.assets === undefined ? {} : { assets: this.options.assets }),
      ...(this.config.assetsUrl === undefined ? {} : { assetsUrl: this.config.assetsUrl }),
      ...(this.options.fetch === undefined ? {} : { fetch: this.options.fetch }),
      ...(this.options.baseUrl === undefined ? {} : { baseUrl: this.options.baseUrl }),
      onVisibleEventChange: (event) => {
        this.recordBacklogEvent(event);
      },
    });

    if (this.activeScreen !== "runtime") {
      mountedApp.destroy();
      return;
    }
    this.runtimeApp = mountedApp;
  }

  private destroyRuntime(): void {
    this.runtimeApp?.destroy();
    this.runtimeApp = null;
  }

  private recordBacklogEvent(event: RuntimeEvent | null): void {
    const entry = createBacklogEntry(event, this.nextBacklogId);
    if (entry === null) {
      return;
    }

    this.nextBacklogId += 1;
    this.backlog.push(entry);
    if (this.activeScreen === "backlog") {
      this.renderBacklog();
    }
  }

  private renderBacklog(): void {
    for (const target of this.root.querySelectorAll("[data-tsuzuru-backlog]")) {
      if (!isHtmlElement(target)) {
        continue;
      }
      if (this.backlog.length === 0) {
        target.replaceChildren(createTextElement(this.document, "p", "tzr-html-app-backlog__empty", "No backlog yet."));
        continue;
      }

      const list = this.document.createElement("ol");
      list.className = "tzr-html-app-backlog__list";
      for (const entry of this.backlog) {
        const item = this.document.createElement("li");
        item.className = "tzr-html-app-backlog__entry";
        item.append(
          createTextElement(
            this.document,
            "p",
            "tzr-html-app-backlog__speaker",
            entry.kind === "dialogue" && entry.speakerName !== null ? entry.speakerName : "Narration",
          ),
          createTextElement(this.document, "p", "tzr-html-app-backlog__text", entry.text),
        );
        list.append(item);
      }
      target.replaceChildren(list);
    }
  }

  private connectSettings(): void {
    for (const input of this.root.querySelectorAll("[data-tsuzuru-setting]")) {
      if (!isHtmlElement(input)) {
        continue;
      }
      const key = input.getAttribute("data-tsuzuru-setting");
      const handleInput = () => {
        this.updateSettingFromInput(input, key);
      };
      input.addEventListener("input", handleInput);
      input.addEventListener("change", handleInput);
      this.removeListeners.push(() => input.removeEventListener("input", handleInput));
      this.removeListeners.push(() => input.removeEventListener("change", handleInput));
    }
    this.syncSettingsControls();
  }

  private updateSettingFromInput(input: HTMLElement, key: string | null): void {
    if (key === "textFontSize") {
      this.settings = { ...this.settings, textFontSize: readNumberInput(input, this.settings.textFontSize) };
    } else if (key === "messageWindowOpacity") {
      this.settings = {
        ...this.settings,
        messageWindowOpacity: readNumberInput(input, this.settings.messageWindowOpacity),
      };
    } else if (key === "audioNoticesVisible") {
      this.settings = { ...this.settings, audioNoticesVisible: readCheckedInput(input) };
    } else {
      return;
    }

    this.saveSettings();
    this.applySettings();
    this.syncSettingsOutputs();
  }

  private syncSettingsControls(): void {
    for (const input of this.root.querySelectorAll("[data-tsuzuru-setting]")) {
      if (!isHtmlElement(input)) {
        continue;
      }
      const key = input.getAttribute("data-tsuzuru-setting");
      if (key === "textFontSize") {
        writeInputValue(input, this.settings.textFontSize);
      } else if (key === "messageWindowOpacity") {
        writeInputValue(input, this.settings.messageWindowOpacity);
      } else if (key === "audioNoticesVisible") {
        writeInputChecked(input, this.settings.audioNoticesVisible);
      }
    }
    this.syncSettingsOutputs();
  }

  private syncSettingsOutputs(): void {
    for (const output of this.root.querySelectorAll("[data-tsuzuru-setting-output]")) {
      if (!isHtmlElement(output)) {
        continue;
      }
      const key = output.getAttribute("data-tsuzuru-setting-output");
      output.textContent =
        key === "textFontSize"
          ? `${this.settings.textFontSize.toFixed(2)}rem`
          : key === "messageWindowOpacity"
            ? `${Math.round(this.settings.messageWindowOpacity * 100)}%`
            : key === "audioNoticesVisible"
              ? this.settings.audioNoticesVisible
                ? "Shown"
                : "Hidden"
              : "";
    }
  }

  private applySettings(): void {
    this.root.style.setProperty("--tzr-html-app-message-font-size", `${this.settings.textFontSize}rem`);
    this.root.style.setProperty("--tzr-html-app-message-window-opacity", String(this.settings.messageWindowOpacity));
    this.root.setAttribute("data-tsuzuru-audio-notices", this.settings.audioNoticesVisible ? "visible" : "hidden");
  }

  private loadSettings(): DeclarativeSettings {
    const storage = this.window?.localStorage;
    if (storage === undefined) {
      return DEFAULT_SETTINGS;
    }

    const rawValue = storage.getItem(`${this.config.storageKeyPrefix}:settings`);
    if (rawValue === null) {
      return DEFAULT_SETTINGS;
    }

    try {
      return normalizeSettings(JSON.parse(rawValue));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private saveSettings(): void {
    this.window?.localStorage?.setItem(`${this.config.storageKeyPrefix}:settings`, JSON.stringify(this.settings));
  }

  private async loadAssets(): Promise<void> {
    if (this.options.assets !== undefined) {
      this.assets = this.options.assets;
      this.assetsError = null;
      this.renderGallery();
      return;
    }

    if (this.config.assetsUrl === undefined) {
      this.assets = null;
      this.assetsError = null;
      this.renderGallery();
      return;
    }

    try {
      this.assets = await loadTsuzuruHtmlAssets(this.config.assetsUrl, {
        ...(this.options.fetch === undefined ? {} : { fetch: this.options.fetch }),
        ...(this.options.baseUrl === undefined ? {} : { baseUrl: this.options.baseUrl }),
      });
      this.assetsError = null;
    } catch (error) {
      this.assets = null;
      this.assetsError = formatError(error);
    }
    this.renderGallery();
  }

  private renderGallery(): void {
    for (const target of this.root.querySelectorAll("[data-tsuzuru-gallery]")) {
      if (!isHtmlElement(target)) {
        continue;
      }

      if (this.assetsError !== null) {
        target.replaceChildren(createTextElement(this.document, "p", "tzr-html-app-gallery__empty", this.assetsError));
      } else if (this.assets === null) {
        target.replaceChildren(createTextElement(this.document, "p", "tzr-html-app-gallery__empty", "Loading assets..."));
      } else {
        target.replaceChildren(createGalleryFragment(this.document, this.assets));
      }
    }
  }

  private screenFromHash(): string {
    const hash = this.window?.location.hash ?? "";
    return hash.startsWith("#") && hash.length > 1 ? decodeURIComponent(hash.slice(1)) : this.config.initialScreen;
  }

  private getScreens(): HTMLElement[] {
    return [...this.root.querySelectorAll("[data-tsuzuru-screen]")].filter(isHtmlElement);
  }

  private async fetchText(url: string, label: string): Promise<string> {
    const fetch = this.options.fetch ?? globalThis.fetch.bind(globalThis);
    let response: Awaited<ReturnType<TsuzuruHtmlFetch>>;
    try {
      response = await fetch(url);
    } catch (cause) {
      throw new Error(`Failed to fetch ${label} "${url}": ${formatError(cause)}.`);
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch ${label} "${url}": ${response.status} ${response.statusText}.`);
    }
    return response.text();
  }

  private replaceScreenWithHtml(screen: HTMLElement, html: string): void {
    const template = this.document.createElement("template");
    template.innerHTML = html.trim();
    screen.replaceChildren(template.content.cloneNode(true));
  }
}

function createBacklogEntry(event: RuntimeEvent | null, id: number): DeclarativeBacklogEntry | null {
  if (event?.type !== "narration" && event?.type !== "dialogue") {
    return null;
  }

  const text = event.lines.map((line) => line.text).join("\n");
  if (event.type === "narration") {
    return { id, kind: "narration", speakerName: null, text };
  }

  return {
    id,
    kind: "dialogue",
    speakerName: event.speaker,
    text,
  };
}

function createGalleryFragment(document: Document, assets: TsuzuruHtmlAssets): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const sections = [
    { title: "Backgrounds", kind: "visual", items: Object.entries(assets.visual.backgrounds) },
    { title: "Sprites", kind: "visual", items: Object.entries(assets.visual.sprites) },
    {
      title: "Audio",
      kind: "audio",
      items: [...Object.entries(assets.audio.bgm), ...Object.entries(assets.audio.se), ...Object.entries(assets.audio.voice)],
    },
  ] as const;

  for (const section of sections) {
    const sectionElement = document.createElement("section");
    sectionElement.className = "tzr-html-app-gallery__section";
    sectionElement.append(createTextElement(document, "h2", "tzr-html-app-gallery__heading", section.title));
    const grid = document.createElement("div");
    grid.className = "tzr-html-app-gallery__grid";
    for (const [assetId, asset] of section.items) {
      const card = document.createElement("article");
      card.className = "tzr-html-app-gallery__item";
      if (section.kind === "visual") {
        const image = document.createElement("img");
        image.className = "tzr-html-app-gallery__image";
        image.src = asset.src;
        image.alt = asset.alt ?? assetId;
        card.append(image);
      }
      card.append(createTextElement(document, "p", "tzr-html-app-gallery__id", assetId));
      grid.append(card);
    }
    sectionElement.append(grid);
    fragment.append(sectionElement);
  }

  return fragment;
}

function normalizeSettings(value: unknown): DeclarativeSettings {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_SETTINGS;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return {
    textFontSize: clampNumber(record.textFontSize, 0.95, 1.35, DEFAULT_SETTINGS.textFontSize),
    messageWindowOpacity: clampNumber(
      record.messageWindowOpacity,
      0.55,
      0.95,
      DEFAULT_SETTINGS.messageWindowOpacity,
    ),
    audioNoticesVisible:
      typeof record.audioNoticesVisible === "boolean" ? record.audioNoticesVisible : DEFAULT_SETTINGS.audioNoticesVisible,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function readNumberInput(input: HTMLElement, fallback: number): number {
  const value = Number((input as HTMLInputElement).value);
  return Number.isFinite(value) ? value : fallback;
}

function readCheckedInput(input: HTMLElement): boolean {
  return Boolean((input as HTMLInputElement).checked);
}

function writeInputValue(input: HTMLElement, value: number): void {
  (input as HTMLInputElement).value = String(value);
}

function writeInputChecked(input: HTMLElement, checked: boolean): void {
  (input as HTMLInputElement).checked = checked;
}

function renderInlineError(document: Document, target: HTMLElement, message: string): void {
  target.replaceChildren(createTextElement(document, "pre", "tzr-html-app-error", message));
}

function createTextElement(document: Document, tagName: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement === "undefined"
    ? typeof value === "object" && value !== null && "querySelectorAll" in value
    : value instanceof HTMLElement;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
