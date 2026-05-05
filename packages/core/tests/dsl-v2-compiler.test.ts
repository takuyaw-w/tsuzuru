import { describe, expect, it } from "vitest";
import { compileTzrV2, parseTzrV2, type CompiledTzrV2Document } from "../src/index.js";

function parseSource(source: string) {
  const parsed = parseTzrV2(source, { filePath: "scenario/v2.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }
  return parsed.document;
}

function compileSource(source: string): CompiledTzrV2Document {
  const compiled = compileTzrV2(parseSource(source));
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }
  return compiled.document;
}

function expectCompileFailure(source: string): string[] {
  const compiled = compileTzrV2(parseSource(source));
  expect(compiled.ok).toBe(false);
  if (compiled.ok) {
    throw new Error("expected compiler failure");
  }
  return compiled.errors.map((error) => error.message);
}

describe("compileTzrV2", () => {
  it("compiles a document with one scene", () => {
    const document = compileSource("scene start:\n");

    expect(document).toMatchObject({
      type: "CompiledTzrV2Document",
      filePath: "scenario/v2.tzr",
      instructions: [{ type: "SceneInstruction", id: "start" }],
      scenes: { start: { id: "start", statementIndex: 0 } },
    });
    expect(document.source.type).toBe("TzrV2Document");
  });

  it("compiles multiple scenes into SceneInstruction entries", () => {
    const document = compileSource(`scene start:
scene later:
scene ending:
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "SceneInstruction", id: "later" },
      { type: "SceneInstruction", id: "ending" },
    ]);
    expect(document.scenes).toMatchObject({
      start: { id: "start", statementIndex: 0 },
      later: { id: "later", statementIndex: 1 },
      ending: { id: "ending", statementIndex: 2 },
    });
  });

  it("extracts title metadata", () => {
    const document = compileSource(`title "Rain Station"
scene start:
`);

    expect(document.metadata.title).toBe("Rain Station");
  });

  it("extracts character metadata", () => {
    const document = compileSource(`character mio name="Mio"
scene start:
`);

    expect(document.metadata.characters).toMatchObject({
      mio: { id: "mio", name: "Mio" },
    });
    expect(document.metadata.characters.mio?.loc.start).toEqual({
      filePath: "scenario/v2.tzr",
      line: 1,
      column: 1,
    });
  });

  it("extracts scene title metadata", () => {
    const document = compileSource(`scene start "Rain Platform":
`);

    expect(document.metadata.scenes).toMatchObject({
      start: { id: "start", title: "Rain Platform" },
    });
  });

  it("allows character declarations after scenes", () => {
    const document = compileSource(`scene start:
  mio:
    Hello.
character mio name="Mio"
`);

    expect(document.metadata.characters).toHaveProperty("mio");
    expect(document.instructions).toMatchObject([{ type: "SceneInstruction", id: "start" }]);
  });

  it("allows jump to a scene declared later", () => {
    const document = compileSource(`scene start:
  jump later
scene later:
`);

    expect(document.scenes).toMatchObject({
      start: { statementIndex: 0 },
      later: { statementIndex: 1 },
    });
  });

  it("validates nested dialogue speaker in if branch", () => {
    const document = compileSource(`character mio name="Mio"
scene start:
  if scenario.hasNotebook:
    mio:
      Hello.
`);

    expect(document.metadata.characters).toHaveProperty("mio");
  });

  it("validates nested jump target in choice item body", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Go":
      jump later
scene later:
`);

    expect(document.scenes).toHaveProperty("later");
  });

  it("rejects duplicate title declarations", () => {
    expect(expectCompileFailure(`title "First"
title "Second"
scene start:
`)).toContain("Duplicate title declaration.");
  });

  it("rejects duplicate character ids", () => {
    expect(expectCompileFailure(`character mio name="Mio"
character mio name="Mio Alt"
scene start:
`)).toContain('Duplicate character "mio".');
  });

  it("rejects duplicate scene ids", () => {
    expect(expectCompileFailure(`scene start:
scene start:
`)).toContain('Duplicate scene "start".');
  });

  it("rejects unknown dialogue speakers", () => {
    expect(expectCompileFailure(`scene start:
  mio:
    Hello.
`)).toContain('Unknown dialogue speaker "mio".');
  });

  it("rejects unknown dialogue speakers inside nested if branches", () => {
    expect(expectCompileFailure(`scene start:
  if scenario.hasNotebook:
    mio:
      Hello.
`)).toContain('Unknown dialogue speaker "mio".');
  });

  it("rejects unknown dialogue speakers inside nested choice item bodies", () => {
    expect(expectCompileFailure(`scene start:
  choice "Choose":
    "Talk":
      mio:
        Hello.
`)).toContain('Unknown dialogue speaker "mio".');
  });

  it("rejects unknown jump targets", () => {
    expect(expectCompileFailure(`scene start:
  jump missing
`)).toContain('Unknown scene "missing".');
  });

  it("rejects unknown jump targets inside nested if branches", () => {
    expect(expectCompileFailure(`scene start:
  if scenario.hasNotebook:
    jump missing
`)).toContain('Unknown scene "missing".');
  });

  it("rejects unknown jump targets inside nested choice item bodies", () => {
    expect(expectCompileFailure(`scene start:
  choice "Choose":
    "Go":
      jump missing
`)).toContain('Unknown scene "missing".');
  });

  it("rejects document with no scene", () => {
    expect(expectCompileFailure('title "Rain Station"\n')).toContain(
      "DSL v2 document must include at least one scene.",
    );
  });
});
