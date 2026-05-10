import { describe, expect, it } from "vitest";
import {
  loadTsuzuruHtmlDeclarativeAppConfig,
  normalizeTsuzuruHtmlDeclarativeAppConfig,
  TsuzuruHtmlDeclarativeAppConfigError,
  type TsuzuruHtmlFetch,
} from "../src/index.js";

describe("Tsuzuru HTML declarative app config", () => {
  it("normalizes a version 1 app config", () => {
    expect(
      normalizeTsuzuruHtmlDeclarativeAppConfig({
        version: 1,
        title: "HTML Basic",
        scenario: {
          entryUrl: "/scenario/main.tzr",
          entryId: "public/scenario/main.tzr",
        },
        assetsUrl: "/assets/assets.json",
        initialScreen: "runtime",
        storageKeyPrefix: "tsuzuru:test",
      }),
    ).toEqual({
      version: 1,
      title: "HTML Basic",
      scenario: {
        entryUrl: "/scenario/main.tzr",
        entryId: "public/scenario/main.tzr",
      },
      assetsUrl: "/assets/assets.json",
      initialScreen: "runtime",
      storageKeyPrefix: "tsuzuru:test",
    });
  });

  it("uses defaults for optional fields", () => {
    expect(
      normalizeTsuzuruHtmlDeclarativeAppConfig({
        version: 1,
        scenario: {
          entryUrl: "/scenario/main.tzr",
        },
      }),
    ).toMatchObject({
      title: "Tsuzuru",
      initialScreen: "title",
      storageKeyPrefix: "tsuzuru:html-app",
    });
  });

  it("rejects invalid config versions and missing scenario URLs", () => {
    expect(() => normalizeTsuzuruHtmlDeclarativeAppConfig({ version: 2 })).toThrow(
      TsuzuruHtmlDeclarativeAppConfigError,
    );
    expect(() => normalizeTsuzuruHtmlDeclarativeAppConfig({ version: 1, scenario: {} })).toThrow(
      "scenario.entryUrl must be a non-empty string",
    );
  });

  it("loads config JSON through injectable fetch", async () => {
    const config = await loadTsuzuruHtmlDeclarativeAppConfig("/tsuzuru.app.json", {
      baseUrl: "https://example.test/game/",
      fetch: createJsonFetch({
        version: 1,
        scenario: {
          entryUrl: "/scenario/main.tzr",
        },
      }),
    });

    expect(config.scenario.entryUrl).toBe("/scenario/main.tzr");
  });
});

function createJsonFetch(value: unknown): TsuzuruHtmlFetch {
  return async (input) => {
    expect(input.toString()).toBe("https://example.test/tsuzuru.app.json");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify(value),
    };
  };
}
