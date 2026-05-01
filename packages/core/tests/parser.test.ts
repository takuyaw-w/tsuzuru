import { describe, expect, it } from "vitest";
import { parseTzr } from "../src/index.js";

describe("parseTzr", () => {
  it("parses the v0.1 Tsuzuru script surface", () => {
    const result = parseTzr(
      `#scene("prologue")

The classroom was unusually quiet.

:: Haruka
You're late again.

@bg("school_evening")
$enter("haruka", "smile", "center")

? What do you do?
- "Apologize" -> #apologize
- "Make a joke" -> #joke

#label("apologize")
@jump("#after_choice")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }

    expect(result.document.body.map((node) => node.type)).toEqual([
      "SceneDeclaration",
      "NarrationBlock",
      "SpeakerBlock",
      "CommandStatement",
      "MacroStatement",
      "ChoiceBlock",
      "LabelDeclaration",
      "CommandStatement",
    ]);

    const scene = result.document.body[0];
    expect(scene).toMatchObject({ type: "SceneDeclaration", id: "prologue" });

    const speaker = result.document.body[2];
    expect(speaker).toMatchObject({
      type: "SpeakerBlock",
      speaker: "Haruka",
      lines: [{ text: "You're late again." }],
    });

    const choice = result.document.body[5];
    expect(choice).toMatchObject({
      type: "ChoiceBlock",
      question: "What do you do?",
      items: [
        { text: "Apologize", target: { raw: "#apologize", label: "apologize" } },
        { text: "Make a joke", target: { raw: "#joke", label: "joke" } },
      ],
    });

    const jump = result.document.body[7];
    expect(jump).toMatchObject({
      type: "CommandStatement",
      name: "jump",
      jumpTarget: { raw: "#after_choice", label: "after_choice" },
    });
  });

  it("parses positional and named command arguments", () => {
    const result = parseTzr('@show(character="haruka", pose="smile", at=center)\n', {
      filePath: "scenario/main.tzr",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }

    expect(result.document.body[0]).toMatchObject({
      type: "CommandStatement",
      name: "show",
      args: [
        { type: "NamedArgument", name: "character", value: { type: "StringValue", value: "haruka" } },
        { type: "NamedArgument", name: "pose", value: { type: "StringValue", value: "smile" } },
        { type: "NamedArgument", name: "at", value: { type: "IdentifierValue", name: "center" } },
      ],
    });
  });

  it("parses bare commands as zero-argument command statements", () => {
    const result = parseTzr("@stopBgm\n", {
      filePath: "scenario/main.tzr",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }

    expect(result.document.body[0]).toMatchObject({
      type: "CommandStatement",
      name: "stopBgm",
      args: [],
    });
  });

  it("parses bare commands with surrounding whitespace", () => {
    const result = parseTzr("  @stopBgm  \n", {
      filePath: "scenario/main.tzr",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }

    expect(result.document.body[0]).toMatchObject({
      type: "CommandStatement",
      name: "stopBgm",
      args: [],
    });
  });

  it("does not allow bare macro calls", () => {
    const result = parseTzr("$someMacro\n", {
      filePath: "scenario/broken.tzr",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 1,
        message: "$ call must use $name(...) syntax.",
        sourceLine: "$someMacro",
      },
    ]);
  });

  it("returns a diagnostic for malformed bare commands", () => {
    const result = parseTzr("@stopBgm extra\n", {
      filePath: "scenario/broken.tzr",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 1,
        message: "@ call must use @name(...) syntax.",
        sourceLine: "@stopBgm extra",
      },
    ]);
  });

  it("returns file path, line, and column diagnostics for malformed syntax", () => {
    const result = parseTzr(
      `#scene(prologue)
? Choose
`,
      { filePath: "scenario/broken.tzr" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 1,
        message: '#scene must use #scene("id") syntax.',
        sourceLine: "#scene(prologue)",
      },
      {
        filePath: "scenario/broken.tzr",
        line: 2,
        column: 1,
        message: "Choice must include at least one item.",
        sourceLine: "? Choose",
      },
    ]);
  });

  it("parses @if, @else, and @endif blocks with raw conditions", () => {
    const result = parseTzr(
      `@if(var("haruka_affection") >= 1)
:: Haruka
At least you apologized.
@else
:: Haruka
You never change.
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }

    expect(result.document.body).toHaveLength(1);
    expect(result.document.body[0]).toMatchObject({
      type: "IfBlock",
      condition: 'var("haruka_affection") >= 1',
      thenBranch: [
        {
          type: "SpeakerBlock",
          speaker: "Haruka",
          lines: [{ text: "At least you apologized." }],
        },
      ],
      elseBranch: [
        {
          type: "SpeakerBlock",
          speaker: "Haruka",
          lines: [{ text: "You never change." }],
        },
      ],
    });
  });

  it("parses nested @if blocks", () => {
    const result = parseTzr(
      `@if(flag("met_haruka"))
@if(var("affection") >= 3)
@jump("#haruka_route")
@endif
@else
@jump("#common_route")
@endif
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected parser success");
    }

    expect(result.document.body[0]).toMatchObject({
      type: "IfBlock",
      condition: 'flag("met_haruka")',
      thenBranch: [
        {
          type: "IfBlock",
          condition: 'var("affection") >= 3',
          thenBranch: [{ type: "CommandStatement", name: "jump" }],
        },
      ],
      elseBranch: [{ type: "CommandStatement", name: "jump" }],
    });
  });

  it("parses supported condition expressions into AST nodes", () => {
    const cases = [
      {
        source: '@if(flag("met_haruka"))\n@endif\n',
        expected: {
          type: "FlagCondition",
          name: "met_haruka",
        },
      },
      {
        source: '@if(!flag("met_haruka"))\n@endif\n',
        expected: {
          type: "NotCondition",
          expression: {
            type: "FlagCondition",
            name: "met_haruka",
          },
        },
      },
      {
        source: '@if(var("route") == "haruka")\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "route",
          operator: "==",
          value: { type: "StringValue", value: "haruka" },
        },
      },
      {
        source: '@if(var("route") != "haruka")\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "route",
          operator: "!=",
          value: { type: "StringValue", value: "haruka" },
        },
      },
      {
        source: '@if(var("score") >= 1)\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "score",
          operator: ">=",
          value: { type: "NumberValue", value: 1 },
        },
      },
      {
        source: '@if(var("score") <= 1)\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "score",
          operator: "<=",
          value: { type: "NumberValue", value: 1 },
        },
      },
      {
        source: '@if(var("score") > 1)\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "score",
          operator: ">",
          value: { type: "NumberValue", value: 1 },
        },
      },
      {
        source: '@if(var("score") < 1)\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "score",
          operator: "<",
          value: { type: "NumberValue", value: 1 },
        },
      },
      {
        source: '@if(var("cleared") == true)\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "cleared",
          operator: "==",
          value: { type: "BooleanValue", value: true },
        },
      },
      {
        source: '@if(var("cleared") == false)\n@endif\n',
        expected: {
          type: "VariableComparisonCondition",
          name: "cleared",
          operator: "==",
          value: { type: "BooleanValue", value: false },
        },
      },
    ];

    for (const testCase of cases) {
      const result = parseTzr(testCase.source, { filePath: "scenario/main.tzr" });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("expected parser success");
      }

      expect(result.document.body[0]).toMatchObject({
        type: "IfBlock",
        conditionExpression: testCase.expected,
      });
    }
  });

  it("returns diagnostics for unsupported condition expressions", () => {
    const result = parseTzr(
      `@if(calcSomething())
@endif
@if(player.affection > 3)
@endif
@if(flag())
@endif
@if(flag(name))
@endif
@if(var("score"))
@endif
@if(var("score") >= "high")
@endif
@if(var("score") === 1)
@endif
@if(flag("a") && flag("b"))
@endif
`,
      { filePath: "scenario/broken.tzr" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 5,
        message: "Invalid condition expression.",
        sourceLine: "@if(calcSomething())",
      },
      {
        filePath: "scenario/broken.tzr",
        line: 3,
        column: 5,
        message: "Invalid condition expression.",
        sourceLine: "@if(player.affection > 3)",
      },
      {
        filePath: "scenario/broken.tzr",
        line: 5,
        column: 5,
        message: "Invalid condition expression.",
        sourceLine: "@if(flag())",
      },
      {
        filePath: "scenario/broken.tzr",
        line: 7,
        column: 5,
        message: "Invalid condition expression.",
        sourceLine: "@if(flag(name))",
      },
      {
        filePath: "scenario/broken.tzr",
        line: 9,
        column: 5,
        message: "Invalid condition expression.",
        sourceLine: '@if(var("score"))',
      },
      {
        filePath: "scenario/broken.tzr",
        line: 11,
        column: 21,
        message: 'Condition operator ">=" requires a number value.',
        sourceLine: '@if(var("score") >= "high")',
      },
      {
        filePath: "scenario/broken.tzr",
        line: 13,
        column: 5,
        message: "Invalid condition expression.",
        sourceLine: '@if(var("score") === 1)',
      },
      {
        filePath: "scenario/broken.tzr",
        line: 15,
        column: 5,
        message: "Invalid condition expression.",
        sourceLine: '@if(flag("a") && flag("b"))',
      },
    ]);
  });

  it("returns a diagnostic when @endif is missing", () => {
    const result = parseTzr(
      `@if(flag("met_haruka"))
:: Haruka
We meet again.
`,
      { filePath: "scenario/broken.tzr" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 1,
        message: "@if block must be closed with @endif.",
        sourceLine: '@if(flag("met_haruka"))',
      },
    ]);
  });

  it("returns a diagnostic when @else appears without @if", () => {
    const result = parseTzr(
      `@else
Narration.
`,
      { filePath: "scenario/broken.tzr" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 1,
        message: "@else must appear inside an @if block.",
        sourceLine: "@else",
      },
    ]);
  });

  it("returns a diagnostic when @if condition is empty", () => {
    const result = parseTzr(
      `@if()
@endif
`,
      { filePath: "scenario/broken.tzr" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 5,
        message: "@if condition must not be empty.",
        sourceLine: "@if()",
      },
    ]);
  });

  it("returns a diagnostic when @if condition is whitespace only", () => {
    const result = parseTzr(
      `@if(   )
@endif
`,
      { filePath: "scenario/broken.tzr" },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parser failure");
    }

    expect(result.errors).toEqual([
      {
        filePath: "scenario/broken.tzr",
        line: 1,
        column: 5,
        message: "@if condition must not be empty.",
        sourceLine: "@if(   )",
      },
    ]);
  });
});
