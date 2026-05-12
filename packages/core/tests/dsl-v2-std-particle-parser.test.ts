import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-particle.tzr" });
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

function expectParticleFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-particle.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std particle sugar statements", () => {
  it("parses particle and stopParticle commands", () => {
    expect(parseSingleStatement("scene start:\n  particle rain intensity=normal\n")).toMatchObject({
      type: "StdParticleStatement",
      name: "particle",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "rain" } },
        { type: "NamedArgument", name: "intensity", value: { type: "StringValue", value: "normal" } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  particle snow\n")).toMatchObject({
      type: "StdParticleStatement",
      name: "particle",
      args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "snow" } }],
    });
    expect(parseSingleStatement("scene start:\n  particle sakura intensity=strong\n")).toMatchObject({
      type: "StdParticleStatement",
      name: "particle",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "sakura" } },
        { type: "NamedArgument", name: "intensity", value: { type: "StringValue", value: "strong" } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  particle dust intensity=light\n")).toMatchObject({
      type: "StdParticleStatement",
      name: "particle",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "dust" } },
        { type: "NamedArgument", name: "intensity", value: { type: "StringValue", value: "light" } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  stopParticle\n")).toMatchObject({
      type: "StdParticleStatement",
      name: "stopParticle",
      args: [],
    });
  });

  it("parses particle statements inside if branches and choice item bodies", () => {
    expect(
      parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    particle rain intensity=strong
    stopParticle
`),
    ).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "StdParticleStatement", name: "particle" },
        { type: "StdParticleStatement", name: "stopParticle" },
      ],
    });

    expect(
      parseSingleStatement(`scene start:
  choice "どうする？":
    "見る":
      particle snow
      stopParticle
`),
    ).toMatchObject({
      type: "ChoiceStatement",
      items: [
        {
          body: [
            { type: "StdParticleStatement", name: "particle" },
            { type: "StdParticleStatement", name: "stopParticle" },
          ],
        },
      ],
    });
  });

  it("rejects malformed particle argument syntax", () => {
    expect(expectParticleFailure('scene start:\n  particle "rain intensity=normal\n')).toContain(
      "particle string argument is missing closing quote.",
    );
    expect(expectParticleFailure("scene start:\n  particle rain intensity=\n")).toContain(
      "particle argument value is required.",
    );
    expect(expectParticleFailure("scene start:\n  particle rain intensity=#normal\n")).toContain(
      "Invalid particle argument value.",
    );
    expect(expectParticleFailure("scene start:\n  stopParticle rain\n")).toContain(
      "stopParticle statement must not have extra trailing tokens.",
    );
  });
});
