import { createInitialRuntimeState, stepRuntime } from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  loadScenarioDocumentsFromUrl,
  loadTsuzuruHtmlScenario,
  type TsuzuruHtmlFetch,
  TsuzuruHtmlScenarioLoadError,
} from "../src/index.js";

describe("loadTsuzuruHtmlScenario", () => {
  it("loads and compiles a scenario from an entry URL", async () => {
    const fetch = createScenarioFetch({
      "https://example.test/scenario/main.tzr": `scene start:
  narration:
    Loaded.
`,
    });

    const document = await loadTsuzuruHtmlScenario(
      { entryUrl: "/scenario/main.tzr", entryId: "scenario/main.tzr" },
      { fetch, baseUrl: "https://example.test/game/" },
    );
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const narration = stepRuntime(document, scene.state);

    expect(document.filePath).toBe("scenario/main.tzr");
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Loaded." }],
    });
  });

  it("resolves nested include URLs and document ids", async () => {
    const fetch = createScenarioFetch({
      "https://example.test/scenario/main.tzr": `include "./chapters/01-opening.tzr"
scene start:
  jump opening
`,
      "https://example.test/scenario/chapters/01-opening.tzr": `include "./02-common.tzr"
scene opening:
  jump common
`,
      "https://example.test/scenario/chapters/02-common.tzr": `scene common:
  narration:
    Common.
`,
    });

    const documents = await loadScenarioDocumentsFromUrl(
      { entryUrl: "/scenario/main.tzr", entryId: "scenario/main.tzr" },
      { fetch, baseUrl: "https://example.test/game/" },
    );

    expect(documents.map((document) => document.id)).toEqual([
      "scenario/main.tzr",
      "scenario/chapters/01-opening.tzr",
      "scenario/chapters/02-common.tzr",
    ]);
    expect(fetch.calls).toEqual([
      "https://example.test/scenario/main.tzr",
      "https://example.test/scenario/chapters/01-opening.tzr",
      "https://example.test/scenario/chapters/02-common.tzr",
    ]);
  });

  it("dedupes duplicate include targets", async () => {
    const fetch = createScenarioFetch({
      "https://example.test/scenario/main.tzr": `include "./chapters/a.tzr"
include "./chapters/a.tzr"
scene start:
  jump a
`,
      "https://example.test/scenario/chapters/a.tzr": `scene a:
  narration:
    A.
`,
    });

    const documents = await loadScenarioDocumentsFromUrl(
      { entryUrl: "/scenario/main.tzr", entryId: "scenario/main.tzr" },
      { fetch, baseUrl: "https://example.test/" },
    );

    expect(documents.map((document) => document.id)).toEqual([
      "scenario/main.tzr",
      "scenario/chapters/a.tzr",
    ]);
    expect(fetch.calls.filter((url) => url.endsWith("/a.tzr"))).toHaveLength(1);
  });

  it("reports circular includes as scenario load errors", async () => {
    const fetch = createScenarioFetch({
      "https://example.test/scenario/main.tzr": `include "./chapters/a.tzr"
scene start:
`,
      "https://example.test/scenario/chapters/a.tzr": `include "../main.tzr"
scene a:
`,
    });

    await expect(
      loadScenarioDocumentsFromUrl(
        { entryUrl: "/scenario/main.tzr", entryId: "scenario/main.tzr" },
        { fetch, baseUrl: "https://example.test/" },
      ),
    ).rejects.toMatchObject({
      name: "TsuzuruHtmlScenarioLoadError",
      diagnostics: [expect.objectContaining({ message: expect.stringContaining("Circular include detected") })],
    });
  });

  it("reports non-OK fetch responses as scenario load errors", async () => {
    const fetch = createScenarioFetch({});

    await expect(
      loadTsuzuruHtmlScenario({ entryUrl: "https://example.test/missing.tzr" }, { fetch }),
    ).rejects.toBeInstanceOf(TsuzuruHtmlScenarioLoadError);
  });
});

function createScenarioFetch(files: Readonly<Record<string, string>>): TsuzuruHtmlFetch & { readonly calls: string[] } {
  const calls: string[] = [];
  const fetch: TsuzuruHtmlFetch & { readonly calls: string[] } = Object.assign(
    async (input: string | URL) => {
      const url = input.toString();
      calls.push(url);
      const source = files[url];
      if (source === undefined) {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => "",
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => source,
      };
    },
    { calls },
  );
  return fetch;
}
