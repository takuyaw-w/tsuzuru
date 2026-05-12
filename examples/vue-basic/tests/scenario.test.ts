import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assets } from "../assets.js";
import { scenarioProject } from "../src/scenario.js";

describe("vue-basic example", () => {
  it("compiles the scenario project", () => {
    expect(scenarioProject.ok).toBe(true);
  });

  it("uses @tsuzuru/vue without Preact dependencies", async () => {
    const packageJson = JSON.parse(await readFile(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };

    expect(packageJson.dependencies["@tsuzuru/vue"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/preact"]).toBeUndefined();
    expect(packageJson.dependencies.preact).toBeUndefined();
  });

  it("keeps visual and audio assets in one manifest", () => {
    expect(assets.visual.backgrounds.riverside.url).toContain("/assets/images/backgrounds/");
    expect(assets.visual.sprites.aoi_smile.url).toContain("/assets/images/sprites/");
    expect(assets.audio.bgm.vue_theme).toContain("/assets/audio/bgm/");
    expect(assets.textSound.soft.type).toBe("tone");
  });
});
