import { compileTzr, parseTzr, type RuntimeDocument } from "@tsuzuru/core";
import { describe, expect, it, vi } from "vitest";
import { mountTsuzuruHtml, type TsuzuruHtmlAssets, type TsuzuruHtmlFetch } from "../src/index.js";

describe("mountTsuzuruHtml", () => {
  it("mounts a minimal shell into the root", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;

    const app = await mountTsuzuruHtml(root, { title: "HTML Basic", className: "custom-shell" });

    expect(app.root).toBe(root);
    expect(app.element.className).toBe("tzr-html-player custom-shell");
    expect(app.element.getAttribute("data-tsuzuru-html-state")).toBe("mounted");
    expect(root.childNodes).toEqual([app.element]);
    expect(toText(app.element as unknown as TestElement)).toBe("HTML BasicHTML adapter mounted.HTML adapter mounted.");
    expect(app.isDestroyed()).toBe(false);
    expect(app.getState()).toBeNull();
  });

  it("destroys the mounted shell once", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const app = await mountTsuzuruHtml(root);

    app.destroy();
    app.destroy();

    expect(root.childNodes).toEqual([]);
    expect(app.element.getAttribute("data-tsuzuru-html-state")).toBe("destroyed");
    expect(app.isDestroyed()).toBe(true);
  });

  it("mounts a scenario and renders narration through the runtime controller", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const app = await mountTsuzuruHtml(root, {
      title: "Scenario",
      scenario: {
        document: compileScript(`scene start:
  narration:
    Ready.
`),
      },
    });

    expect(toText(app.element as unknown as TestElement)).toContain("Click, Enter, or Space to start.");

    app.step();

    expect(app.getVisibleEvent()).toMatchObject({ type: "narration" });
    expect(toText(app.element as unknown as TestElement)).toContain("Ready.");
  });

  it("notifies runtime and visible event changes", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const runtimeEvents: Array<string | null> = [];
    const visibleEvents: Array<string | null> = [];
    const app = await mountTsuzuruHtml(root, {
      scenario: {
        document: compileScript(`scene start:
  narration:
    Ready.
  choice "Choose":
    "Stay":
      narration:
        Stayed.
`),
      },
      onRuntimeEventChange: (event) => {
        runtimeEvents.push(event?.type ?? null);
      },
      onVisibleEventChange: (event) => {
        visibleEvents.push(event?.type ?? null);
      },
    });

    app.step();
    app.step();

    expect(runtimeEvents).toEqual(["narration", "choice"]);
    expect(visibleEvents).toEqual(["narration", "choice"]);
  });

  it("renders choices and resolves choice button clicks", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const app = await mountTsuzuruHtml(root, {
      scenario: {
        document: compileScript(`scene start:
  choice "Choose":
    "Stay":
      narration:
        Stayed.
    "Leave":
      narration:
        Left.
`),
      },
    });

    app.step();

    expect(toText(app.element as unknown as TestElement)).toContain("Choose");
    const buttons = findByTagName(app.element as unknown as TestElement, "button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Stay", "Leave"]);

    buttons[1]?.dispatchEvent(new TestEvent("click"));

    expect(app.getVisibleEvent()).toMatchObject({ type: "narration" });
    expect(toText(app.element as unknown as TestElement)).toContain("Left.");
  });

  it("renders scenario loader errors inside the mounted player", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const app = await mountTsuzuruHtml(root, {
      scenario: {
        entryUrl: "https://example.test/missing.tzr",
      },
      fetch: async () => ({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "",
      }),
    });

    expect(app.element.getAttribute("data-tsuzuru-html-state")).toBe("error");
    expect(toText(app.element as unknown as TestElement)).toContain("Failed to fetch scenario document");
  });

  it("renders assetsUrl manifest errors inside the mounted player", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const app = await mountTsuzuruHtml(root, {
      scenario: {
        entryUrl: "/scenario/main.tzr",
      },
      assetsUrl: "/assets/assets.json",
      baseUrl: "https://example.test/game/",
      fetch: createUrlFetch({
        "https://example.test/assets/assets.json": JSON.stringify({ version: 2 }),
        "https://example.test/scenario/main.tzr": `scene start:
  narration:
    Ready.
`,
      }),
    });

    expect(app.element.getAttribute("data-tsuzuru-html-state")).toBe("error");
    expect(toText(app.element as unknown as TestElement)).toContain("Unsupported assets.json version: 2");
  });

  it("loads assets and renders std-visual plus std-audio from a URL scenario", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const audioElements: FakeAudio[] = [];
    const app = await mountTsuzuruHtml(root, {
      scenario: {
        entryUrl: "https://example.test/scenario/main.tzr",
      },
      assets: testAssets,
      fetch: createScenarioFetch(`scene start:
  bg room
  show mio_smile at center
  bgm daily_theme
  se page
  voice mio_001
  narration:
    Ready.
`),
      audioFactory: (src) => {
        const audio = new FakeAudio(src);
        audioElements.push(audio);
        return audio;
      },
    });

    app.step();
    await Promise.resolve();

    expect(toText(app.element as unknown as TestElement)).toContain("Ready.");
    expect(
      findByTagName(app.element as unknown as TestElement, "img").map((image) => image.getAttribute("src")),
    ).toEqual(["https://example.test/assets/images/room.svg", "https://example.test/assets/images/mio.svg"]);
    expect(audioElements.map((audio) => audio.src)).toEqual([
      "https://example.test/assets/audio/bgm.mp3",
      "https://example.test/assets/audio/page.mp3",
      "https://example.test/assets/audio/mio.mp3",
    ]);
    expect(audioElements.map((audio) => audio.playCount)).toEqual([1, 1, 1]);
  });

  it("loads assetsUrl and resolves visual asset URLs during mount", async () => {
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const app = await mountTsuzuruHtml(root, {
      scenario: {
        entryUrl: "/scenario/main.tzr",
      },
      assetsUrl: "/assets/assets.json",
      baseUrl: "https://example.test/game/",
      fetch: createUrlFetch({
        "https://example.test/scenario/main.tzr": `scene start:
  bg room
  narration:
    Ready.
`,
        "https://example.test/assets/assets.json": JSON.stringify({
          version: 1,
          visual: { backgrounds: { room: { src: "images/room.svg" } } },
        }),
      }),
    });

    app.step();

    expect(findByTagName(app.element as unknown as TestElement, "img")[0]?.getAttribute("src")).toBe(
      "https://example.test/assets/images/room.svg",
    );
  });

  it("renders missing visual assets as non-fatal notices and placeholders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const document = new TestDocument();
    const root = document.createElement("main") as unknown as HTMLElement;
    const app = await mountTsuzuruHtml(root, {
      scenario: {
        entryUrl: "https://example.test/scenario/main.tzr",
      },
      assets: {
        version: 1,
        visual: { backgrounds: {}, sprites: {} },
        audio: { bgm: {}, se: {}, voice: {} },
      },
      fetch: createScenarioFetch(`scene start:
  bg missing_room
  narration:
    Ready.
`),
    });

    app.step();

    expect(toText(app.element as unknown as TestElement)).toContain("Missing background: missing_room");
    expect(toText(app.element as unknown as TestElement)).toContain("Background asset is not mapped: missing_room");
    warn.mockRestore();
  });
});

class TestDocument {
  public createElement(tagName: string): TestElement {
    return new TestElement(this, tagName);
  }
}

class TestElement {
  public className = "";
  public textContent = "";
  public readonly childNodes: TestElement[] = [];
  public parentNode: TestElement | null = null;
  public type = "";
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(event: TestEvent) => void>>();

  public constructor(
    public readonly ownerDocument: TestDocument,
    public readonly tagName: string,
  ) {}

  public append(...children: TestElement[]): void {
    for (const child of children) {
      child.parentNode = this;
      this.childNodes.push(child);
    }
  }

  public replaceChildren(...children: TestElement[]): void {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes.length = 0;
    this.append(...children);
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
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

  public dispatchEvent(event: TestEvent): boolean {
    event.target = this;
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    if (!event.isPropagationStopped && this.parentNode !== null) {
      this.parentNode.dispatchEvent(event);
    }
    return true;
  }
}

function toText(element: TestElement): string {
  return `${element.textContent}${element.childNodes.map(toText).join("")}`;
}

function findByTagName(element: TestElement, tagName: string): TestElement[] {
  return [
    ...(element.tagName === tagName ? [element] : []),
    ...element.childNodes.flatMap((child) => findByTagName(child, tagName)),
  ];
}

const testAssets: TsuzuruHtmlAssets = {
  version: 1,
  visual: {
    backgrounds: {
      room: { src: "https://example.test/assets/images/room.svg", alt: "Room" },
    },
    sprites: {
      mio_smile: { src: "https://example.test/assets/images/mio.svg", alt: "Mio" },
    },
  },
  audio: {
    bgm: { daily_theme: { src: "https://example.test/assets/audio/bgm.mp3" } },
    se: { page: { src: "https://example.test/assets/audio/page.mp3" } },
    voice: { mio_001: { src: "https://example.test/assets/audio/mio.mp3" } },
  },
};

function createScenarioFetch(source: string): TsuzuruHtmlFetch {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => source,
  });
}

function createUrlFetch(files: Readonly<Record<string, string>>): TsuzuruHtmlFetch {
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

class FakeAudio {
  public loop = false;
  public volume = 1;
  public currentTime = 0;
  public playCount = 0;
  public pauseCount = 0;

  public constructor(public readonly src: string) {}

  public play(): void {
    this.playCount += 1;
  }

  public pause(): void {
    this.pauseCount += 1;
  }

  public addEventListener(): void {
    // No-op for the fake audio element.
  }
}

class TestEvent {
  public target: TestElement | null = null;
  public isPropagationStopped = false;

  public constructor(
    public readonly type: string,
    public readonly key = "",
  ) {}

  public stopPropagation(): void {
    this.isPropagationStopped = true;
  }

  public preventDefault(): void {
    // No-op for the minimal event used by these DOM tests.
  }
}

function compileScript(source: string): RuntimeDocument {
  const parsed = parseTzr(source, { filePath: "scenario/main.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(parsed.errors.map((error) => error.message).join("\n"));
  }

  const compiled = compileTzr(parsed.document);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error(compiled.errors.map((error) => error.message).join("\n"));
  }

  return compiled.document;
}
