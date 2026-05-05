# Legacy DSL cleanup plan

This document inventories the current legacy DSL surface before deleting,
moving, or reorganizing old DSL files. It is a planning document only.

Inventory context:

- Branch: `feature/new-dsl`
- Checked HEAD before this plan: `e076985ea41f1c8b37159048856db2689340ffb4`
- Existing public exports are intentionally unchanged by this plan.
- No legacy files should be deleted or moved until a later release decision.

## 1. Current legacy DSL inventory

### Parser

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/parser.ts` | legacy-only | Implements `parseTzr`, `ParseResult`, legacy line parser, `#scene(...)`, `#label(...)`, `:: Speaker`, `@command(...)`, `$macro(...)`, `?` choice, `@if` / `@else` / `@endif`, legacy jump target parsing. |
| `packages/core/src/diagnostic.ts` | shared runtime/IR | Used by both legacy parser/compiler and DSL v2 parser/compiler for diagnostics. Do not delete with legacy parser. |

### AST

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/ast.ts` legacy document/statement types | shared public API | `TzrDocument`, `TzrStatement`, `SceneDeclaration`, `LabelDeclaration`, `CommandStatement`, `MacroStatement`, `ChoiceBlock`, `IfBlock`, legacy `ConditionExpression`, and `JumpTarget` are legacy-facing and exported publicly. |
| `packages/core/src/ast.ts` shared primitives | shared runtime/IR | `SourceLocation`, `SourceRange`, `TextLine`, `TzrArgument`, and `TzrValue` are still used by shared IR, runtime events, DSL v2 AST/compiler, and command args. The file cannot be deleted wholesale without extracting these primitives first. |
| `packages/core/src/dsl-v2/ast.ts` imports from `../ast.js` | shared runtime/IR | DSL v2 AST currently reuses `SourceRange`; this creates a direct dependency on `ast.ts`. |

### Compiler

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/compiler.ts` `compileTzr` pipeline | legacy-only | Compiles `TzrDocument` to `CompiledTzrDocument`; validates duplicate labels/scenes, legacy jump and choice targets, core/plugin command args, macro expansion, and forbidden macro results. |
| `packages/core/src/compiler.ts` plugin command definitions | shared public API | `definePluginCommand`, `PluginCommandDefinition`, `PluginCommandArgumentSchema`, and related types are exported public API and used by plugin docs/tests. DSL v2 does not currently consume `CompileOptions`, so future ownership needs a decision. |
| `packages/core/src/commands.ts` | shared runtime/IR | Defines core command names and metadata used by legacy compiler and runtime command handling. DSL v2 compiles `set`, `wait`, and related behavior into shared command instructions. |

### Condition evaluator

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/condition.ts` | legacy-only | Evaluates legacy `ConditionExpression` for `IfInstruction`. DSL v2 uses `dsl-v2/condition-parser.ts` and `dsl-v2/condition-evaluator.ts` instead. Keep while legacy `IfInstruction` remains executable. |

### Macro support

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/macro.ts` | legacy-only | Expands legacy `MacroInstruction` through `compileTzr`. DSL v2 has no macro syntax or macro AST at this point. Public exports make removal a public API decision. |
| `MacroStatement` in `ast.ts` | legacy-only | Produced only by legacy `$macro(...)` syntax. |
| `MacroInstruction` in `ir.ts` | unclear / needs decision | Runtime treats it as unsupported, legacy compiler removes successful macros, tests and UI packages still cover unsupported rendering. Keep until macro public API policy is decided. |

### Runtime instructions still shared

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/ir.ts` | shared runtime/IR | Contains legacy and v2 IR in one union: `LabelInstruction`, `ChoiceInstruction`, `IfInstruction`, `MacroInstruction` are legacy-facing; `SceneJumpInstruction`, `BodyChoiceInstruction`, `V2IfInstruction`, `CommandInstruction`, `NarrationInstruction`, `DialogueInstruction`, and `RuntimeDocument` are shared by DSL v2/runtime. |
| `packages/core/src/runtime.ts` | shared runtime/IR | Executes both legacy and v2 instructions. Includes legacy label jump and choice handling plus v2 scene jump, body choice, and v2 if support. |
| `packages/core/src/runtime-control.ts` | shared runtime/IR | Contains legacy `stepIfInstruction` / `stepChoiceInstruction` and v2 `stepV2IfInstruction` / `stepBodyChoiceInstruction`. Imports both legacy and v2 condition evaluators. |
| `packages/core/src/runtime-commands.ts` | shared runtime/IR | Handles core commands used by legacy and instructions emitted by DSL v2, including internal `__tsuzuru_v2_add`. |
| `packages/core/src/runtime-types.ts` | shared runtime/IR | Runtime events/state are shared; `RuntimeChoiceItem` supports both target-label choices and body choices. Imports legacy `TextLine` from `ast.ts`. |
| `packages/core/src/runtime-snapshot.ts` | shared runtime/IR | Clones shared instructions, branch frames, pending choices, and body-choice item bodies. Required by DSL v2 runtime/save behavior. |
| `packages/core/src/runtime-args.ts` | shared runtime/IR | Reads `TzrArgument` values for runtime commands and plugin command handlers. |
| `packages/core/src/runtime-frames.ts` | shared runtime/IR | Shared branch-frame execution for legacy `IfInstruction` and v2 `V2IfInstruction`/body choices. |

### Tests

| Item | Classification | Notes |
|---|---|---|
| `packages/core/tests/parser.test.ts` | test-only | Legacy parser coverage for `parseTzr`, legacy commands, macros, choices, labels, and `@if`. |
| `packages/core/tests/compiler.test.ts` | test-only | Legacy compiler coverage for `compileTzr`, plugin command validation, macro expansion, label/choice validation, and forbidden macro output. |
| `packages/core/tests/condition.test.ts` | test-only | Legacy `evaluateCondition` coverage. |
| `packages/core/tests/runtime.test.ts` | test-only | Mostly legacy runtime coverage, but also covers shared runtime behavior that DSL v2 relies on. Split before deleting legacy tests. |
| `packages/core/tests/commands.test.ts` | test-only | Shared core command registry tests. |
| `packages/preact/tests/use-runtime.test.ts` | test-only | Uses legacy `parseTzr`/`compileTzr`; also verifies shared Preact adapter behavior. Needs migration or v2 companion tests later. |
| `packages/plugin-std-visual/tests/index.test.ts` | test-only | Uses legacy `parseTzr`/`compileTzr` to verify std visual plugin integration. |
| `packages/plugin-std-audio/tests/index.test.ts` | test-only | Uses legacy `parseTzr`/`compileTzr` to verify std audio plugin integration. |
| `packages/standard-ui-preact/tests/index.test.tsx` | test-only | Does not parse legacy DSL directly, but expects unsupported `MacroInstruction` display behavior. |

### Examples

| Item | Classification | Notes |
|---|---|---|
| `examples/basic` | legacy-only | Node example using `parseTzr`, `compileTzr`, `createInitialRuntimeState`, and `stepRuntime`. Migrate later or keep as legacy reference. |
| `examples/preact-basic` | legacy-only | Vite/Preact example using legacy parser/compiler plus `useRuntime` and `RuntimeView`. |
| `examples/preact-std-visual` | legacy-only | Uses legacy syntax and `stdVisualPluginCommands`; keep until v2 std visual path is the recommended example. |
| `examples/preact-std-audio` | legacy-only | Uses legacy syntax and `stdAudioPluginCommands`; keep until v2 std audio path is the recommended example. |
| `examples/standard-ui-preact` | legacy-only | Uses legacy parser/compiler with standard UI package. Migration depends on standard UI accepting v2 compiled documents. |
| `examples/dsl-v2-basic` | shared runtime/IR | DSL v2-first runnable example using `parseTzrV2`, `compileTzrV2`, manual runtime stepping, visual/audio layers, and shared runtime state. |

### Docs

| Item | Classification | Notes |
|---|---|---|
| `README.md` | docs-only | Presents legacy `#scene` / `#label` / `@if` syntax as the main DSL. Update after plan review, not in this task. |
| `docs/dsl.md` | docs-only | Source of truth for current legacy DSL syntax. Should become a legacy reference or be replaced by DSL v2 docs after the v2 merge decision. |
| `docs/architecture.md` | docs-only | Uses `parseTzr`, `compileTzr`, `TzrDocument`, and legacy syntax in architecture flow. |
| `docs/runtime.md` | docs-only | Describes legacy label jumps and `compileTzr` plugin registration, while also covering shared runtime behavior. |
| `docs/plugin-api.md` | docs-only | Describes plugin command registration through legacy `compileTzr`. |
| `docs/macro-api.md` | docs-only | Legacy macro API reference. Keep as legacy reference while public macro exports exist. |
| `docs/plugins/std-visual.md` | docs-only | Shows `compileTzr` integration for std visual plugin. Needs v2-oriented update later. |
| `docs/plugins/std-audio.md` | docs-only | Shows `compileTzr` integration for std audio plugin. Needs v2-oriented update later. |
| `docs/roadmap.md` | docs-only | Contains legacy DSL examples and `parseTzr` loading guidance. |
| `docs/design/design/dsl-v2.md` | docs-only | DSL v2 design draft. Keep and reconcile with implemented v2 behavior. |
| `docs/plans/dsl-v2-compile-to-ir.md` | docs-only | Existing plan that documents legacy pipeline and v2 compile strategy. Keep as historical/implementation planning context. |
| `docs/decisions/*.md` | docs-only | ADRs contain legacy syntax examples as design rationale. Usually keep; add context only if they are confused with current syntax docs. |

### Public exports

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/index.ts` legacy parse/compile exports | shared public API | `parseTzr`, `compileTzr`, `ParseResult`, `CompileResult`, `CompileOptions`, and plugin command schema types are public. Do not remove in this branch. |
| `packages/core/src/index.ts` legacy AST exports | shared public API | `TzrDocument`, `TzrStatement`, `MacroStatement`, `IfBlock`, `ChoiceBlock`, `JumpTarget`, and legacy value/condition types are public. |
| `packages/core/src/index.ts` legacy/shared IR exports | shared public API | `CompiledTzrDocument`, `LabelInstruction`, `ChoiceInstruction`, `IfInstruction`, `MacroInstruction`, `CommandInstruction`, `TzrInstruction`, and runtime types are public. Some are legacy-only, some are shared. |
| `packages/core/src/index.ts` v2 exports | shared public API | `parseTzrV2`, `compileTzrV2`, `CompiledTzrV2Document`, `TzrV2*` types, and v2 condition helpers are already public. |

## 2. Current DSL v2 inventory

| Item | Classification | Notes |
|---|---|---|
| `packages/core/src/dsl-v2/parser.ts` | legacy-independent v2 | Exports `parseTzrV2`; parses indentation-based v2 syntax. |
| `packages/core/src/dsl-v2/compiler.ts` | legacy-independent v2 plus shared IR | Exports `compileTzrV2`; compiles v2 AST to shared `RuntimeDocument`/`TzrInstruction` shapes. |
| `packages/core/src/dsl-v2/ast.ts` | v2 AST | Exports `TzrV2Document`, `TzrV2SceneStatement`, condition/value/text/std visual/audio/system statement types. Imports shared `SourceRange`. |
| `packages/core/src/dsl-v2/condition-parser.ts` | v2 condition parser | Exports `parseTzrV2ConditionExpression`. |
| `packages/core/src/dsl-v2/condition-evaluator.ts` | v2 condition evaluator | Used by runtime-control for `V2IfInstruction` and conditional body choices. |
| `packages/core/src/dsl-v2/index.ts` | v2 public surface | Re-exports v2 parser/compiler/AST/condition APIs into root `index.ts`. |
| `packages/core/tests/dsl-v2-*.test.ts` | v2 tests | Parser, compiler, runtime, conditions, choices, if, state, inline text, std visual/audio/system coverage. |
| `examples/dsl-v2-basic` | v2 example | Runnable Vite/Preact example using `parseTzrV2`, `compileTzrV2`, manual runtime, scene/narration/dialogue/end, scene jumps, choices, conditional choices, if, set/add, std visual/audio compile output. |

## 3. Shared components that must not be deleted accidentally

Do not delete these as part of a legacy cleanup unless the v2 replacement is already in place:

| File | Why it is shared |
|---|---|
| `packages/core/src/ir.ts` | Shared `RuntimeDocument`, `TzrInstruction`, narration/dialogue/command/scene/body-choice/v2-if instructions. Also still contains legacy instructions. |
| `packages/core/src/runtime.ts` | Single runtime executor for both legacy compiled documents and v2 compiled documents. |
| `packages/core/src/runtime-control.ts` | Shared branch and choice runtime logic; contains both legacy and v2 handlers. |
| `packages/core/src/runtime-commands.ts` | Shared core command execution, plugin command dispatch, and DSL v2 internal add command. |
| `packages/core/src/runtime-types.ts` | Shared runtime state, events, pending choice/wait, plugin handler APIs, snapshots. |
| `packages/core/src/runtime-snapshot.ts` | Shared snapshot cloning for branch frames and body choices. |
| `packages/core/src/runtime-frames.ts` | Shared branch-frame execution support. |
| `packages/core/src/runtime-args.ts` | Shared command argument readers for core and plugin command execution. |
| `packages/core/src/diagnostic.ts` | Shared diagnostic model for legacy and v2 parsers/compilers. |
| `packages/core/src/commands.ts` | Shared command registry and runtime command identity. |
| `packages/core/src/ast.ts` | Mixed: legacy AST plus shared primitives. Extract primitives before deleting legacy AST. |
| `packages/core/src/compiler.ts` | Mixed: legacy compiler plus public plugin command definition/schema types. Decide API ownership before moving/removing. |
| `packages/core/src/macro.ts` | Legacy-only behavior but public macro API. Removing it is a public API break. |
| `packages/core/src/condition.ts` | Legacy-only evaluator, but required while runtime still supports `IfInstruction`. |

## 4. Public API impact

Legacy-facing root exports from `packages/core/src/index.ts` include:

- Parser/compiler: `parseTzr`, `compileTzr`, `ParseResult`, `CompileResult`, `CompileOptions`.
- Legacy AST: `TzrDocument`, `TzrStatement`, `SceneDeclaration`, `LabelDeclaration`, `NarrationBlock`, `SpeakerBlock`, `CommandStatement`, `MacroStatement`, `ChoiceBlock`, `IfBlock`, `ChoiceItem`, `JumpTarget`, legacy condition/value/argument types.
- Legacy/shared compiler APIs: `definePluginCommand`, `PluginCommandDefinition`, `PluginCommandMap`, `PluginCommandArgumentSchema`, and related plugin command schema types.
- Legacy/shared IR: `CompiledTzrDocument`, `LabelInstruction`, `ChoiceInstruction`, `IfInstruction`, `MacroInstruction`, `CommandInstruction`, `SceneInstruction`, `NarrationInstruction`, `DialogueInstruction`, `TzrInstruction`, `RuntimeDocument`.
- Macro API: `MacroContext`, `MacroDefinition`, `MacroEntry`, `MacroExpandFunction`, `MacroMap`, `expandMacro`.
- Legacy condition API: `evaluateCondition`.

V2-facing root exports include:

- Parser/compiler: `parseTzrV2`, `compileTzrV2`, `parseTzrV2ConditionExpression`.
- V2 compiled output: `CompiledTzrV2Document`, `TzrV2CompileOptions`, `TzrV2CompileResult`, `TzrV2DocumentMetadata`, `TzrV2CompiledCharacter`, `TzrV2CompiledSceneMetadata`.
- V2 AST/types: `TzrV2Document`, `TzrV2TopLevelDeclaration`, `TzrV2SceneDeclaration`, `TzrV2SceneStatement`, `TzrV2NarrationStatement`, `TzrV2DialogueStatement`, `TzrV2ChoiceStatement`, `TzrV2IfStatement`, `TzrV2SetStatement`, `TzrV2AddStatement`, `TzrV2BgStatement`, `TzrV2ShowStatement`, `TzrV2HideStatement`, `TzrV2BgmStatement`, `TzrV2StopBgmStatement`, `TzrV2SeStatement`, `TzrV2VoiceStatement`, condition/value/text/inline/std system types.
- Shared v2 runtime IR: `SceneJumpInstruction`, `BodyChoiceInstruction`, `BodyChoiceInstructionItem`, `V2IfInstruction`, `V2ElifInstructionBranch`.

Impact:

- Removing `parseTzr` or `compileTzr` would break current examples, Preact tests, std plugin tests, docs, and any external users of the v0.1 API.
- Moving implementation files can preserve public exports if `index.ts` keeps re-exporting the same names, but internal imports and package tests must be updated carefully.
- Removing legacy AST exports is a public API break even if runtime keeps working.
- `CompiledTzrDocument` and `CompiledTzrV2Document` are separate public document types. Do not collapse them until release policy is decided.

## 5. Existing examples impact

| Example | Current parser/compiler | Runtime integration | Classification | Suggested action |
|---|---|---|---|---|
| `examples/basic` | `parseTzr` / `compileTzr` | Manually wired `createInitialRuntimeState` / `stepRuntime` | migrate later | Replace or mark as legacy after v2 CLI/basic example exists. |
| `examples/preact-basic` | `parseTzr` / `compileTzr` | `@tsuzuru/preact` `useRuntime` and `RuntimeView` | migrate later | Migrate after Preact adapter accepts v2 compiled documents in examples. |
| `examples/preact-std-visual` | `parseTzr` / `compileTzr` | `useRuntime`, `RuntimeView`, std visual handlers | replace later | Replace with v2 visual sugar example or fold into `dsl-v2-basic`. |
| `examples/preact-std-audio` | `parseTzr` / `compileTzr` | `useRuntime`, `RuntimeView`, std audio handlers | replace later | Replace with v2 audio sugar example or fold into `dsl-v2-basic`. |
| `examples/standard-ui-preact` | `parseTzr` / `compileTzr` | `useRuntime` plus standard UI package | migrate later | Migrate once standard UI v2 scenario contract is decided. |
| `examples/dsl-v2-basic` | `parseTzrV2` / `compileTzrV2` | Manually wired runtime with visual/audio layers | keep unchanged | Keep as the current v2 runnable proof. |

## 6. Existing docs impact

| Doc | Current state | Classification | Suggested action |
|---|---|---|---|
| `README.md` | Presents legacy DSL as the main user-facing syntax. | update immediately | After this plan is reviewed, add wording that legacy syntax is deprecated/legacy and DSL v2 is the recommended direction. |
| `docs/dsl.md` | Legacy DSL source of truth. | keep as legacy reference | Rename or banner later; do not change in this task. |
| `docs/design/design/dsl-v2.md` | DSL v2 design draft. | update after v2 merge | Reconcile draft status and implemented subset after v2 stabilization. |
| `docs/plans/dsl-v2-compile-to-ir.md` | Historical v2 compile plan. | keep as legacy/v2 planning reference | Keep; optionally mark completed sections later. |
| `docs/architecture.md` | Architecture uses legacy parse/compile flow. | update after v2 merge | Update pipeline diagrams and document dual parse/compile period. |
| `docs/runtime.md` | Mixes shared runtime with legacy label-jump docs. | update after v2 merge | Add v2 scene jump/body choice notes and distinguish legacy label jumps. |
| `docs/plugin-api.md` | Uses `compileTzr` plugin registration model. | update after v2 merge | Decide how plugin command validation should work for v2 first. |
| `docs/macro-api.md` | Describes `$macro(...)` and legacy macro APIs. | keep as legacy reference | Keep while macro public exports remain; mark legacy/deprecated later. |
| `docs/plugins/std-visual.md` | Shows legacy `compileTzr` integration. | update after v2 merge | Add v2 visual sugar integration path. |
| `docs/plugins/std-audio.md` | Shows legacy `compileTzr` integration. | update after v2 merge | Add v2 audio sugar integration path. |
| `docs/roadmap.md` | Contains legacy syntax and `parseTzr` guidance. | update after v2 merge | Align roadmap with v2-first release plan. |
| `docs/decisions/*.md` | ADRs contain legacy syntax examples. | keep as legacy reference | Keep historical decisions; only add notes if needed to avoid confusion. |

## 7. Cleanup strategy options

### Option A: Keep legacy DSL fully until v1.0 and mark it deprecated

Benefits:

- Lowest short-term breakage risk.
- Keeps current examples, docs, Preact tests, and plugin tests passing while DSL v2 stabilizes.
- Allows users of v0.1 public API to migrate intentionally.

Risks:

- Maintains two DSL surfaces longer.
- Docs must be clear so legacy syntax does not look like the recommended path.
- Runtime/IR remains mixed until later cleanup.

Estimated work: small for deprecation notes; medium ongoing maintenance.

Recommended timing: now through `feature/new-dsl` stabilization.

### Option B: Move legacy DSL into `packages/core/src/legacy/` but keep public exports

Benefits:

- Clarifies ownership and reduces accidental mixing.
- Preserves public API if root exports stay the same.
- Makes later removal easier.

Risks:

- Mechanical import churn across compiler/parser/tests/docs.
- `ast.ts` and `compiler.ts` contain shared primitives/public plugin types, so extraction must happen first.
- Easy to break public declarations if the move is rushed.

Estimated work: medium.

Recommended timing: after examples/docs are v2-first and after shared primitives are extracted.

### Option C: Remove legacy DSL before v1.0 and make DSL v2 the only DSL

Benefits:

- Simplest long-term product story.
- Removes mixed IR/runtime legacy paths sooner.
- Avoids stabilizing a legacy syntax publicly.

Risks:

- Immediate public API break for `parseTzr`, `compileTzr`, legacy AST/macro types, and current examples.
- Requires migrating Preact tests, plugin tests, standard UI tests, examples, README, and docs first.
- May block stabilization if v2 still needs API and docs polish.

Estimated work: large.

Recommended timing: only at a v1.0 release gate after explicit public API policy.

### Option D: Keep legacy parser/compiler as internal tests only and remove public exports later

Benefits:

- Lets the codebase keep regression coverage for runtime compatibility while moving users to v2.
- Creates a staged path to remove public exports without deleting code immediately.
- Can be paired with Option B.

Risks:

- Internal-only APIs can still create maintenance burden.
- Requires a clear package export policy and docs messaging.
- If external users already rely on legacy exports, removal still needs a release note/migration path.

Estimated work: medium.

Recommended timing: after README/docs/examples are v2-first and before final v1.0 API freeze.

## 8. Recommended policy

Recommendation:

- Do not delete legacy DSL immediately.
- Mark legacy DSL as deprecated/legacy in docs and internal comments after this plan is reviewed.
- Keep `parseTzr` and `compileTzr` during `feature/new-dsl` stabilization.
- Keep runtime shared components intact until v2 examples, tests, and docs no longer depend on legacy-only paths.
- After examples and docs move to DSL v2, decide whether to remove legacy DSL or move it under `src/legacy/` before v1.0.
- Avoid breaking public exports inside this branch until final release planning.

## 9. Proposed phased cleanup plan

### Phase 1: Inventory and document legacy DSL surface

Status: this document.

Deliverables:

- Inventory legacy parser, AST, compiler, condition, macro, runtime IR, tests, examples, docs, and public exports.
- Identify shared files that must not be deleted accidentally.

### Phase 2: Add deprecation notes/comments

Deliverables:

- Add docs banners to `docs/dsl.md`, `docs/macro-api.md`, and relevant README sections.
- Add small comments near `parseTzr` and `compileTzr` noting legacy status.
- No behavior changes.

### Phase 3: Move examples toward DSL v2

Deliverables:

- Keep `examples/dsl-v2-basic` as the v2-first runnable example.
- Add or migrate Preact adapter examples to use `parseTzrV2` / `compileTzrV2`.
- Decide which legacy examples remain as compatibility references.

### Phase 4: Update README to present DSL v2 as recommended syntax

Deliverables:

- README quickstart and syntax examples should point to DSL v2.
- Legacy syntax should be explicitly marked as legacy/deprecated if still exported.

### Phase 5: Decide public API policy

Options:

- Keep `parseTzr` / `compileTzr` as legacy APIs.
- Rename to `parseLegacyTzr` / `compileLegacyTzr` and keep compatibility aliases for a defined period.
- Remove legacy exports in v1.0.

Decision inputs:

- External compatibility expectations.
- Whether v1.0 should include any deprecated APIs.
- How plugin command validation should work for DSL v2.

### Phase 6: Optionally move legacy implementation under `src/legacy/`

Prerequisites:

- Shared primitives extracted from `ast.ts`.
- Public plugin command definitions either extracted from `compiler.ts` or explicitly kept in legacy.
- Tests updated without changing public exports.

### Phase 7: Final removal decision before v1.0 release gate

Release gate questions:

- Are all recommended examples on DSL v2?
- Does README describe DSL v2 as the main syntax?
- Are public exports intentionally stable?
- Are legacy docs either removed, archived, or clearly marked legacy?

## 10. Concrete next task recommendation

Immediate next task after this plan is reviewed:

- Add legacy/deprecated comments and README/docs wording only.
- Do not delete code yet.
- Do not move files yet.
- Do not rename `parseTzr` / `compileTzr` yet.
- Do not change runtime/compiler behavior yet.

