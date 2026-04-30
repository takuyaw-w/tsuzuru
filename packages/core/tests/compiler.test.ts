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

  it("reports invalid jump target formats", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("")
@jump("#")
@jump("chapter-01.tzr#")
@jump("chapter-01.tzr#start#extra")
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
        message: "Jump target must not be empty.",
        sourceLine: '@jump("")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 8,
        message: "Jump target must include a label after #.",
        sourceLine: '@jump("#")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 8,
        message: "Jump target must include a label after #.",
        sourceLine: '@jump("chapter-01.tzr#")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 8,
        message: 'Jump target must contain at most one "#".',
        sourceLine: '@jump("chapter-01.tzr#start#extra")',
      },
    ]);
  });

  it("reports invalid choice target formats", () => {
    const parsed = parseTzr(
      `#scene("prologue")
? Choose
- "Broken" -> #
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
        line: 3,
        column: 15,
        message: "Jump target must include a label after #.",
        sourceLine: '- "Broken" -> #',
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

  it("reports duplicate labels inside @if blocks", () => {
    const parsed = parseTzr(
      `#scene("prologue")
#label("start")
@if(flag("met_haruka"))
#label("start")
@endif
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
        line: 4,
        column: 1,
        message: 'Duplicate label "#start".',
        sourceLine: '#label("start")',
      },
    ]);
  });

  it("reports missing @jump targets inside @if blocks", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@jump("#missing")
@endif
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
        line: 3,
        column: 8,
        message: 'Unknown label "#missing".',
        sourceLine: '@jump("#missing")',
      },
    ]);
  });

  it("reports missing choice targets inside @else blocks", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@jump("#known")
@else
? Choose
- "Missing" -> #missing
@endif
#label("known")
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
        line: 6,
        column: 16,
        message: 'Unknown label "#missing".',
        sourceLine: '- "Missing" -> #missing',
      },
    ]);
  });

  it("reports missing jump targets inside nested @if blocks", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@if(var("affection") >= 3)
@jump("#nested_missing")
@endif
@endif
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
        line: 4,
        column: 8,
        message: 'Unknown label "#nested_missing".',
        sourceLine: '@jump("#nested_missing")',
      },
    ]);
  });

  it("accepts valid core command arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump("#known")
@wait(500)
@waitClick()
@page()
@stop()
#label("known")
`,
      { filePath: "scenario/main.tzr" },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    expect(compileTzr(parsed.document).ok).toBe(true);
  });

  it("reports invalid @jump arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@jump()
@jump(123)
@jump("#known", "extra")
#label("known")
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
        message: "@jump expects exactly 1 positional string argument.",
        sourceLine: "@jump()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 7,
        message: "@jump expects a string argument.",
        sourceLine: "@jump(123)",
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "@jump expects exactly 1 positional string argument.",
        sourceLine: '@jump("#known", "extra")',
      },
    ]);
  });

  it("reports invalid @wait arguments", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@wait()
@wait("500")
@wait(500, 100)
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
        message: "@wait expects exactly 1 positional number argument.",
        sourceLine: "@wait()",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 7,
        message: "@wait expects a number argument.",
        sourceLine: '@wait("500")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "@wait expects exactly 1 positional number argument.",
        sourceLine: "@wait(500, 100)",
      },
    ]);
  });

  it("reports invalid no-argument core commands", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@waitClick(1)
@page("x")
@stop("x")
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
        message: "@waitClick expects no arguments.",
        sourceLine: "@waitClick(1)",
      },
      {
        filePath: "scenario/main.tzr",
        line: 3,
        column: 1,
        message: "@page expects no arguments.",
        sourceLine: '@page("x")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 4,
        column: 1,
        message: "@stop expects no arguments.",
        sourceLine: '@stop("x")',
      },
    ]);
  });

  it("validates core command arguments inside @if branches", () => {
    const parsed = parseTzr(
      `#scene("prologue")
@if(flag("met_haruka"))
@wait("500")
@else
@page("x")
@endif
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
        line: 3,
        column: 7,
        message: "@wait expects a number argument.",
        sourceLine: '@wait("500")',
      },
      {
        filePath: "scenario/main.tzr",
        line: 5,
        column: 1,
        message: "@page expects no arguments.",
        sourceLine: '@page("x")',
      },
    ]);
  });
});
