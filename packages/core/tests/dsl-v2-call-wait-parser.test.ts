import { describe, expect, it } from "vitest";
import { parseTzr, type TzrSceneStatement } from "../src/index.js";

function parseSingleStatement(source: string): TzrSceneStatement {
  const result = parseTzr(source, { filePath: "scenario/call-wait.tzr" });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parser success");
  }

  const scene = result.document.declarations[0];
  if (scene === undefined || scene.type !== "SceneDeclaration") {
    throw new Error("expected scene");
  }
  const statement = scene.body[0];
  if (statement === undefined) {
    throw new Error("expected statement");
  }
  return statement;
}

function expectCallWaitFailure(source: string): string[] {
  const result = parseTzr(source, { filePath: "scenario/call-wait.tzr" });
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected parser failure");
  }
  return result.errors.map((error) => error.message);
}

describe("parseTzr call and wait statements", () => {
  it("parses call and wait with no args", () => {
    expect(parseSingleStatement("scene start:\n  call screen.open()\n")).toMatchObject({
      type: "CallStatement",
      name: "screen.open",
      args: [],
    });
    expect(parseSingleStatement("scene start:\n  wait screen.closed()\n")).toMatchObject({
      type: "WaitStatement",
      name: "screen.closed",
      args: [],
    });
  });

  it("parses timed wait duration in milliseconds", () => {
    expect(parseSingleStatement("scene start:\n  wait 1000\n")).toMatchObject({
      type: "WaitStatement",
      duration: { type: "NumberValue", value: 1000 },
    });
  });

  it("parses identifier args", () => {
    expect(parseSingleStatement("scene start:\n  call screen.open(id=notebook)\n")).toMatchObject({
      type: "CallStatement",
      args: [{ type: "NamedArgument", name: "id", value: { type: "IdentifierValue", value: "notebook" } }],
    });
    expect(parseSingleStatement("scene start:\n  wait audio.finished(assetId=mio_001)\n")).toMatchObject({
      type: "WaitStatement",
      args: [{ name: "assetId", value: { type: "IdentifierValue", value: "mio_001" } }],
    });
  });

  it("parses literal and dotted identifier args", () => {
    expect(parseSingleStatement('scene start:\n  call route.set(route="mio-route")\n')).toMatchObject({
      type: "CallStatement",
      args: [{ name: "route", value: { type: "StringValue", value: "mio-route" } }],
    });
    expect(parseSingleStatement("scene start:\n  call inventory.add(count=1)\n")).toMatchObject({
      type: "CallStatement",
      args: [{ name: "count", value: { type: "NumberValue", value: 1 } }],
    });
    expect(parseSingleStatement("scene start:\n  call screen.set(enabled=true)\n")).toMatchObject({
      type: "CallStatement",
      args: [{ name: "enabled", value: { type: "BooleanValue", value: true } }],
    });
    expect(parseSingleStatement("scene start:\n  call screen.clear(value=null)\n")).toMatchObject({
      type: "CallStatement",
      args: [{ name: "value", value: { type: "NullValue", value: null } }],
    });
    expect(parseSingleStatement("scene start:\n  call audio.play(assetId=mio.normal_001)\n")).toMatchObject({
      type: "CallStatement",
      args: [{ name: "assetId", value: { type: "IdentifierValue", value: "mio.normal_001" } }],
    });
  });

  it("parses variable reference args", () => {
    expect(parseSingleStatement("scene start:\n  call voice.play(current=$scenario.currentVoice)\n")).toMatchObject({
      type: "CallStatement",
      args: [
        { name: "current", value: { type: "VariableReferenceValue", path: "scenario.currentVoice", root: "scenario" } },
      ],
    });
    expect(
      parseSingleStatement("scene start:\n  call achievement.unlock(unlocked=$system.endings.trueEnd)\n"),
    ).toMatchObject({
      type: "CallStatement",
      args: [
        { name: "unlocked", value: { type: "VariableReferenceValue", path: "system.endings.trueEnd", root: "system" } },
      ],
    });
  });

  it("parses multiple args", () => {
    expect(
      parseSingleStatement('scene start:\n  call screen.open(id=notebook, route="mio-route", count=1)\n'),
    ).toMatchObject({
      type: "CallStatement",
      name: "screen.open",
      args: [
        { name: "id", value: { type: "IdentifierValue", value: "notebook" } },
        { name: "route", value: { type: "StringValue", value: "mio-route" } },
        { name: "count", value: { type: "NumberValue", value: 1 } },
      ],
    });
  });

  it("parses call inside if branches", () => {
    const statement = parseSingleStatement(`scene start:
  if scenario.hasNotebook:
    call screen.open(id=notebook)
`);

    expect(statement).toMatchObject({
      type: "IfStatement",
      thenBranch: [{ type: "CallStatement", name: "screen.open", args: [{ name: "id" }] }],
    });
  });

  it("parses wait inside choice item bodies", () => {
    const statement = parseSingleStatement(`scene start:
  choice "どうする？":
    "待つ":
      wait audio.finished(assetId=mio_001)
`);

    expect(statement).toMatchObject({
      type: "ChoiceStatement",
      items: [{ body: [{ type: "WaitStatement", name: "audio.finished", args: [{ name: "assetId" }] }] }],
    });
  });

  it("rejects call and wait without names", () => {
    expect(expectCallWaitFailure("scene start:\n  call\n")).toContain("call name is required.");
    expect(expectCallWaitFailure("scene start:\n  wait\n")).toContain("wait name is required.");
  });

  it("rejects non-namespaced and invalid dotted names", () => {
    expect(expectCallWaitFailure("scene start:\n  call open()\n")).toContain("call name must be namespaced.");
    expect(expectCallWaitFailure("scene start:\n  wait closed()\n")).toContain("wait name must be namespaced.");
    expect(expectCallWaitFailure("scene start:\n  call screen.open-now()\n")).toContain(
      "Invalid call name dotted identifier.",
    );
    expect(expectCallWaitFailure("scene start:\n  call screen..open()\n")).toContain(
      "Invalid call name dotted identifier.",
    );
  });

  it("rejects missing parentheses", () => {
    expect(expectCallWaitFailure("scene start:\n  call screen.open\n")).toContain(
      "call statement must include parentheses.",
    );
    expect(expectCallWaitFailure("scene start:\n  wait screen.closed\n")).toContain(
      "wait statement must include parentheses.",
    );
  });

  it("rejects non-number timed wait duration", () => {
    expect(expectCallWaitFailure("scene start:\n  wait 1s\n")).toContain("wait duration must be a number literal.");
  });

  it("rejects missing closing parenthesis", () => {
    expect(expectCallWaitFailure("scene start:\n  call screen.open(id=notebook\n")).toContain(
      "call statement is missing closing parenthesis.",
    );
  });

  it("rejects malformed arguments", () => {
    expect(expectCallWaitFailure("scene start:\n  call screen.open(notebook)\n")).toContain(
      "Positional arguments are not supported.",
    );
    expect(expectCallWaitFailure("scene start:\n  call screen.open(1st=notebook)\n")).toContain(
      "Invalid argument name.",
    );
    expect(expectCallWaitFailure("scene start:\n  call screen.open(id=notebook, id=other)\n")).toContain(
      'Duplicate call argument "id".',
    );
    expect(expectCallWaitFailure("scene start:\n  call screen.open(id=)\n")).toContain(
      "call argument value is required.",
    );
    expect(expectCallWaitFailure("scene start:\n  call screen.open(id={})\n")).toContain(
      "Invalid call argument value.",
    );
    expect(expectCallWaitFailure("scene start:\n  call screen.open(id=notebook,)\n")).toContain(
      "Malformed call argument list.",
    );
  });

  it("rejects invalid variable references", () => {
    expect(expectCallWaitFailure("scene start:\n  call voice.play(current=$)\n")).toContain(
      "Invalid call argument variable reference.",
    );
    expect(expectCallWaitFailure("scene start:\n  call voice.play(current=$scenario.)\n")).toContain(
      "Invalid call argument variable reference.",
    );
    expect(expectCallWaitFailure("scene start:\n  call voice.play(current=$scenario..value)\n")).toContain(
      "Invalid call argument variable reference.",
    );
    expect(expectCallWaitFailure("scene start:\n  call voice.play(current=$player.score)\n")).toContain(
      'Invalid call argument variable reference root "player".',
    );
  });

  it("rejects single-quoted and backtick strings", () => {
    expect(expectCallWaitFailure("scene start:\n  call route.set(route='mio')\n")).toContain(
      "Only double-quoted string literals are supported.",
    );
    expect(expectCallWaitFailure("scene start:\n  call route.set(route=`mio`)\n")).toContain(
      "Backtick string literals are not supported.",
    );
  });

  it("rejects extra trailing tokens", () => {
    expect(expectCallWaitFailure("scene start:\n  call screen.open() now\n")).toContain(
      "call statement must not have extra trailing tokens.",
    );
  });
});
