import { compileTzr, parseTzr, type RuntimeDocument, type RuntimeEvent } from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createTsuzuruHtmlRuntimeController,
  getTsuzuruHtmlVisibleRuntimeEvent,
  isTsuzuruHtmlAutoSteppableRuntimeEvent,
} from "../src/index.js";

describe("createTsuzuruHtmlRuntimeController", () => {
  it("initializes runtime state without stepping", () => {
    const document = compileScript(`scene start:
  narration:
    Ready.
`);
    const controller = createTsuzuruHtmlRuntimeController(document);

    expect(controller.getState().pointer.instructionIndex).toBe(0);
    expect(controller.getEvent()).toBeNull();
    expect(controller.getVisibleEvent()).toBeNull();
    expect(controller.getBlockReason()).toBeNull();
    expect(controller.isBlocked()).toBe(false);
  });

  it("steps to the next visible runtime event without Preact", () => {
    const document = compileScript(`scene start:
  narration:
    Ready.
`);
    const controller = createTsuzuruHtmlRuntimeController(document, { autoStepTransientEvents: true });

    controller.step();

    expect(controller.getEvent()).toMatchObject({
      type: "narration",
      lines: [{ text: "Ready." }],
    });
    expect(controller.getVisibleEvent()).toMatchObject({ type: "narration" });
    expect(controller.getBlockReason()).toBeNull();
  });

  it("resolves body choices and advances into the selected item body", () => {
    const document = compileScript(`scene start:
  choice "Choose":
    "Stay" id=stay:
      narration:
        Stayed.
    "Leave" id=leave:
      narration:
        Left.
`);
    const controller = createTsuzuruHtmlRuntimeController(document, { autoStepTransientEvents: true });

    controller.step();

    expect(controller.getEvent()).toEqual({
      type: "choice",
      question: "Choose",
      items: [
        { id: "stay", text: "Stay" },
        { id: "leave", text: "Leave" },
      ],
    });
    expect(controller.getBlockReason()).toBe("choice");

    controller.choose(1);

    expect(controller.getEvent()).toMatchObject({
      type: "narration",
      lines: [{ text: "Left." }],
    });
    expect(controller.getVisibleEvent()).toMatchObject({ type: "narration" });
    expect(controller.getBlockReason()).toBeNull();
  });

  it("surfaces choice resolution errors as visible events", () => {
    const document = compileScript(`scene start:
  choice "Choose":
    "Stay":
      narration:
        Stayed.
`);
    const controller = createTsuzuruHtmlRuntimeController(document, { autoStepTransientEvents: true });

    controller.step();
    controller.choose(99);

    expect(controller.getEvent()).toMatchObject({
      type: "error",
      code: "choice_index_out_of_range",
    });
    expect(controller.getVisibleEvent()).toMatchObject({ type: "error" });
  });

  it("auto-clears timed waits and continues from the cleared state", () => {
    const callbacks: Array<() => void> = [];
    const delays: number[] = [];
    const document = compileScript(`scene start:
  wait 25
  narration:
    Done.
`);
    const controller = createTsuzuruHtmlRuntimeController(document, {
      autoStepTransientEvents: true,
      setTimeout: (callback, timeoutMs) => {
        callbacks.push(callback);
        delays.push(timeoutMs);
        return callbacks.length;
      },
      clearTimeout: () => undefined,
    });

    controller.step();

    expect(controller.getEvent()).toEqual({ type: "wait", durationMs: 25 });
    expect(controller.getVisibleEvent()).toEqual({ type: "wait", durationMs: 25 });
    expect(controller.getBlockReason()).toBe("wait");
    expect(delays).toEqual([25]);

    callbacks[0]?.();

    expect(controller.getEvent()).toMatchObject({
      type: "narration",
      lines: [{ text: "Done." }],
    });
    expect(controller.getBlockReason()).toBeNull();
  });

  it("resets state and treats destroy as terminal", () => {
    const document = compileScript(`scene start:
  narration:
    Ready.
`);
    const controller = createTsuzuruHtmlRuntimeController(document, { autoStepTransientEvents: true });

    controller.step();
    expect(controller.getVisibleEvent()).toMatchObject({ type: "narration" });

    controller.reset();
    expect(controller.getState().pointer.instructionIndex).toBe(0);
    expect(controller.getEvent()).toBeNull();
    expect(controller.getVisibleEvent()).toBeNull();

    controller.destroy();
    controller.step();

    expect(controller.isDestroyed()).toBe(true);
    expect(controller.getEvent()).toBeNull();
    expect(controller.getState().pointer.instructionIndex).toBe(0);
  });
});

describe("runtime event helpers", () => {
  it("extracts visible events and skips transient runtime events", () => {
    expect(getTsuzuruHtmlVisibleRuntimeEvent({ type: "scene", id: "start" })).toBeNull();
    expect(getTsuzuruHtmlVisibleRuntimeEvent({ type: "choiceResolve", itemIndex: 0, text: "Stay" })).toBeNull();

    const narration: RuntimeEvent = { type: "narration", lines: [textLine("Visible.")] };
    expect(getTsuzuruHtmlVisibleRuntimeEvent(narration)).toBe(narration);
    expect(getTsuzuruHtmlVisibleRuntimeEvent({ type: "if", result: true, branch: "then", event: narration })).toBe(
      narration,
    );
  });

  it("classifies auto-steppable runtime events", () => {
    expect(isTsuzuruHtmlAutoSteppableRuntimeEvent({ type: "scene", id: "start" })).toBe(true);
    expect(isTsuzuruHtmlAutoSteppableRuntimeEvent({ type: "pluginCommand", name: "bg" })).toBe(true);
    expect(isTsuzuruHtmlAutoSteppableRuntimeEvent({ type: "wait", durationMs: 100 })).toBe(false);
    expect(isTsuzuruHtmlAutoSteppableRuntimeEvent({ type: "choice", question: "Choose", items: [] })).toBe(false);
  });
});

function compileScript(source: string): RuntimeDocument {
  const parsed = parseTzr(source, { filePath: "scenario/main.tzr" });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(parsed.errors.map((error) => error.message).join("\n"));
  }

  const compiled = compileTzr(parsed.document);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error(compiled.errors.map((error) => error.message).join("\n"));
  }

  return compiled.document;
}

function textLine(text: string) {
  const loc = {
    start: { filePath: "scenario/main.tzr", line: 1, column: 1 },
    end: { filePath: "scenario/main.tzr", line: 1, column: 1 },
  };
  return { text, loc };
}
