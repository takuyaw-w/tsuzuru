import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-camera.tzr" });
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

function expectCameraFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-camera.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std camera sugar statements", () => {
  it("parses camera, camera focus, and reset camera commands", () => {
    expect(parseSingleStatement("scene start:\n  camera x=0 y=0 zoom=1 duration=300\n")).toMatchObject({
      type: "StdCameraStatement",
      name: "camera",
      args: [
        { type: "NamedArgument", name: "x", value: { type: "NumberValue", value: 0 } },
        { type: "NamedArgument", name: "y", value: { type: "NumberValue", value: 0 } },
        { type: "NamedArgument", name: "zoom", value: { type: "NumberValue", value: 1 } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 300 } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  camera zoom=1.08 duration=240\n")).toMatchObject({
      type: "StdCameraStatement",
      name: "camera",
      args: [
        { type: "NamedArgument", name: "zoom", value: { type: "NumberValue", value: 1.08 } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 240 } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  camera focus tone_stand zoom=1.2 duration=400\n")).toMatchObject({
      type: "StdCameraStatement",
      name: "cameraFocus",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "tone_stand" } },
        { type: "NamedArgument", name: "zoom", value: { type: "NumberValue", value: 1.2 } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 400 } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  reset camera duration=300\n")).toMatchObject({
      type: "StdCameraStatement",
      name: "resetCamera",
      args: [{ type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 300 } }],
    });
  });

  it("parses camera statements inside if branches and choice item bodies", () => {
    expect(
      parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    camera focus tone_stand zoom=1.2 duration=400
    reset camera duration=300
`),
    ).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "StdCameraStatement", name: "cameraFocus" },
        { type: "StdCameraStatement", name: "resetCamera" },
      ],
    });

    expect(
      parseSingleStatement(`scene start:
  choice "どうする？":
    "見る":
      camera x=0 y=-20 duration=300
`),
    ).toMatchObject({
      type: "ChoiceStatement",
      items: [{ body: [{ type: "StdCameraStatement", name: "camera" }] }],
    });
  });

  it("rejects malformed camera argument syntax", () => {
    expect(expectCameraFailure('scene start:\n  camera focus "tone_stand duration=400\n')).toContain(
      "camera focus string argument is missing closing quote.",
    );
    expect(expectCameraFailure("scene start:\n  camera zoom=\n")).toContain("camera argument value is required.");
    expect(expectCameraFailure("scene start:\n  reset camera duration=#300\n")).toContain(
      "Invalid reset camera argument value.",
    );
  });
});
