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

  it("compiles simple if statements into V2IfInstruction", () => {
    const document = compileSource(`scene start:
  if scenario.hasNotebook:
    narration:
      Open it.
`);

    expect(document.instructions[1]).toMatchObject({
      type: "V2IfInstruction",
      condition: { type: "ConditionReference", path: "scenario.hasNotebook" },
      thenBranch: [{ type: "NarrationInstruction", lines: [{ text: "Open it." }] }],
      elifBranches: [],
    });
  });

  it("compiles if / else statements into V2IfInstruction", () => {
    const document = compileSource(`scene start:
  if scenario.hasNotebook:
    narration:
      Open it.
  else:
    narration:
      Leave it.
`);

    expect(document.instructions[1]).toMatchObject({
      type: "V2IfInstruction",
      thenBranch: [{ type: "NarrationInstruction", lines: [{ text: "Open it." }] }],
      elseBranch: [{ type: "NarrationInstruction", lines: [{ text: "Leave it." }] }],
    });
  });

  it("compiles if / elif / else statements into V2IfInstruction", () => {
    const document = compileSource(`scene start:
  if scenario.route.a:
    narration:
      Route A.
  elif scenario.route.b:
    narration:
      Route B.
  else:
    narration:
      Common.
`);

    expect(document.instructions[1]).toMatchObject({
      type: "V2IfInstruction",
      thenBranch: [{ type: "NarrationInstruction", lines: [{ text: "Route A." }] }],
      elifBranches: [
        {
          condition: { type: "ConditionReference", path: "scenario.route.b" },
          body: [{ type: "NarrationInstruction", lines: [{ text: "Route B." }] }],
        },
      ],
      elseBranch: [{ type: "NarrationInstruction", lines: [{ text: "Common." }] }],
    });
  });

  it("compiles nested if statements", () => {
    const document = compileSource(`scene start:
  if scenario.outer:
    if scenario.inner:
      narration:
        Nested.
`);

    const instruction = document.instructions[1];
    expect(instruction).toMatchObject({ type: "V2IfInstruction" });
    if (instruction?.type !== "V2IfInstruction") {
      throw new Error("expected V2IfInstruction");
    }
    expect(instruction.thenBranch[0]).toMatchObject({
      type: "V2IfInstruction",
      thenBranch: [{ type: "NarrationInstruction", lines: [{ text: "Nested." }] }],
    });
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

  it("compiles set string, number, and boolean statements into set commands", () => {
    const document = compileSource(`scene start:
  set scenario.route = "mio"
  set scenario.score = 10
  set scenario.hasNotebook = true
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      {
        type: "CommandInstruction",
        name: "set",
        args: [
          { type: "NamedArgument", name: "name", value: { type: "StringValue", value: "scenario.route" } },
          { type: "NamedArgument", name: "value", value: { type: "StringValue", value: "mio" } },
        ],
      },
      {
        type: "CommandInstruction",
        name: "set",
        args: [
          { type: "NamedArgument", name: "name", value: { type: "StringValue", value: "scenario.score" } },
          { type: "NamedArgument", name: "value", value: { type: "NumberValue", value: 10 } },
        ],
      },
      {
        type: "CommandInstruction",
        name: "set",
        args: [
          { type: "NamedArgument", name: "name", value: { type: "StringValue", value: "scenario.hasNotebook" } },
          { type: "NamedArgument", name: "value", value: { type: "BooleanValue", value: true } },
        ],
      },
    ]);
  });

  it("compiles add number and negative number statements into v2 add commands", () => {
    const document = compileSource(`scene start:
  add scenario.score += 1
  add scenario.affection += -1
`);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      {
        type: "CommandInstruction",
        name: "__tsuzuru_v2_add",
        args: [
          { type: "NamedArgument", name: "name", value: { type: "StringValue", value: "scenario.score" } },
          { type: "NamedArgument", name: "by", value: { type: "NumberValue", value: 1 } },
        ],
      },
      {
        type: "CommandInstruction",
        name: "__tsuzuru_v2_add",
        args: [
          { type: "NamedArgument", name: "name", value: { type: "StringValue", value: "scenario.affection" } },
          { type: "NamedArgument", name: "by", value: { type: "NumberValue", value: -1 } },
        ],
      },
    ]);
  });

  it("rejects set null values for now", () => {
    expect(expectCompileFailure(`scene start:
  set scenario.currentCg = null
`)).toContain("set null value is not compile-supported yet.");
  });

  it("rejects set variable reference values for now", () => {
    expect(expectCompileFailure(`scene start:
  set scenario.currentVoice = $scenario.nextVoice
  set scenario.lastUnlocked = $system.endings.trueEnd
`)).toEqual([
      "set variable reference value is not compile-supported yet.",
      "set variable reference value is not compile-supported yet.",
    ]);
  });

  it("compiles set and add inside choice item bodies", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Score":
      set scenario.route = "mio"
      add scenario.score += 1
`);

    expect(document.instructions[1]).toMatchObject({
      type: "BodyChoiceInstruction",
      items: [
        {
          label: "Score",
          body: [
            { type: "CommandInstruction", name: "set" },
            { type: "CommandInstruction", name: "__tsuzuru_v2_add" },
          ],
        },
      ],
    });
  });

  it("compiles set and add inside if branch bodies", () => {
    const document = compileSource(`scene start:
  if scenario.hasNotebook:
    set scenario.route = "mio"
    add scenario.score += 1
`);

    expect(document.instructions[1]).toMatchObject({
      type: "V2IfInstruction",
      thenBranch: [
        { type: "CommandInstruction", name: "set" },
        { type: "CommandInstruction", name: "__tsuzuru_v2_add" },
      ],
    });
  });

  it("rejects system condition references for now", () => {
    expect(expectCompileFailure(`scene start:
  if system.endings.trueEnd.unlocked:
    narration:
      True end.
`)).toContain("system condition references are not compile-supported yet.");
  });

  it("rejects unsupported statements inside if branch bodies", () => {
    expect(expectCompileFailure(`scene start:
  if scenario.hasNotebook:
    call screen.open(id=notebook)
`)).toContain('DSL v2 statement "CallStatement" is not compile-supported yet.');
  });

  it("compiles conditional choice items into BodyChoiceInstructionItem conditions", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Locked" id=locked if scenario.unlocked:
      jump later
scene later:
`);

    expect(document.instructions[1]).toMatchObject({
      type: "BodyChoiceInstruction",
      question: "Choose",
      items: [
        {
          label: "Locked",
          id: "locked",
          condition: { type: "ConditionReference", path: "scenario.unlocked" },
          body: [{ type: "SceneJumpInstruction", sceneId: "later" }],
        },
      ],
    });
  });

  it("compiles mixed conditional and unconditional choice items", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Open" id=open if scenario.hasNotebook:
      narration:
        Open.
    "Leave" id=leave:
      narration:
        Leave.
`);

    expect(document.instructions[1]).toMatchObject({
      type: "BodyChoiceInstruction",
      items: [
        {
          label: "Open",
          id: "open",
          condition: { type: "ConditionReference", path: "scenario.hasNotebook" },
          body: [{ type: "NarrationInstruction", lines: [{ text: "Open." }] }],
        },
        {
          label: "Leave",
          id: "leave",
          body: [{ type: "NarrationInstruction", lines: [{ text: "Leave." }] }],
        },
      ],
    });
  });

  it("rejects system references in conditional choice item conditions for now", () => {
    expect(expectCompileFailure(`scene start:
  choice "Choose":
    "True end" if system.endings.trueEnd.unlocked:
      narration:
        True end.
`)).toContain("system condition references are not compile-supported yet.");
  });

  it("rejects unsupported statements inside choice item bodies", () => {
    expect(expectCompileFailure(`scene start:
  choice "Choose":
    "Set route":
      call screen.open(id=notebook)
`)).toContain('DSL v2 statement "CallStatement" is not compile-supported yet.');
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
