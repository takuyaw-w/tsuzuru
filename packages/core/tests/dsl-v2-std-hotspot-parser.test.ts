import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/std-hotspot.tzr" });
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

function expectHotspotFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/std-hotspot.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr std hotspot sugar statements", () => {
  it("parses hotspot, wait hotspot, and clear hotspots commands", () => {
    expect(
      parseSingleStatement(
        "scene start:\n  hotspot desk rect(x=160, y=260, width=220, height=120) jump inspect_desk\n",
      ),
    ).toMatchObject({
      type: "StdHotspotStatement",
      name: "hotspot",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "desk" } },
        { type: "NamedArgument", name: "x", value: { type: "NumberValue", value: 160 } },
        { type: "NamedArgument", name: "y", value: { type: "NumberValue", value: 260 } },
        { type: "NamedArgument", name: "width", value: { type: "NumberValue", value: 220 } },
        { type: "NamedArgument", name: "height", value: { type: "NumberValue", value: 120 } },
        { type: "NamedArgument", name: "target", value: { type: "StringValue", value: "inspect_desk" } },
      ],
    });
    expect(parseSingleStatement("scene start:\n  wait hotspot\n")).toMatchObject({
      type: "StdHotspotStatement",
      name: "waitHotspot",
      args: [],
    });
    expect(parseSingleStatement("scene start:\n  clear hotspots\n")).toMatchObject({
      type: "StdHotspotStatement",
      name: "clearHotspots",
      args: [],
    });
  });

  it("parses hotspot statements inside if branches and choice item bodies", () => {
    expect(
      parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    hotspot desk rect(x=160, y=260, width=220, height=120) jump inspect_desk
    wait hotspot
`),
    ).toMatchObject({
      type: "IfStatement",
      thenBranch: [
        { type: "StdHotspotStatement", name: "hotspot" },
        { type: "StdHotspotStatement", name: "waitHotspot" },
      ],
    });

    expect(
      parseSingleStatement(`scene start:
  choice "どうする？":
    "見る":
      hotspot door rect(x=720, y=180, width=120, height=360) jump hallway
      clear hotspots
`),
    ).toMatchObject({
      type: "ChoiceStatement",
      items: [
        {
          body: [
            { type: "StdHotspotStatement", name: "hotspot" },
            { type: "StdHotspotStatement", name: "clearHotspots" },
          ],
        },
      ],
    });
  });

  it("rejects unsupported shape and action syntax", () => {
    expect(expectHotspotFailure("scene start:\n  hotspot desk circle(x=1, y=2, r=3) jump inspect_desk\n")).toContain(
      'Unsupported hotspot shape "circle(x=1,".',
    );
    expect(
      expectHotspotFailure(
        "scene start:\n  hotspot desk rect(x=160, y=260, width=220, height=120) call inspect_desk\n",
      ),
    ).toContain('Unsupported hotspot action "call".');
  });

  it("rejects malformed hotspot syntax", () => {
    expect(expectHotspotFailure("scene start:\n  hotspot\n")).toContain("hotspot id is required.");
    expect(expectHotspotFailure("scene start:\n  hotspot desk rect(x=160, y=260, width=220)\n")).toContain(
      'hotspot rect argument "height" is required.',
    );
    expect(
      expectHotspotFailure(
        "scene start:\n  hotspot desk rect(x=160, y=260, width=220, height=120, extra=1) jump next\n",
      ),
    ).toContain('Unsupported hotspot rect argument "extra".');
    expect(
      expectHotspotFailure("scene start:\n  hotspot desk rect(x=left, y=260, width=220, height=120) jump next\n"),
    ).toContain('hotspot rect argument "x" must be a number.');
    expect(expectHotspotFailure("scene start:\n  wait hotspot now\n")).toContain(
      "wait hotspot statement must not have extra trailing tokens.",
    );
    expect(expectHotspotFailure("scene start:\n  clear hotspots now\n")).toContain(
      "clear hotspots statement must not have extra trailing tokens.",
    );
  });
});
