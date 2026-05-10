import { describe, expect, it } from "vitest";
import {
  mountTsuzuruHtmlApp,
  mountTsuzuruHtmlAppsFromDocument,
  type TsuzuruHtmlDeclarativeAppConfig,
  type TsuzuruHtmlFetch,
} from "../src/index.js";

describe("Tsuzuru HTML declarative app", () => {
  it("detects declarative app roots from a document", async () => {
    const { document, root } = createAppFixture();
    root.setAttribute("data-config", "/tsuzuru.app.json");

    const apps = await mountTsuzuruHtmlAppsFromDocument(document as unknown as Document, {
      fetch: createFetch({
        "https://example.test/tsuzuru.app.json": JSON.stringify(testConfig),
      }),
      baseUrl: "https://example.test/game/",
    });

    expect(apps).toHaveLength(1);
    expect(apps[0]?.root).toBe(root);
    expect(root.getAttribute("data-tsuzuru-active-screen")).toBe("title");
  });

  it("switches active screens from hash navigation", async () => {
    const { root, window } = createAppFixture();
    window.location.hash = "#gallery";

    const app = await mountTsuzuruHtmlApp(root as unknown as HTMLElement, { config: testConfig });

    expect(app.getActiveScreen()).toBe("gallery");
    expect(root.queryById("gallery")?.getAttribute("hidden")).toBeNull();

    window.location.hash = "#backlog";
    window.dispatchEvent(new TestEvent("hashchange"));

    expect(app.getActiveScreen()).toBe("backlog");
    expect(root.queryById("gallery")?.getAttribute("hidden")).toBe("");
  });

  it("binds settings controls and writes CSS variables", async () => {
    const { root } = createAppFixture();
    const input = new TestElement("input", root.ownerDocument);
    input.setAttribute("data-tsuzuru-setting", "textFontSize");
    input.value = "1.35";
    const output = new TestElement("span", root.ownerDocument);
    output.setAttribute("data-tsuzuru-setting-output", "textFontSize");
    root.append(input, output);

    await mountTsuzuruHtmlApp(root as unknown as HTMLElement, { config: testConfig });
    input.value = "1.2";
    input.dispatchEvent(new TestEvent("input"));

    expect(root.style.getPropertyValue("--tzr-html-app-message-font-size")).toBe("1.2rem");
    expect(output.textContent).toBe("1.20rem");
  });

  it("loads screen fragments from an injected registry", async () => {
    const { root } = createAppFixture();
    const settings = new TestElement("section", root.ownerDocument);
    settings.id = "settings";
    settings.setAttribute("data-tsuzuru-screen", "settings");
    root.append(settings);

    await mountTsuzuruHtmlApp(root as unknown as HTMLElement, {
      config: testConfig,
      screenFragments: {
        settings: "<p>Settings from registry</p>",
      },
    });

    expect(textContent(settings)).toContain("Settings from registry");
  });

  it("renders gallery assets from assetsUrl", async () => {
    const { root } = createAppFixture();

    await mountTsuzuruHtmlApp(root as unknown as HTMLElement, {
      config: { ...testConfig, assetsUrl: "/assets/assets.json", initialScreen: "gallery" },
      fetch: createFetch({
        "https://example.test/assets/assets.json": JSON.stringify({
          version: 1,
          visual: {
            backgrounds: {
              room: { src: "images/room.svg", alt: "Room" },
            },
          },
        }),
      }),
      baseUrl: "https://example.test/game/",
    });
    await Promise.resolve();

    expect(textContent(root.queryById("gallery"))).toContain("room");
  });

  it("renders gallery assets from injected assets", async () => {
    const { root } = createAppFixture();

    await mountTsuzuruHtmlApp(root as unknown as HTMLElement, {
      config: { ...testConfig, initialScreen: "gallery" },
      assets: {
        version: 1,
        visual: {
          backgrounds: {
            room: { src: "https://example.test/assets/room.svg", alt: "Room" },
          },
          sprites: {},
        },
        audio: {
          bgm: {},
          se: {},
          voice: {},
        },
      },
    });

    expect(textContent(root.queryById("gallery"))).toContain("room");
  });

  it("renders a clear error when runtime root is missing", async () => {
    const { root } = createAppFixture({ includeRuntimeRoot: false, initialHash: "#runtime" });

    await mountTsuzuruHtmlApp(root as unknown as HTMLElement, { config: { ...testConfig, initialScreen: "runtime" } });

    expect(textContent(root)).toContain("missing [data-tsuzuru-runtime]");
  });
});

const testConfig: TsuzuruHtmlDeclarativeAppConfig = {
  version: 1,
  title: "HTML Basic",
  scenario: {
    entryUrl: "/scenario/main.tzr",
    entryId: "scenario/main.tzr",
  },
  initialScreen: "title",
  storageKeyPrefix: "tsuzuru:test",
};

function createAppFixture(options: { readonly includeRuntimeRoot?: boolean; readonly initialHash?: string } = {}): {
  readonly document: TestDocument;
  readonly window: TestWindow;
  readonly root: TestElement;
} {
  const window = new TestWindow();
  window.location.hash = options.initialHash ?? "";
  const document = new TestDocument(window);
  const root = new TestElement("main", document);
  root.setAttribute("data-tsuzuru-html-app", "");
  document.roots.push(root);

  for (const id of ["title", "runtime", "backlog", "gallery"]) {
    const screen = new TestElement("section", document);
    screen.id = id;
    screen.setAttribute("data-tsuzuru-screen", id);
    if (id === "runtime" && options.includeRuntimeRoot !== false) {
      const runtimeRoot = new TestElement("div", document);
      runtimeRoot.setAttribute("data-tsuzuru-runtime", "");
      screen.append(runtimeRoot);
    }
    if (id === "backlog") {
      const backlog = new TestElement("div", document);
      backlog.setAttribute("data-tsuzuru-backlog", "");
      screen.append(backlog);
    }
    if (id === "gallery") {
      const gallery = new TestElement("div", document);
      gallery.setAttribute("data-tsuzuru-gallery", "");
      screen.append(gallery);
    }
    root.append(screen);
  }

  return { document, window, root };
}

function createFetch(files: Readonly<Record<string, string>>): TsuzuruHtmlFetch {
  return async (input) => {
    const source = files[input.toString()];
    return {
      ok: source !== undefined,
      status: source === undefined ? 404 : 200,
      statusText: source === undefined ? "Not Found" : "OK",
      text: async () => source ?? "",
    };
  };
}

function textContent(element: TestElement | null): string {
  if (element === null) {
    return "";
  }
  return `${element.textContent}${element.children.map(textContent).join("")}`;
}

class TestWindow {
  public readonly location = { hash: "" };
  public readonly localStorage = new TestStorage();
  private readonly listeners = new Map<string, Set<(event: TestEvent) => void>>();

  public addEventListener(name: string, listener: (event: TestEvent) => void): void {
    const listeners = this.listeners.get(name) ?? new Set<(event: TestEvent) => void>();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  public removeEventListener(name: string, listener: (event: TestEvent) => void): void {
    this.listeners.get(name)?.delete(listener);
  }

  public dispatchEvent(event: TestEvent): void {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
  }
}

class TestStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class TestDocument {
  public readonly roots: TestElement[] = [];

  public constructor(public readonly defaultView: TestWindow) {}

  public createElement(tagName: string): TestElement {
    return new TestElement(tagName, this);
  }

  public createDocumentFragment(): TestElement {
    return new TestElement("#fragment", this);
  }

  public querySelectorAll(selector: string): TestElement[] {
    return this.roots.flatMap((root) => root.querySelectorAll(selector));
  }
}

class TestElement {
  public id = "";
  public className = "";
  public textContent = "";
  public value = "";
  public checked = false;
  public readonly content: TestElement;
  public readonly style = new TestStyle();
  public readonly children: TestElement[] = [];
  private html = "";
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(event: TestEvent) => void>>();

  public constructor(
    public readonly tagName: string,
    public readonly ownerDocument: TestDocument,
    skipTemplateContent = false,
  ) {
    this.content = tagName === "template" && !skipTemplateContent ? new TestElement("#fragment", ownerDocument, true) : this;
  }

  public get innerHTML(): string {
    return this.html;
  }

  public set innerHTML(value: string) {
    this.html = value;
    if (this.tagName !== "template") {
      return;
    }

    const child = new TestElement("p", this.ownerDocument);
    child.textContent = value.replace(/<[^>]*>/g, "");
    this.content.replaceChildren(child);
  }

  public append(...children: TestElement[]): void {
    this.children.push(...children);
  }

  public replaceChildren(...children: TestElement[]): void {
    this.children.length = 0;
    this.append(...children);
  }

  public cloneNode(deep: boolean): TestElement {
    const clone = new TestElement(this.tagName, this.ownerDocument);
    clone.id = this.id;
    clone.className = this.className;
    clone.textContent = this.textContent;
    for (const [name, value] of this.attributes) {
      clone.setAttribute(name, value);
    }
    if (deep) {
      clone.replaceChildren(...this.children.map((child) => child.cloneNode(true)));
    }
    return clone;
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "id") {
      this.id = value;
    }
  }

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public addEventListener(name: string, listener: (event: TestEvent) => void): void {
    const listeners = this.listeners.get(name) ?? new Set<(event: TestEvent) => void>();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  public removeEventListener(name: string, listener: (event: TestEvent) => void): void {
    this.listeners.get(name)?.delete(listener);
  }

  public dispatchEvent(event: TestEvent): void {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
  }

  public querySelector(selector: string): TestElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  public querySelectorAll(selector: string): TestElement[] {
    const matches = this.matchesSelector(selector) ? [this] : [];
    return [...matches, ...this.children.flatMap((child) => child.querySelectorAll(selector))];
  }

  public queryById(id: string): TestElement | null {
    if (this.id === id) {
      return this;
    }
    for (const child of this.children) {
      const match = child.queryById(id);
      if (match !== null) {
        return match;
      }
    }
    return null;
  }

  private matchesSelector(selector: string): boolean {
    const match = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (match === null) {
      return false;
    }
    const [, name, value] = match;
    if (name === undefined) {
      return false;
    }
    if (!this.attributes.has(name)) {
      return false;
    }
    return value === undefined || this.attributes.get(name) === value;
  }
}

class TestStyle {
  private readonly values = new Map<string, string>();

  public setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  public getPropertyValue(name: string): string {
    return this.values.get(name) ?? "";
  }
}

class TestEvent {
  public constructor(public readonly type: string) {}
}
