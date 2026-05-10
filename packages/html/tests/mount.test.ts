import { compileTzr, parseTzr, type RuntimeDocument } from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import { mountTsuzuruHtml } from "../src/index.js";

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
