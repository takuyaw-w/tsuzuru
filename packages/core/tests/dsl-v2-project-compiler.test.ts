import { describe, expect, it } from "vitest";
import {
  type CompiledTzrDocument,
  compileTzr,
  compileTzrProject,
  createInitialRuntimeState,
  parseTzr,
  stepRuntime,
} from "../src/index.js";

function compileProject(
  documents: readonly { readonly id: string; readonly source: string }[],
  entryId = "scenario/main.tzr",
): CompiledTzrDocument {
  const compiled = compileTzrProject({ entryId, documents });
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error(compiled.errors.map((error) => error.message).join("\n"));
  }
  return compiled.document;
}

function expectProjectFailure(
  documents: readonly { readonly id: string; readonly source: string }[],
  entryId = "scenario/main.tzr",
) {
  const compiled = compileTzrProject({ entryId, documents });
  expect(compiled.ok).toBe(false);
  if (compiled.ok) {
    throw new Error("expected project compile failure");
  }
  return compiled.errors;
}

describe("compileTzrProject", () => {
  it("handles prototype-named project document ids", () => {
    const errors = expectProjectFailure([{ id: "__proto__", source: "scene start:\n  jump missing\n" }], "__proto__");

    expect(errors).toContainEqual(expect.objectContaining({ filePath: "__proto__", line: 2 }));
  });

  it("resolves includes from the entry document id", () => {
    const document = compileProject([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/01-opening.tzr"
scene main:
  jump opening_start
`,
      },
      {
        id: "scenario/chapters/01-opening.tzr",
        source: `scene opening_start:
  narration:
    Opening.
`,
      },
    ]);

    expect(document.scenes).toMatchObject({
      main: { id: "main", statementIndex: 0 },
      opening_start: { id: "opening_start", statementIndex: 2 },
    });
  });

  it("aggregates included documents once in include order after the entry document", () => {
    const document = compileProject([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/a.tzr"
include "./chapters/b.tzr"
include "./chapters/a.tzr"
scene main:
  jump a
`,
      },
      {
        id: "scenario/chapters/a.tzr",
        source: `scene a:
  narration:
    A
`,
      },
      {
        id: "scenario/chapters/b.tzr",
        source: `scene b:
  narration:
    B
`,
      },
    ]);

    expect(document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "main" },
      { type: "SceneJumpInstruction", sceneId: "a" },
      { type: "SceneInstruction", id: "a" },
      { type: "NarrationInstruction", lines: [{ text: "A" }] },
      { type: "SceneInstruction", id: "b" },
      { type: "NarrationInstruction", lines: [{ text: "B" }] },
    ]);
    expect(document.scenes.a?.statementIndex).toBeLessThan(document.scenes.b?.statementIndex ?? 0);
  });

  it("resolves nested includes", () => {
    const document = compileProject([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/01-opening.tzr"
scene main:
  jump common
`,
      },
      {
        id: "scenario/chapters/01-opening.tzr",
        source: `include "./02-common.tzr"
scene opening_start:
  narration:
    Opening.
`,
      },
      {
        id: "scenario/chapters/02-common.tzr",
        source: `scene common:
  narration:
    Common.
`,
      },
    ]);

    expect(document.scenes).toMatchObject({
      opening_start: { id: "opening_start" },
      common: { id: "common" },
    });
  });

  it("jumps to an included scene with jump sceneName", () => {
    const document = compileProject([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/01-opening.tzr"
scene main:
  jump opening_start
`,
      },
      {
        id: "scenario/chapters/01-opening.tzr",
        source: `scene opening_start:
  narration:
    Cross-file scene.
`,
      },
    ]);

    const scene = stepRuntime(document, createInitialRuntimeState(document));
    expect(scene.event).toMatchObject({ type: "scene", id: "main" });

    const jump = stepRuntime(document, scene.state);
    expect(jump.event).toMatchObject({ type: "jump", sceneId: "opening_start" });

    const targetScene = stepRuntime(document, jump.state);
    expect(targetScene.event).toMatchObject({ type: "scene", id: "opening_start" });

    const narration = stepRuntime(document, targetScene.state);
    expect(narration.event).toMatchObject({
      type: "narration",
      lines: [{ text: "Cross-file scene." }],
    });
  });

  it("rejects duplicate scene ids at project level", () => {
    const errors = expectProjectFailure([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/01-opening.tzr"
scene main:
`,
      },
      {
        id: "scenario/chapters/01-opening.tzr",
        source: `scene main:
`,
      },
    ]);

    expect(errors).toContainEqual(expect.objectContaining({ filePath: "scenario/chapters/01-opening.tzr" }));
    expect(errors.map((error) => error.message)).toContain('Duplicate scene "main".');
  });

  it("rejects missing project-level scene jump targets", () => {
    const errors = expectProjectFailure([
      {
        id: "scenario/main.tzr",
        source: `scene main:
  jump missing
`,
      },
    ]);

    expect(errors.map((error) => error.message)).toContain('Unknown scene "missing".');
  });

  it("rejects missing include targets", () => {
    const errors = expectProjectFailure([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/missing.tzr"
scene main:
`,
      },
    ]);

    expect(errors).toContainEqual(expect.objectContaining({ filePath: "scenario/main.tzr" }));
    expect(errors.map((error) => error.message)).toContain('Missing include target "scenario/chapters/missing.tzr".');
  });

  it("rejects circular includes", () => {
    const errors = expectProjectFailure([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/a.tzr"
scene main:
`,
      },
      {
        id: "scenario/chapters/a.tzr",
        source: `include "../main.tzr"
scene a:
`,
      },
    ]);

    expect(errors).toContainEqual(expect.objectContaining({ filePath: "scenario/chapters/a.tzr" }));
    expect(errors.map((error) => error.message).join("\n")).toContain("Circular include detected");
  });

  it("does not emit include directives as runtime events", () => {
    const document = compileProject([
      {
        id: "scenario/main.tzr",
        source: `include "./chapters/01-opening.tzr"
scene main:
  end
`,
      },
      {
        id: "scenario/chapters/01-opening.tzr",
        source: `scene opening_start:
  narration:
    Opening.
`,
      },
    ]);

    expect(document.instructions).not.toContainEqual(expect.objectContaining({ type: "IncludeDirective" }));
    const scene = stepRuntime(document, createInitialRuntimeState(document));
    expect(scene.event).toMatchObject({ type: "scene", id: "main" });
  });

  it("keeps single-document compileTzr scene jumps working", () => {
    const parsed = parseTzr(
      `scene start:
  jump later
scene later:
`,
      { filePath: "scenario/single.tzr" },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compile success");
    }

    expect(compiled.document.instructions).toMatchObject([
      { type: "SceneInstruction", id: "start" },
      { type: "SceneJumpInstruction", sceneId: "later" },
      { type: "SceneInstruction", id: "later" },
    ]);
  });
});
