import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("html-basic declarative files", () => {
  it("keeps the app entrypoint declarative", async () => {
    await expect(readFile(join(import.meta.dirname, "../src/main.ts"), "utf8")).resolves.toContain(
      "mountTsuzuruHtmlAppsFromDocument",
    );
  });

  it("declares hash-link screens in index.html", async () => {
    const html = await readFile(join(import.meta.dirname, "../index.html"), "utf8");

    expect(html).toContain("data-tsuzuru-html-app");
    expect(html).toContain('href="#runtime"');
    expect(html).toContain('href="#backlog"');
    expect(html).toContain('href="#settings"');
    expect(html).toContain('href="#gallery"');
    expect(html).toContain('data-src="/screens/settings.html"');
  });

  it("keeps settings as an external fragment", async () => {
    const html = await readFile(join(import.meta.dirname, "../public/screens/settings.html"), "utf8");

    expect(html).toContain('data-tsuzuru-setting="textFontSize"');
    expect(html).toContain('data-tsuzuru-setting="messageWindowOpacity"');
    expect(html).toContain('data-tsuzuru-setting="audioNoticesVisible"');
  });
});
