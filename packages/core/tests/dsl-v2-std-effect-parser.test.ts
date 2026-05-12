import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-effect.tzr" });
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

function expectEffectFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-effect.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std effect sugar statements", () => {
  it("parses shake, flash, pulse, and blur commands", () => {
    expect(parseSingleStatement("scene start:\n  shake screen intensity=strong duration=400\n")).toMatchObject({
      type: "StdEffectStatement",
      name: "shake",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "screen" } },
        { type: "NamedArgument", name: "intensity", value: { type: "StringValue", value: "strong" } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 400 } },
      ],
    });
    expect(parseSingleStatement('scene start:\n  flash color="#ffffff" duration=120\n')).toMatchObject({
      type: "StdEffectStatement",
      name: "flash",
      args: [
        { type: "NamedArgument", name: "color", value: { type: "StringValue", value: "#ffffff" } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 120 } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  pulse message intensity=light duration=180\n")).toMatchObject({
      type: "StdEffectStatement",
      name: "pulse",
    });
    expect(parseSingleStatement("scene start:\n  blur screen amount=6 duration=300\n")).toMatchObject({
      type: "StdEffectStatement",
      name: "blur",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "screen" } },
        { type: "NamedArgument", name: "amount", value: { type: "NumberValue", value: 6 } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 300 } },
      ],
    });
  });

  it("parses effect statements inside if branches and choice item bodies", () => {
    expect(
      parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    shake screen duration=180
    flash color="#fff" duration=120
`),
    ).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "StdEffectStatement", name: "shake" },
        { type: "StdEffectStatement", name: "flash" },
      ],
    });

    expect(
      parseSingleStatement(`scene start:
  choice "どうする？":
    "見る":
      pulse message duration=180
      blur screen amount=4 duration=240
`),
    ).toMatchObject({
      type: "ChoiceStatement",
      items: [
        {
          body: [
            { type: "StdEffectStatement", name: "pulse" },
            { type: "StdEffectStatement", name: "blur" },
          ],
        },
      ],
    });
  });

  it("rejects malformed effect argument syntax", () => {
    expect(expectEffectFailure('scene start:\n  flash color="#fff duration=120\n')).toContain(
      "flash string argument is missing closing quote.",
    );
    expect(expectEffectFailure("scene start:\n  shake screen duration=\n")).toContain(
      "shake argument value is required.",
    );
    expect(expectEffectFailure("scene start:\n  blur screen amount=#6 duration=300\n")).toContain(
      "Invalid blur argument value.",
    );
  });
});
