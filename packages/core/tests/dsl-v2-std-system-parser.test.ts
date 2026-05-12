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

describe("parseTzr std system call statements", () => {
  it("parses system unlock calls as normal call statements", () => {
    expect(parseSingleStatement("scene start:\n  call system.unlockEnding(id=trueEnd)\n")).toMatchObject({
      type: "CallStatement",
      name: "system.unlockEnding",
      args: [{ type: "NamedArgument", name: "id", value: { type: "IdentifierValue", value: "trueEnd" } }],
    });
    expect(parseSingleStatement("scene start:\n  call system.unlockCg(id=textSoundLab)\n")).toMatchObject({
      type: "CallStatement",
      name: "system.unlockCg",
      args: [{ type: "NamedArgument", name: "id", value: { type: "IdentifierValue", value: "textSoundLab" } }],
    });
    expect(parseSingleStatement("scene start:\n  call system.unlockAchievement(id=firstTextSoundLab)\n")).toMatchObject(
      {
        type: "CallStatement",
        name: "system.unlockAchievement",
        args: [{ type: "NamedArgument", name: "id", value: { type: "IdentifierValue", value: "firstTextSoundLab" } }],
      },
    );
  });

  it("parses string ids for call system unlock commands", () => {
    expect(parseSingleStatement('scene start:\n  call system.unlockCg(id="text-sound-lab")\n')).toMatchObject({
      type: "CallStatement",
      name: "system.unlockCg",
      args: [{ type: "NamedArgument", name: "id", value: { type: "StringValue", value: "text-sound-lab" } }],
    });
  });

  it("parses system unlock calls inside if branches", () => {
    const statement = parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    call system.unlockEnding(id=trueEnd)
    call system.unlockCg(id=textSoundLab)
    call system.unlockAchievement(id=firstTextSoundLab)
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "CallStatement", name: "system.unlockEnding" },
        { type: "CallStatement", name: "system.unlockCg" },
        { type: "CallStatement", name: "system.unlockAchievement" },
      ],
    });
  });

  it("parses system unlock calls inside choice item bodies", () => {
    const statement = parseSingleStatement(`scene start:
  choice "どうする？":
    "解放する":
      call system.unlockEnding(id=trueEnd)
      call system.unlockAchievement(id=firstTextSoundLab)
`);

    expect(statement).toMatchObject({
      type: "ChoiceStatement",
      items: [
        {
          body: [
            { type: "CallStatement", name: "system.unlockEnding" },
            { type: "CallStatement", name: "system.unlockAchievement" },
          ],
        },
      ],
    });
  });

  it("does not add dedicated system unlock DSL sugar", () => {
    expect(expectSystemFailure("scene start:\n  system.unlockEnding trueEnd\n")).toContain(
      "Unsupported DSL v2 scene body statement.",
    );
    expect(expectSystemFailure("scene start:\n  unlock ending trueEnd\n")).toContain(
      "Unsupported DSL v2 scene body statement.",
    );
  });
});
