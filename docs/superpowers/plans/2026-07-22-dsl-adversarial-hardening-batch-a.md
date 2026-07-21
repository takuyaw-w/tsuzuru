# DSL Adversarial Hardening Batch A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve `ADV-001` through `ADV-004` while preserving the public `parseTzr` / `compileTzr` API and the constrained v1 DSL boundary.

**Architecture:** Keep authoring-input defenses at the parser boundary, use a single internal numeric-literal helper from both parsers, and construct emitted records with own enumerable properties. Preserve deferred AST variants, but stop producing implicit `TextClickWait` nodes from blank source lines.

**Tech Stack:** TypeScript, Vitest, pnpm workspace, Vite plugin, Oxc formatter/linter.

## Global Constraints

- Treat `main` and the modern DSL under `packages/core/src` as the source of truth.
- Do not change the public parser/compiler function names or result shapes.
- Do not introduce legacy syntax, macros, presets, stages, or arbitrary JavaScript.
- Maximum condition nesting is exactly 128; depth 129 is rejected.
- Integer syntax must produce a safe integer; finite decimal syntax remains supported.
- Blank text-block lines are ignored and do not produce `TextClickWait`.
- Preserve the user's untracked review, brief, and backlog files until the documentation task intentionally updates the review and backlog.

---

## File Structure

- Create `packages/core/src/numeric-literal.ts`: shared source-number conversion and reason codes.
- Modify `packages/core/package.json`: include the built internal module in packed files.
- Modify `packages/core/src/parser.ts`: use shared numeric validation and ignore text-block blank lines.
- Modify `packages/core/src/condition-parser.ts`: use shared numeric validation and enforce nesting depth.
- Modify `packages/core/src/compiler.ts`: create prototype-safe compiled indexes.
- Modify `packages/core/src/project-compiler.ts`: make the user-keyed source-line map prototype-safe.
- Modify `packages/vite-plugin/src/index.ts`: reconstruct serialized documents with `JSON.parse`.
- Modify focused core parser/compiler/project tests and Vite plugin tests.
- Modify `docs/design/dsl-v2.md` and `docs/design/dsl-support-matrix.md`: document the stable behavior.
- Modify `docs/design/dsl-adversarial-review.md` and `docs/plans/dsl-adversarial-hardening.md`: mark Batch A resolved after implementation commits exist.

---

### Task 1: Prototype-safe compiled and project records

**Files:**

- Modify: `packages/core/tests/dsl-v2-compiler.test.ts`
- Modify: `packages/core/tests/dsl-v2-project-compiler.test.ts`
- Modify: `packages/vite-plugin/tests/vite-plugin.test.ts`
- Modify: `packages/core/src/compiler.ts`
- Modify: `packages/core/src/project-compiler.ts`

**Interfaces:**

- Consumes: existing `CompiledTzrDocument.scenes` and `TzrDocumentMetadata` record shapes.
- Produces: the same public record types with prototype-named own enumerable properties.

- [ ] **Step 1: Add failing core and project regression tests**

Add a compiler test that compiles and JSON-round-trips prototype-named IDs:

```ts
it("preserves prototype-named scene and character ids through JSON serialization", () => {
  const document = compile(`character __proto__ name="Prototype"
character constructor name="Constructor"
scene start:
  jump __proto__
scene __proto__:
  __proto__:
    Reached.
  jump constructor
scene constructor:
  end
`);
  const restored = JSON.parse(JSON.stringify(document)) as CompiledTzrDocument;

  expect(Object.keys(restored.scenes)).toEqual(["start", "__proto__", "constructor"]);
  expect(restored.scenes.__proto__).toMatchObject({ id: "__proto__" });
  expect(restored.metadata.characters.__proto__).toMatchObject({ id: "__proto__" });
  expect(restored.metadata.characters.constructor).toMatchObject({ id: "constructor" });
});
```

Add a project test using `__proto__` as a document ID so diagnostic source lookup cannot inherit from `Object.prototype`:

```ts
it("handles prototype-named project document ids", () => {
  const errors = expectProjectFailure([{ id: "__proto__", source: "scene start:\n  jump missing\n" }], "__proto__");
  expect(errors).toContainEqual(expect.objectContaining({ filePath: "__proto__", line: 2 }));
});
```

- [ ] **Step 2: Add the failing Vite serialization regression test**

```ts
it("preserves prototype-named ids in the generated ESM module", async () => {
  const root = await createTempRoot();
  const scenarioPath = await writeScenario(
    root,
    "scenario/main.tzr",
    'character __proto__ name="Prototype"\nscene __proto__:\n  end\n',
  );
  const result = await loadScenarioModule(tsuzuru(), root, scenarioPath);

  expect(Object.keys(result.document.scenes)).toContain("__proto__");
  expect(result.document.scenes.__proto__).toMatchObject({ id: "__proto__" });
  expect(result.document.metadata.characters.__proto__).toMatchObject({ id: "__proto__" });
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-compiler.test.ts dsl-v2-project-compiler.test.ts
rtk pnpm --filter @tsuzuru/vite-plugin test -- vite-plugin.test.ts
```

Expected: failures show missing `__proto__` own properties or invalid project source lookup.

- [ ] **Step 4: Build records from entries**

In `packages/core/src/compiler.ts`, replace property assignment with entry collection:

```ts
private buildMetadata(): TzrDocumentMetadata {
  const characters = Object.fromEntries(
    [...this.characters.values()].map((character) => [
      character.id,
      { id: character.id, name: character.name, loc: character.loc } satisfies TzrCompiledCharacter,
    ]),
  );
  const scenes = Object.fromEntries(
    [...this.scenes.values()].map((scene) => [
      scene.id,
      {
        id: scene.id,
        ...(scene.title === undefined ? {} : { title: scene.title }),
        loc: scene.loc,
      } satisfies TzrCompiledSceneMetadata,
    ]),
  );

  return { ...(this.title === undefined ? {} : { title: this.title.title }), characters, scenes };
}

function buildSceneIndexes(instructions: readonly TzrInstruction[]): Readonly<Record<string, DeclarationIndexEntry>> {
  return Object.fromEntries(
    instructions.flatMap((instruction, statementIndex) =>
      instruction.type === "SceneInstruction"
        ? [[instruction.id, { id: instruction.id, statementIndex, loc: instruction.loc } satisfies DeclarationIndexEntry]]
        : [],
    ),
  );
}
```

In `packages/core/src/project-compiler.ts`, initialize the source map without a prototype:

```ts
private readonly sourceLineMap = Object.create(null) as Record<string, readonly string[]>;
```

In `packages/vite-plugin/src/index.ts`, avoid evaluating serialized JSON as an
object literal because `__proto__` has special literal semantics:

```ts
const serializedDocument = JSON.stringify(result.document);
return {
  code: `const scenario = JSON.parse(${JSON.stringify(serializedDocument)});\nexport default scenario;\n`,
  map: null,
};
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the commands from Step 3. Expected: all selected core and Vite tests pass.

- [ ] **Step 6: Commit Task 1**

```sh
git add packages/core/src/compiler.ts packages/core/src/project-compiler.ts packages/core/tests/dsl-v2-compiler.test.ts packages/core/tests/dsl-v2-project-compiler.test.ts packages/vite-plugin/tests/vite-plugin.test.ts
git commit -m "fix(core): preserve prototype-named DSL identifiers"
```

---

### Task 2: Shared safe numeric-literal parsing

**Files:**

- Create: `packages/core/src/numeric-literal.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/parser.ts`
- Modify: `packages/core/src/condition-parser.ts`
- Modify: `packages/core/tests/dsl-v2-state-parser.test.ts`
- Modify: `packages/core/tests/dsl-v2-call-wait-parser.test.ts`
- Modify: `packages/core/tests/dsl-v2-condition-parser.test.ts`
- Modify: `packages/core/tests/dsl-v2-std-camera-parser.test.ts`

**Interfaces:**

- Produces: internal `parseTzrNumberLiteral(source: string): TzrNumberLiteralResult`.
- Consumes: exact raw numeric source and existing parser diagnostic facilities.

- [ ] **Step 1: Add failing boundary tests for state, calls, waits, and conditions**

Add assertions equivalent to:

```ts
it("accepts safe integer boundaries and rejects unsafe integer literals", () => {
  expect(parseSingleStatement("scene start:\n  set scenario.max = 9007199254740991\n")).toMatchObject({
    value: { value: Number.MAX_SAFE_INTEGER },
  });
  expect(expectStateFailure("scene start:\n  set scenario.max = 9007199254740992\n")).toContain(
    'Number literal "9007199254740992" is outside the safe integer range.',
  );
  expect(expectStateFailure(`scene start:\n  add scenario.max += ${"9".repeat(400)}\n`)).toContain(
    "must be finite",
  );
});
```

```ts
it("rejects unsafe numeric call arguments and wait durations", () => {
  expect(expectCallWaitFailure("scene start:\n  call inventory.add(count=9007199254740992)\n")).toContain(
    'Number literal "9007199254740992" is outside the safe integer range.',
  );
  expect(expectCallWaitFailure(`scene start:\n  wait ${"9".repeat(400)}\n`)).toContain("must be finite");
});
```

```ts
it("rejects unsafe and non-finite condition number literals", () => {
  expect(expectConditionFailure("scenario.score == 9007199254740992")).toContain(
    'Number literal "9007199254740992" is outside the safe integer range.',
  );
  expect(expectConditionFailure(`scenario.score == ${"9".repeat(400)}`)).toContain("must be finite");
  expect(parseCondition("scenario.zoom == 1.25")).toMatchObject({ right: { value: 1.25 } });
});
```

Add one representative standard-command test, such as camera `zoom=1.25` success and unsafe integer `duration` failure, to prove sugar uses the same path.

- [ ] **Step 2: Run focused parser tests and verify RED**

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-state-parser.test.ts dsl-v2-call-wait-parser.test.ts dsl-v2-condition-parser.test.ts dsl-v2-std-camera-parser.test.ts
```

Expected: unsafe integer cases currently parse successfully and overflow cases become `Infinity`.

- [ ] **Step 3: Create the shared numeric module**

Create `packages/core/src/numeric-literal.ts`:

```ts
export type TzrNumberLiteralResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: "non-finite" | "unsafe-integer" };

const INTEGER_LITERAL_PATTERN = /^-?\d+$/;

export function parseTzrNumberLiteral(source: string): TzrNumberLiteralResult {
  const value = Number(source);
  if (!Number.isFinite(value)) {
    return { ok: false, reason: "non-finite" };
  }
  if (INTEGER_LITERAL_PATTERN.test(source) && !Number.isSafeInteger(value)) {
    return { ok: false, reason: "unsafe-integer" };
  }
  return { ok: true, value };
}

export function describeTzrNumberLiteralError(source: string, reason: "non-finite" | "unsafe-integer"): string {
  return reason === "non-finite"
    ? `Number literal "${source}" must be finite.`
    : `Number literal "${source}" is outside the safe integer range.`;
}
```

Add `dist/src/numeric-literal.*` to `packages/core/package.json` so packed runtime imports resolve.

- [ ] **Step 4: Route every source `Number(...)` conversion through the helper**

Import the helper in both parsers. In `TzrParser`, add:

```ts
private parseNumberLiteral(line: SourceLine, source: string, sourceColumn: number): number | undefined {
  const result = parseTzrNumberLiteral(source);
  if (!result.ok) {
    this.addError(line, sourceColumn, describeTzrNumberLiteralError(source, result.reason));
    return undefined;
  }
  return result.value;
}
```

Use it from set, add, wait, generic arguments, coordinate placement, inline values, and text metadata. Each caller returns `undefined` after the helper emits a diagnostic. Replace `Number(attribute.value)` checks with a single validated value before applying feature-specific minimum constraints.

In `condition-parser.ts`, validate `raw` in `readNumberToken`; return a token-or-diagnostic result and append the diagnostic in `tokenizeConditionExpression` before continuing. The error location is the number token's first column.

- [ ] **Step 5: Prove no raw source conversion remains and verify GREEN**

```sh
rtk rg -n 'Number\(' packages/core/src/parser.ts packages/core/src/condition-parser.ts
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-state-parser.test.ts dsl-v2-call-wait-parser.test.ts dsl-v2-condition-parser.test.ts dsl-v2-std-camera-parser.test.ts
```

Expected: `rg` finds only conversions inside `numeric-literal.ts` or no matches in the two parsers; selected tests pass.

- [ ] **Step 6: Commit Task 2**

```sh
git add packages/core/package.json packages/core/src/numeric-literal.ts packages/core/src/parser.ts packages/core/src/condition-parser.ts packages/core/tests/dsl-v2-state-parser.test.ts packages/core/tests/dsl-v2-call-wait-parser.test.ts packages/core/tests/dsl-v2-condition-parser.test.ts packages/core/tests/dsl-v2-std-camera-parser.test.ts
git commit -m "fix(core): reject unsafe DSL number literals"
```

---

### Task 3: Bound condition recursion

**Files:**

- Modify: `packages/core/src/condition-parser.ts`
- Modify: `packages/core/tests/dsl-v2-condition-parser.test.ts`
- Modify: `packages/core/tests/dsl-v2-if-parser.test.ts`

**Interfaces:**

- Consumes: existing `TzrConditionParseResult` and embedded `if` parsing.
- Produces: source-located parse failures at depth 129 without uncaught exceptions.

- [ ] **Step 1: Add failing depth-boundary tests**

```ts
it("limits parenthesis and not nesting without throwing", () => {
  expect(parseTzrConditionExpression(`${"(".repeat(128)}scenario.flag${")".repeat(128)}`).ok).toBe(true);
  expect(expectConditionFailure(`${"(".repeat(129)}scenario.flag${")".repeat(129)}`)).toContain(
    "Condition expression nesting must not exceed 128 levels.",
  );
  expect(parseTzrConditionExpression(`${"not ".repeat(128)}scenario.flag`).ok).toBe(true);
  expect(expectConditionFailure(`${"not ".repeat(129)}scenario.flag`)).toContain(
    "Condition expression nesting must not exceed 128 levels.",
  );
});
```

Add an `if` parser test with 129 parentheses and assert `parseTzr` returns `ok: false` with the same message.

- [ ] **Step 2: Run tests and verify RED**

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-condition-parser.test.ts dsl-v2-if-parser.test.ts
```

Expected: depth 129 currently succeeds; a much deeper control assertion would throw `RangeError`.

- [ ] **Step 3: Add balanced recursion accounting**

In `condition-parser.ts`:

```ts
const MAX_CONDITION_NESTING = 128;

class TzrConditionExpressionParser {
  private nestingDepth = 0;

  private enterNesting(location: SourceLocation): boolean {
    this.nestingDepth += 1;
    if (this.nestingDepth <= MAX_CONDITION_NESTING) return true;
    this.addError(location, `Condition expression nesting must not exceed ${MAX_CONDITION_NESTING} levels.`);
    this.nestingDepth -= 1;
    return false;
  }

  private leaveNesting(): void {
    this.nestingDepth -= 1;
  }
}
```

Call `enterNesting` before recursively parsing a parenthesized or unary-`not` expression and always call `leaveNesting` after the recursive call returns. If entry fails, return `undefined` immediately. Do not expose the limit as public configuration.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass and no exception escapes.

- [ ] **Step 5: Commit Task 3**

```sh
git add packages/core/src/condition-parser.ts packages/core/tests/dsl-v2-condition-parser.test.ts packages/core/tests/dsl-v2-if-parser.test.ts
git commit -m "fix(core): bound DSL condition nesting"
```

---

### Task 4: Ignore blank text-block lines

**Files:**

- Modify: `packages/core/tests/dsl-v2-parser.test.ts`
- Modify: `packages/core/tests/dsl-v2-compiler.test.ts`
- Modify: `packages/core/src/parser.ts`

**Interfaces:**

- Consumes: physical blank lines inside narration, explicit dialogue, and shorthand dialogue.
- Produces: only `TextLine` nodes for those sources; keeps the `TextClickWait` AST type for programmatic documents.

- [ ] **Step 1: Replace click-wait parser expectations with ignored-whitespace expectations**

```ts
it("ignores blank lines inside text blocks", () => {
  const result = parseTzr(`scene start:
  narration:

    First.


    Second.

  end
`);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected parser success");
  expect(result.document.declarations[0]).toMatchObject({
    body: [{ type: "NarrationStatement", lines: [{ type: "TextLine", text: "First." }, { type: "TextLine", text: "Second." }] }],
  });
});
```

Update mixed parser fixtures so their expected arrays no longer contain `TextClickWait`. Add the same assertion for CRLF source.

- [ ] **Step 2: Replace the compiler rejection test with successful paragraph compilation**

```ts
it("compiles narration containing paragraph blank lines", () => {
  const document = compile(`scene start:
  narration:
    First.

    Second.
`);
  expect(document.instructions).toContainEqual(
    expect.objectContaining({ type: "NarrationInstruction", lines: [{ text: "First." }, { text: "Second." }] }),
  );
});
```

- [ ] **Step 3: Run tests and verify RED**

```sh
rtk pnpm --filter @tsuzuru/core test -- dsl-v2-parser.test.ts dsl-v2-compiler.test.ts
```

Expected: parser still produces `TextClickWait`, and compile still rejects the blank line.

- [ ] **Step 4: Ignore blank lines during collection**

In `collectTextBlock`, replace the current blank-line branch with:

```ts
if (this.isIgnorable(line)) {
  this.cursor += 1;
  continue;
}
```

Delete `findNextTextBlockLine` after confirming it has no callers. Do not remove `TzrTextClickWait` or the compiler's programmatic-AST rejection branch.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: selected tests pass for LF, CRLF, leading, internal, consecutive, and trailing blank lines.

- [ ] **Step 6: Commit Task 4**

```sh
git add packages/core/src/parser.ts packages/core/tests/dsl-v2-parser.test.ts packages/core/tests/dsl-v2-compiler.test.ts
git commit -m "fix(core): ignore blank text block lines"
```

---

### Task 5: Align design records and close Batch A

**Files:**

- Modify: `docs/design/dsl-v2.md`
- Modify: `docs/design/dsl-support-matrix.md`
- Modify: `docs/design/dsl-adversarial-review.md`
- Modify: `docs/plans/dsl-adversarial-hardening.md`

**Interfaces:**

- Consumes: implementation commit IDs from Tasks 1–4.
- Produces: current DSL documentation and resolved finding records.

- [ ] **Step 1: Update current DSL behavior**

Change the text-block documentation to state:

```md
Blank physical lines inside narration and dialogue blocks are ignored. They are
authoring whitespace and do not imply a click wait. Explicit page-break and
other rich text controls remain outside the stable subset.
```

Document numeric literals as finite numbers, with integer syntax limited to
`Number.MIN_SAFE_INTEGER` through `Number.MAX_SAFE_INTEGER`, and document the
128-level condition nesting limit as an implementation safety boundary.

- [ ] **Step 2: Update the support matrix and tracking documents**

Remove the parser-supported blank-line click-wait row or mark it unsupported
from source syntax while noting that the AST variant remains reserved. Check
`ADV-001` through `ADV-004` in the backlog. In the adversarial review, preserve
each finding, set `status: resolved`, and record the relevant implementation
commit ID and verification commands.

- [ ] **Step 3: Run docs consistency checks**

```sh
rtk rg -n 'blank-line click wait|blank line as click wait' docs packages/core/tests
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

Expected: no current-authoring claim says blank lines produce click waits; all checks exit successfully.

- [ ] **Step 4: Commit Task 5**

```sh
git add docs/design/dsl-v2.md docs/design/dsl-support-matrix.md docs/design/dsl-adversarial-review.md docs/plans/dsl-adversarial-hardening.md
git commit -m "docs: close DSL adversarial hardening batch A"
```

---

### Task 6: Full verification

**Files:** None unless a verification failure reveals an in-scope defect.

**Interfaces:** Validates the full public and package surface affected by Batch A.

- [ ] **Step 1: Run focused package checks**

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm --filter @tsuzuru/vite-plugin test
rtk pnpm --filter @tsuzuru/vite-plugin typecheck
```

- [ ] **Step 2: Run example integration checks**

```sh
rtk pnpm --filter @tsuzuru/example-preact-basic check:scenario
rtk pnpm --filter @tsuzuru/example-preact-basic build
rtk pnpm examples:check
```

- [ ] **Step 3: Run repository and release checks**

```sh
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk pnpm test
rtk pnpm typecheck
rtk pnpm release-readiness:check
rtk git diff --check
```

Expected: every command exits successfully with no test failures. If a command is skipped because it duplicates an already-completed release gate, record the exact skipped command and reason in the final report.

- [ ] **Step 4: Audit the final diff and requirements**

```sh
rtk git status --short --branch
rtk git diff HEAD~5 --stat
rtk git log -6 --oneline --decorate
```

Confirm all four findings have tests, RED evidence was observed, docs match behavior, and unrelated user files were not modified.
