import { describe, expect, it } from "vitest";
import { parseTzrV2, type TzrV2TextLine } from "../src/index.js";

function parseSingleTextLine(source: string): TzrV2TextLine {
  const result = parseTzrV2(`scene start:\n  mio:\n    ${source}\n`, { filePath: "scenario/inline.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }

  const scene = result.document.declarations[0];
  if (scene === undefined || scene.type !== "SceneDeclaration") {
    throw new Error("expected scene");
  }
  const statement = scene.body[0];
  if (statement === undefined || statement.type !== "DialogueStatement") {
    throw new Error("expected dialogue");
  }
  const line = statement.lines[0];
  if (line === undefined || line.type !== "TextLine") {
    throw new Error("expected text line");
  }
  return line;
}

function expectInlineFailure(source: string): string[] {
  const result = parseTzrV2(`scene start:\n  mio:\n    ${source}\n`, { filePath: "scenario/inline.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzrV2 inline markup", () => {
  it("parses plain text line into InlineText", () => {
    const line = parseSingleTextLine("Plain text.");

    expect(line).toMatchObject({
      type: "TextLine",
      text: "Plain text.",
      inline: [{ type: "InlineText", text: "Plain text." }],
    });
  });

  it("parses text color spans", () => {
    expect(parseSingleTextLine("{text color=#f55|赤}")).toMatchObject({
      text: "赤",
      inline: [{ type: "InlineTextSpan", text: "赤", attributes: [{ name: "color", value: "#f55" }] }],
    });
    expect(parseSingleTextLine("{text color=#ff5555|赤}")).toMatchObject({
      text: "赤",
      inline: [{ type: "InlineTextSpan", attributes: [{ name: "color", value: "#ff5555" }] }],
    });
    expect(parseSingleTextLine("{text color=#ff5555cc|赤}")).toMatchObject({
      text: "赤",
      inline: [{ type: "InlineTextSpan", attributes: [{ name: "color", value: "#ff5555cc" }] }],
    });
  });

  it("parses text style spans", () => {
    expect(parseSingleTextLine("{text bold=true|太字}")).toMatchObject({
      text: "太字",
      inline: [{ type: "InlineTextSpan", attributes: [{ name: "bold", value: true }] }],
    });
    expect(parseSingleTextLine("{text italic=true|斜体}")).toMatchObject({
      text: "斜体",
      inline: [{ type: "InlineTextSpan", attributes: [{ name: "italic", value: true }] }],
    });
    expect(parseSingleTextLine("{text size=32|大きい文字}")).toMatchObject({
      text: "大きい文字",
      inline: [{ type: "InlineTextSpan", attributes: [{ name: "size", value: 32 }] }],
    });
  });

  it("parses text spans with multiple attributes", () => {
    const line = parseSingleTextLine("{text color=#ff5555 bold=true size=32|赤く太く大きい文字}");

    expect(line).toMatchObject({
      text: "赤く太く大きい文字",
      inline: [
        {
          type: "InlineTextSpan",
          text: "赤く太く大きい文字",
          attributes: [
            { name: "color", value: "#ff5555" },
            { name: "bold", value: true },
            { name: "size", value: 32 },
          ],
        },
      ],
    });
  });

  it("parses delay spans", () => {
    expect(parseSingleTextLine("{delay ms=20|速い}")).toMatchObject({
      text: "速い",
      inline: [{ type: "InlineDelaySpan", ms: 20, text: "速い" }],
    });
    expect(parseSingleTextLine("{delay ms=0|即時}")).toMatchObject({
      text: "即時",
      inline: [{ type: "InlineDelaySpan", ms: 0, text: "即時" }],
    });
  });

  it("parses text before and after inline markup", () => {
    const line = parseSingleTextLine("A {text bold=true|bold} B");

    expect(line).toMatchObject({
      text: "A bold B",
      inline: [
        { type: "InlineText", text: "A " },
        { type: "InlineTextSpan", text: "bold" },
        { type: "InlineText", text: " B" },
      ],
    });
  });

  it("parses nested text inside delay", () => {
    const line = parseSingleTextLine("{delay ms=20|A {text bold=true|bold} B}");

    expect(line).toMatchObject({
      text: "A bold B",
      inline: [
        {
          type: "InlineDelaySpan",
          text: "A bold B",
          children: [
            { type: "InlineText", text: "A " },
            { type: "InlineTextSpan", text: "bold" },
            { type: "InlineText", text: " B" },
          ],
        },
      ],
    });
  });

  it("parses nested delay inside text", () => {
    const line = parseSingleTextLine("{text italic=true|A {delay ms=20|fast} B}");

    expect(line).toMatchObject({
      text: "A fast B",
      inline: [
        {
          type: "InlineTextSpan",
          text: "A fast B",
          children: [
            { type: "InlineText", text: "A " },
            { type: "InlineDelaySpan", text: "fast", ms: 20 },
            { type: "InlineText", text: " B" },
          ],
        },
      ],
    });
  });

  it("keeps text block escapes in normal text", () => {
    const line = parseSingleTextLine("\\{ \\} \\| \\\\");

    expect(line).toMatchObject({
      text: "{ } | \\",
      inline: [{ type: "InlineText", text: "{ } | \\" }],
    });
  });

  it("keeps escaped separators inside inline markup content", () => {
    const line = parseSingleTextLine("{text bold=true|a \\| b \\}}");

    expect(line).toMatchObject({
      text: "a | b }",
      inline: [{ type: "InlineTextSpan", text: "a | b }", children: [{ type: "InlineText", text: "a | b }" }] }],
    });
  });

  it("rejects malformed inline markup", () => {
    expect(expectInlineFailure("{}")).toContain("Malformed inline markup.");
  });

  it("rejects missing closing brace", () => {
    expect(expectInlineFailure("{text color=#fff|赤")).toContain("Inline markup must be closed with `}`.");
  });

  it("rejects missing separator", () => {
    expect(expectInlineFailure("{text color=#fff}")).toContain("Inline markup must include `|`.");
  });

  it("rejects empty inline text", () => {
    expect(expectInlineFailure("{text color=#fff|}")).toContain("Inline markup text must not be empty.");
  });

  it("rejects unknown and unsupported inline markup names", () => {
    expect(expectInlineFailure("{ruby text=foo|bar}")).toContain('Unknown inline markup "ruby".');
    expect(expectInlineFailure("{wait ms=500}")).toContain('Unsupported inline markup "wait".');
    expect(expectInlineFailure("{se assetId=doorOpen}")).toContain('Unsupported inline markup "se".');
    expect(expectInlineFailure("{voice assetId=mio_001}")).toContain('Unsupported inline markup "voice".');
  });

  it("rejects invalid text span attributes", () => {
    expect(expectInlineFailure("{text|赤}")).toContain("{text} requires at least one attribute.");
    expect(expectInlineFailure("{text color=red|赤}")).toContain("Invalid {text} color value.");
    expect(expectInlineFailure("{text color=rgb(255,0,0)|赤}")).toContain("Invalid {text} color value.");
    expect(expectInlineFailure("{text bold=yes|赤}")).toContain("Invalid {text} bold value.");
    expect(expectInlineFailure("{text italic=1|赤}")).toContain("Invalid {text} italic value.");
    expect(expectInlineFailure("{text size=0|赤}")).toContain("Invalid {text} size value.");
    expect(expectInlineFailure("{text size=-1|赤}")).toContain("Invalid {text} size value.");
    expect(expectInlineFailure("{text color=#fff color=#000|赤}")).toContain('Duplicate {text} attribute "color".');
  });

  it("rejects invalid delay attributes", () => {
    expect(expectInlineFailure("{delay|速い}")).toContain("{delay} requires ms.");
    expect(expectInlineFailure("{delay foo=1|速い}")).toContain('Unknown {delay} attribute "foo".');
    expect(expectInlineFailure("{delay ms=-1|速い}")).toContain("Invalid {delay} ms value.");
    expect(expectInlineFailure('{delay ms="20"|速い}')).toContain("Invalid {delay} ms value.");
  });

  it("rejects invalid escapes", () => {
    expect(expectInlineFailure("trailing \\")).toContain("Incomplete text block escape.");
    expect(expectInlineFailure("\\x")).toContain("Invalid text block escape \\x.");
    expect(expectInlineFailure("{text bold=true|\\x}")).toContain("Invalid text block escape \\x.");
  });

  it("rejects unescaped standalone braces", () => {
    expect(expectInlineFailure("standalone }")).toContain("Unescaped `}` is not valid in text.");
  });
});
