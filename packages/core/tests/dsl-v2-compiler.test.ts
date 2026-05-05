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

  it("compiles scene and plain narration into SceneInstruction and NarrationInstruction", () => {
    const document = compileSource(`scene start:
  narration:
    Rain blurred the platform edge.
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "NarrationInstruction", lines: [{ text: "Rain blurred the platform edge." }] },
    ]);
  });

  it("compiles scene and plain dialogue into SceneInstruction and DialogueInstruction", () => {
    const document = compileSource(`character mio name="Mio"
scene start:
  mio:
    You're late.
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "DialogueInstruction", speaker: "mio", lines: [{ text: "You're late." }] },
    ]);
  });

  it("compiles multiple scenes with bodies in source order", () => {
    const document = compileSource(`character mio name="Mio"
scene start:
  narration:
    First.
  end
scene later:
  mio:
    Later.
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "NarrationInstruction", lines: [{ text: "First." }] },
      { type: "CommandInstruction", name: "stop", args: [] },
      { type: "SceneInstruction", id: "later" },
      { type: "DialogueInstruction", speaker: "mio", lines: [{ text: "Later." }] },
    ]);
    expect(document.scenes).toMatchObject({
      start: { statementIndex: 0 },
      later: { statementIndex: 3 },
    });
  });

  it("maintains scene indexes after body instructions are inserted", () => {
    const document = compileSource(`scene start:
  narration:
    First.
  jump later
scene later:
  narration:
    Later.
scene ending:
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "NarrationInstruction", lines: [{ text: "First." }] },
      { type: "SceneJumpInstruction", sceneId: "later" },
      { type: "SceneInstruction", id: "later" },
      { type: "NarrationInstruction", lines: [{ text: "Later." }] },
      { type: "SceneInstruction", id: "ending" },
    ]);
    expect(document.scenes).toMatchObject({
      start: { statementIndex: 0 },
      later: { statementIndex: 3 },
      ending: { statementIndex: 5 },
    });
  });

  it("compiles end into a stop command instruction", () => {
    const document = compileSource(`scene start:
  end
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "CommandInstruction", name: "stop", args: [] },
    ]);
  });

  it("preserves text line locations for compiled plain text", () => {
    const document = compileSource(`scene start:
  narration:
    Rain blurred the platform edge.
`);

    const instruction = document.instructions[1];
    expect(instruction).toMatchObject({ type: "NarrationInstruction" });
    if (instruction?.type !== "NarrationInstruction") {
      throw new Error("expected narration instruction");
    }
    expect(instruction.lines[0]?.loc.start).toEqual({
      filePath: "scenario/v2.tzr",
      line: 3,
      column: 5,
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
    expect(document.instructions[0]).toMatchObject({ type: "SceneInstruction", id: "start" });
    expect(document.instructions[1]).toMatchObject({ type: "DialogueInstruction", speaker: "mio" });
  });

  it("compiles scene-target jump into SceneJumpInstruction", () => {
    const document = compileSource(`scene start:
  jump later
scene later:
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "SceneJumpInstruction", sceneId: "later" },
      { type: "SceneInstruction", id: "later" },
    ]);
  });

  it("compiles jump to a later scene", () => {
    const document = compileSource(`scene start:
  jump later
scene middle:
scene later:
`);

    expect(document.instructions[1]).toMatchObject({ type: "SceneJumpInstruction", sceneId: "later" });
    expect(document.scenes.later).toMatchObject({ statementIndex: 3 });
  });

  it("rejects unsupported if statements after preserving nested validation", () => {
    expect(expectCompileFailure(`character mio name="Mio"
scene start:
  if scenario.hasNotebook:
    mio:
      Hello.
`)).toContain('DSL v2 statement "IfStatement" is not compile-supported yet.');
  });

  it("compiles unconditional choice into BodyChoiceInstruction", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay" id=stay:
      narration:
        Stay here.
    "Go":
      jump later
scene later:
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      {
        type: "BodyChoiceInstruction",
        question: "Choose",
        items: [
          {
            label: "Stay",
            id: "stay",
            body: [{ type: "NarrationInstruction", lines: [{ text: "Stay here." }] }],
          },
          {
            label: "Go",
            body: [{ type: "SceneJumpInstruction", sceneId: "later" }],
          },
        ],
      },
      { type: "SceneInstruction", id: "later" },
    ]);
  });

  it("compiles choice item body dialogue and end statements", () => {
    const document = compileSource(`character mio name="Mio"
scene start:
  choice "Choose":
    "Talk" id=talk:
      mio:
        Hello.
      end
`);

    expect(document.instructions[1]).toMatchObject({
      type: "BodyChoiceInstruction",
      question: "Choose",
      items: [
        {
          label: "Talk",
          id: "talk",
          body: [
            { type: "DialogueInstruction", speaker: "mio", lines: [{ text: "Hello." }] },
            { type: "CommandInstruction", name: "stop", args: [] },
          ],
        },
      ],
    });
  });

  it("rejects conditional choice items for now", () => {
    expect(expectCompileFailure(`scene start:
  choice "Choose":
    "Locked" if scenario.unlocked:
      jump later
scene later:
`)).toContain("Conditional choice items are not compile-supported yet.");
  });

  it("rejects unsupported statements inside choice item bodies", () => {
    expect(expectCompileFailure(`scene start:
  choice "Choose":
    "Set route":
      set scenario.route = "mio"
`)).toContain('DSL v2 statement "SetStatement" is not compile-supported yet.');
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

  it("rejects narration with text click wait", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    First.

    Second.
`)).toContain("Text click wait is not compile-supported yet.");
  });

  it("rejects narration with text page break", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    First.
    ---
    Second.
`)).toContain("Text page break is not compile-supported yet.");
  });

  it("rejects narration with text block metadata", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    :meta
      delay=70
    Rain blurred the platform edge.
`)).toContain("Text block metadata is not compile-supported yet.");
  });

  it("rejects narration with rich inline text", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    {text bold=true|Bold}
`)).toContain("Rich inline text is not compile-supported yet.");
  });

  it("rejects narration with inline delay", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    {delay ms=20|Fast}
`)).toContain("Inline delay is not compile-supported yet.");
  });

  it("rejects narration with inline wait", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    A {wait ms=500}B
`)).toContain("Inline wait is not compile-supported yet.");
  });

  it("rejects narration with inline se", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    {se assetId=doorOpen}Door.
`)).toContain("Inline se is not compile-supported yet.");
  });

  it("rejects narration with inline voice", () => {
    expect(expectCompileFailure(`scene start:
  narration:
    {voice assetId=mio_001}Line.
`)).toContain("Inline voice is not compile-supported yet.");
  });

  it("rejects unsupported state, call, wait, visual, audio, and system statements", () => {
    const cases = [
      { source: 'set scenario.route = "mio"', statement: "SetStatement" },
      { source: "add scenario.score += 1", statement: "AddStatement" },
      { source: "call screen.open(id=notebook)", statement: "CallStatement" },
      { source: "wait screen.closed(id=notebook)", statement: "WaitStatement" },
      { source: "bg classroom", statement: "BgStatement" },
      { source: "show mio.normal at center", statement: "ShowStatement" },
      { source: "hide mio.normal", statement: "HideStatement" },
      { source: "clear sprites", statement: "ClearVisualStatement" },
      { source: "bgm daily", statement: "BgmStatement" },
      { source: "stopBgm", statement: "StopBgmStatement" },
      { source: "se doorOpen", statement: "SeStatement" },
      { source: "voice mio_001", statement: "VoiceStatement" },
      { source: "system.unlockAchievement firstClear", statement: "SystemUnlockStatement" },
    ];

    for (const { source, statement } of cases) {
      expect(expectCompileFailure(`scene start:\n  ${source}\n`)).toContain(
        `DSL v2 statement "${statement}" is not compile-supported yet.`,
      );
    }
  });
});
