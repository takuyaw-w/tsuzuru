import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-text-sound.tzr" });
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

function expectTextSoundFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-text-sound.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std text sound sugar statements", () => {
  it("parses textSound asset refs", () => {
    expect(parseSingleStatement("scene start:\n  textSound soft\n")).toMatchObject({
      type: "TextSoundStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "soft" },
    });
    expect(parseSingleStatement("scene start:\n  textSound profiles.soft\n")).toMatchObject({
      type: "TextSoundStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "profiles.soft" },
    });
    expect(parseSingleStatement('scene start:\n  textSound "soft-blip"\n')).toMatchObject({
      type: "TextSoundStatement",
      assetRef: { type: "AudioStringAssetRef", value: "soft-blip" },
    });
  });

  it("parses stopTextSound", () => {
    expect(parseSingleStatement("scene start:\n  stopTextSound\n")).toMatchObject({
      type: "StopTextSoundStatement",
    });
  });

  it("parses text sound statements inside if branches", () => {
    const statement = parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    textSound soft
    stopTextSound
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      thenBranch: [{ type: "TextSoundStatement" }, { type: "StopTextSoundStatement" }],
    });
  });

  it("parses text sound statements inside choice item bodies", () => {
    const statement = parseSingleStatement(`scene start:
  choice "どうする？":
    "聞く":
      textSound soft
      stopTextSound
`);

    expect(statement).toMatchObject({
      type: "ChoiceStatement",
      items: [{ body: [{ type: "TextSoundStatement" }, { type: "StopTextSoundStatement" }] }],
    });
  });

  it("rejects invalid textSound statements", () => {
    expect(expectTextSoundFailure("scene start:\n  textSound\n")).toContain("textSound assetRef is required.");
    expect(expectTextSoundFailure("scene start:\n  textSound $scenario.sound\n")).toContain(
      "textSound audio assetRef must be static.",
    );
    expect(expectTextSoundFailure('scene start:\n  textSound ""\n')).toContain(
      "textSound audio assetRef must not be empty.",
    );
    expect(expectTextSoundFailure("scene start:\n  textSound soft-blip\n")).toContain(
      "Invalid textSound audio assetRef.",
    );
    expect(expectTextSoundFailure("scene start:\n  textSound soft extra\n")).toContain(
      "textSound statement must not have extra trailing tokens.",
    );
  });

  it("rejects invalid stopTextSound statements", () => {
    expect(expectTextSoundFailure("scene start:\n  stopTextSound now\n")).toContain(
      "stopTextSound statement must not have extra trailing tokens.",
    );
  });
});
