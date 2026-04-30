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
});
