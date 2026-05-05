import { describe, expect, it } from "vitest";
import { isValidTzrV2DottedIdentifier, parseTzrV2 } from "../src/index.js";

function expectParseFailure(source: string): string[] {
  const result = parseTzrV2(source, { filePath: "scenario/v2.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzrV2", () => {
  it("parses a valid title declaration", () => {
    const result = parseTzrV2('title "Rain Station"\n', { filePath: "scenario/v2.tzr" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations).toEqual([
      expect.objectContaining({ type: "TitleDeclaration", title: "Rain Station" }),
    ]);
  });

  it("parses a valid character declaration", () => {
    const result = parseTzrV2('character mio name="Mio"\n', { filePath: "scenario/v2.tzr" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "CharacterDeclaration",
      id: "mio",
      name: "Mio",
    });
  });

  it("parses a valid scene declaration", () => {
    const result = parseTzrV2("scene start:\n", { filePath: "scenario/v2.tzr" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      id: "start",
      body: [],
    });
  });

  it("parses a valid scene declaration with title", () => {
    const result = parseTzrV2('scene start "Rain Platform":\n', { filePath: "scenario/v2.tzr" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      id: "start",
      title: "Rain Platform",
    });
  });

  it("recognizes scene body lines without compiling them", () => {
    const result = parseTzrV2(
      `scene start:
  narration:
    Rain blurred the platform edge.
scene next:
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "NarrationStatement", lines: [{ text: "Rain blurred the platform edge." }] }],
    });
    expect(result.document.declarations[1]).toMatchObject({ type: "SceneDeclaration", id: "next" });
  });

  it("parses a narration block", () => {
    const result = parseTzrV2(
      `scene start:
  narration:
    Rain blurred the platform edge.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "NarrationStatement",
          lines: [{ type: "TextLine", text: "Rain blurred the platform edge." }],
        },
      ],
    });
  });

  it("parses an explicit say block", () => {
    const result = parseTzrV2(
      `scene start:
  say mio:
    You're late.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "DialogueStatement", speaker: "mio", explicit: true, lines: [{ text: "You're late." }] }],
    });
  });

  it("parses character dialogue shorthand", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    You're late.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "DialogueStatement", speaker: "mio", explicit: false, lines: [{ text: "You're late." }] }],
    });
  });

  it("parses a jump statement", () => {
    const result = parseTzrV2("scene start:\n  jump commonRoute\n", { filePath: "scenario/v2.tzr" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "JumpStatement", target: "commonRoute" }],
    });
  });

  it("parses an end statement", () => {
    const result = parseTzrV2("scene start:\n  end\n", { filePath: "scenario/v2.tzr" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "EndStatement" }],
    });
  });

  it("parses a small scene containing narration, dialogue, jump, and end", () => {
    const result = parseTzrV2(
      `scene start:
  narration:
    Rain blurred the platform edge.
  mio:
    You're late.
  jump commonRoute
scene commonRoute:
  say mio:
    Let's go.
  end
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations).toMatchObject([
      {
        type: "SceneDeclaration",
        id: "start",
        body: [
          { type: "NarrationStatement" },
          { type: "DialogueStatement", speaker: "mio", explicit: false },
          { type: "JumpStatement", target: "commonRoute" },
        ],
      },
      {
        type: "SceneDeclaration",
        id: "commonRoute",
        body: [
          { type: "DialogueStatement", speaker: "mio", explicit: true },
          { type: "EndStatement" },
        ],
      },
    ]);
  });

  it("parses a normal text line", () => {
    const result = parseTzrV2("scene start:\n  mio:\n    You're late.\n", { filePath: "scenario/v2.tzr" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "DialogueStatement", lines: [{ type: "TextLine", text: "You're late." }] }],
    });
  });

  it("parses a blank line as click wait with page kept", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    You're late.

    I waited thirty minutes.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          lines: [
            { type: "TextLine", text: "You're late." },
            { type: "TextClickWait" },
            { type: "TextLine", text: "I waited thirty minutes." },
          ],
        },
      ],
    });
  });

  it("parses page break lines", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    You're late.
    ---
    I waited thirty minutes.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          lines: [
            { type: "TextLine", text: "You're late." },
            { type: "TextPageBreak" },
            { type: "TextLine", text: "I waited thirty minutes." },
          ],
        },
      ],
    });
  });

  it("accepts a trailing page break", () => {
    const result = parseTzrV2("scene start:\n  mio:\n    You're late.\n    ---\n", {
      filePath: "scenario/v2.tzr",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "DialogueStatement", lines: [{ type: "TextLine" }, { type: "TextPageBreak" }] }],
    });
  });

  it("parses escaped page break and line comment markers as literal text", () => {
    const result = parseTzrV2("scene start:\n  mio:\n    \\---\n    \\// not a comment\n", {
      filePath: "scenario/v2.tzr",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          lines: [
            { type: "TextLine", text: "---" },
            { type: "TextLine", text: "// not a comment" },
          ],
        },
      ],
    });
  });

  it("parses text block punctuation escapes as literal text", () => {
    const result = parseTzrV2("scene start:\n  mio:\n    \\{wait ms=500\\} \\| \\\\\n", {
      filePath: "scenario/v2.tzr",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "DialogueStatement", lines: [{ type: "TextLine", text: "{wait ms=500} | \\" }] }],
    });
  });

  it("strips unescaped line comments inside text block lines", () => {
    const result = parseTzrV2("scene start:\n  mio:\n    Visible text // hidden comment\n    // full line comment\n", {
      filePath: "scenario/v2.tzr",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [{ type: "DialogueStatement", lines: [{ type: "TextLine", text: "Visible text" }] }],
    });
  });

  it("preserves multiple text block items in order", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    First.

    Second.
    ---
    Third.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          lines: [
            { type: "TextLine", text: "First." },
            { type: "TextClickWait" },
            { type: "TextLine", text: "Second." },
            { type: "TextPageBreak" },
            { type: "TextLine", text: "Third." },
          ],
        },
      ],
    });
  });

  it("parses :meta in a narration block", () => {
    const result = parseTzrV2(
      `scene start:
  narration:
    :meta
      delay=70
    Rain blurred the platform edge.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "NarrationStatement",
          meta: {
            type: "TextBlockMeta",
            attributes: [{ type: "TextBlockNumberMetaAttribute", name: "delay", value: 70 }],
          },
          lines: [{ type: "TextLine", text: "Rain blurred the platform edge." }],
        },
      ],
    });
  });

  it("parses :meta in an explicit say block", () => {
    const result = parseTzrV2(
      `scene start:
  say mio:
    :meta
      mood=annoyed
    You're late.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          explicit: true,
          meta: {
            attributes: [{ type: "TextBlockMoodMetaAttribute", name: "mood", value: "annoyed", valueKind: "identifier" }],
          },
          lines: [{ type: "TextLine", text: "You're late." }],
        },
      ],
    });
  });

  it("parses :meta in shorthand dialogue", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    :meta
      color=#ff5555
    You're late.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          explicit: false,
          meta: {
            attributes: [{ type: "TextBlockColorMetaAttribute", name: "color", value: "#ff5555" }],
          },
          lines: [{ type: "TextLine", text: "You're late." }],
        },
      ],
    });
  });

  it("parses all supported :meta attributes", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    :meta
      color=#ff5555cc
      bold=true
      italic=false
      size=28
      delay=0
      mood="annoyed"
    You're late.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          meta: {
            attributes: [
              { type: "TextBlockColorMetaAttribute", name: "color", value: "#ff5555cc" },
              { type: "TextBlockBooleanMetaAttribute", name: "bold", value: true },
              { type: "TextBlockBooleanMetaAttribute", name: "italic", value: false },
              { type: "TextBlockNumberMetaAttribute", name: "size", value: 28 },
              { type: "TextBlockNumberMetaAttribute", name: "delay", value: 0 },
              { type: "TextBlockMoodMetaAttribute", name: "mood", value: "annoyed", valueKind: "string" },
            ],
          },
        },
      ],
    });
  });

  it("accepts :meta shorthand color and boolean false values", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    :meta
      color=#f55
      bold=false
      delay=70
    You're late.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          meta: {
            attributes: [
              { type: "TextBlockColorMetaAttribute", name: "color", value: "#f55" },
              { type: "TextBlockBooleanMetaAttribute", name: "bold", value: false },
              { type: "TextBlockNumberMetaAttribute", name: "delay", value: 70 },
            ],
          },
        },
      ],
    });
  });

  it("does not carry :meta to the next text block", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    :meta
      mood=annoyed
    You're late.
  mio:
    Sorry.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        { type: "DialogueStatement", meta: { type: "TextBlockMeta" } },
        { type: "DialogueStatement", lines: [{ type: "TextLine", text: "Sorry." }] },
      ],
    });
    const scene = result.document.declarations[0];
    if (scene === undefined || scene.type !== "SceneDeclaration") {
      throw new Error("expected scene");
    }
    const secondStatement = scene.body[1];
    if (secondStatement === undefined) {
      throw new Error("expected second statement");
    }
    expect(secondStatement).not.toHaveProperty("meta");
  });

  it("keeps text block items after :meta in order", () => {
    const result = parseTzrV2(
      `scene start:
  mio:
    :meta
      delay=70
    First.

    Second.
    ---
    Third.
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations[0]).toMatchObject({
      type: "SceneDeclaration",
      body: [
        {
          type: "DialogueStatement",
          meta: { attributes: [{ name: "delay", value: 70 }] },
          lines: [
            { type: "TextLine", text: "First." },
            { type: "TextClickWait" },
            { type: "TextLine", text: "Second." },
            { type: "TextPageBreak" },
            { type: "TextLine", text: "Third." },
          ],
        },
      ],
    });
  });

  it("rejects unknown top-level declaration names that share known prefixes", () => {
    expect(expectParseFailure('titlex "Rain Station"\n')).toContain("Expected a DSL v2 top-level declaration.");
    expect(expectParseFailure('characterx mio name="Mio"\n')).toContain("Expected a DSL v2 top-level declaration.");
    expect(expectParseFailure("scenex start:\n")).toContain("Expected a DSL v2 top-level declaration.");
  });

  it("rejects an invalid identifier", () => {
    expect(expectParseFailure('character 1stRoute name="Route"\n')).toContain('Invalid identifier "1stRoute".');
  });

  it("rejects an invalid dotted identifier", () => {
    expect(isValidTzrV2DottedIdentifier("system.true-ending.seen")).toBe(false);
  });

  it("rejects single-quoted strings", () => {
    expect(expectParseFailure("title 'Rain Station'\n")).toContain("Only double-quoted string literals are supported.");
  });

  it("rejects backtick strings", () => {
    expect(expectParseFailure("title `Rain Station`\n")).toContain("Backtick string literals are not supported.");
  });

  it("rejects tab indentation", () => {
    expect(expectParseFailure("scene start:\n\tnarration:\n")).toContain("Tabs are not allowed for indentation.");
  });

  it("rejects full-width space indentation", () => {
    expect(expectParseFailure("scene start:\n　narration:\n")).toContain("Full-width spaces are not allowed for indentation.");
  });

  it("rejects odd scene body indentation", () => {
    expect(expectParseFailure("scene start:\n   narration:\n")).toContain("Indentation must use 2 spaces per level.");
  });

  it("rejects narration without a colon", () => {
    expect(expectParseFailure("scene start:\n  narration\n")).toContain("narration block must end with `:`.");
  });

  it("rejects say without a colon", () => {
    expect(expectParseFailure("scene start:\n  say mio\n")).toContain("say block must use `say speaker:` syntax.");
  });

  it("rejects invalid explicit say speaker", () => {
    expect(expectParseFailure('scene start:\n  say "Mio":\n')).toContain('Invalid identifier ""Mio"".');
    expect(expectParseFailure("scene start:\n  say 1st:\n")).toContain('Invalid identifier "1st".');
  });

  it("rejects invalid shorthand speaker", () => {
    expect(expectParseFailure("scene start:\n  1st:\n")).toContain('Invalid identifier "1st".');
  });

  it("rejects quoted jump targets", () => {
    expect(expectParseFailure('scene start:\n  jump "commonRoute"\n')).toContain('Invalid identifier ""commonRoute"".');
  });

  it("rejects dynamic jump targets", () => {
    expect(expectParseFailure("scene start:\n  jump $scenario.nextScene\n")).toContain(
      'Invalid identifier "$scenario.nextScene".',
    );
  });

  it("rejects jump without a target", () => {
    expect(expectParseFailure("scene start:\n  jump\n")).toContain("jump target is required.");
  });

  it("rejects end with arguments", () => {
    expect(expectParseFailure("scene start:\n  end now\n")).toContain("end statement must not have arguments.");
  });

  it("rejects unsupported scene body statements", () => {
    expect(expectParseFailure('scene start:\n  choice "Question":\n')).toContain(
      "Unsupported DSL v2 scene body statement.",
    );
  });

  it("rejects malformed text block indentation", () => {
    expect(expectParseFailure("scene start:\n  narration:\n      Too deep.\n")).toContain(
      "Text block lines must be indented 4 spaces.",
    );
  });

  it("rejects page break outside a text block", () => {
    expect(expectParseFailure("scene start:\n  ---\n")).toContain("`---` is only valid inside a text block.");
  });

  it("rejects page break at the wrong indentation level", () => {
    expect(expectParseFailure("scene start:\n  narration:\n      ---\n")).toContain(
      "`---` must be indented at the text block level.",
    );
  });

  it("rejects invalid text block escapes", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    \\x\n")).toContain("Invalid text block escape \\x.");
  });

  it("rejects incomplete text block escapes", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    trailing \\\n")).toContain("Incomplete text block escape.");
  });

  it("rejects duplicate :meta", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      mood=annoyed\n    :meta\n      delay=70\n    Text.\n")).toContain(
      "Duplicate :meta block.",
    );
  });

  it("rejects :meta after text block items", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    Text.\n    :meta\n      delay=70\n")).toContain(
      ":meta must appear before text block items.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    Text.\n\n    :meta\n      delay=70\n")).toContain(
      ":meta must appear before text block items.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    Text.\n    ---\n    :meta\n      delay=70\n")).toContain(
      ":meta must appear before text block items.",
    );
  });

  it("rejects empty :meta", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n    Text.\n")).toContain(
      ":meta must include at least one attribute.",
    );
  });

  it("rejects malformed :meta indentation", () => {
    expect(expectParseFailure("scene start:\n  mio:\n      :meta\n        delay=70\n    Text.\n")).toContain(
      ":meta must be indented at the text block level.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n        delay=70\n    Text.\n")).toContain(
      ":meta attributes must be indented 6 spaces.",
    );
  });

  it("rejects malformed :meta attributes", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      delay\n    Text.\n")).toContain(
      ":meta attribute must use key=value syntax.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      unknown=true\n    Text.\n")).toContain(
      'Unknown :meta attribute "unknown".',
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      delay=70\n      delay=80\n    Text.\n")).toContain(
      'Duplicate :meta attribute "delay".',
    );
  });

  it("rejects invalid :meta color values", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      color=red\n    Text.\n")).toContain(
      "Invalid :meta color value.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      color=rgb(255,0,0)\n    Text.\n")).toContain(
      "Invalid :meta color value.",
    );
  });

  it("rejects invalid :meta boolean values", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      bold=yes\n    Text.\n")).toContain(
      "Invalid :meta bold value.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      italic=1\n    Text.\n")).toContain(
      "Invalid :meta italic value.",
    );
  });

  it("rejects invalid :meta numeric values", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      size=0\n    Text.\n")).toContain(
      "Invalid :meta size value.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      size=-1\n    Text.\n")).toContain(
      "Invalid :meta size value.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      delay=-1\n    Text.\n")).toContain(
      "Invalid :meta delay value.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      delay=\"70\"\n    Text.\n")).toContain(
      "Invalid :meta delay value.",
    );
  });

  it("rejects invalid :meta mood and voice values", () => {
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      mood=annoyed-face\n    Text.\n")).toContain(
      "Invalid :meta mood value.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      voice=mio_001\n    Text.\n")).toContain(
      "voice is not allowed in :meta.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      mood='annoyed'\n    Text.\n")).toContain(
      "Only double-quoted string literals are supported.",
    );
    expect(expectParseFailure("scene start:\n  mio:\n    :meta\n      mood=`annoyed`\n    Text.\n")).toContain(
      "Backtick string literals are not supported.",
    );
  });

  it("rejects an unterminated block comment", () => {
    expect(expectParseFailure("/* comment\n")).toContain("Block comment must be closed with */.");
  });

  it("rejects nested block comments", () => {
    expect(expectParseFailure("/* outer /* inner */ */\n")).toContain("Nested block comments are not allowed.");
  });

  it("ignores comments between statements", () => {
    const result = parseTzrV2(
      `// leading comment
title "Rain Station" // inline comment
/*
  disabled declaration
*/
character mio name="Mio"
`,
      { filePath: "scenario/v2.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }
    expect(result.document.declarations.map((declaration) => declaration.type)).toEqual([
      "TitleDeclaration",
      "CharacterDeclaration",
    ]);
  });
});
