import { describe, expect, it } from "vitest";
import { compileTzr, definePluginCommand, parseTzr } from "../src/index.js";

describe("compileTzr", () => {
  it("accepts same-file jump and choice targets that resolve to labels", () => {
    const parsed = parseTzr(
      `#scene("prologue")

? Choose
- "Go" -> #next

#label("next")
@jump("#next")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document).toMatchObject({
      type: "CompiledTzrDocument",
      filePath: "scenario/main.tzr",
      body: parsed.document.body,
    });
    expect(compiled.document.instructions.map((instruction) => instruction.type)).toEqual([
      "SceneInstruction",
      "ChoiceInstruction",
      "LabelInstruction",
      "CommandInstruction",
    ]);
  });

  it("builds a label index for the compiled document", () => {
    const parsed = parseTzr(
      `#scene("prologue")
#label("start")
@waitClick()
#label("after")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document.labels).toMatchObject({
      start: { id: "start", statementIndex: 1 },
      after: { id: "after", statementIndex: 3 },
    });
    expect(compiled.document.instructions[compiled.document.labels.start?.statementIndex ?? -1]).toMatchObject({
      type: "LabelInstruction",
      id: "start",
    });
    expect(compiled.document.instructions[compiled.document.labels.after?.statementIndex ?? -1]).toMatchObject({
      type: "LabelInstruction",
      id: "after",
    });
    expect(compiled.document.labels.start?.loc.start).toEqual({
      filePath: "scenario/main.tzr",
      line: 2,
      column: 1,
    });
  });

  it("keeps @if branch instructions out of the top-level instruction list", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
:: Haruka
We meet again.
@else
@waitClick()
@endif
@page()
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document.instructions.map((instruction) => instruction.type)).toEqual([
      "SceneInstruction",
      "IfInstruction",
      "CommandInstruction",
    ]);
    expect(compiled.document.instructions[1]).toMatchObject({
      type: "IfInstruction",
      thenBranch: [{ type: "DialogueInstruction", speaker: "Haruka" }],
      elseBranch: [{ type: "CommandInstruction", name: "waitClick" }],
    });
  });

  it("builds a scene index for the compiled document", () => {
    const parsed = parseTzr(
      `#scene("prologue")
#label("start")
#scene("chapter_1")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document.scenes).toMatchObject({
      prologue: { id: "prologue", statementIndex: 0 },
      chapter_1: { id: "chapter_1", statementIndex: 2 },
    });
    expect(compiled.document.instructions[compiled.document.scenes.prologue?.statementIndex ?? -1]).toMatchObject({
      type: "SceneInstruction",
      id: "prologue",
    });
    expect(compiled.document.instructions[compiled.document.scenes.chapter_1?.statementIndex ?? -1]).toMatchObject({
      type: "SceneInstruction",
      id: "chapter_1",
    });
    expect(compiled.document.scenes.chapter_1?.loc.start).toEqual({
      filePath: "scenario/main.tzr",
      line: 3,
      column: 1,
    });
  });

  it("reports duplicate labels and scenes", () => {
    const parsed = parseTzr(
      `#scene("prologue")
#scene("prologue")
#label("start")
#label("start")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Duplicate scene "prologue".',
        sourceLine: '#scene("prologue")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: 'Duplicate label "#start".',
        sourceLine: '#label("start")',
      },
    ]);
  });

  it("reports missing same-file jump and choice labels", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("#missing")

? Choose
- "Missing" -> #missing_choice
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 8,
        message: 'Unknown label "#missing".',
        sourceLine: '@jump("#missing")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 16,
        message: 'Unknown label "#missing_choice".',
        sourceLine: '- "Missing" -> #missing_choice',
      },
    ]);
  });

  it("reports invalid jump target formats", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("")
@jump("#")
@jump("chapter-01.tzr#")
@jump("chapter-01.tzr#start#extra")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 8,
        message: "Jump target must not be empty.",
        sourceLine: '@jump("")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 8,
        message: "Jump target must include a label after #.",
        sourceLine: '@jump("#")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 8,
        message: "Jump target must include a label after #.",
        sourceLine: '@jump("chapter-01.tzr#")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 8,
        message: 'Jump target must contain at most one "#".',
        sourceLine: '@jump("chapter-01.tzr#start#extra")',
      },
    ]);
  });

  it("reports invalid choice target formats", () => {
    const parsed = parseTzr(
      `#scene("prologue")
? Choose
- "Broken" -> #
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 15,
        message: "Jump target must include a label after #.",
        sourceLine: '- "Broken" -> #',
      },
    ]);
  });

  it("leaves cross-file target validation for a later compiler phase", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("chapter-01.tzr#start")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    expect(compileTzr(parsed.document).ok).toBe(true);
  });

  it("reports labels inside @if blocks as invalid placement", () => {
    const parsed = parseTzr(
      `#scene("prologue")
#label("start")
@if(flag("met_haruka"))
#label("start")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "#label declarations must be top-level.",
        sourceLine: '#label("start")',
      },
    ]);
  });

  it("reports scenes inside @if blocks as invalid placement", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
#scene("inside")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 1,
        message: "#scene declarations must be top-level.",
        sourceLine: '#scene("inside")',
      },
    ]);
  });

  it("reports missing @jump targets inside @if blocks", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@jump("#missing")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 8,
        message: 'Unknown label "#missing".',
        sourceLine: '@jump("#missing")',
      },
    ]);
  });

  it("reports missing choice targets inside @else blocks", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@jump("#known")
@else
? Choose
- "Missing" -> #missing
@endif
#label("known")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 6,
        column: 16,
        message: 'Unknown label "#missing".',
        sourceLine: '- "Missing" -> #missing',
      },
    ]);
  });

  it("reports missing jump targets inside nested @if blocks", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@if(var("affection") >= 3)
@jump("#nested_missing")
@endif
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 8,
        message: 'Unknown label "#nested_missing".',
        sourceLine: '@jump("#nested_missing")',
      },
    ]);
  });

  it("accepts valid core command arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("#known")
@wait(500)
@waitClick()
@page()
@stop()
#label("known")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    expect(compileTzr(parsed.document).ok).toBe(true);
  });

  it("reports invalid @jump arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump()
@jump(123)
@jump("#known", "extra")
#label("known")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: "@jump expects exactly 1 positional string argument.",
        sourceLine: "@jump()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 7,
        message: "@jump expects a string argument.",
        sourceLine: "@jump(123)",
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "@jump expects exactly 1 positional string argument.",
        sourceLine: '@jump("#known", "extra")',
      },
    ]);
  });

  it("reports invalid @wait arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@wait()
@wait("500")
@wait(500, 100)
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: "@wait expects exactly 1 positional number argument.",
        sourceLine: "@wait()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 7,
        message: "@wait expects a number argument.",
        sourceLine: '@wait("500")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "@wait expects exactly 1 positional number argument.",
        sourceLine: "@wait(500, 100)",
      },
    ]);
  });

  it("reports invalid no-argument core commands", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@waitClick(1)
@page("x")
@stop("x")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: "@waitClick expects no arguments.",
        sourceLine: "@waitClick(1)",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 1,
        message: "@page expects no arguments.",
        sourceLine: '@page("x")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "@stop expects no arguments.",
        sourceLine: '@stop("x")',
      },
    ]);
  });

  it("validates core command arguments inside @if branches", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@wait("500")
@else
@page("x")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 7,
        message: "@wait expects a number argument.",
        sourceLine: '@wait("500")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 1,
        message: "@page expects no arguments.",
        sourceLine: '@page("x")',
      },
    ]);
  });

  it("accepts valid state core command arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@set(name="route", value="haruka")
@set(name="score", value=10)
@set(name="cleared", value=true)
@inc(name="haruka_affection", by=1)
@dec(name="haruka_affection", by=1)
@flag("met_haruka")
@unflag("met_haruka")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    expect(compileTzr(parsed.document).ok).toBe(true);
  });

  it("reports invalid @set arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@set()
@set(name="route")
@set(value="haruka")
@set(name=route, value="haruka")
@set(name="route", value=haruka)
@set(name="route", value="haruka", extra=true)
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: '@set requires a named "name" argument.',
        sourceLine: "@set()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: '@set requires a named "value" argument.',
        sourceLine: "@set()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 1,
        message: '@set requires a named "value" argument.',
        sourceLine: '@set(name="route")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: '@set requires a named "name" argument.',
        sourceLine: '@set(value="haruka")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 11,
        message: '@set argument "name" must be string.',
        sourceLine: '@set(name=route, value="haruka")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 6,
        column: 26,
        message: '@set argument "value" must be string, number, or boolean.',
        sourceLine: '@set(name="route", value=haruka)',
      },
      {
        filePath: "scenario/main.tzr",
        line: 7,
        column: 36,
        message: '@set does not allow argument "extra".',
        sourceLine: '@set(name="route", value="haruka", extra=true)',
      },
    ]);
  });

  it("reports invalid @inc and @dec arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@inc(name="affection")
@inc(name="affection", by="1")
@dec(name=affection, by=1)
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: '@inc requires a named "by" argument.',
        sourceLine: '@inc(name="affection")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 27,
        message: '@inc argument "by" must be number.',
        sourceLine: '@inc(name="affection", by="1")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 11,
        message: '@dec argument "name" must be string.',
        sourceLine: "@dec(name=affection, by=1)",
      },
    ]);
  });

  it("reports invalid @flag and @unflag arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@flag()
@flag(123)
@flag("x", "extra")
@unflag()
@unflag(123)
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: "@flag expects exactly 1 positional string argument.",
        sourceLine: "@flag()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 7,
        message: "@flag expects a string argument.",
        sourceLine: "@flag(123)",
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "@flag expects exactly 1 positional string argument.",
        sourceLine: '@flag("x", "extra")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 1,
        message: "@unflag expects exactly 1 positional string argument.",
        sourceLine: "@unflag()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 6,
        column: 9,
        message: "@unflag expects a string argument.",
        sourceLine: "@unflag(123)",
      },
    ]);
  });

  it("validates state core command arguments inside @if branches", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@set(name="route", value=haruka)
@else
@inc(name="affection", by="1")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 26,
        message: '@set argument "value" must be string, number, or boolean.',
        sourceLine: '@set(name="route", value=haruka)',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 27,
        message: '@inc argument "by" must be number.',
        sourceLine: '@inc(name="affection", by="1")',
      },
    ]);
  });

  it("reports unknown non-core commands", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@bg("school")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Unknown command "@bg".',
        sourceLine: '@bg("school")',
      },
    ]);
  });

  it("accepts registered plugin commands", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@bg("school")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: { name: "bg" },
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("accepts registered plugin commands with valid positional argument schemas", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@bg("school")
@transition("fade", 300)
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: definePluginCommand("bg", {
          kind: "positional",
          arguments: [{ type: "string" }],
        }),
        transition: definePluginCommand("transition", {
          kind: "positional",
          arguments: [{ type: "string" }, { type: "number", optional: true }],
        }),
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("reports invalid registered plugin command positional arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@bg()
@bg(123)
@bg("school", "extra")
@bg(name="school")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: definePluginCommand("bg", {
          kind: "positional",
          arguments: [{ type: "string" }],
        }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: "@bg requires positional argument 1.",
        sourceLine: "@bg()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 5,
        message: "@bg positional argument 1 must be string.",
        sourceLine: "@bg(123)",
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 15,
        message: "@bg does not allow extra positional arguments.",
        sourceLine: '@bg("school", "extra")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 5,
        message: "@bg expects only positional arguments.",
        sourceLine: '@bg(name="school")',
      },
    ]);
  });

  it("accepts registered plugin commands with valid named argument schemas", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@show(character="haruka", pose="smile", at=center)
@hide(character="haruka")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: definePluginCommand("show", {
          kind: "named",
          arguments: [
            { name: "character", type: "string" },
            { name: "pose", type: "string", optional: true },
            { name: "at", type: ["string", "identifier"], optional: true },
          ],
        }),
        hide: definePluginCommand("hide", {
          kind: "named",
          arguments: [{ name: "character", type: "string" }],
        }),
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("reports invalid registered plugin command named arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@show()
@show(character=haruka)
@show(character="haruka", extra=true)
@show(character="haruka", character="yu")
@show("haruka")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: definePluginCommand("show", {
          kind: "named",
          arguments: [{ name: "character", type: "string" }],
        }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: '@show requires a named "character" argument.',
        sourceLine: "@show()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 17,
        message: '@show argument "character" must be string.',
        sourceLine: "@show(character=haruka)",
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 27,
        message: '@show does not allow argument "extra".',
        sourceLine: '@show(character="haruka", extra=true)',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 27,
        message: '@show has duplicate argument "character".',
        sourceLine: '@show(character="haruka", character="yu")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 6,
        column: 7,
        message: "@show expects only named arguments.",
        sourceLine: '@show("haruka")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 6,
        column: 1,
        message: '@show requires a named "character" argument.',
        sourceLine: '@show("haruka")',
      },
    ]);
  });

  it("accepts registered plugin commands with no-argument schemas", () => {
    const parsed = parseTzr("@flash()\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        flash: definePluginCommand("flash", { kind: "none" }),
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("accepts registered plugin commands with no-argument schemas and explicit parentheses", () => {
    const parsed = parseTzr("@stopBgm()\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        stopBgm: definePluginCommand("stopBgm", { kind: "none" }),
      },
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document.instructions).toMatchObject([
      {
        type: "CommandInstruction",
        name: "stopBgm",
        args: [],
      },
    ]);
  });

  it("reports registered plugin commands with invalid no-argument schemas", () => {
    const parsed = parseTzr('@flash("white")\n', { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        flash: definePluginCommand("flash", { kind: "none" }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: "@flash expects no arguments.",
        sourceLine: '@flash("white")',
      },
    ]);
  });

  it("reports plugin command named schemas with duplicate argument definitions", () => {
    const parsed = parseTzr("@wait(500)\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: definePluginCommand("show", {
          kind: "named",
          arguments: [
            { name: "character", type: "string" },
            { name: "character", type: "string", optional: true },
          ],
        }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command "@show" has duplicate argument definition "character".',
        sourceLine: "@wait(500)",
      },
    ]);
  });

  it("reports plugin command positional schemas with required arguments after optional arguments", () => {
    const parsed = parseTzr("@wait(500)\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        transition: definePluginCommand("transition", {
          kind: "positional",
          arguments: [
            { type: "string", optional: true },
            { type: "number" },
          ],
        }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command "@transition" has required positional argument after optional argument.',
        sourceLine: "@wait(500)",
      },
    ]);
  });

  it("does not treat plugin commands with invalid named schemas as registered commands", () => {
    const parsed = parseTzr('@show(character="haruka")\n', { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: definePluginCommand("show", {
          kind: "named",
          arguments: [
            { name: "character", type: "string" },
            { name: "character", type: "string", optional: true },
          ],
        }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command "@show" has duplicate argument definition "character".',
        sourceLine: '@show(character="haruka")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Unknown command "@show".',
        sourceLine: '@show(character="haruka")',
      },
    ]);
  });

  it("does not treat plugin commands with invalid positional schemas as registered commands", () => {
    const parsed = parseTzr('@transition("fade", 300)\n', { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        transition: definePluginCommand("transition", {
          kind: "positional",
          arguments: [
            { type: "string", optional: true },
            { type: "number" },
          ],
        }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command "@transition" has required positional argument after optional argument.',
        sourceLine: '@transition("fade", 300)',
      },
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Unknown command "@transition".',
        sourceLine: '@transition("fade", 300)',
      },
    ]);
  });

  it("keeps core command validation independent from invalid plugin command schemas", () => {
    const parsed = parseTzr('@wait("500")\n', { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: definePluginCommand("show", {
          kind: "named",
          arguments: [
            { name: "character", type: "string" },
            { name: "character", type: "string", optional: true },
          ],
        }),
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command "@show" has duplicate argument definition "character".',
        sourceLine: '@wait("500")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 7,
        message: "@wait expects a number argument.",
        sourceLine: '@wait("500")',
      },
    ]);
  });

  it("accepts plugin command registry entries whose key matches the definition name", () => {
    const parsed = parseTzr('@bg("school")\n', { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: { name: "bg" },
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("reports plugin command registry entries whose key does not match the definition name", () => {
    const parsed = parseTzr("@wait(500)\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: { name: "show" },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command registry key "bg" does not match definition name "show".',
        sourceLine: "@wait(500)",
      },
    ]);
  });

  it("does not treat mismatched plugin command definitions as registered commands", () => {
    const parsed = parseTzr('@bg("school")\n', { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: { name: "show" },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command registry key "bg" does not match definition name "show".',
        sourceLine: '@bg("school")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Unknown command "@bg".',
        sourceLine: '@bg("school")',
      },
    ]);
  });

  it("keeps core commands independent from valid plugin command definitions", () => {
    const parsed = parseTzr("@wait(500)\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: { name: "bg" },
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("reports mismatched plugin command registry entries even when the scenario only uses core commands", () => {
    const parsed = parseTzr("@wait(500)\n", { filePath: "scenario/main.tzr" });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        wait: { name: "bg" },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 1,
        column: 1,
        message: 'Plugin command registry key "wait" does not match definition name "bg".',
        sourceLine: "@wait(500)",
      },
    ]);
  });

  it("accepts core commands without plugin command registration", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@wait(500)
@page()
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    expect(compileTzr(parsed.document).ok).toBe(true);
  });

  it("reports unknown non-core commands inside @if branches", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@bg("school")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 1,
        message: 'Unknown command "@bg".',
        sourceLine: '@bg("school")',
      },
    ]);
  });

  it("accepts registered plugin commands inside @if branches", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@bg("school")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        bg: { name: "bg" },
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("expands registered macros and removes MacroInstruction from compiled instructions", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$enter("haruka", "smile", "center")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: { name: "show" },
      },
      macros: {
        enter(call) {
          return [
            {
              type: "CommandInstruction",
              name: "show",
              args: call.args,
              loc: call.loc,
            },
          ];
        },
      },
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "prologue" },
      { type: "CommandInstruction", name: "show" },
    ]);
    expect(compiled.document.instructions.some((instruction) => instruction.type === "MacroInstruction")).toBe(false);
  });

  it("validates plugin commands returned by macros against the registry", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$enter("haruka")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      macros: {
        enter(call) {
          return [{ type: "CommandInstruction", name: "show", args: call.args, loc: call.loc }];
        },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Unknown command "@show".',
        sourceLine: '$enter("haruka")',
      },
    ]);
  });

  it("accepts registered plugin commands returned by macros", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$enter("haruka")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: { name: "show" },
      },
      macros: {
        enter(call) {
          return [{ type: "CommandInstruction", name: "show", args: call.args, loc: call.loc }];
        },
      },
    });

    expect(compiled.ok).toBe(true);
  });

  it("validates registered plugin command schemas for macro expansion results", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$enter(123)
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: definePluginCommand("show", {
          kind: "positional",
          arguments: [{ type: "string" }],
        }),
      },
      macros: {
        enter(call) {
          return [{ type: "CommandInstruction", name: "show", args: call.args, loc: call.loc }];
        },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 8,
        message: "@show positional argument 1 must be string.",
        sourceLine: "$enter(123)",
      },
    ]);
  });

  it("reports unknown macros", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$missing()
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Unknown macro "$missing".',
        sourceLine: "$missing()",
      },
    ]);
  });

  it("expands macros inside @if branches", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
$enter("haruka")
@else
$exit("haruka")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      pluginCommands: {
        show: { name: "show" },
        hide: { name: "hide" },
      },
      macros: {
        enter(call) {
          return [{ type: "CommandInstruction", name: "show", args: call.args, loc: call.loc }];
        },
        exit(call) {
          return [{ type: "CommandInstruction", name: "hide", args: call.args, loc: call.loc }];
        },
      },
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "prologue" },
      {
        type: "IfInstruction",
        thenBranch: [{ type: "CommandInstruction", name: "show" }],
        elseBranch: [{ type: "CommandInstruction", name: "hide" }],
      },
    ]);
    const ifInstruction = compiled.document.instructions[1];
    expect(ifInstruction?.type).toBe("IfInstruction");
    if (ifInstruction?.type !== "IfInstruction") {
      throw new Error("expected IfInstruction");
    }
    expect(ifInstruction.thenBranch.some((instruction) => instruction.type === "MacroInstruction")).toBe(false);
    expect(ifInstruction.elseBranch?.some((instruction) => instruction.type === "MacroInstruction")).toBe(false);
  });

  it("rejects macro expansion results that create structural or control-flow instructions", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$bad()
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      macros: {
        bad(call) {
          return [
            { type: "SceneInstruction", id: "generated", loc: call.loc },
            { type: "LabelInstruction", id: "generated", loc: call.loc },
            { type: "SceneJumpInstruction", sceneId: "generated", loc: call.loc },
            {
              type: "IfInstruction",
              condition: 'flag("x")',
              conditionExpression: {
                type: "FlagCondition",
                name: "x",
                loc: call.loc,
              },
              thenBranch: [],
              loc: call.loc,
            },
            { type: "ChoiceInstruction", question: "Choose", items: [], loc: call.loc },
            { type: "BodyChoiceInstruction", question: "Choose", items: [], loc: call.loc },
          ];
        },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Macro "$bad" returned forbidden instruction "SceneInstruction".',
        sourceLine: "$bad()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Macro "$bad" returned forbidden instruction "LabelInstruction".',
        sourceLine: "$bad()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Macro "$bad" returned forbidden instruction "SceneJumpInstruction".',
        sourceLine: "$bad()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Macro "$bad" returned forbidden instruction "IfInstruction".',
        sourceLine: "$bad()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Macro "$bad" returned forbidden instruction "ChoiceInstruction".',
        sourceLine: "$bad()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Macro "$bad" returned forbidden instruction "BodyChoiceInstruction".',
        sourceLine: "$bad()",
      },
    ]);
  });

  it("rejects macros that return @jump commands", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$badJump()
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      macros: {
        badJump(call) {
          return [{ type: "CommandInstruction", name: "jump", args: [], loc: call.loc }];
        },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Macro "$badJump" must not return @jump commands.',
        sourceLine: "$badJump()",
      },
    ]);
  });

  it("validates invalid core command instructions returned by macros", () => {
    const parsed = parseTzr(
      `#scene("prologue")
$badWait("500")
$badPage("x")
$badSet(name="route")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      macros: {
        badWait(call) {
          return [{ type: "CommandInstruction", name: "wait", args: call.args, loc: call.loc }];
        },
        badPage(call) {
          return [{ type: "CommandInstruction", name: "page", args: call.args, loc: call.loc }];
        },
        badSet(call) {
          return [{ type: "CommandInstruction", name: "set", args: call.args, loc: call.loc }];
        },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 10,
        message: "@wait expects a number argument.",
        sourceLine: '$badWait("500")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 1,
        message: "@page expects no arguments.",
        sourceLine: '$badPage("x")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: '@set requires a named "value" argument.',
        sourceLine: '$badSet(name="route")',
      },
    ]);
  });

  it("validates macro output core commands inside @if branches", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
$badThen("500")
@else
$badElse("x")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      macros: {
        badThen(call) {
          return [{ type: "CommandInstruction", name: "wait", args: call.args, loc: call.loc }];
        },
        badElse(call) {
          return [{ type: "CommandInstruction", name: "page", args: call.args, loc: call.loc }];
        },
      },
    });

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 10,
        message: "@wait expects a number argument.",
        sourceLine: '$badThen("500")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 1,
        message: "@page expects no arguments.",
        sourceLine: '$badElse("x")',
      },
    ]);
  });
});
