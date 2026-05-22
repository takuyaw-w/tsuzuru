import { describe, expect, it } from "vitest";
import { defineTsuzuruConfig, type TsuzuruConfigPlugin } from "../src/index.js";

describe("defineTsuzuruConfig", () => {
  it("returns the provided config object", () => {
    const plugin = { name: "std-visual", createInitialState: () => ({}) };
    const config = {
      project: {
        id: "tsuzuru.example.config-test",
        version: "1",
      },
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
      project: {
        id: "tsuzuru.example.config-test",
        version: "1",
      },
      scenario: {
        entry: "scenario/main.tzr",
        files: ["scenario/**/*.tzr"] as const,
      },
      plugins: [{ name: "std-audio", createInitialState: () => ({}) }],
    });

    const projectId: string = config.project.id;
    const projectVersion: string = config.project.version;
    const entry: string = config.scenario.entry;
    const files: readonly string[] = config.scenario.files;
    const plugins: readonly TsuzuruConfigPlugin[] = config.plugins;

    expect(projectId).toBe("tsuzuru.example.config-test");
    expect(projectVersion).toBe("1");
    expect(entry).toBe("scenario/main.tzr");
    expect(files).toEqual(["scenario/**/*.tzr"]);
    expect(plugins[0]?.name).toBe("std-audio");
  });
});
