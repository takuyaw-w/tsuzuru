import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-transition.tzr" });
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

function expectTransitionFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-transition.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std transition statements", () => {
  it("parses standalone transition commands", () => {
    expect(parseSingleStatement("scene start:\n  transition fade(duration=500)\n")).toMatchObject({
      type: "StdTransitionStatement",
      effect: "fade",
      args: [{ type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 500 } }],
    });
    expect(parseSingleStatement('scene start:\n  transition wipe(direction="left", duration=600)\n')).toMatchObject({
      type: "StdTransitionStatement",
      effect: "wipe",
      args: [
        { type: "NamedArgument", name: "direction", value: { type: "StringValue", value: "left" } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 600 } },
      ],
    });
    expect(parseSingleStatement('scene start:\n  transition flash(color="#ffffff", duration=180)\n')).toMatchObject({
      type: "StdTransitionStatement",
      effect: "flash",
      args: [
        { type: "NamedArgument", name: "color", value: { type: "StringValue", value: "#ffffff" } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 180 } },
      ],
    });
    expect(parseSingleStatement('scene start:\n  transition pageTurn(direction="left", duration=800)\n')).toMatchObject(
      {
        type: "StdTransitionStatement",
        effect: "pageTurn",
        args: [
          { type: "NamedArgument", name: "direction", value: { type: "StringValue", value: "left" } },
          { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 800 } },
        ],
      },
    );
    expect(parseSingleStatement("scene start:\n  transition blurFade(duration=700)\n")).toMatchObject({
      type: "StdTransitionStatement",
      effect: "blurFade",
      args: [{ type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 700 } }],
    });
    expect(parseSingleStatement('scene start:\n  transition slide(direction="up", duration=650)\n')).toMatchObject({
      type: "StdTransitionStatement",
      effect: "slide",
      args: [
        { type: "NamedArgument", name: "direction", value: { type: "StringValue", value: "up" } },
        { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 650 } },
      ],
    });
  });

  it("parses bg with screen transitions", () => {
    expect(parseSingleStatement("scene start:\n  bg station with fade(duration=600)\n")).toMatchObject({
      type: "BgStatement",
      transition: {
        type: "VisualTransition",
        name: "fade",
        args: [{ type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 600 } }],
      },
    });
    expect(
      parseSingleStatement('scene start:\n  bg library with pageTurn(direction="left", duration=800)\n'),
    ).toMatchObject({
      type: "BgStatement",
      transition: {
        type: "VisualTransition",
        name: "pageTurn",
        args: [
          { type: "NamedArgument", name: "direction", value: { type: "StringValue", value: "left" } },
          { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 800 } },
        ],
      },
    });
    expect(parseSingleStatement("scene start:\n  bg rooftop with blurFade(duration=700)\n")).toMatchObject({
      type: "BgStatement",
      transition: {
        type: "VisualTransition",
        name: "blurFade",
        args: [{ type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 700 } }],
      },
    });
    expect(
      parseSingleStatement('scene start:\n  bg hallway with slide(direction="right", duration=650)\n'),
    ).toMatchObject({
      type: "BgStatement",
      transition: {
        type: "VisualTransition",
        name: "slide",
        args: [
          { type: "NamedArgument", name: "direction", value: { type: "StringValue", value: "right" } },
          { type: "NamedArgument", name: "duration", value: { type: "NumberValue", value: 650 } },
        ],
      },
    });
  });

  it("parses transition statements inside if branches and choice item bodies", () => {
    expect(
      parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    transition fade(duration=500)
`),
    ).toMatchObject({
      type: "IfStatement",
      thenBranch: [{ type: "StdTransitionStatement", effect: "fade" }],
    });

    expect(
      parseSingleStatement(`scene start:
  choice "どうする？":
    "見る":
      transition wipe(direction="left", duration=600)
`),
    ).toMatchObject({
      type: "ChoiceStatement",
      items: [{ body: [{ type: "StdTransitionStatement", effect: "wipe" }] }],
    });
  });

  it("rejects malformed transition syntax", () => {
    expect(expectTransitionFailure("scene start:\n  transition\n")).toContain("transition effect is required.");
    expect(expectTransitionFailure("scene start:\n  transition fade\n")).toContain(
      "transition statement must include parentheses.",
    );
    expect(expectTransitionFailure("scene start:\n  transition dissolve(duration=500)\n")).toContain(
      'Unknown transition effect "dissolve".',
    );
    expect(expectTransitionFailure("scene start:\n  transition fade(duration=500\n")).toContain(
      "transition statement is missing closing parenthesis.",
    );
    expect(expectTransitionFailure("scene start:\n  transition fade(duration=500) now\n")).toContain(
      "transition statement must not have extra trailing tokens.",
    );
    expect(expectTransitionFailure('scene start:\n  transition flash(color="#fff, duration=180)\n')).toContain(
      "transition statement is missing closing parenthesis.",
    );
  });
});
