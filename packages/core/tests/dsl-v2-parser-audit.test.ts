import { describe, expect, it } from "vitest";
import { parseTzrV2, type TzrV2SceneStatement } from "../src/index.js";

function parseSceneBody(source: string): readonly TzrV2SceneStatement[] {
  const result = parseTzrV2(source, { filePath: "scenario/audit.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }

  const scene = result.document.declarations[0];
  if (scene === undefined || scene.type !== "SceneDeclaration") {
    throw new Error("expected scene");
  }

  return scene.body;
}

describe("parseTzrV2 parser audit coverage", () => {
  it("parses state statements inside nested if branches", () => {
    const body = parseSceneBody(`scene start:
  if scenario.outer:
    if scenario.inner:
      set scenario.route = "mio"
      add scenario.score += 1
`);

    expect(body).toMatchObject([
      {
        type: "IfStatement",
        thenBranch: [
          {
            type: "IfStatement",
            thenBranch: [
              { type: "SetStatement", target: { path: "scenario.route" }, value: { value: "mio" } },
              { type: "AddStatement", target: { path: "scenario.score" }, value: { value: 1 } },
            ],
          },
        ],
      },
    ]);
  });

  it("parses call and wait statements inside nested choice item bodies", () => {
    const body = parseSceneBody(`scene start:
  choice "外側":
    "開く":
      choice "内側":
        "ノート":
          call screen.open(id=notebook)
          wait screen.closed(id=notebook)
`);

    expect(body).toMatchObject([
      {
        type: "ChoiceStatement",
        items: [
          {
            body: [
              {
                type: "ChoiceStatement",
                items: [
                  {
                    body: [
                      { type: "CallStatement", name: "screen.open" },
                      { type: "WaitStatement", name: "screen.closed" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("parses visual audio and system sugar inside nested if branches", () => {
    const body = parseSceneBody(`scene start:
  if scenario.outer:
    if scenario.inner:
      bg classroom with fade(duration=300)
      show alice_smile at center
      bgm daily_theme
      se doorOpen
      system.unlockAchievement firstClear
`);

    expect(body).toMatchObject([
      {
        type: "IfStatement",
        thenBranch: [
          {
            type: "IfStatement",
            thenBranch: [
              { type: "BgStatement", transition: { name: "fade", duration: 300 } },
              { type: "ShowStatement", placement: { value: "center" } },
              { type: "BgmStatement" },
              { type: "SeStatement" },
              { type: "SystemUnlockStatement", kind: "achievement" },
            ],
          },
        ],
      },
    ]);
  });

  it("parses visual audio and system sugar inside nested choice item bodies", () => {
    const body = parseSceneBody(`scene start:
  choice "外側":
    "見る":
      choice "内側":
        "表示":
          hide alice_smile with dissolve(duration=250)
          clear bg
          voice mio_001
          stopBgm
          system.unlockCg cg001
`);

    expect(body).toMatchObject([
      {
        type: "ChoiceStatement",
        items: [
          {
            body: [
              {
                type: "ChoiceStatement",
                items: [
                  {
                    body: [
                      { type: "HideStatement", transition: { name: "dissolve", duration: 250 } },
                      { type: "ClearVisualStatement", target: "bg" },
                      { type: "VoiceStatement" },
                      { type: "StopBgmStatement" },
                      { type: "SystemUnlockStatement", kind: "cg" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps condition ASTs attached in if and conditional choice items", () => {
    const body = parseSceneBody(`scene start:
  if scenario.a or scenario.b and system.c:
    choice "条件":
      "進む" if scenario.route == "mio" or system.endings.trueEnd.unlocked:
        jump route
`);

    expect(body[0]).toMatchObject({
      type: "IfStatement",
      condition: {
        type: "ConditionBinaryExpression",
        operator: "or",
        right: { type: "ConditionBinaryExpression", operator: "and" },
      },
      thenBranch: [
        {
          type: "ChoiceStatement",
          items: [
            {
              condition: {
                type: "ConditionBinaryExpression",
                operator: "or",
                left: { type: "ConditionComparisonExpression", operator: "==" },
                right: { type: "ConditionReference", path: "system.endings.trueEnd.unlocked" },
              },
            },
          ],
        },
      ],
    });
  });
});
