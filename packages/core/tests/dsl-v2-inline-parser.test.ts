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

  it("parses wait events", () => {
    expect(parseSingleTextLine("……えっと、{wait ms=500}ありがとう。")).toMatchObject({
      text: "……えっと、ありがとう。",
      inline: [
        { type: "InlineText", text: "……えっと、" },
        { type: "InlineWaitEvent", ms: 500, text: "" },
        { type: "InlineText", text: "ありがとう。" },
      ],
    });
    expect(parseSingleTextLine("{wait ms=0}即時")).toMatchObject({
      text: "即時",
      inline: [
        { type: "InlineWaitEvent", ms: 0, text: "" },
        { type: "InlineText", text: "即時" },
      ],
    });
  });

  it("parses se events", () => {
    expect(parseSingleTextLine("{se assetId=doorOpen}開いた。")).toMatchObject({
      text: "開いた。",
      inline: [
        { type: "InlineSeEvent", text: "", assetId: { type: "InlineIdentifierAssetId", value: "doorOpen" } },
        { type: "InlineText", text: "開いた。" },
      ],
    });
    expect(parseSingleTextLine("{se assetId=door.open}")).toMatchObject({
      text: "",
      inline: [{ type: "InlineSeEvent", assetId: { type: "InlineIdentifierAssetId", value: "door.open" } }],
    });
    expect(parseSingleTextLine('{se assetId="door-open"}')).toMatchObject({
      text: "",
      inline: [{ type: "InlineSeEvent", assetId: { type: "InlineStringAssetId", value: "door-open" } }],
    });
    expect(parseSingleTextLine("{se assetId=$system.se.doorOpen}")).toMatchObject({
      text: "",
      inline: [{ type: "InlineSeEvent", assetId: { type: "InlineVariableAssetId", path: "system.se.doorOpen" } }],
    });
  });

  it("parses voice events", () => {
    expect(parseSingleTextLine("{voice assetId=mio_001}遅いよ。")).toMatchObject({
      text: "遅いよ。",
      inline: [
        { type: "InlineVoiceEvent", text: "", assetId: { type: "InlineIdentifierAssetId", value: "mio_001" } },
        { type: "InlineText", text: "遅いよ。" },
      ],
    });
    expect(parseSingleTextLine("{voice assetId=mio.normal_001}")).toMatchObject({
      text: "",
      inline: [{ type: "InlineVoiceEvent", assetId: { type: "InlineIdentifierAssetId", value: "mio.normal_001" } }],
    });
    expect(parseSingleTextLine("{voice assetId=$scenario.currentVoice}")).toMatchObject({
      text: "",
      inline: [{ type: "InlineVoiceEvent", assetId: { type: "InlineVariableAssetId", path: "scenario.currentVoice" } }],
    });
    expect(parseSingleTextLine('{voice assetId="mio-001"}')).toMatchObject({
      text: "",
      inline: [{ type: "InlineVoiceEvent", assetId: { type: "InlineStringAssetId", value: "mio-001" } }],
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

  it("parses text before and after inline event markup", () => {
    const line = parseSingleTextLine("A {wait ms=500}B {se assetId=doorOpen}C {voice assetId=mio_001}D");

    expect(line).toMatchObject({
      text: "A B C D",
      inline: [
        { type: "InlineText", text: "A " },
        { type: "InlineWaitEvent", ms: 500 },
        { type: "InlineText", text: "B " },
        { type: "InlineSeEvent", assetId: { value: "doorOpen" } },
        { type: "InlineText", text: "C " },
        { type: "InlineVoiceEvent", assetId: { value: "mio_001" } },
        { type: "InlineText", text: "D" },
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

  it("allows inline events inside text and delay ranges", () => {
    expect(parseSingleTextLine("{text bold=true|A {wait ms=500}B}")).toMatchObject({
      text: "A B",
      inline: [
        {
          type: "InlineTextSpan",
          text: "A B",
          children: [
            { type: "InlineText", text: "A " },
            { type: "InlineWaitEvent", ms: 500 },
            { type: "InlineText", text: "B" },
          ],
        },
      ],
    });
    expect(parseSingleTextLine("{delay ms=20|A {voice assetId=mio_001}B}")).toMatchObject({
      text: "A B",
      inline: [
        {
          type: "InlineDelaySpan",
          text: "A B",
          children: [
            { type: "InlineText", text: "A " },
            { type: "InlineVoiceEvent", assetId: { value: "mio_001" } },
            { type: "InlineText", text: "B" },
          ],
        },
      ],
    });
  });

  it("keeps escaped inline event markup as literal text", () => {
    const line = parseSingleTextLine("\\{wait ms=500\\}");

    expect(line).toMatchObject({
      text: "{wait ms=500}",
      inline: [{ type: "InlineText", text: "{wait ms=500}" }],
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

  it("rejects unknown inline markup names", () => {
    expect(expectInlineFailure("{ruby text=foo|bar}")).toContain('Unknown inline markup "ruby".');
  });

  it("rejects invalid text span attributes", () => {
    expect(expectInlineFailure("{text|赤}")).toContain("{text} requires at least one attribute.");
    expect(expectInlineFailure("{text mood=angry|赤}")).toContain('Unknown {text} attribute "mood".');
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
    expect(expectInlineFailure("{delay ms=20 ms=30|速い}")).toContain('Duplicate {delay} attribute "ms".');
    expect(expectInlineFailure("{delay ms=-1|速い}")).toContain("Invalid {delay} ms value.");
    expect(expectInlineFailure('{delay ms="20"|速い}')).toContain("Invalid {delay} ms value.");
  });

  it("rejects invalid wait event attributes", () => {
    expect(expectInlineFailure("{wait}")).toContain("{wait} requires ms.");
    expect(expectInlineFailure("{wait ms=-1}")).toContain("Invalid {wait} ms value.");
    expect(expectInlineFailure('{wait ms="500"}')).toContain("Invalid {wait} ms value.");
    expect(expectInlineFailure("{wait foo=500}")).toContain('Unknown {wait} attribute "foo".');
    expect(expectInlineFailure("{wait ms=500 extra=1}")).toContain('Unknown {wait} attribute "extra".');
    expect(expectInlineFailure("{wait ms=500 ms=600}")).toContain('Duplicate {wait} attribute "ms".');
    expect(expectInlineFailure("{wait ms=500|text}")).toContain("{wait} does not support text ranges.");
    expect(expectInlineFailure("{wait ms=500")).toContain("Inline event markup must be closed with `}`.");
  });

  it("rejects invalid se event attributes", () => {
    expect(expectInlineFailure("{se}")).toContain("{se} requires assetId.");
    expect(expectInlineFailure("{se assetId=}")).toContain("{se} assetId must not be empty.");
    expect(expectInlineFailure("{se id=doorOpen}")).toContain('Unknown {se} attribute "id".');
    expect(expectInlineFailure('{se assetId=""}')).toContain("{se} assetId must not be empty.");
    expect(expectInlineFailure("{se assetId=doorOpen volume=80}")).toContain('Unknown {se} attribute "volume".');
    expect(expectInlineFailure("{se assetId=doorOpen assetId=doorClose}")).toContain(
      'Duplicate {se} attribute "assetId".',
    );
    expect(expectInlineFailure("{se assetId=door-open.part}")).toContain("Invalid {se} assetId value.");
    expect(expectInlineFailure("{se assetId=$}")).toContain("Invalid {se} variable assetId.");
    expect(expectInlineFailure("{se assetId=$scenario.}")).toContain("Invalid {se} variable assetId.");
    expect(expectInlineFailure("{se assetId=$scenario..voice}")).toContain("Invalid {se} variable assetId.");
    expect(expectInlineFailure("{se assetId=doorOpen|text}")).toContain("{se} does not support text ranges.");
    expect(expectInlineFailure("{se assetId=doorOpen")).toContain("Inline event markup must be closed with `}`.");
  });

  it("rejects invalid voice event attributes", () => {
    expect(expectInlineFailure("{voice}")).toContain("{voice} requires assetId.");
    expect(expectInlineFailure("{voice assetId=}")).toContain("{voice} assetId must not be empty.");
    expect(expectInlineFailure("{voice id=mio_001}")).toContain('Unknown {voice} attribute "id".');
    expect(expectInlineFailure('{voice assetId=""}')).toContain("{voice} assetId must not be empty.");
    expect(expectInlineFailure("{voice assetId=mio_001 volume=80}")).toContain(
      'Unknown {voice} attribute "volume".',
    );
    expect(expectInlineFailure("{voice assetId=mio_001 assetId=mio_002}")).toContain(
      'Duplicate {voice} attribute "assetId".',
    );
    expect(expectInlineFailure("{voice assetId=door-open.part}")).toContain("Invalid {voice} assetId value.");
    expect(expectInlineFailure("{voice assetId=$}")).toContain("Invalid {voice} variable assetId.");
    expect(expectInlineFailure("{voice assetId=mio_001|text}")).toContain(
      "{voice} does not support text ranges.",
    );
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
