import { describe, expect, it } from "vitest";
import { compileTzr, parseTzr } from "../src/index.js";

describe("compileTzr", () => {
  it("accepts same-file jump and choice targets that resolve to labels", () => {
    const parsed = parseTzr(
      `#scene("prologue")

? Choose
- "Go" -> #next

#label("next")
@jump("#next")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }
    expect(compiled.document).toBe(parsed.document);
  });

  it("reports duplicate labels and scenes", () => {
    const parsed = parseTzr(
      `#scene("prologue")
#scene("prologue")
#label("start")
#label("start")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 1,
        message: 'Duplicate scene "prologue".',
        sourceLine: '#scene("prologue")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: 'Duplicate label "#start".',
        sourceLine: '#label("start")',
      },
    ]);
  });

  it("reports missing same-file jump and choice labels", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("#missing")

? Choose
- "Missing" -> #missing_choice
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document);

    expect(compiled.ok).toBe(false);
    if (compiled.ok) {
      throw new Error("expected compiler failure");
    }
    expect(compiled.errors).toEqual([
      {
        filePath: "scenario/main.tzr",
        line: 2,
        column: 8,
        message: 'Unknown label "#missing".',
        sourceLine: '@jump("#missing")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 16,
        message: 'Unknown label "#missing_choice".',
        sourceLine: '- "Missing" -> #missing_choice',
      },
    ]);
  });

  it("leaves cross-file target validation for a later compiler phase", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("chapter-01.tzr#start")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    expect(compileTzr(parsed.document).ok).toBe(true);
  });
});
