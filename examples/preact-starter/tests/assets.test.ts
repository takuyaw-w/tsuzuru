import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assets } from "../src/assets.js";

const exampleRoot = fileURLToPath(new URL("..", import.meta.url));

describe("starter assets", () => {
  it("maps image ids to files under public/assets/images", () => {
    const imageGroups = [assets.visual.backgrounds, assets.visual.sprites];

    for (const group of imageGroups) {
      for (const asset of Object.values(group)) {
        if (asset.src === undefined) {
          continue;
        }

        expect(asset.src).toMatch(/^\/assets\/images\/.+\.svg$/);
        expect(existsSync(`${exampleRoot}/public${asset.src}`)).toBe(true);
      }
    }
  });
});
