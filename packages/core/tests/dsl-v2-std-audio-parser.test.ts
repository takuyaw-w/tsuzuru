import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-audio.tzr" });
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

function expectAudioFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-audio.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std audio sugar statements", () => {
  it("parses bgm asset refs", () => {
    expect(parseSingleStatement("scene start:\n  bgm daily_theme\n")).toMatchObject({
      type: "BgmStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "daily_theme" },
    });
    expect(parseSingleStatement("scene start:\n  bgm music.daily_theme\n")).toMatchObject({
      type: "BgmStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "music.daily_theme" },
    });
    expect(parseSingleStatement('scene start:\n  bgm "daily-theme"\n')).toMatchObject({
      type: "BgmStatement",
      assetRef: { type: "AudioStringAssetRef", value: "daily-theme" },
    });
  });

  it("parses stopBgm", () => {
    expect(parseSingleStatement("scene start:\n  stopBgm\n")).toMatchObject({
      type: "StopBgmStatement",
    });
  });

  it("parses se asset refs", () => {
    expect(parseSingleStatement("scene start:\n  se doorOpen\n")).toMatchObject({
      type: "SeStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "doorOpen" },
    });
    expect(parseSingleStatement("scene start:\n  se sounds.doorOpen\n")).toMatchObject({
      type: "SeStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "sounds.doorOpen" },
    });
    expect(parseSingleStatement('scene start:\n  se "door-open"\n')).toMatchObject({
      type: "SeStatement",
      assetRef: { type: "AudioStringAssetRef", value: "door-open" },
    });
  });

  it("parses voice asset refs", () => {
    expect(parseSingleStatement("scene start:\n  voice mio_001\n")).toMatchObject({
      type: "VoiceStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "mio_001" },
    });
    expect(parseSingleStatement("scene start:\n  voice mio.normal_001\n")).toMatchObject({
      type: "VoiceStatement",
      assetRef: { type: "AudioIdentifierAssetRef", value: "mio.normal_001" },
    });
    expect(parseSingleStatement('scene start:\n  voice "mio-001"\n')).toMatchObject({
      type: "VoiceStatement",
      assetRef: { type: "AudioStringAssetRef", value: "mio-001" },
    });
  });

  it("parses audio statements inside if branches", () => {
    const statement = parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    bgm daily_theme
    se doorOpen
    voice mio_001
    stopBgm
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "BgmStatement" },
        { type: "SeStatement" },
        { type: "VoiceStatement" },
        { type: "StopBgmStatement" },
      ],
    });
  });

  it("parses audio statements inside choice item bodies", () => {
    const statement = parseSingleStatement(`scene start:
  choice "どうする？":
    "聞く":
      bgm daily_theme
      se doorOpen
      voice mio_001
`);

    expect(statement).toMatchObject({
      type: "ChoiceStatement",
      items: [{ body: [{ type: "BgmStatement" }, { type: "SeStatement" }, { type: "VoiceStatement" }] }],
    });
  });

  it("rejects invalid bgm statements", () => {
    expect(expectAudioFailure("scene start:\n  bgm\n")).toContain("bgm assetRef is required.");
    expect(expectAudioFailure("scene start:\n  bgm $scenario.bgm\n")).toContain("bgm audio assetRef must be static.");
    expect(expectAudioFailure('scene start:\n  bgm ""\n')).toContain("bgm audio assetRef must not be empty.");
    expect(expectAudioFailure("scene start:\n  bgm daily-theme\n")).toContain("Invalid bgm audio assetRef.");
    expect(expectAudioFailure("scene start:\n  bgm daily_theme extra\n")).toContain(
      "bgm statement must not have extra trailing tokens.",
    );
  });

  it("rejects invalid stopBgm statements", () => {
    expect(expectAudioFailure("scene start:\n  stopBgm now\n")).toContain(
      "stopBgm statement must not have extra trailing tokens.",
    );
  });

  it("rejects invalid se statements", () => {
    expect(expectAudioFailure("scene start:\n  se\n")).toContain("se assetRef is required.");
    expect(expectAudioFailure("scene start:\n  se $scenario.se\n")).toContain("se audio assetRef must be static.");
    expect(expectAudioFailure('scene start:\n  se ""\n')).toContain("se audio assetRef must not be empty.");
    expect(expectAudioFailure("scene start:\n  se door-open\n")).toContain("Invalid se audio assetRef.");
    expect(expectAudioFailure("scene start:\n  se doorOpen extra\n")).toContain(
      "se statement must not have extra trailing tokens.",
    );
  });

  it("rejects invalid voice statements", () => {
    expect(expectAudioFailure("scene start:\n  voice\n")).toContain("voice assetRef is required.");
    expect(expectAudioFailure("scene start:\n  voice $scenario.voice\n")).toContain(
      "voice audio assetRef must be static.",
    );
    expect(expectAudioFailure('scene start:\n  voice ""\n')).toContain("voice audio assetRef must not be empty.");
    expect(expectAudioFailure("scene start:\n  voice mio-001\n")).toContain("Invalid voice audio assetRef.");
    expect(expectAudioFailure("scene start:\n  voice mio_001 extra\n")).toContain(
      "voice statement must not have extra trailing tokens.",
    );
  });
});
