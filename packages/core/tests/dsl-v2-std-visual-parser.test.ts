import { describe, expect, it } from "vitest";
import { parseTzrV2, type TzrV2SceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrV2SceneStatement {
  const result = parseTzrV2(source, { filePath: "scenario/std-visual.tzr" });
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

function expectVisualFailure(source: string): string[] {
  const result = parseTzrV2(source, { filePath: "scenario/std-visual.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzrV2 std visual sugar statements", () => {
  it("parses bg asset refs", () => {
    expect(parseSingleStatement("scene start:\n  bg classroom\n")).toMatchObject({
      type: "BgStatement",
      assetRef: { type: "VisualIdentifierAssetRef", value: "classroom" },
    });
    expect(parseSingleStatement("scene start:\n  bg classroom.rain\n")).toMatchObject({
      type: "BgStatement",
      assetRef: { type: "VisualIdentifierAssetRef", value: "classroom.rain" },
    });
    expect(parseSingleStatement('scene start:\n  bg "classroom-bg"\n')).toMatchObject({
      type: "BgStatement",
      assetRef: { type: "VisualStringAssetRef", value: "classroom-bg" },
    });
  });

  it("parses show named placements", () => {
    expect(parseSingleStatement("scene start:\n  show alice_smile at left\n")).toMatchObject({
      type: "ShowStatement",
      assetRef: { type: "VisualIdentifierAssetRef", value: "alice_smile" },
      placement: { type: "VisualNamedPlacement", value: "left" },
    });
    expect(parseSingleStatement("scene start:\n  show alice_smile at center\n")).toMatchObject({
      type: "ShowStatement",
      placement: { type: "VisualNamedPlacement", value: "center" },
    });
    expect(parseSingleStatement("scene start:\n  show alice_smile at right\n")).toMatchObject({
      type: "ShowStatement",
      placement: { type: "VisualNamedPlacement", value: "right" },
    });
    expect(parseSingleStatement('scene start:\n  show "alice-smile" at center\n')).toMatchObject({
      type: "ShowStatement",
      assetRef: { type: "VisualStringAssetRef", value: "alice-smile" },
      placement: { type: "VisualNamedPlacement", value: "center" },
    });
  });

  it("parses show coordinate placement", () => {
    expect(parseSingleStatement("scene start:\n  show alice_smile at x=100 y=200\n")).toMatchObject({
      type: "ShowStatement",
      placement: { type: "VisualCoordinatePlacement", x: 100, y: 200 },
    });
    expect(parseSingleStatement("scene start:\n  show alice_smile at x=-10.5 y=20.25\n")).toMatchObject({
      type: "ShowStatement",
      placement: { type: "VisualCoordinatePlacement", x: -10.5, y: 20.25 },
    });
  });

  it("parses hide and clear statements", () => {
    expect(parseSingleStatement("scene start:\n  hide alice_smile\n")).toMatchObject({
      type: "HideStatement",
      assetRef: { type: "VisualIdentifierAssetRef", value: "alice_smile" },
    });
    expect(parseSingleStatement('scene start:\n  hide "alice-smile"\n')).toMatchObject({
      type: "HideStatement",
      assetRef: { type: "VisualStringAssetRef", value: "alice-smile" },
    });
    expect(parseSingleStatement("scene start:\n  clear sprites\n")).toMatchObject({
      type: "ClearVisualStatement",
      target: "sprites",
    });
    expect(parseSingleStatement("scene start:\n  clear bg\n")).toMatchObject({
      type: "ClearVisualStatement",
      target: "bg",
    });
  });

  it("parses visual statements inside if branches", () => {
    const statement = parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    bg classroom
    show alice_smile at center
    hide alice_smile
    clear sprites
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "BgStatement" },
        { type: "ShowStatement" },
        { type: "HideStatement" },
        { type: "ClearVisualStatement", target: "sprites" },
      ],
    });
  });

  it("parses visual statements inside choice item bodies", () => {
    const statement = parseSingleStatement(`scene start:
  choice "どうする？":
    "見る":
      bg classroom
      show alice_smile at right
      clear bg
`);

    expect(statement).toMatchObject({
      type: "ChoiceStatement",
      items: [{ body: [{ type: "BgStatement" }, { type: "ShowStatement" }, { type: "ClearVisualStatement", target: "bg" }] }],
    });
  });

  it("rejects invalid bg statements", () => {
    expect(expectVisualFailure("scene start:\n  bg\n")).toContain("bg assetRef is required.");
    expect(expectVisualFailure("scene start:\n  bg $scenario.bg\n")).toContain(
      "bg visual assetRef must be static.",
    );
    expect(expectVisualFailure('scene start:\n  bg ""\n')).toContain("bg visual assetRef must not be empty.");
    expect(expectVisualFailure("scene start:\n  bg classroom-bg\n")).toContain("Invalid bg visual assetRef.");
    expect(expectVisualFailure("scene start:\n  bg classroom extra\n")).toContain(
      "bg statement must not have extra trailing tokens.",
    );
  });

  it("rejects invalid show statements", () => {
    expect(expectVisualFailure("scene start:\n  show\n")).toContain("show assetRef is required.");
    expect(expectVisualFailure("scene start:\n  show $scenario.sprite at center\n")).toContain(
      "show visual assetRef must be static.",
    );
    expect(expectVisualFailure("scene start:\n  show alice_smile center\n")).toContain(
      "show statement must include `at`.",
    );
    expect(expectVisualFailure("scene start:\n  show alice_smile at top\n")).toContain("Invalid show placement.");
    expect(expectVisualFailure("scene start:\n  show alice_smile at x=100\n")).toContain(
      "show coordinate placement requires both x and y.",
    );
    expect(expectVisualFailure("scene start:\n  show alice_smile at y=200\n")).toContain(
      "show coordinate placement requires both x and y.",
    );
    expect(expectVisualFailure("scene start:\n  show alice_smile at x=left y=200\n")).toContain(
      "Malformed show coordinate placement.",
    );
    expect(expectVisualFailure("scene start:\n  show alice_smile at y=200 x=100\n")).toContain(
      "Malformed show coordinate placement.",
    );
    expect(expectVisualFailure("scene start:\n  show alice_smile at center with fade(duration=300)\n")).toContain(
      "Visual transitions are not implemented yet.",
    );
  });

  it("rejects invalid hide statements", () => {
    expect(expectVisualFailure("scene start:\n  hide\n")).toContain("hide assetRef is required.");
    expect(expectVisualFailure("scene start:\n  hide $scenario.sprite\n")).toContain(
      "hide visual assetRef must be static.",
    );
    expect(expectVisualFailure('scene start:\n  hide ""\n')).toContain("hide visual assetRef must not be empty.");
    expect(expectVisualFailure("scene start:\n  hide alice_smile extra\n")).toContain(
      "hide statement must not have extra trailing tokens.",
    );
  });

  it("rejects invalid clear statements", () => {
    expect(expectVisualFailure("scene start:\n  clear\n")).toContain("clear target is required.");
    expect(expectVisualFailure("scene start:\n  clear screen\n")).toContain("Invalid clear target.");
    expect(expectVisualFailure("scene start:\n  clear bg extra\n")).toContain(
      "clear statement must not have extra trailing tokens.",
    );
  });

  it("rejects visual transitions for this phase", () => {
    expect(expectVisualFailure("scene start:\n  bg classroom with fade(duration=500)\n")).toContain(
      "Visual transitions are not implemented yet.",
    );
    expect(expectVisualFailure("scene start:\n  hide alice_smile with fade(duration=300)\n")).toContain(
      "Visual transitions are not implemented yet.",
    );
    expect(expectVisualFailure("scene start:\n  clear sprites with fade(duration=300)\n")).toContain(
      "Visual transitions are not implemented yet.",
    );
  });
});
