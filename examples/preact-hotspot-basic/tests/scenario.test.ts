import { describe, expect, it } from "vitest";
import scenario from "../scenario/main.tzr";

describe("preact hotspot basic scenario", () => {
  it("compiles hotspot exploration scenes", () => {
    expect(scenario.instructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "CommandInstruction", name: "hotspot" }),
        expect.objectContaining({ type: "CommandInstruction", name: "waitHotspot" }),
        expect.objectContaining({ type: "CommandInstruction", name: "clearHotspots" }),
      ]),
    );
    expect(Object.keys(scenario.scenes)).toEqual(["room_search", "inspect_desk", "inspect_window", "hallway"]);
  });
});
