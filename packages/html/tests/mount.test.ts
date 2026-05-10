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
    expect(toText(app.element as unknown as TestElement)).toBe("HTML BasicHTML adapter mounted.");
    expect(app.isDestroyed()).toBe(false);
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
  private readonly attributes = new Map<string, string>();

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

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

function toText(element: TestElement): string {
  return `${element.textContent}${element.childNodes.map(toText).join("")}`;
}
