import { describe, expect, it } from "vitest";
import { parseTzr, type TzrChoiceStatement } from "../src/index.js";

function parseSingleChoice(source: string): TzrChoiceStatement {
  const result = parseTzr(source, { filePath: "scenario/choice.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }

  const scene = result.document.declarations[0];
  if (scene === undefined || scene.type !== "SceneDeclaration") {
    throw new Error("expected scene");
  }
  const statement = scene.body[0];
  if (statement === undefined || statement.type !== "ChoiceStatement") {
    throw new Error("expected choice");
  }
  return statement;
}

function expectChoiceFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/choice.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr choice statements", () => {
  it("parses a basic choice with two items", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どう答える？":
    "正直に謝る":
      jump apologize

    "言い訳する":
      jump dodge
`);

    expect(choice).toMatchObject({
      type: "ChoiceStatement",
      question: "どう答える？",
      items: [
        {
          type: "ChoiceItem",
          label: "正直に謝る",
          body: [{ type: "JumpStatement", target: "apologize" }],
        },
        {
          type: "ChoiceItem",
          label: "言い訳する",
          body: [{ type: "JumpStatement", target: "dodge" }],
        },
      ],
    });
  });

  it("parses choice item ids", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どう答える？":
    "正直に謝る" id=apologize:
      jump apologize

    "言い訳する" id=excuse:
      jump dodge
`);

    expect(choice.items).toMatchObject([
      { label: "正直に謝る", id: "apologize" },
      { label: "言い訳する", id: "excuse" },
    ]);
  });

  it("does not generate ids when omitted", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どう答える？":
    "正直に謝る":
      jump apologize
`);

    expect(choice.items[0]).not.toHaveProperty("id");
  });

  it("parses conditional choice items without ids", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どうする？":
    "手帳を開く" if scenario.inventory.hasNotebook:
      jump notebook
`);

    expect(choice.items[0]).toMatchObject({
      label: "手帳を開く",
      condition: { type: "ConditionReference", path: "scenario.inventory.hasNotebook" },
      body: [{ type: "JumpStatement", target: "notebook" }],
    });
    expect(choice.items[0]).not.toHaveProperty("id");
  });

  it("parses conditional choice items with ids", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どうする？":
    "手帳を開く" id=openNotebook if scenario.inventory.hasNotebook:
      jump notebook
`);

    expect(choice.items[0]).toMatchObject({
      label: "手帳を開く",
      id: "openNotebook",
      condition: { type: "ConditionReference", path: "scenario.inventory.hasNotebook" },
    });
  });

  it("parses unconditional and conditional items in the same choice", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どうする？":
    "手帳を開く" id=openNotebook if scenario.inventory.hasNotebook:
      jump notebook

    "立ち去る" id=leave:
      jump hallway
`);

    expect(choice.items).toMatchObject([
      { label: "手帳を開く", id: "openNotebook", condition: { path: "scenario.inventory.hasNotebook" } },
      { label: "立ち去る", id: "leave", body: [{ type: "JumpStatement", target: "hallway" }] },
    ]);
    expect(choice.items[1]).not.toHaveProperty("condition");
  });

  it("preserves condition parser precedence in choice item conditions", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どうする？":
    "手帳を開く" if scenario.a or scenario.b and system.c:
      jump notebook
`);

    expect(choice.items[0]?.condition).toMatchObject({
      type: "ConditionBinaryExpression",
      operator: "or",
      left: { type: "ConditionReference", path: "scenario.a" },
      right: {
        type: "ConditionBinaryExpression",
        operator: "and",
        left: { type: "ConditionReference", path: "scenario.b" },
        right: { type: "ConditionReference", path: "system.c" },
      },
    });
  });

  it("parses choice item bodies containing narration and dialogue", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どう答える？":
    "周囲を見る":
      narration:
        Rain blurred the platform edge.

    "美緒に話す":
      say mio:
        You're late.
`);

    expect(choice.items).toMatchObject([
      {
        label: "周囲を見る",
        body: [{ type: "NarrationStatement", lines: [{ type: "TextLine", text: "Rain blurred the platform edge." }] }],
      },
      {
        label: "美緒に話す",
        body: [{ type: "DialogueStatement", speaker: "mio", explicit: true, lines: [{ text: "You're late." }] }],
      },
    ]);
  });

  it("parses conditional choice item bodies containing narration and dialogue", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どう答える？":
    "周囲を見る" if scenario.canLookAround:
      narration:
        Rain blurred the platform edge.

    "美緒に話す" if scenario.mio.visible:
      say mio:
        You're late.
`);

    expect(choice.items).toMatchObject([
      {
        label: "周囲を見る",
        condition: { path: "scenario.canLookAround" },
        body: [{ type: "NarrationStatement", lines: [{ type: "TextLine", text: "Rain blurred the platform edge." }] }],
      },
      {
        label: "美緒に話す",
        condition: { path: "scenario.mio.visible" },
        body: [{ type: "DialogueStatement", speaker: "mio", explicit: true, lines: [{ text: "You're late." }] }],
      },
    ]);
  });

  it("allows blank lines and comments between choice items", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どう答える？":
    "正直に謝る":
      jump apologize

    // another route
    "言い訳する":
      jump dodge
`);

    expect(choice.items.map((item) => item.label)).toEqual(["正直に謝る", "言い訳する"]);
  });

  it("preserves source locations", () => {
    const choice = parseSingleChoice(`scene start:
  choice "どう答える？":
    "正直に謝る":
      jump apologize
`);

    expect(choice.loc.start).toMatchObject({ filePath: "scenario/choice.tzr", line: 2, column: 3 });
    expect(choice.loc.end).toBeDefined();
    expect(choice.items[0]?.loc.start).toMatchObject({ filePath: "scenario/choice.tzr", line: 3, column: 5 });
    expect(choice.items[0]?.body[0]?.loc.start).toBeDefined();
  });

  it("rejects choice without a question", () => {
    expect(expectChoiceFailure("scene start:\n  choice\n")).toContain("choice question is required.");
  });

  it("rejects unquoted choice questions", () => {
    expect(expectChoiceFailure("scene start:\n  choice Choose:\n")).toContain(
      "choice question must be a double-quoted string.",
    );
  });

  it("rejects choice missing a colon", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose"\n')).toContain("choice header must end with `:`.");
  });

  it("rejects item labels that are not double-quoted", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose":\n    Apologize:\n      jump apologize\n')).toContain(
      "choice item label must be a double-quoted string.",
    );
  });

  it("rejects item missing a colon", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose":\n    "Apologize"\n      jump apologize\n')).toContain(
      "choice item must end with `:`.",
    );
  });

  it("rejects invalid item ids", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose":\n    "Apologize" id=1st:\n      jump apologize\n')).toContain(
      'Invalid choice item id "1st".',
    );
  });

  it("rejects duplicate item ids", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Apologize" id=answer:
      jump apologize
    "Make excuse" id=answer:
      jump dodge
`),
    ).toContain('Duplicate choice item id "answer".');
  });

  it("rejects duplicate item ids when conditions are present", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Apologize" id=answer if scenario.a:
      jump apologize
    "Make excuse" id=answer if scenario.b:
      jump dodge
`),
    ).toContain('Duplicate choice item id "answer".');
  });

  it("rejects choice with no items", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose":\n')).toContain("choice must include at least one item.");
  });

  it("rejects item with empty body", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose":\n    "Apologize":\n')).toContain(
      "Choice item body must include at least one statement.",
    );
  });

  it("rejects malformed item indentation", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose":\n      "Apologize":\n        jump apologize\n')).toContain(
      "Choice items must be indented 4 spaces.",
    );
  });

  it("rejects malformed item body indentation", () => {
    expect(expectChoiceFailure('scene start:\n  choice "Choose":\n    "Apologize":\n        jump apologize\n')).toContain(
      "Choice item body statements must be indented 6 spaces.",
    );
  });

  it("rejects id after if", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" if scenario.inventory.hasNotebook id=openNotebook:
      jump notebook
`),
    ).toContain("choice item id must appear before if.");
  });

  it("rejects missing conditional choice item conditions", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" if:
      jump notebook
`),
    ).toContain("choice item condition is required.");
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" id=openNotebook if:
      jump notebook
`),
    ).toContain("choice item condition is required.");
  });

  it("rejects invalid conditional choice item conditions", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" if player.inventory.hasNotebook:
      jump notebook
`),
    ).toContain('Invalid choice item condition: Invalid reference root "player".');
  });

  it("rejects conditional items missing a colon", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" if scenario.inventory.hasNotebook
      jump notebook
`),
    ).toContain("choice item must end with `:`.");
  });

  it("rejects invalid item ids with conditions", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" id=1st if scenario.inventory.hasNotebook:
      jump notebook
`),
    ).toContain('Invalid choice item id "1st".');
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" id= if scenario.inventory.hasNotebook:
      jump notebook
`),
    ).toContain('Invalid choice item id "".');
  });

  it("rejects malformed conditional choice item headers", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" enabled if scenario.inventory.hasNotebook:
      jump notebook
`),
    ).toContain('choice item must use `"label":` or `"label" id=id:` syntax.');
  });

  it("rejects extra trailing tokens after choice item conditions", () => {
    expect(
      expectChoiceFailure(`scene start:
  choice "Choose":
    "Open notebook" if scenario.inventory.hasNotebook scenario.extra:
      jump notebook
`),
    ).toContain('Invalid choice item condition: Unexpected token "scenario.extra" after condition expression.');
  });
});
