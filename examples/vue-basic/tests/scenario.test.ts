import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assets } from "../assets.js";
import { scenarioProject } from "../src/scenario.js";

describe("vue-basic example", () => {
  it("compiles the scenario project", () => {
    expect(scenarioProject.ok).toBe(true);
  });

  it("includes individual std-effect demo scenes", async () => {
    const scenario = await readFile(join(import.meta.dirname, "..", "scenario", "chapters", "01-opening.tzr"), "utf8");

    expect(scenario).toContain('choice "今度は、どの effect を試す？"');
    expect(scenario).toContain("shake screen intensity=strong duration=420");
    expect(scenario).toContain('flash color="#ffffff" duration=140');
    expect(scenario).toContain("pulse message intensity=strong duration=260");
    expect(scenario).toContain("blur screen amount=8 duration=420");
  });

  it("uses @tsuzuru/vue without Preact dependencies", async () => {
    const packageJson = JSON.parse(await readFile(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };

    expect(packageJson.dependencies["@tsuzuru/vue"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/plugin-std-effect"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/preact"]).toBeUndefined();
    expect(packageJson.dependencies.preact).toBeUndefined();
  });

  it("keeps visual and audio assets in one manifest", () => {
    expect(assets.visual.backgrounds.riverside.url).toContain("/assets/images/backgrounds/");
    expect(assets.visual.sprites.tone_stand.url).toContain("/assets/images/sprites/");
    expect(assets.visual.sprites.noize_stand.url).toContain("/assets/images/sprites/");
    expect(assets.visual.sprites.mix_stand.url).toContain("/assets/images/sprites/");
    expect(assets.audio.bgm.vue_theme).toContain("/assets/audio/bgm/");
    expect(assets.textSound.profiles.narration.type).toBe("noise");
    expect(assets.textSound.profiles.tone.type).toBe("tone");
    expect(assets.textSound.profiles.noize.type).toBe("noise");
    expect(assets.textSound.profiles.mix.type).toBe("mix");
  });
});
