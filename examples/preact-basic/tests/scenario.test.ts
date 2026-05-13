import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scenarioProject } from "../src/scenario.js";

describe("preact-basic scenario", () => {
  it("compiles the scenario project", () => {
    expect(scenarioProject.ok).toBe(true);
  });

  it("includes the std-system unlock demo scene", async () => {
    const scenario = await readFile(join(import.meta.dirname, "..", "scenario", "chapters", "03-ending.tzr"), "utf8");

    expect(scenario).toContain("scene system_unlock_demo:");
    expect(scenario).toContain("call system.unlockCg(id=textSoundLab)");
    expect(scenario).toContain("call system.unlockAchievement(id=firstTextSoundLab)");
    expect(scenario).toContain("call system.unlockEnding(id=textSoundLabComplete)");
    expect(scenario).not.toContain("unlock ending");
  });

  it("includes the std-particle demo scenes", async () => {
    const scenario = await readFile(join(import.meta.dirname, "..", "scenario", "chapters", "02-common.tzr"), "utf8");

    expect(scenario).toContain('choice "particle demo を試す？"');
    expect(scenario).toContain("particle rain intensity=normal");
    expect(scenario).toContain("particle snow intensity=light");
    expect(scenario).toContain("particle sakura intensity=normal");
    expect(scenario).toContain("particle dust intensity=light");
    expect(scenario).toContain("stopParticle");
  });

  it("depends on the std-system plugin package", async () => {
    const packageJson = JSON.parse(await readFile(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };

    expect(packageJson.dependencies["@tsuzuru/plugin-std-system"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/plugin-std-particle"]).toBeDefined();
  });
});
