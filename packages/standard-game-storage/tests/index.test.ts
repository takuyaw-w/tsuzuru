import { describe, expect, it } from "vitest";
import { STANDARD_GAME_STORAGE_PACKAGE_NAME, STANDARD_GAME_STORAGE_PLANNED_AREAS } from "../src/index.js";

describe("@tsuzuru/standard-game-storage", () => {
  it("exposes the package skeleton entrypoint", () => {
    expect(STANDARD_GAME_STORAGE_PACKAGE_NAME).toBe("@tsuzuru/standard-game-storage");
    expect(STANDARD_GAME_STORAGE_PLANNED_AREAS).toEqual(["preferences", "read-tracking", "save-slots"]);
  });
});
