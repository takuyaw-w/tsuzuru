import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-system.tzr" });
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

function expectSystemFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-system.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std system sugar statements", () => {
  it("parses system.unlockEnding ids", () => {
    expect(parseSingleStatement("scene start:\n  system.unlockEnding trueEnd\n")).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "ending",
      id: { type: "SystemUnlockIdentifierId", value: "trueEnd" },
    });
    expect(parseSingleStatement("scene start:\n  system.unlockEnding endings.trueEnd\n")).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "ending",
      id: { type: "SystemUnlockIdentifierId", value: "endings.trueEnd" },
    });
    expect(parseSingleStatement('scene start:\n  system.unlockEnding "true-end"\n')).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "ending",
      id: { type: "SystemUnlockStringId", value: "true-end" },
    });
  });

  it("parses system.unlockCg ids", () => {
    expect(parseSingleStatement("scene start:\n  system.unlockCg cg001\n")).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "cg",
      id: { type: "SystemUnlockIdentifierId", value: "cg001" },
    });
    expect(parseSingleStatement("scene start:\n  system.unlockCg gallery.cg001\n")).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "cg",
      id: { type: "SystemUnlockIdentifierId", value: "gallery.cg001" },
    });
    expect(parseSingleStatement('scene start:\n  system.unlockCg "cg-001"\n')).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "cg",
      id: { type: "SystemUnlockStringId", value: "cg-001" },
    });
  });

  it("parses system.unlockAchievement ids", () => {
    expect(parseSingleStatement("scene start:\n  system.unlockAchievement firstClear\n")).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "achievement",
      id: { type: "SystemUnlockIdentifierId", value: "firstClear" },
    });
    expect(parseSingleStatement("scene start:\n  system.unlockAchievement achievements.firstClear\n")).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "achievement",
      id: { type: "SystemUnlockIdentifierId", value: "achievements.firstClear" },
    });
    expect(parseSingleStatement('scene start:\n  system.unlockAchievement "first-clear"\n')).toMatchObject({
      type: "SystemUnlockStatement",
      kind: "achievement",
      id: { type: "SystemUnlockStringId", value: "first-clear" },
    });
  });

  it("parses system unlock statements inside if branches", () => {
    const statement = parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    system.unlockEnding trueEnd
    system.unlockCg cg001
    system.unlockAchievement firstClear
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "SystemUnlockStatement", kind: "ending" },
        { type: "SystemUnlockStatement", kind: "cg" },
        { type: "SystemUnlockStatement", kind: "achievement" },
      ],
    });
  });

  it("parses system unlock statements inside choice item bodies", () => {
    const statement = parseSingleStatement(`scene start:
  choice "どうする？":
    "解放する":
      system.unlockEnding trueEnd
      system.unlockAchievement firstClear
`);

    expect(statement).toMatchObject({
      type: "ChoiceStatement",
      items: [
        {
          body: [
            { type: "SystemUnlockStatement", kind: "ending" },
            { type: "SystemUnlockStatement", kind: "achievement" },
          ],
        },
      ],
    });
  });

  it("keeps call system.unlock as a normal call statement", () => {
    expect(parseSingleStatement("scene start:\n  call system.unlockEnding(id=trueEnd)\n")).toMatchObject({
      type: "CallStatement",
      name: "system.unlockEnding",
      args: [{ name: "id", value: { type: "IdentifierValue", value: "trueEnd" } }],
    });
  });

  it("rejects unknown system statements", () => {
    expect(expectSystemFailure("scene start:\n  system.set path\n")).toContain("Unknown system statement.");
    expect(expectSystemFailure("scene start:\n  system.unlockVoice voice001\n")).toContain("Unknown system statement.");
  });

  it("rejects missing system unlock ids", () => {
    expect(expectSystemFailure("scene start:\n  system.unlockEnding\n")).toContain(
      "system.unlockEnding id is required.",
    );
    expect(expectSystemFailure("scene start:\n  system.unlockCg\n")).toContain("system.unlockCg id is required.");
    expect(expectSystemFailure("scene start:\n  system.unlockAchievement\n")).toContain(
      "system.unlockAchievement id is required.",
    );
  });

  it("rejects invalid system unlock ids", () => {
    expect(expectSystemFailure("scene start:\n  system.unlockEnding $scenario.endingId\n")).toContain(
      "system.unlockEnding id must be static.",
    );
    expect(expectSystemFailure("scene start:\n  system.unlockCg $scenario.cgId\n")).toContain(
      "system.unlockCg id must be static.",
    );
    expect(expectSystemFailure("scene start:\n  system.unlockAchievement $scenario.achievementId\n")).toContain(
      "system.unlockAchievement id must be static.",
    );
    expect(expectSystemFailure('scene start:\n  system.unlockEnding ""\n')).toContain(
      "system.unlockEnding id must not be empty.",
    );
    expect(expectSystemFailure("scene start:\n  system.unlockCg cg-001\n")).toContain("Invalid system.unlockCg id.");
  });

  it("rejects extra trailing tokens", () => {
    expect(expectSystemFailure("scene start:\n  system.unlockEnding trueEnd extra\n")).toContain(
      "system.unlockEnding statement must not have extra trailing tokens.",
    );
    expect(expectSystemFailure('scene start:\n  system.unlockCg "cg-001" extra\n')).toContain(
      "system.unlockCg statement must not have extra trailing tokens.",
    );
  });

  it("keeps direct system state mutation rejected", () => {
    expect(expectSystemFailure("scene start:\n  set system.endings.trueEnd.unlocked = true\n")).toContain(
      "set cannot target system.*.",
    );
    expect(expectSystemFailure("scene start:\n  add system.playCount += 1\n")).toContain("add cannot target system.*.");
  });
});
