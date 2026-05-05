import { describe, expect, it } from "vitest";
import { CORE_COMMAND_NAMES, CORE_COMMANDS, isCoreCommandName } from "../src/index.js";

describe("core command registry", () => {
  it("defines the v0.1 core-owned command names", () => {
    expect(CORE_COMMAND_NAMES).toEqual([
      "waitClick",
      "page",
      "stop",
      "wait",
      "set",
      "inc",
      "dec",
      "flag",
      "unflag",
    ]);
  });

  it("classifies core commands by ownership category", () => {
    expect(CORE_COMMANDS).toEqual([
      { name: "waitClick", category: "text" },
      { name: "page", category: "text" },
      { name: "stop", category: "flow" },
      { name: "wait", category: "flow" },
      { name: "set", category: "state" },
      { name: "inc", category: "state" },
      { name: "dec", category: "state" },
      { name: "flag", category: "state" },
      { name: "unflag", category: "state" },
    ]);
  });

  it("checks whether a command name is core-owned", () => {
    expect(isCoreCommandName("jump")).toBe(false);
    expect(isCoreCommandName("waitClick")).toBe(true);
    expect(isCoreCommandName("bg")).toBe(false);
    expect(isCoreCommandName("enter")).toBe(false);
  });
});
