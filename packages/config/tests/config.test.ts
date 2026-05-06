import { describe, expect, it } from "vitest";
import { defineTsuzuruConfig, type TsuzuruConfigPlugin } from "../src/index.js";

describe("defineTsuzuruConfig", () => {
  it("returns the provided config object", () => {
    const plugin = { name: "std-visual", createInitialState: () => ({}) };
    const config = {
      scenario: {
        entry: "scenario/main.tzr",
        files: ["scenario/**/*.tzr"],
      },
      plugins: [plugin],
    };

    expect(defineTsuzuruConfig(config)).toBe(config);
  });

  it("preserves scenario and plugin types", () => {
    const config = defineTsuzuruConfig({
      scenario: {
        entry: "scenario/main.tzr",
        files: ["scenario/**/*.tzr"] as const,
      },
      plugins: [{ name: "std-audio", createInitialState: () => ({}) }],
    });

    const entry: string = config.scenario.entry;
    const files: readonly string[] = config.scenario.files;
    const plugins: readonly TsuzuruConfigPlugin[] = config.plugins;

    expect(entry).toBe("scenario/main.tzr");
    expect(files).toEqual(["scenario/**/*.tzr"]);
    expect(plugins[0]?.name).toBe("std-audio");
  });
});
