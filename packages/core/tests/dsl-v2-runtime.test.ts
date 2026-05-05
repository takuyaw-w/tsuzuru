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

  it("filters DSL v2 conditional body choice items when emitting a choice event", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  set scenario.hasKey = false
  choice "Choose":
    "Open notebook" id=openNotebook if scenario.hasNotebook:
      jump notebook
    "Use key" id=useKey if scenario.hasKey:
      jump key
    "Leave" id=leave:
      jump leave
scene notebook:
scene key:
scene leave:
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const hasNotebook = stepRuntime(document, scene.state);
    const hasKey = stepRuntime(document, hasNotebook.state);
    const choice = stepRuntime(document, hasKey.state);

    expect(choice.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [
        { id: "openNotebook", text: "Open notebook" },
        { id: "leave", text: "Leave" },
      ],
    });
    expect(choice.state.pendingChoice).toMatchObject({
      kind: "body",
      items: [
        { id: "openNotebook", text: "Open notebook", body: [{ type: "SceneJumpInstruction", sceneId: "notebook" }] },
        { id: "leave", text: "Leave", body: [{ type: "SceneJumpInstruction", sceneId: "leave" }] },
      ],
    });
  });

  it("resolves the first visible DSL v2 conditional choice item to the correct body", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  choice "Choose":
    "Open notebook" id=openNotebook if scenario.hasNotebook:
      jump notebook
    "Use key" id=useKey if scenario.hasKey:
      jump key
    "Leave" id=leave:
      jump leave
scene notebook:
scene key:
scene leave:
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const choice = stepRuntime(document, set.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const jump = stepRuntime(document, resolved.state);

    expect(resolved.event).toEqual({
      type: "choiceResolve",
      itemIndex: 0,
      id: "openNotebook",
      text: "Open notebook",
    });
    expect(jump.event).toEqual({
      type: "jump",
      sceneId: "notebook",
      instructionIndex: 3,
    });
  });

  it("resolves the second visible DSL v2 conditional choice item to the correct body", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  choice "Choose":
    "Open notebook" id=openNotebook if scenario.hasNotebook:
      jump notebook
    "Use key" id=useKey if scenario.hasKey:
      jump key
    "Leave" id=leave:
      jump leave
scene notebook:
scene key:
scene leave:
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const choice = stepRuntime(document, set.state);
    const resolved = resolveChoice(document, choice.state, 1);
    const jump = stepRuntime(document, resolved.state);

    expect(resolved.event).toEqual({
      type: "choiceResolve",
      itemIndex: 1,
      id: "leave",
      text: "Leave",
    });
    expect(jump.event).toEqual({
      type: "jump",
      sceneId: "leave",
      instructionIndex: 5,
    });
  });

  it("returns a runtime error when all DSL v2 conditional choice items are hidden", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Open notebook" id=openNotebook if scenario.hasNotebook:
      narration:
        Open.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);

    expect(choice.event).toEqual({
      type: "error",
      code: "choice_no_available_items",
      message: 'Choice "Choose" has no available items.',
    });
    expect(choice.state.pendingChoice).toBeNull();
  });

  it("returns a runtime error when a DSL v2 conditional choice condition evaluation fails", () => {
    const document = compileSource(`scene start:
  set scenario.route = "mio"
  choice "Choose":
    "Invalid" id=invalid if scenario.route > 1:
      narration:
        Invalid.
    "Leave" id=leave:
      narration:
        Leave.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const choice = stepRuntime(document, set.state);

    expect(choice.event).toEqual({
      type: "error",
      code: "condition_invalid_numeric_comparison",
      message: 'Cannot evaluate condition operator ">" because both operands must be numbers.',
    });
    expect(choice.state.pendingChoice).toBeNull();
  });

  it("preserves filtered DSL v2 pending body choices through snapshot restore", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  choice "Choose":
    "Open notebook" id=openNotebook if scenario.hasNotebook:
      narration:
        Open.
    "Use key" id=useKey if scenario.hasKey:
      narration:
        Key.
    "Leave" id=leave:
      narration:
        Leave.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const choice = stepRuntime(document, set.state);
    const restored = restoreRuntimeState(JSON.parse(JSON.stringify(createRuntimeSnapshot(choice.state))));
    const resolved = resolveChoice(document, restored, 1);
    const narration = stepRuntime(document, resolved.state);

    expect(restored.pendingChoice).toMatchObject({
      kind: "body",
      question: "Choose",
      items: [
        { id: "openNotebook", text: "Open notebook", body: [{ type: "NarrationInstruction" }] },
        { id: "leave", text: "Leave", body: [{ type: "NarrationInstruction" }] },
      ],
    });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Leave." }],
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

  it("runs a DSL v2 if true branch from a scenario boolean variable", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  if scenario.hasNotebook:
    narration:
      Open it.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const branch = stepRuntime(document, set.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "Open it." }] },
    });
  });

  it("runs a DSL v2 if false else branch", () => {
    const document = compileSource(`scene start:
  if scenario.hasNotebook:
    narration:
      Open it.
  else:
    narration:
      Leave it.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const branch = stepRuntime(document, scene.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: false,
      branch: "else",
      event: { type: "narration", lines: [{ text: "Leave it." }] },
    });
  });

  it("runs a DSL v2 elif branch", () => {
    const document = compileSource(`scene start:
  set scenario.score = 2
  if scenario.score > 3:
    narration:
      High.
  elif scenario.score >= 2:
    narration:
      Middle.
  else:
    narration:
      Low.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const branch = stepRuntime(document, set.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "elif",
      branchIndex: 0,
      event: { type: "narration", lines: [{ text: "Middle." }] },
    });
  });

  it("runs nested DSL v2 if statements", () => {
    const document = compileSource(`scene start:
  set scenario.outer = true
  set scenario.inner = true
  if scenario.outer:
    if scenario.inner:
      narration:
        Nested.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const outerSet = stepRuntime(document, scene.state);
    const innerSet = stepRuntime(document, outerSet.state);
    const branch = stepRuntime(document, innerSet.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: {
        type: "if",
        result: true,
        branch: "then",
        event: { type: "narration", lines: [{ text: "Nested." }] },
      },
    });
  });

  it("runs DSL v2 numeric comparison after set and add", () => {
    const document = compileSource(`scene start:
  set scenario.score = 1
  add scenario.score += 2
  if scenario.score >= 3:
    narration:
      Enough.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const add = stepRuntime(document, set.state);
    const branch = stepRuntime(document, add.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "Enough." }] },
    });
  });

  it("runs DSL v2 string equality", () => {
    const document = compileSource(`scene start:
  set scenario.route = "mio"
  if scenario.route == "mio":
    narration:
      Mio route.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const branch = stepRuntime(document, set.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "Mio route." }] },
    });
  });

  it("runs DSL v2 boolean equality", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  if scenario.hasNotebook == true:
    narration:
      True.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const branch = stepRuntime(document, set.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "True." }] },
    });
  });

  it("treats a missing DSL v2 scenario value as null for null comparison", () => {
    const document = compileSource(`scene start:
  if scenario.currentCg == null:
    narration:
      Missing.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const branch = stepRuntime(document, scene.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "Missing." }] },
    });
  });

  it("treats a missing bare DSL v2 scenario reference as false", () => {
    const document = compileSource(`scene start:
  if scenario.hasNotebook:
    narration:
      Open it.
  else:
    narration:
      Leave it.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const branch = stepRuntime(document, scene.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: false,
      branch: "else",
      event: { type: "narration", lines: [{ text: "Leave it." }] },
    });
  });

  it("runs DSL v2 logical and / or / not conditions", () => {
    const document = compileSource(`scene start:
  set scenario.a = false
  set scenario.b = true
  if not scenario.a and scenario.b:
    narration:
      Logical.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const a = stepRuntime(document, scene.state);
    const b = stepRuntime(document, a.state);
    const branch = stepRuntime(document, b.state);

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "Logical." }] },
    });
  });

  it("returns a runtime error for invalid DSL v2 numeric comparisons", () => {
    const document = compileSource(`scene start:
  set scenario.route = "mio"
  if scenario.route > 1:
    narration:
      Invalid.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const branch = stepRuntime(document, set.state);

    expect(branch.event).toEqual({
      type: "error",
      code: "condition_invalid_numeric_comparison",
      message: 'Cannot evaluate condition operator ">" because both operands must be numbers.',
    });
    expect(branch.state.variables).toEqual({ "scenario.route": "mio" });
  });
});
