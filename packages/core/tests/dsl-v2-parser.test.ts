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
      body: [{ type: "SceneBodyLine", text: "narration:", indentLevel: 1 }],
    });
    expect(result.document.declarations[1]).toMatchObject({ type: "SceneDeclaration", id: "next" });
  });

  it("recognizes nested scene body lines without compiling them", () => {
    const result = parseTzrV2(
      `scene start:
  choice "Question":
    "A":
      jump routeA
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
        { type: "SceneBodyLine", text: 'choice "Question":', indentLevel: 1 },
        { type: "SceneBodyLine", text: '"A":', indentLevel: 2 },
        { type: "SceneBodyLine", text: "jump routeA", indentLevel: 3 },
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
