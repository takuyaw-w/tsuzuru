import { describe, expect, it } from "vitest";
import {
  compileTzrV2,
  createInitialRuntimeState,
  parseTzrV2,
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
});
