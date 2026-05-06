import { describe, expect, it } from "vitest";
import {
  type CommandInstruction,
  type CompiledTzrDocument,
  compileTzr,
  createInitialRuntimeState,
  createRuntimeSnapshot,
  parseTzr,
  type RuntimePluginCommandHandler,
  resolveChoice,
  restoreRuntimeState,
  stepRuntime,
} from "../src/index.js";

function parseSource(source: string) {
  const parsed = parseTzr(source, { filePath: "scenario/v2.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error("expected parser success");
  }
  return parsed.document;
}

function compileSource(source: string): CompiledTzrDocument {
  const compiled = compileTzr(parseSource(source));
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error("expected compiler success");
  }
  return compiled.document;
}

function capturePluginCommand(seen: CommandInstruction[]): RuntimePluginCommandHandler {
  return (state, instruction) => {
    seen.push(instruction);
    return {
      state,
      event: { type: "pluginCommand", name: instruction.name },
    };
  };
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

  it("runs DSL v2 timed wait as a host-cleared pending wait", () => {
    const document = compileSource(`scene start:
  wait 1000
`);

    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const wait = stepRuntime(document, scene.state);
    const repeatedWait = stepRuntime(document, wait.state);

    expect(wait.event).toEqual({ type: "wait", durationMs: 1000 });
    expect(wait.state.pendingWait).toEqual({ durationMs: 1000 });
    expect(repeatedWait.state).toBe(wait.state);
    expect(repeatedWait.event).toEqual({ type: "wait", durationMs: 1000 });
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

  it("keeps DSL v2 scene jumps scene-index based", () => {
    const document = compileSource(`scene start:
  jump later
scene later:
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const jump = stepRuntime(document, scene.state);

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
      items: [{ id: "stay", text: "Stay" }, { text: "Go" }],
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

  it("renders DSL v2 body choices without target metadata", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Stay":
      narration:
        Stay.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);

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
    if (choice.event.type !== "choice") {
      throw new Error("expected choice event");
    }
    expect(choice.event.items[0]).not.toHaveProperty("body");
    expect(choice.event.items[1]).not.toHaveProperty("body");
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
    expect(jump.state.branchFrames).toEqual([]);
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
    expect(jump.state.branchFrames).toEqual([]);
  });

  it("filters DSL v2 conditional choice items with logical and / or / not conditions", () => {
    const document = compileSource(`scene start:
  set scenario.a = false
  set scenario.b = true
  choice "Choose":
    "Logical" id=logical if not scenario.a and (scenario.b or scenario.c):
      narration:
        Logical.
    "Fallback" id=fallback:
      narration:
        Fallback.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const a = stepRuntime(document, scene.state);
    const b = stepRuntime(document, a.state);
    const choice = stepRuntime(document, b.state);

    expect(choice.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [
        { id: "logical", text: "Logical" },
        { id: "fallback", text: "Fallback" },
      ],
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
    const restoredChoice = stepRuntime(document, restored);

    expect(restored.pendingChoice).toMatchObject({
      kind: "body",
      question: "Choose",
      items: [
        { id: "openNotebook", text: "Open notebook", body: [{ type: "NarrationInstruction" }] },
        { id: "leave", text: "Leave", body: [{ type: "NarrationInstruction" }] },
      ],
    });
    expect(restoredChoice.event).toEqual({
      type: "choice",
      question: "Choose",
      items: [
        { id: "openNotebook", text: "Open notebook" },
        { id: "leave", text: "Leave" },
      ],
    });
    if (restoredChoice.event.type !== "choice") {
      throw new Error("expected restored choice event");
    }
    expect(restoredChoice.event.items[0]).not.toHaveProperty("body");
    expect(restoredChoice.event.items[1]).not.toHaveProperty("body");
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Leave." }],
    });
  });

  it("resolves the first visible filtered DSL v2 pending body choice after snapshot restore", () => {
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
    const resolved = resolveChoice(document, restored, 0);
    const narration = stepRuntime(document, resolved.state);

    expect(resolved.event).toEqual({
      type: "choiceResolve",
      itemIndex: 0,
      id: "openNotebook",
      text: "Open notebook",
    });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Open." }],
    });
  });

  it("clones filtered DSL v2 pending body choice bodies in snapshots", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  choice "Choose":
    "Open notebook" id=openNotebook if scenario.hasNotebook:
      narration:
        Open.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const choice = stepRuntime(document, set.state);
    const instruction = document.instructions[2];

    expect(instruction?.type).toBe("BodyChoiceInstruction");
    if (instruction?.type !== "BodyChoiceInstruction") {
      throw new Error("expected body choice instruction");
    }

    const originalBody = instruction.items[0]?.body;
    const snapshot = createRuntimeSnapshot(choice.state);
    const restored = restoreRuntimeState(snapshot);

    expect(snapshot.pendingChoice?.kind).toBe("body");
    if (snapshot.pendingChoice?.kind !== "body") {
      throw new Error("expected body pending choice snapshot");
    }
    expect(restored.pendingChoice?.kind).toBe("body");
    if (restored.pendingChoice?.kind !== "body") {
      throw new Error("expected restored body pending choice");
    }
    expect(snapshot.pendingChoice.items[0]?.body).not.toBe(originalBody);
    expect(snapshot.pendingChoice.items[0]?.body[0]).not.toBe(originalBody?.[0]);
    expect(restored.pendingChoice.items[0]?.body).not.toBe(originalBody);
    expect(restored.pendingChoice.items[0]?.body[0]).not.toBe(originalBody?.[0]);
    expect(restored.pendingChoice.items[0]?.body).not.toBe(snapshot.pendingChoice.items[0]?.body);
    expect(restored.pendingChoice.items[0]?.body[0]).not.toBe(snapshot.pendingChoice.items[0]?.body[0]);
  });

  it("resumes parent flow after a filtered DSL v2 body choice branch completes", () => {
    const document = compileSource(`scene start:
  set scenario.canTalk = true
  choice "Choose":
    "Talk" id=talk if scenario.canTalk:
      narration:
        Talk.
  narration:
    After.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const choice = stepRuntime(document, set.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const talk = stepRuntime(document, resolved.state);
    const instruction = document.instructions[2];
    const activeBranchSnapshot = createRuntimeSnapshot(talk.state);
    const activeBranchRestored = restoreRuntimeState(activeBranchSnapshot);
    const after = stepRuntime(document, talk.state);

    expect(instruction?.type).toBe("BodyChoiceInstruction");
    if (instruction?.type !== "BodyChoiceInstruction") {
      throw new Error("expected body choice instruction");
    }
    expect(activeBranchSnapshot.branchFrames[0]?.instructions).not.toBe(instruction.items[0]?.body);
    expect(activeBranchSnapshot.branchFrames[0]?.instructions[0]).not.toBe(instruction.items[0]?.body[0]);
    expect(activeBranchRestored.branchFrames[0]?.instructions).not.toBe(
      activeBranchSnapshot.branchFrames[0]?.instructions,
    );
    expect(talk.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Talk." }],
    });
    expect(after.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After." }],
    });
    expect(after.state.branchFrames).toEqual([]);
  });

  it("restores an active DSL v2 body choice branch from a JSON snapshot without sharing instructions", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Talk" id=talk:
      narration:
        Talk.
  narration:
    After.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const instruction = document.instructions[1];

    expect(instruction?.type).toBe("BodyChoiceInstruction");
    if (instruction?.type !== "BodyChoiceInstruction") {
      throw new Error("expected body choice instruction");
    }

    const snapshot = createRuntimeSnapshot(resolved.state);
    const parsedSnapshot = JSON.parse(JSON.stringify(snapshot));
    const restored = restoreRuntimeState(parsedSnapshot);
    const talk = stepRuntime(document, restored);
    const after = stepRuntime(document, talk.state);

    expect(snapshot.branchFrames[0]?.instructions).not.toBe(instruction.items[0]?.body);
    expect(snapshot.branchFrames[0]?.instructions[0]).not.toBe(instruction.items[0]?.body[0]);
    expect(restored.branchFrames[0]?.instructions).not.toBe(snapshot.branchFrames[0]?.instructions);
    expect(restored.branchFrames[0]?.instructions[0]).not.toBe(snapshot.branchFrames[0]?.instructions[0]);
    expect(talk.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Talk." }],
    });
    expect(after.event).toMatchObject({
      type: "narration",
      lines: [{ text: "After." }],
    });
    expect(after.state.branchFrames).toEqual([]);
  });

  it("runs nested filtered DSL v2 body choices", () => {
    const document = compileSource(`scene start:
  set scenario.hasNotebook = true
  choice "Outer":
    "Open" id=open if scenario.hasNotebook:
      choice "Inner":
        "Read" id=read if scenario.hasNotebook:
          narration:
            Read.
        "Close" id=close:
          narration:
            Close.
    "Leave" id=leave:
      narration:
        Leave.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const outerChoice = stepRuntime(document, set.state);
    const outerResolved = resolveChoice(document, outerChoice.state, 0);
    const innerChoice = stepRuntime(document, outerResolved.state);
    const innerResolved = resolveChoice(document, innerChoice.state, 0);
    const narration = stepRuntime(document, innerResolved.state);

    expect(innerChoice.event).toEqual({
      type: "choice",
      question: "Inner",
      items: [
        { id: "read", text: "Read" },
        { id: "close", text: "Close" },
      ],
    });
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Read." }],
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

  it("runs DSL v2 set null and preserves it through snapshot restore", () => {
    const document = compileSource(`scene start:
  set scenario.selectedItem = null
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const restored = restoreRuntimeState(JSON.parse(JSON.stringify(createRuntimeSnapshot(set.state))));

    expect(set.event).toEqual({ type: "state", command: "set", name: "scenario.selectedItem", value: null });
    expect(set.state.variables).toEqual({ "scenario.selectedItem": null });
    expect(restored.variables).toEqual({ "scenario.selectedItem": null });
  });

  it("runs DSL v2 set from a scenario variable reference", () => {
    const document = compileSource(`scene start:
  set scenario.name = "mio"
  set scenario.currentSpeaker = scenario.name
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const name = stepRuntime(document, scene.state);
    const currentSpeaker = stepRuntime(document, name.state);

    expect(currentSpeaker.event).toEqual({
      type: "state",
      command: "set",
      name: "scenario.currentSpeaker",
      value: "mio",
    });
    expect(currentSpeaker.state.variables).toEqual({
      "scenario.name": "mio",
      "scenario.currentSpeaker": "mio",
    });
  });

  it("returns a runtime error when DSL v2 set references missing scenario state", () => {
    const document = compileSource(`scene start:
  set scenario.currentSpeaker = scenario.name
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const currentSpeaker = stepRuntime(document, scene.state);

    expect(currentSpeaker.event).toEqual({
      type: "error",
      code: "state_reference_missing",
      message: 'Cannot set "scenario.currentSpeaker" from "scenario.name" because the source value is missing.',
    });
    expect(currentSpeaker.state.variables).toEqual({});
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

  it("runs DSL v2 set and add inside a selected filtered body choice", () => {
    const document = compileSource(`scene start:
  set scenario.canScore = true
  choice "Choose":
    "Score" id=score if scenario.canScore:
      set scenario.route = "mio"
      add scenario.score += 2
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const canScore = stepRuntime(document, scene.state);
    const choice = stepRuntime(document, canScore.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const set = stepRuntime(document, resolved.state);
    const add = stepRuntime(document, set.state);

    expect(resolved.event).toEqual({
      type: "choiceResolve",
      itemIndex: 0,
      id: "score",
      text: "Score",
    });
    expect(set.event).toEqual({ type: "state", command: "set", name: "scenario.route", value: "mio" });
    expect(add.event).toEqual({ type: "state", command: "add", name: "scenario.score", value: 2 });
    expect(add.state.variables).toEqual({
      "scenario.canScore": true,
      "scenario.route": "mio",
      "scenario.score": 2,
    });
  });

  it("dispatches compiled DSL v2 bg through plugin command handlers", () => {
    const document = compileSource(`scene start:
  bg classroom
`);
    const seen: CommandInstruction[] = [];
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const bg = stepRuntime(document, scene.state, {
      commandHandlers: { bg: capturePluginCommand(seen) },
    });

    expect(bg.event).toEqual({ type: "pluginCommand", name: "bg" });
    expect(seen[0]).toMatchObject({
      name: "bg",
      args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "classroom" } }],
    });
  });

  it("dispatches compiled DSL v2 show through plugin command handlers", () => {
    const document = compileSource(`scene start:
  show alice_smile at left
`);
    const seen: CommandInstruction[] = [];
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const show = stepRuntime(document, scene.state, {
      commandHandlers: { show: capturePluginCommand(seen) },
    });

    expect(show.event).toEqual({ type: "pluginCommand", name: "show" });
    expect(seen[0]).toMatchObject({
      name: "show",
      args: [
        { type: "PositionalArgument", value: { type: "StringValue", value: "alice_smile" } },
        { type: "NamedArgument", name: "position", value: { type: "StringValue", value: "left" } },
      ],
    });
  });

  it("dispatches compiled DSL v2 hide through plugin command handlers", () => {
    const document = compileSource(`scene start:
  hide alice_smile
`);
    const seen: CommandInstruction[] = [];
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const hide = stepRuntime(document, scene.state, {
      commandHandlers: { hide: capturePluginCommand(seen) },
    });

    expect(hide.event).toEqual({ type: "pluginCommand", name: "hide" });
    expect(seen[0]).toMatchObject({
      name: "hide",
      args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "alice_smile" } }],
    });
  });

  it("dispatches compiled DSL v2 bgm through plugin command handlers", () => {
    const document = compileSource(`scene start:
  bgm daily_theme
`);
    const seen: CommandInstruction[] = [];
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const bgm = stepRuntime(document, scene.state, {
      commandHandlers: { startBgm: capturePluginCommand(seen) },
    });

    expect(bgm.event).toEqual({ type: "pluginCommand", name: "startBgm" });
    expect(seen[0]).toMatchObject({
      name: "startBgm",
      args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "daily_theme" } }],
    });
  });

  it("dispatches compiled DSL v2 stopBgm through plugin command handlers", () => {
    const document = compileSource(`scene start:
  stopBgm
`);
    const seen: CommandInstruction[] = [];
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const stopBgm = stepRuntime(document, scene.state, {
      commandHandlers: { stopBgm: capturePluginCommand(seen) },
    });

    expect(stopBgm.event).toEqual({ type: "pluginCommand", name: "stopBgm" });
    expect(seen[0]).toMatchObject({
      name: "stopBgm",
      args: [],
    });
  });

  it("dispatches compiled DSL v2 se through plugin command handlers", () => {
    const document = compileSource(`scene start:
  se doorOpen
`);
    const seen: CommandInstruction[] = [];
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const se = stepRuntime(document, scene.state, {
      commandHandlers: { se: capturePluginCommand(seen) },
    });

    expect(se.event).toEqual({ type: "pluginCommand", name: "se" });
    expect(seen[0]).toMatchObject({
      name: "se",
      args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "doorOpen" } }],
    });
  });

  it("dispatches compiled DSL v2 voice through plugin command handlers", () => {
    const document = compileSource(`scene start:
  voice mio_001
`);
    const seen: CommandInstruction[] = [];
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const voice = stepRuntime(document, scene.state, {
      commandHandlers: { voice: capturePluginCommand(seen) },
    });

    expect(voice.event).toEqual({ type: "pluginCommand", name: "voice" });
    expect(seen[0]).toMatchObject({
      name: "voice",
      args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "mio_001" } }],
    });
  });

  it("dispatches DSL v2 audio commands inside selected choice bodies", () => {
    const document = compileSource(`scene start:
  choice "Choose":
    "Listen":
      bgm daily_theme
      se doorOpen
      voice mio_001
      stopBgm
`);
    const seen: CommandInstruction[] = [];
    const commandHandlers = {
      startBgm: capturePluginCommand(seen),
      se: capturePluginCommand(seen),
      voice: capturePluginCommand(seen),
      stopBgm: capturePluginCommand(seen),
    };
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const choice = stepRuntime(document, scene.state);
    const resolved = resolveChoice(document, choice.state, 0);
    const bgm = stepRuntime(document, resolved.state, { commandHandlers });
    const se = stepRuntime(document, bgm.state, { commandHandlers });
    const voice = stepRuntime(document, se.state, { commandHandlers });
    const stopBgm = stepRuntime(document, voice.state, { commandHandlers });

    expect(bgm.event).toEqual({ type: "pluginCommand", name: "startBgm" });
    expect(se.event).toEqual({ type: "pluginCommand", name: "se" });
    expect(voice.event).toEqual({ type: "pluginCommand", name: "voice" });
    expect(stopBgm.event).toEqual({ type: "pluginCommand", name: "stopBgm" });
    expect(seen).toMatchObject([
      {
        name: "startBgm",
        args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "daily_theme" } }],
      },
      { name: "se", args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "doorOpen" } }] },
      { name: "voice", args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "mio_001" } }] },
      { name: "stopBgm", args: [] },
    ]);
  });

  it("dispatches DSL v2 audio commands inside if branches", () => {
    const document = compileSource(`scene start:
  set scenario.ready = true
  if scenario.ready:
    bgm daily_theme
    se doorOpen
    voice mio_001
    stopBgm
`);
    const seen: CommandInstruction[] = [];
    const commandHandlers = {
      startBgm: capturePluginCommand(seen),
      se: capturePluginCommand(seen),
      voice: capturePluginCommand(seen),
      stopBgm: capturePluginCommand(seen),
    };
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const ready = stepRuntime(document, scene.state);
    const branch = stepRuntime(document, ready.state, { commandHandlers });
    const se = stepRuntime(document, branch.state, { commandHandlers });
    const voice = stepRuntime(document, se.state, { commandHandlers });
    const stopBgm = stepRuntime(document, voice.state, { commandHandlers });

    expect(branch.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "pluginCommand", name: "startBgm" },
    });
    expect(se.event).toEqual({ type: "pluginCommand", name: "se" });
    expect(voice.event).toEqual({ type: "pluginCommand", name: "voice" });
    expect(stopBgm.event).toEqual({ type: "pluginCommand", name: "stopBgm" });
    expect(seen).toMatchObject([
      {
        name: "startBgm",
        args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "daily_theme" } }],
      },
      { name: "se", args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "doorOpen" } }] },
      { name: "voice", args: [{ type: "PositionalArgument", value: { type: "StringValue", value: "mio_001" } }] },
      { name: "stopBgm", args: [] },
    ]);
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
    expect("flags" in restored).toBe(false);
  });

  it("preserves scenario boolean variables after snapshot restore", () => {
    const document = compileSource(`scene start:
  set scenario.flagLike = true
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const snapshot = createRuntimeSnapshot(set.state);
    const restored = restoreRuntimeState(snapshot);

    expect(set.event).toEqual({ type: "state", command: "set", name: "scenario.flagLike", value: true });
    expect(snapshot.version).toBe(2);
    expect("flags" in snapshot).toBe(false);
    expect(restored.variables).toEqual({ "scenario.flagLike": true });
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

  it("runs DSL v2 null equality and inequality against stored null values", () => {
    const document = compileSource(`scene start:
  set scenario.currentCg = null
  if scenario.currentCg == null:
    narration:
      Empty.
  if scenario.currentCg != null:
    narration:
      Filled.
  else:
    narration:
      Still empty.
`);
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    const set = stepRuntime(document, scene.state);
    const equal = stepRuntime(document, set.state);
    const notEqual = stepRuntime(document, equal.state);

    expect(equal.event).toMatchObject({
      type: "if",
      result: true,
      branch: "then",
      event: { type: "narration", lines: [{ text: "Empty." }] },
    });
    expect(notEqual.event).toMatchObject({
      type: "if",
      result: false,
      branch: "else",
      event: { type: "narration", lines: [{ text: "Still empty." }] },
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
