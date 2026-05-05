import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/state.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }

  const scene = result.document.declarations[0];
  if (scene === undefined || scene.type !== "SceneDeclaration") {
    throw new Error("expected scene");
  }
  const statement = scene.body[0];
  if (statement === undefined) {
    throw new Error("expected statement");
  }
  return statement;
}

function expectStateFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/state.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr state statements", () => {
  it("parses set string values", () => {
    expect(parseSingleStatement('scene start:\n  set scenario.route = "mio"\n')).toMatchObject({
      type: "SetStatement",
      target: { type: "StatePath", path: "scenario.route", root: "scenario" },
      value: { type: "StringValue", value: "mio" },
    });
  });

  it("parses set number values", () => {
    expect(parseSingleStatement("scene start:\n  set scenario.score = 10\n")).toMatchObject({
      type: "SetStatement",
      target: { path: "scenario.score" },
      value: { type: "NumberValue", value: 10 },
    });
    expect(parseSingleStatement("scene start:\n  set scenario.score = -1.5\n")).toMatchObject({
      type: "SetStatement",
      value: { type: "NumberValue", value: -1.5 },
    });
  });

  it("parses set boolean values", () => {
    expect(parseSingleStatement("scene start:\n  set scenario.hasNotebook = true\n")).toMatchObject({
      type: "SetStatement",
      value: { type: "BooleanValue", value: true },
    });
    expect(parseSingleStatement("scene start:\n  set scenario.hasNotebook = false\n")).toMatchObject({
      type: "SetStatement",
      value: { type: "BooleanValue", value: false },
    });
  });

  it("parses set null values", () => {
    expect(parseSingleStatement("scene start:\n  set scenario.currentCg = null\n")).toMatchObject({
      type: "SetStatement",
      value: { type: "NullValue", value: null },
    });
  });

  it("parses set variable references to scenario and system paths", () => {
    expect(parseSingleStatement("scene start:\n  set scenario.currentVoice = $scenario.nextVoice\n")).toMatchObject({
      type: "SetStatement",
      value: { type: "VariableReferenceValue", path: "scenario.nextVoice", root: "scenario" },
    });
    expect(parseSingleStatement("scene start:\n  set scenario.lastUnlocked = $system.endings.trueEnd\n")).toMatchObject({
      type: "SetStatement",
      value: { type: "VariableReferenceValue", path: "system.endings.trueEnd", root: "system" },
    });
  });

  it("parses add number values including negative numbers", () => {
    expect(parseSingleStatement("scene start:\n  add scenario.score += 1\n")).toMatchObject({
      type: "AddStatement",
      target: { type: "StatePath", path: "scenario.score", root: "scenario" },
      value: { type: "NumberValue", value: 1 },
    });
    expect(parseSingleStatement("scene start:\n  add scenario.affection += -3\n")).toMatchObject({
      type: "AddStatement",
      value: { type: "NumberValue", value: -3 },
    });
  });

  it("parses set and add inside if branches", () => {
    const statement = parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    set scenario.route = "mio"
    add scenario.affection += 3
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "SetStatement", target: { path: "scenario.route" }, value: { value: "mio" } },
        { type: "AddStatement", target: { path: "scenario.affection" }, value: { value: 3 } },
      ],
    });
  });

  it("parses set and add inside choice item bodies", () => {
    const statement = parseSingleStatement(`scene start:
  choice "どうする？":
    "手帳を開く":
      set scenario.hasNotebook = true
      add scenario.score += 1
`);

    expect(statement).toMatchObject({
      type: "ChoiceStatement",
      items: [
        {
          body: [
            { type: "SetStatement", target: { path: "scenario.hasNotebook" }, value: { value: true } },
            { type: "AddStatement", target: { path: "scenario.score" }, value: { value: 1 } },
          ],
        },
      ],
    });
  });

  it("rejects set without a target", () => {
    expect(expectStateFailure("scene start:\n  set\n")).toContain("set target is required.");
  });

  it("rejects set without equals", () => {
    expect(expectStateFailure('scene start:\n  set scenario.route "mio"\n')).toContain(
      "set statement must include `=`.",
    );
  });

  it("rejects set with plus equals", () => {
    expect(expectStateFailure("scene start:\n  set scenario.score += 1\n")).toContain(
      "set statement must use `=`, not `+=`.",
    );
  });

  it("rejects invalid set targets", () => {
    expect(expectStateFailure("scene start:\n  set system.endings.trueEnd.unlocked = true\n")).toContain(
      "set cannot target system.*.",
    );
    expect(expectStateFailure("scene start:\n  set player.score = 1\n")).toContain(
      "set target must start with scenario.",
    );
    expect(expectStateFailure("scene start:\n  set scenario. = 1\n")).toContain(
      "Invalid set target dotted identifier.",
    );
    expect(expectStateFailure("scene start:\n  set scenario..score = 1\n")).toContain(
      "Invalid set target dotted identifier.",
    );
  });

  it("rejects set without a value", () => {
    expect(expectStateFailure("scene start:\n  set scenario.route =\n")).toContain("set value is required.");
  });

  it("rejects invalid set values", () => {
    expect(expectStateFailure("scene start:\n  set scenario.route = route\n")).toContain("Invalid set value.");
    expect(expectStateFailure("scene start:\n  set scenario.route = {}\n")).toContain("Invalid set value.");
  });

  it("rejects invalid set variable references", () => {
    expect(expectStateFailure("scene start:\n  set scenario.currentVoice = $\n")).toContain(
      "Invalid set variable reference.",
    );
    expect(expectStateFailure("scene start:\n  set scenario.currentVoice = $scenario.\n")).toContain(
      "Invalid set variable reference.",
    );
    expect(expectStateFailure("scene start:\n  set scenario.currentVoice = $scenario..value\n")).toContain(
      "Invalid set variable reference.",
    );
    expect(expectStateFailure("scene start:\n  set scenario.currentVoice = $player.score\n")).toContain(
      'Invalid set variable reference root "player".',
    );
  });

  it("rejects single-quoted and backtick set strings", () => {
    expect(expectStateFailure("scene start:\n  set scenario.route = 'mio'\n")).toContain(
      "Only double-quoted string literals are supported.",
    );
    expect(expectStateFailure("scene start:\n  set scenario.route = `mio`\n")).toContain(
      "Backtick string literals are not supported.",
    );
  });

  it("rejects add without a target", () => {
    expect(expectStateFailure("scene start:\n  add\n")).toContain("add target is required.");
  });

  it("rejects add without plus equals", () => {
    expect(expectStateFailure("scene start:\n  add scenario.score 1\n")).toContain(
      "add statement must include `+=`.",
    );
  });

  it("rejects add with equals", () => {
    expect(expectStateFailure("scene start:\n  add scenario.score = 1\n")).toContain(
      "add statement must use `+=`, not `=`.",
    );
  });

  it("rejects invalid add targets", () => {
    expect(expectStateFailure("scene start:\n  add system.playCount += 1\n")).toContain(
      "add cannot target system.*.",
    );
    expect(expectStateFailure("scene start:\n  add player.score += 1\n")).toContain(
      "add target must start with scenario.",
    );
    expect(expectStateFailure("scene start:\n  add scenario. += 1\n")).toContain(
      "Invalid add target dotted identifier.",
    );
    expect(expectStateFailure("scene start:\n  add scenario..score += 1\n")).toContain(
      "Invalid add target dotted identifier.",
    );
  });

  it("rejects add without a value", () => {
    expect(expectStateFailure("scene start:\n  add scenario.score +=\n")).toContain("add value is required.");
  });

  it("rejects non-number add values", () => {
    expect(expectStateFailure('scene start:\n  add scenario.score += "1"\n')).toContain(
      "add value must be a number literal.",
    );
    expect(expectStateFailure("scene start:\n  add scenario.score += true\n")).toContain(
      "add value must be a number literal.",
    );
    expect(expectStateFailure("scene start:\n  add scenario.score += $scenario.delta\n")).toContain(
      "add value must be a number literal.",
    );
  });

  it("rejects extra trailing tokens", () => {
    expect(expectStateFailure("scene start:\n  set scenario.score = 1 2\n")).toContain(
      "set statement must not have extra trailing tokens.",
    );
    expect(expectStateFailure("scene start:\n  add scenario.score += 1 2\n")).toContain(
      "add statement must not have extra trailing tokens.",
    );
  });
});
