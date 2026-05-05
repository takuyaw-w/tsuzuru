import { describe, expect, it } from "vitest";
import { parseTzrV2, type TzrV2IfStatement } from "../src/index.js";

function parseSingleIf(source: string): TzrV2IfStatement {
  const result = parseTzrV2(source, { filePath: "scenario/if.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }

  const scene = result.document.declarations[0];
  if (scene === undefined || scene.type !== "SceneDeclaration") {
    throw new Error("expected scene");
  }
  const statement = scene.body[0];
  if (statement === undefined || statement.type !== "IfStatement") {
    throw new Error("expected if statement");
  }
  return statement;
}

function expectIfFailure(source: string): string[] {
  const result = parseTzrV2(source, { filePath: "scenario/if.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzrV2 if statements", () => {
  it("parses a simple if statement", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.hasNotebook:
    narration:
      手帳を持っている。
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      condition: { type: "ConditionReference", path: "scenario.hasNotebook" },
      thenBranch: [{ type: "NarrationStatement", lines: [{ type: "TextLine", text: "手帳を持っている。" }] }],
      elifBranches: [],
    });
    expect(statement).not.toHaveProperty("elseBranch");
  });

  it("parses if / else", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.hasNotebook:
    jump notebookRoute
  else:
    end
`);

    expect(statement).toMatchObject({
      thenBranch: [{ type: "JumpStatement", target: "notebookRoute" }],
      elseBranch: [{ type: "EndStatement" }],
    });
  });

  it("parses if / elif / else", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.hasNotebook:
    jump notebookRoute
  elif scenario.hasKey:
    jump keyRoute
  else:
    jump commonRoute
`);

    expect(statement).toMatchObject({
      condition: { type: "ConditionReference", path: "scenario.hasNotebook" },
      elifBranches: [
        {
          type: "ElifBranch",
          condition: { type: "ConditionReference", path: "scenario.hasKey" },
          body: [{ type: "JumpStatement", target: "keyRoute" }],
        },
      ],
      elseBranch: [{ type: "JumpStatement", target: "commonRoute" }],
    });
  });

  it("parses multiple elif branches", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.route.a:
    jump routeA
  elif scenario.route.b:
    jump routeB
  elif system.endings.trueEnd.unlocked:
    jump trueEnd
`);

    expect(statement.elifBranches).toMatchObject([
      { condition: { path: "scenario.route.b" }, body: [{ type: "JumpStatement", target: "routeB" }] },
      { condition: { path: "system.endings.trueEnd.unlocked" }, body: [{ type: "JumpStatement", target: "trueEnd" }] },
    ]);
  });

  it("parses nested if statements", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.a:
    if scenario.b:
      jump both
    else:
      jump onlyA
  else:
    jump neither
`);

    expect(statement.thenBranch).toMatchObject([
      {
        type: "IfStatement",
        condition: { path: "scenario.b" },
        thenBranch: [{ type: "JumpStatement", target: "both" }],
        elseBranch: [{ type: "JumpStatement", target: "onlyA" }],
      },
    ]);
    expect(statement.elseBranch).toMatchObject([{ type: "JumpStatement", target: "neither" }]);
  });

  it("parses if branch bodies containing narration, dialogue, jump, and choice", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.hasNotebook:
    narration:
      雨がホームの端をぼかしていた。
    mio:
      遅いよ。
    choice "どうする？":
      "謝る":
        jump apologize
    jump commonRoute
`);

    expect(statement.thenBranch).toMatchObject([
      { type: "NarrationStatement" },
      { type: "DialogueStatement", speaker: "mio", explicit: false },
      { type: "ChoiceStatement", items: [{ label: "謝る", body: [{ type: "JumpStatement", target: "apologize" }] }] },
      { type: "JumpStatement", target: "commonRoute" },
    ]);
  });

  it("attaches condition ASTs to if and elif branches", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.a or scenario.b and system.c:
    jump first
  elif not (scenario.d == "done"):
    jump second
`);

    expect(statement.condition).toMatchObject({
      type: "ConditionBinaryExpression",
      operator: "or",
      right: { type: "ConditionBinaryExpression", operator: "and" },
    });
    expect(statement.elifBranches[0]?.condition).toMatchObject({
      type: "ConditionUnaryExpression",
      operator: "not",
      expression: { type: "ConditionComparisonExpression", operator: "==" },
    });
  });

  it("allows blank lines and comments between branches", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.a:
    jump first

  // second route
  elif scenario.b:
    jump second

  // fallback
  else:
    end
`);

    expect(statement.elifBranches).toHaveLength(1);
    expect(statement.elseBranch).toMatchObject([{ type: "EndStatement" }]);
  });

  it("preserves source locations", () => {
    const statement = parseSingleIf(`scene start:
  if scenario.a:
    jump first
`);

    expect(statement.loc.start).toMatchObject({ filePath: "scenario/if.tzr", line: 2, column: 3 });
    expect(statement.loc.end).toBeDefined();
    expect(statement.condition.loc.start).toBeDefined();
    expect(statement.thenBranch[0]?.loc.start).toBeDefined();
  });

  it("rejects if without a condition", () => {
    expect(expectIfFailure("scene start:\n  if:\n    jump route\n")).toContain("if condition is required.");
  });

  it("rejects if missing a colon", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a\n    jump route\n")).toContain("if header must end with `:`.");
  });

  it("rejects invalid if conditions", () => {
    expect(expectIfFailure("scene start:\n  if player.score:\n    jump route\n")).toContain(
      'Invalid if condition: Invalid reference root "player".',
    );
  });

  it("rejects empty if bodies", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n")).toContain(
      "If branch body must include at least one statement.",
    );
  });

  it("rejects elif without a condition", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n    jump first\n  elif:\n    jump second\n")).toContain(
      "elif condition is required.",
    );
  });

  it("rejects elif missing a colon", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n    jump first\n  elif scenario.b\n    jump second\n")).toContain(
      "elif header must end with `:`.",
    );
  });

  it("rejects invalid elif conditions", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n    jump first\n  elif player.score:\n    jump second\n")).toContain(
      'Invalid elif condition: Invalid reference root "player".',
    );
  });

  it("rejects empty elif bodies", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n    jump first\n  elif scenario.b:\n")).toContain(
      "Elif branch body must include at least one statement.",
    );
  });

  it("rejects else with a condition or arguments", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n    jump first\n  else scenario.b:\n    jump second\n")).toContain(
      "else must not have a condition or arguments.",
    );
  });

  it("rejects else missing a colon", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n    jump first\n  else\n    jump second\n")).toContain(
      "else block must end with `:`.",
    );
  });

  it("rejects empty else bodies", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n    jump first\n  else:\n")).toContain(
      "Else branch body must include at least one statement.",
    );
  });

  it("rejects elif without a preceding if", () => {
    expect(expectIfFailure("scene start:\n  elif scenario.a:\n    jump route\n")).toContain(
      "elif must follow an if statement.",
    );
  });

  it("rejects else without a preceding if", () => {
    expect(expectIfFailure("scene start:\n  else:\n    jump route\n")).toContain("else must follow an if statement.");
  });

  it("rejects elif after else", () => {
    expect(
      expectIfFailure(`scene start:
  if scenario.a:
    jump first
  else:
    jump fallback
  elif scenario.b:
    jump second
`),
    ).toContain("elif cannot appear after else.");
  });

  it("rejects duplicate else branches", () => {
    expect(
      expectIfFailure(`scene start:
  if scenario.a:
    jump first
  else:
    jump fallback
  else:
    jump duplicate
`),
    ).toContain("Duplicate else branch.");
  });

  it("rejects malformed branch indentation", () => {
    expect(
      expectIfFailure(`scene start:
  if scenario.a:
    jump first
 elif scenario.b:
    jump second
`),
    ).toContain("if / elif / else branch headers must align with the owning if statement.");
  });

  it("rejects malformed branch body indentation", () => {
    expect(expectIfFailure("scene start:\n  if scenario.a:\n      jump route\n")).toContain(
      "If branch body statements must be indented 4 spaces.",
    );
  });
});
