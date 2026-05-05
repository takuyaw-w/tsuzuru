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

function expectCompileFailure(source: string): string[] {
  const compiled = compileTzrV2(parseSource(source));
  expect(compiled.ok).toBe(false);
  if (compiled.ok) {
    throw new Error("expected compiler failure");
  }
  return compiled.errors.map((error) => error.message);
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

  it("keeps scene-target jump rejected until runtime support exists", () => {
    expect(expectCompileFailure(`scene start:
  jump later
scene later:
`)).toContain("Scene-target jump runtime support is not implemented yet.");
  });
});
