import { describe, expect, it } from "vitest";
import {
  compileTzrV2,
  createRuntimeSnapshot,
  createInitialRuntimeState,
  parseTzrV2,
  resolveChoice,
  restoreRuntimeState,
  stepRuntime,
  type CompiledTzrV2Document,
} from "../src/index.js";

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

describe("DSL v2 compiled document runtime compatibility", () => {
  it("creates an initial runtime state from a compiled DSL v2 document", () => {
    const document = compileSource(`scene start:
  end
`);

    const state = createInitialRuntimeState(document);

    expect(state).toMatchObject({
      pointer: {
        filePath: "scenario/v2.tzr",
        instructionIndex: 0,
      },
      pendingChoice: null,
      pendingWait: null,
      isStopped: false,
      isWaitingForClick: false,
    });
  });

  it("steps a compiled DSL v2 document", () => {
    const document = compileSource(`scene start:
  end
`);

    const scene = stepRuntime(document, createInitialRuntimeState(document));

    expect(scene.event).toEqual({ type: "scene", id: "start" });
    expect(scene.state.pointer).toEqual({
      filePath: "scenario/v2.tzr",
      instructionIndex: 1,
    });
  });

  it("runs minimal DSL v2 scene, narration, and stop", () => {
    const document = compileSource(`scene start:
  narration:
    Hello.
  end
`);

    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const narration = stepRuntime(document, scene.state);
    const stop = stepRuntime(document, narration.state);

    expect(scene.event).toEqual({ type: "scene", id: "start" });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Hello." }],
    });
    expect(stop.event).toEqual({ type: "stop" });
    expect(stop.state.isStopped).toBe(true);
  });

  it("runs minimal DSL v2 scene, dialogue, and stop", () => {
    const document = compileSource(`character mio name="Mio"
scene start:
  mio:
    Hello.
  end
`);

    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const dialogue = stepRuntime(document, scene.state);
    const stop = stepRuntime(document, dialogue.state);

    expect(scene.event).toEqual({ type: "scene", id: "start" });
    expect(dialogue.event).toMatchObject({
      type: "dialogue",
      speaker: "mio",
      lines: [{ text: "Hello." }],
    });
    expect(stop.event).toEqual({ type: "stop" });
    expect(stop.state.isStopped).toBe(true);
  });

  it("runs DSL v2 scene jump to a later scene", () => {
    const document = compileSource(`scene start:
  jump later
scene later:
  narration:
    Later.
`);

    const sceneStart = stepRuntime(document, createInitialRuntimeState(document));
    const jump = stepRuntime(document, sceneStart.state);
    const sceneLater = stepRuntime(document, jump.state);
    const narration = stepRuntime(document, sceneLater.state);

    expect(sceneStart.event).toEqual({ type: "scene", id: "start" });
    expect(jump.event).toEqual({
      type: "jump",
      sceneId: "later",
      instructionIndex: 2,
    });
    expect(sceneLater.event).toEqual({ type: "scene", id: "later" });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Later." }],
    });
  });

  it("does not use labels for DSL v2 scene jumps", () => {
    const document = compileSource(`scene start:
  jump later
scene later:
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const jump = stepRuntime(document, scene.state);

    expect(document.labels).toEqual({});
    expect(jump.event).toEqual({
      type: "jump",
      sceneId: "later",
      instructionIndex: 2,
    });
  });

  it("runs DSL v2 scene to choice event", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay" id=stay:
      narration:
        Stay.
    "Go":
      narration:
        Go.
`);

    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);

    expect(choice.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [
        { id: "stay", text: "Stay" },
        { text: "Go" },
      ],
    });
    expect(choice.state.pendingChoice).toMatchObject({
      kind: "body",
      question: "Choose",
      items: [
        { id: "stay", text: "Stay", body: [{ type: "NarrationInstruction" }] },
        { text: "Go", body: [{ type: "NarrationInstruction" }] },
      ],
    });
  });

  it("resolves the first DSL v2 body choice item and executes its body", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay" id=stay:
      narration:
        Stay.
    "Go" id=go:
      narration:
        Go.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const narration = stepRuntime(document, resolved.state);

    expect(resolved.event).toEqual({
      type: "choiceResolve",
      itemIndex: 0,
      id: "stay",
      text: "Stay",
    });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Stay." }],
    });
  });

  it("resolves the second DSL v2 body choice item and executes its body", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay" id=stay:
      narration:
        Stay.
    "Go" id=go:
      narration:
        Go.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);
    const resolved = resolveChoice(document, choice.state, 1);
    const narration = stepRuntime(document, resolved.state);

    expect(resolved.event).toEqual({
      type: "choiceResolve",
      itemIndex: 1,
      id: "go",
      text: "Go",
    });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Go." }],
    });
  });

  it("runs a DSL v2 choice body that jumps to another scene", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Go":
      jump later
scene later:
  narration:
    Later.
`);
    const sceneStart = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, sceneStart.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const jump = stepRuntime(document, resolved.state);
    const sceneLater = stepRuntime(document, jump.state);
    const narration = stepRuntime(document, sceneLater.state);

    expect(jump.event).toEqual({
      type: "jump",
      sceneId: "later",
      instructionIndex: 2,
    });
    expect(sceneLater.event).toEqual({ type: "scene", id: "later" });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Later." }],
    });
  });

  it("keeps a DSL v2 body choice pending until it is resolved", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay":
      narration:
        Stay.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const first = stepRuntime(document, scene.state);
    const second = stepRuntime(document, first.state);

    expect(second.event).toEqual(first.event);
    expect(second.state).toBe(first.state);
  });

  it("preserves a pending DSL v2 body choice through snapshot restore", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay" id=stay:
      narration:
        Stay.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);
    const restored = restoreRuntimeState(JSON.parse(JSON.stringify(createRuntimeSnapshot(choice.state))));
    const resolved = resolveChoice(document, restored, 0);
    const narration = stepRuntime(document, resolved.state);

    expect(restored.pendingChoice).toMatchObject({
      kind: "body",
      question: "Choose",
      items: [{ id: "stay", text: "Stay", body: [{ type: "NarrationInstruction" }] }],
    });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Stay." }],
    });
  });

  it("does not require labels for DSL v2 body choices", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay":
      narration:
        Stay.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);

    expect(document.labels).toEqual({});
    expect(choice.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [{ text: "Stay" }],
    });
  });

  it("runs DSL v2 set string, number, and boolean statements", () => {
    const document = compileSource(`scene start:
  set scenario.route = "mio"
  set scenario.score = 10
  set scenario.hasNotebook = true
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const route = stepRuntime(document, scene.state);
    const score = stepRuntime(document, route.state);
    const hasNotebook = stepRuntime(document, score.state);

    expect(route.event).toEqual({ type: "state", command: "set", name: "scenario.route", value: "mio" });
    expect(score.event).toEqual({ type: "state", command: "set", name: "scenario.score", value: 10 });
    expect(hasNotebook.event).toEqual({
      type: "state",
      command: "set",
      name: "scenario.hasNotebook",
      value: true,
    });
    expect(hasNotebook.state.variables).toEqual({
      "scenario.route": "mio",
      "scenario.score": 10,
      "scenario.hasNotebook": true,
    });
  });

  it("runs DSL v2 add from a missing initial value", () => {
    const document = compileSource(`scene start:
  add scenario.score += 1
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const add = stepRuntime(document, scene.state);

    expect(add.event).toEqual({ type: "state", command: "add", name: "scenario.score", value: 1 });
    expect(add.state.variables).toEqual({ "scenario.score": 1 });
  });

  it("runs DSL v2 add from an existing numeric value", () => {
    const document = compileSource(`scene start:
  set scenario.score = 10
  add scenario.score += -1
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const add = stepRuntime(document, set.state);

    expect(add.event).toEqual({ type: "state", command: "add", name: "scenario.score", value: 9 });
    expect(add.state.variables).toEqual({ "scenario.score": 9 });
  });

  it("returns a runtime error when DSL v2 add targets a non-number value", () => {
    const document = compileSource(`scene start:
  set scenario.score = "ten"
  add scenario.score += 1
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const add = stepRuntime(document, set.state);

    expect(add.event).toEqual({
      type: "error",
      code: "state_add_non_number",
      message: 'Cannot add to "scenario.score" because the current value is not a number.',
    });
    expect(add.state.variables).toEqual({ "scenario.score": "ten" });
  });

  it("runs DSL v2 set and add inside a body choice", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Score":
      set scenario.route = "mio"
      add scenario.score += 2
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const set = stepRuntime(document, resolved.state);
    const add = stepRuntime(document, set.state);

    expect(set.event).toEqual({ type: "state", command: "set", name: "scenario.route", value: "mio" });
    expect(add.event).toEqual({ type: "state", command: "add", name: "scenario.score", value: 2 });
    expect(add.state.variables).toEqual({
      "scenario.route": "mio",
      "scenario.score": 2,
    });
  });

  it("preserves DSL v2 variables after snapshot restore", () => {
    const document = compileSource(`scene start:
  set scenario.route = "mio"
  add scenario.score += 2
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const add = stepRuntime(document, set.state);
    const restored = restoreRuntimeState(createRuntimeSnapshot(add.state));

    expect(restored.variables).toEqual({
      "scenario.route": "mio",
      "scenario.score": 2,
    });
  });
});
