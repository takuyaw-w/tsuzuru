# DSL v2 -> IR compile strategy plan

このドキュメントは `feature/new-dsl` 時点の DSL v2 parser / AST を、既存の runtime instruction model へ接続するための実装前設計メモである。

これは計画書であり、DSL v2 -> IR compiler の実装仕様を確定する正式な利用者向け仕様ではない。
この文書の追加では compiler / runtime / examples の挙動は変更しない。

確認時点の前提:

- branch: `feature/new-dsl`
- HEAD: `7c0b6abfd5ccfcfdb82640a57f9784a7cc01f022`
- DSL v2 parser は `parseTzrV2` と `TzrV2*` AST を public export 済み
- `compileTzr` は legacy DSL 用のまま維持する

用語:

- `compile-ready`: 既存 IR / runtime をほぼそのまま使ってコンパイルできる
- `parser-only`: AST と validation はあるが runtime 意味をまだ持たせない
- `runtime-change-required`: compiler 実装だけでは足りず、IR / runtime event / state / snapshot の変更が必要
- `deferred`: plugin package や別設計が揃うまで compile error とする

---

## 1. Current legacy compile pipeline

### 1.1 `parseTzr`

`packages/core/src/parser.ts` の `parseTzr(source, options)` は legacy `.tzr` を `TzrDocument` に変換する。

主な性質:

- line-oriented parser
- parser は AST と parse diagnostics の生成のみを行う
- unknown command / macro は parse error ではない
- jump target は parser 段階で `JumpTarget` に正規化される
- `@if(...)` は parser 段階で constrained `ConditionExpression` へ変換される

### 1.2 Legacy AST

`packages/core/src/ast.ts` の `TzrStatement` は次の union:

- `SceneDeclaration`
- `LabelDeclaration`
- `NarrationBlock`
- `SpeakerBlock`
- `CommandStatement`
- `MacroStatement`
- `ChoiceBlock`
- `IfBlock`

text は `TextLine[]` で、shape は `{ text, loc }` のみ。
rich text、inline event、text metadata は持たない。

### 1.3 `compileTzr`

`packages/core/src/compiler.ts` の `compileTzr(document, options)` は `TzrDocument` を `CompiledTzrDocument` に変換する。

現在の validation:

- plugin command registry の key/name consistency
- plugin command schema definition
- duplicate scene / label
- `#scene` / `#label` の if branch 内配置禁止
- same-file `@jump("#label")` / choice target の存在
- jump target shape
- core command arguments
- plugin command registration
- plugin command arguments
- unknown macro
- macro expansion result の禁止 instruction

### 1.4 `CompiledTzrDocument`

`packages/core/src/ir.ts` の `CompiledTzrDocument`:

```ts
{
  type: "CompiledTzrDocument";
  filePath: string;
  body: readonly TzrStatement[];
  instructions: readonly TzrInstruction[];
  labels: Record<string, DeclarationIndexEntry>;
  scenes: Record<string, DeclarationIndexEntry>;
}
```

runtime は実行時に主に `filePath`, `instructions`, `labels` を使う。
`scenes` は現状 index として作られているが、jump resolution には使われていない。
`body` は legacy AST 型なので、DSL v2 compiled document をそのまま入れるには型上の無理がある。

### 1.5 IR instruction types

既存 `TzrInstruction`:

- `SceneInstruction`
- `LabelInstruction`
- `NarrationInstruction`
- `DialogueInstruction`
- `CommandInstruction`
- `MacroInstruction`
- `ChoiceInstruction`
- `IfInstruction`

`CommandInstruction` は core command と plugin command の両方に使われる。
`ChoiceInstruction` は legacy choice 用で、各 item は jump target を持つだけで body は持たない。
`IfInstruction` は branch instruction list を持ち、runtime は branch frame で実行する。

### 1.6 Runtime expectations

`packages/core/src/runtime.ts` は `CompiledTzrDocument` と `RuntimeState` を受け取って `stepRuntime` する。

重要な前提:

- pointer は `{ filePath, instructionIndex }`
- `@jump` は `document.labels[label].statementIndex` へ移動する
- choice resolution も `targetLabel` を `document.labels` で引く
- branch 実行は `RuntimeBranchFrame[]` に nested instruction list を入れて進める
- pending state は `pendingChoice`, `pendingWait`, `isWaitingForClick`
- snapshot は pointer, variables, flags, plugins, branchFrames, pendingChoice, pendingWait, click wait を保存する

現在の runtime event:

- visible-ish: `scene`, `label`, `narration`, `dialogue`, `choice`
- control: `waitClick`, `page`, `wait`, `stop`, `jump`, `if`, `end`
- state / plugin / error: `state`, `pluginCommand`, `unsupported`, `error`

### 1.7 Plugin command flow

compile time:

- core command names は `commands.ts` の `CORE_COMMAND_NAMES`
- non-core command は `CompileOptions.pluginCommands` に登録されていないと compile error
- plugin command schema があれば args を validation する

runtime:

- core command は runtime が直接処理する
- non-core command は `RuntimeStepOptions.commandHandlers[name]` へ dispatch する
- handler がない場合は `unsupported` event
- plugin state は `runtimeState.plugins[pluginName]` に保存する

### 1.8 Macro handling

legacy DSL の `$macro(...)` は compile time expansion。
macro call は runtime IR に残さない。

現在の制約:

- unknown macro は compile error
- macro expansion の plugin command も registry/schema validation 対象
- macro は `SceneInstruction`, `LabelInstruction`, `IfInstruction`, `ChoiceInstruction`, `MacroInstruction`, `@jump` を返せない

DSL v2 parser には macro syntax / AST がないため、`compileTzrV2` 初期版では macro 対応を入れない。
将来入れる場合も、presentation shorthand に限定し、scene / choice / if / jump を生成させない。

---

## 2. DSL v2 AST inventory and compile strategy

### 2.1 Top-level declarations

| DSL v2 AST | Compile strategy | Status | Notes |
|---|---|---|---|
| `TitleDeclaration` | IR instruction にはしない。`CompiledTzrV2Document.metadata.title` に保存する | parser-only / compile-ready metadata | runtime behavior なし |
| `CharacterDeclaration` | IR instruction にはしない。`metadata.characters[id] = { name }` に保存する | compile-ready metadata | duplicate character id と dialogue speaker existence を compile validation する |
| `SceneDeclaration` | `SceneInstruction` を生成し、scene index を作る | runtime-change-required for scene jump | v2 に label はない。scene title は metadata に保存 |

### 2.2 Scene statements

| DSL v2 AST | Compile strategy | Status | Notes |
|---|---|---|---|
| `NarrationStatement` | plain text segment は `NarrationInstruction` | compile-ready subset | text controls / inline / meta は下記の通り分割または defer |
| `DialogueStatement` from `say` | plain text segment は `DialogueInstruction` | compile-ready subset | `speaker` は character id として扱う |
| shorthand dialogue | explicit `say` と同じ `DialogueInstruction` | compile-ready subset | `explicit` は compile 後に不要 |
| `TextLine` with only `InlineText` | `TextLine.text` を legacy `TextLine` に変換 | compile-ready | loc は source line の loc を維持 |
| `TextClickWait` | 直前 text segment を flush し、`CommandInstruction @waitClick()` を挿入 | compile-ready | blank line の page kept semantics に対応 |
| `TextPageBreak` | 直前 text segment を flush し、`CommandInstruction @page()` を挿入 | compile-ready | trailing `---` も `@page()` にできる |
| `TextBlockMeta` | rich text metadata として新 text model に保存 | runtime-change-required | 初期 compiler では meta がある block を compile error にするのが安全 |
| `InlineTextSpan` | rich text span として new text line shape に保存 | runtime-change-required | flatten すると styling semantics を失うため初期は reject |
| `InlineDelaySpan` | text reveal timing span として new text line shape に保存 | runtime-change-required | existing `TextLine` では表せない |
| `InlineWaitEvent` | text stream event として new text runtime support | runtime-change-required | separate `@wait` instruction へ単純展開すると mid-line ordering が壊れる |
| `InlineSeEvent` | text stream audio event として std-audio / renderer に渡す | runtime-change-required | statement-level `se` とは別に text stream 内 event が必要 |
| `InlineVoiceEvent` | text stream audio event として std-audio / renderer に渡す | runtime-change-required | voice playback policy は renderer/audio layer 側 |
| `JumpStatement` | scene target jump に変換 | runtime-change-required | existing runtime は labels lookup なので scene lookup support が必要 |
| `EndStatement` | 初期は `CommandInstruction @stop()` に変換 | compile-ready | `end` event と区別したい場合は後で `EndInstruction` を追加 |
| `ChoiceStatement` | body-bearing choice instruction に変換 | runtime-change-required | existing `ChoiceInstruction` は item body を持てない |
| conditional choice item | runtime が choice 表示時に condition evaluation して hide | runtime-change-required | compile-time filtering は不可 |
| `IfStatement` / `ElifBranch` / `elseBranch` | nested `IfInstruction` chain に変換、または v2 condition 対応 IfInstruction に変換 | runtime-change-required | existing condition evaluator は v2 condition AST 非対応 |
| `SetStatement` literal string/number/boolean | existing `@set(name, value)` へ変換可能 | compile-ready subset | variable name は full path `scenario.xxx` を使う |
| `SetStatement` null / variable ref | v2 state instruction または runtime value extension | runtime-change-required | existing `RuntimeValue` に null と reference evaluation がない |
| `AddStatement` | existing `@inc(name, by)` へ変換 | compile-ready | negative number も `@inc(..., by=-1)` で表せる |
| `CallStatement` static literal args | plugin `CommandInstruction` に変換 | compile-ready subset | command name は dotted name をそのまま使う |
| `CallStatement` null / variable ref args | runtime arg/value expression extension | runtime-change-required | existing plugin args は null / variable ref を扱えない |
| `WaitStatement` | app/event wait instruction に変換 | runtime-change-required | core `@wait(ms)` と衝突させない |
| `BgStatement` no transition | std-visual `bg` command | compile-ready if plugin registered | asset ref は string positional arg |
| `ShowStatement` named placement, no transition | std-visual `show` command | compile-ready if plugin registered | `position` named arg は `left/center/right` |
| `ShowStatement` coordinate placement | future std-visual command schema | deferred | current std-visual state は x/y を持たない |
| visual transition | future std-visual command schema | deferred | current plugin docs/source は transition を持たない |
| `HideStatement` no transition | std-visual `hide` command | compile-ready if plugin registered | asset ref は string positional arg |
| `ClearVisualStatement` | future `clearSprites` / `clearBg` command | deferred | current std-visual plugin に clear command がない |
| `BgmStatement` | std-audio `startBgm` command | compile-ready if plugin registered | DSL v2 `bgm` は plugin command `startBgm` に落とす |
| `StopBgmStatement` | std-audio `stopBgm` command | compile-ready if plugin registered | args なし |
| `SeStatement` | std-audio `se` command | compile-ready if plugin registered | asset ref は string positional arg |
| `VoiceStatement` | std-audio `voice` command | compile-ready if plugin registered | asset ref は string positional arg |
| `SystemUnlockStatement` | future std-system command | deferred | `@tsuzuru/plugin-std-system` package がまだない |

Small factual note:

- `docs/design/design/dsl-v2.md` は audio transition syntax を記載しているが、現在の parser / AST / tests は `bgm ... with fadeIn(...)` や `stopBgm with fadeOut(...)` を実装していない。
  この計画では「現在 parser が実装している audio sugar」のみを compile 対象にする。

---

## 3. Reuse vs extension decisions

### 3.1 Reuse existing IR instruction

| Feature | Existing IR |
|---|---|
| scene declaration | `SceneInstruction` |
| plain narration | `NarrationInstruction` |
| plain dialogue | `DialogueInstruction` |
| text click wait | `CommandInstruction` with `name: "waitClick"` |
| text page break | `CommandInstruction` with `name: "page"` |
| `end` initial behavior | `CommandInstruction` with `name: "stop"` |
| `add scenario.x += n` | `CommandInstruction` with `name: "inc"` |
| simple `set scenario.x = string/number/boolean` | `CommandInstruction` with `name: "set"` |
| statement-level plugin call | `CommandInstruction` for non-core plugin command |
| std-audio bare statements | `CommandInstruction` to existing std-audio commands |
| std-visual bare bg/show/hide subset | `CommandInstruction` to existing std-visual commands |

### 3.2 Compile to existing core command instruction

| DSL v2 feature | Core command target |
|---|---|
| `TextClickWait` | `@waitClick()` |
| `TextPageBreak` | `@page()` |
| `end` | `@stop()` initially |
| `set scenario.x = "a"` | `@set(name="scenario.x", value="a")` |
| `add scenario.x += 1` | `@inc(name="scenario.x", by=1)` |

`@jump` is core-owned but existing target resolution is label-only. v2 `jump sceneId` should still be core-owned, but needs scene target support before it is semantically correct.

### 3.3 Compile to plugin command instruction

| DSL v2 feature | Plugin command target |
|---|---|
| `call screen.open(id=notebook)` | command name `screen.open`, named arg `id: "notebook"` |
| `bg classroom` | `bg("classroom")` |
| `show mio.normal at center` | `show("mio.normal", position="center")` |
| `hide mio.normal` | `hide("mio.normal")` |
| `bgm daily_theme` | `startBgm("daily_theme")` |
| `stopBgm` | `stopBgm()` |
| `se doorOpen` | `se("doorOpen")` |
| `voice mio_001` | `voice("mio_001")` |
| `system.unlockEnding trueEnd` | future `system.unlockEnding(id="trueEnd")` |
| `system.unlockCg cg001` | future `system.unlockCg(id="cg001")` |
| `system.unlockAchievement firstClear` | future `system.unlockAchievement(id="firstClear")` |

### 3.4 Require new or extended IR/runtime model

| Feature | Required change |
|---|---|
| scene-target jump | runtime jump lookup must support `document.scenes` or a new target index |
| choice item bodies | `ChoiceInstruction` must support branch body instructions, or a new `BranchChoiceInstruction` must be added |
| conditional choice items | runtime must filter items against current state before emitting `choice` |
| choice item IDs | `RuntimeChoiceItem` should include optional `id` |
| v2 condition AST | new v2 evaluator or shared condition model |
| `elif` | compiler can lower to nested `IfInstruction`, but evaluator must support v2 conditions |
| `set null` | `RuntimeValue` and snapshot need null support, or v2 state instruction must handle it |
| `set` from variable reference | runtime value expression evaluation |
| `call` args with null / variable ref | plugin arg value model and schema validation extension |
| app `wait namespace.event(...)` | new wait instruction/event/pending state |
| `TextBlockMeta` | rich text metadata shape in runtime events |
| inline text spans/delay | rich text line model and renderer support |
| inline wait/se/voice | text stream events, not normal instruction expansion |
| visual coordinate placement | std-visual state/schema extension |
| visual transitions | std-visual schema/state/runtime/renderer extension |
| clear sprites/bg | std-visual command/state extension |
| system.* conditions | std-system plugin state resolver |

### 3.5 Defer compilation

Initial `compileTzrV2` should reject these with clear diagnostics:

- `TextBlockMeta`
- inline markup other than plain `InlineText`
- `set` to `null`
- `set` from `$scenario.*` / `$system.*`
- `call` args with `null` or variable references
- `wait namespace.event(...)`
- coordinate placement
- visual transitions
- `clear sprites` / `clear bg`
- `system.unlock*`
- `system.*` conditions unless std-system resolver support exists
- audio transitions, because parser does not implement them yet

This keeps the first compiler useful without pretending runtime can honor unsupported semantics.

---

## 4. Proposed compiler entry point

### 4.1 Options considered

#### `compileTzrV2(document)`

Pros:

- clear experimental boundary
- does not affect legacy `compileTzr`
- avoids syntax option branching in the existing compiler
- tests can target v2 without risking legacy regressions

Cons:

- public API grows
- compiled document type needs a decision

#### `compileTzr(document, { syntax: "v2" })`

Pros:

- one public compile entry point
- host code can eventually switch syntax through an option

Cons:

- existing `compileTzr` currently accepts `TzrDocument`, not `TzrV2Document`
- would mix two ASTs and two validation models in one compiler too early
- higher risk of legacy behavior changes

#### `parseTzrV2 + compileTzrV2` as experimental API

Pros:

- matches current `parseTzrV2` public export
- can be marked experimental in docs/API
- lets compiler and runtime extension proceed in phases
- keeps legacy compiler untouched

Cons:

- migration path later needs a unification decision

### 4.2 Recommendation

Prefer separate experimental entry points:

```ts
parseTzrV2(source, options)
compileTzrV2(document, options)
```

Do not replace or overload `compileTzr` until DSL v2 runtime semantics are stable.

Recommended result type:

```ts
type CompileTzrV2Result =
  | { ok: true; document: CompiledTzrV2Document; errors: [] }
  | { ok: false; errors: Diagnostic[] };
```

Recommended compiled document shape:

```ts
interface CompiledTzrV2Document {
  readonly type: "CompiledTzrV2Document";
  readonly syntax: "v2";
  readonly filePath: string;
  readonly source: TzrV2Document;
  readonly metadata: {
    readonly title?: string;
    readonly characters: Readonly<Record<string, { readonly id: string; readonly name: string }>>;
    readonly scenes: Readonly<Record<string, { readonly id: string; readonly title?: string }>>;
  };
  readonly instructions: readonly TzrInstruction[];
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
}
```

Runtime should eventually depend on a smaller structural document interface:

```ts
interface RuntimeInstructionDocument {
  readonly filePath: string;
  readonly instructions: readonly TzrInstruction[];
  readonly labels?: Readonly<Record<string, DeclarationIndexEntry>>;
  readonly scenes?: Readonly<Record<string, DeclarationIndexEntry>>;
}
```

This avoids forcing DSL v2 to fabricate a legacy `body: TzrStatement[]`.
The type split is a compile-time/API cleanup, not a behavior change by itself.

---

## 5. Scene / label model

### 5.1 Decision

DSL v2 has scenes, not labels.

- `scene id:` is the only same-file jump target declaration.
- `jump target` targets a scene id.
- choice item bodies do not target labels.
- v2 compiler should validate duplicate scene ids.
- v2 compiler should validate unknown scene jump targets.
- cross-file jumps remain out of scope because current v2 parser only accepts static `IDENT` jump targets.

### 5.2 Mapping to existing pointer/index model

Compile each `SceneDeclaration` to:

```txt
SceneInstruction(id)
compiled body instructions...
```

Build `document.scenes[id] = { id, statementIndex }`.

Do not create user-visible `LabelInstruction` for v2 scenes.
Avoid abusing `document.labels` as a scene target index because that makes runtime events and diagnostics lie about labels.

### 5.3 Runtime change required

Existing `@jump` and `resolveChoice` use `document.labels`.
v2 needs scene target support.

Recommended minimal extension:

- introduce an internal jump target kind: `scene`
- `JumpStatement target` compiles to a core jump command or jump instruction whose target kind is `scene`
- runtime resolves scene target through `document.scenes[target]`
- `JumpRuntimeEvent` should eventually expose target kind, for example:

```ts
{
  type: "jump",
  target: { type: "scene", id: "commonRoute" },
  instructionIndex: 12
}
```

Compatibility option:

- Keep `label` on `JumpRuntimeEvent` for legacy and add optional `scene` / `target`.
- Do not remove `label` until a major API cleanup.

### 5.4 Scene fallthrough

The v2 design treats scenes as primary control-flow units, but the existing runtime naturally falls through to the next instruction.

Recommended first implementation:

- do not insert hidden `stop` at every scene boundary
- compile only explicit `jump` and `end`
- add a compiler warning or later validation for non-final scenes whose body can fall through

Reason:

- automatic hidden `stop` / `jump` changes author-visible flow
- full control-flow termination analysis is separate work
- early compiler tests should focus on correct AST -> instruction lowering first

---

## 6. Text block compile strategy

### 6.1 Plain text segmentation

For blocks containing only `TextLine` with plain `InlineText`, compile to existing narration/dialogue instructions.

Example:

```txt
mio:
  First.

  Second.
  ---
  Third.
```

Initial lowering:

```txt
DialogueInstruction speaker=mio lines=[First.]
CommandInstruction waitClick
DialogueInstruction speaker=mio lines=[Second.]
CommandInstruction page
DialogueInstruction speaker=mio lines=[Third.]
```

Rules:

- flush the current text segment before `TextClickWait` or `TextPageBreak`
- do not emit empty narration/dialogue instructions
- preserve each source `loc`
- preserve `TextLine.text` exactly as parser produced it

### 6.2 `TextClickWait`

Map to existing core `@waitClick()`.

This matches current runtime:

- event: `{ type: "waitClick" }`
- state: `isWaitingForClick = true`
- host clears with `clearClickWait`

### 6.3 `TextPageBreak`

Map to existing core `@page()`.

This matches current runtime:

- event: `{ type: "page" }`
- state: `isWaitingForClick = true`
- host clears with `clearClickWait`

### 6.4 `TextBlockMeta`

Do not drop metadata silently.

Initial compiler should reject blocks with `meta`:

```txt
Text block metadata is parsed but not supported by compileTzrV2 yet.
```

Future runtime needs a richer text model, for example:

```ts
interface RichTextBlock {
  readonly meta?: TextBlockMeta;
  readonly lines: readonly RichTextLine[];
}
```

### 6.5 Inline spans and delay

Do not flatten styled text to plain text as the final strategy.
Flattening loses semantics and makes it hard for renderers to detect missing support.

Future strategy:

- extend narration/dialogue runtime event line shape to carry `inline`
- keep `text` as the plain concatenated text for fallback rendering
- add `inline` as optional data for rich renderers

Potential line shape:

```ts
interface RuntimeTextLine {
  readonly text: string;
  readonly inline?: readonly RuntimeInlineTextNode[];
  readonly loc: SourceRange;
}
```

### 6.6 Inline wait / se / voice

Inline events are part of the text stream.
They should not be compiled into separate top-level `CommandInstruction`s because mid-line ordering matters.

Example:

```txt
……えっと、{wait ms=500}ありがとう。
```

Separate instructions would either show the whole line too early or block before any part of the line renders.

Future strategy:

- runtime narration/dialogue event carries a text stream with event nodes
- renderer/text-reveal layer interprets `InlineWaitEvent`
- audio layer handles `InlineSeEvent` / `InlineVoiceEvent`
- save/load must record enough text reveal position if mid-line blocking becomes resumable

Initial compiler should reject inline nodes other than plain `InlineText`.

---

## 7. Choice compile strategy

### 7.1 Problem with existing `ChoiceInstruction`

Legacy choices are target-only:

```txt
? Question
- "Text" -> #label
```

DSL v2 choices are body-based:

```txt
choice "Question":
  "A":
    add scenario.score += 1
    jump next
```

Existing `ChoiceInstruction` cannot preserve the item body.

### 7.2 Recommendation

Extend choice IR rather than generating synthetic labels.

Recommended shape:

```ts
interface ChoiceInstruction {
  readonly type: "ChoiceInstruction";
  readonly question: string;
  readonly items: readonly ChoiceInstructionItem[];
  readonly loc: SourceRange;
}

type ChoiceInstructionItem =
  | {
      readonly kind: "target";
      readonly text: string;
      readonly target: JumpTarget;
      readonly loc: SourceRange;
    }
  | {
      readonly kind: "body";
      readonly text: string;
      readonly id?: string;
      readonly condition?: TzrV2ConditionExpression;
      readonly body: readonly TzrInstruction[];
      readonly loc: SourceRange;
    };
```

Legacy compiler can keep producing `kind: "target"`.
DSL v2 compiler produces `kind: "body"`.

Alternative is to add `BranchChoiceInstruction`.
That keeps legacy `ChoiceInstruction` untouched but adds another runtime case.
Either is acceptable; prefer extending `ChoiceInstruction` only if TypeScript migration remains small.

### 7.3 Runtime behavior

At `stepChoiceInstruction`:

1. Evaluate each conditional item against current runtime state.
2. Keep unconditional items and condition-true items.
3. Preserve original order.
4. Emit `choice` event with visible items only.
5. Store selected item execution data in `pendingChoice`.

At `resolveChoice`:

- for legacy target item: current label/scene target jump behavior
- for v2 body item: push item body as a branch frame and clear `pendingChoice`
- top-level pointer remains already advanced past the `ChoiceInstruction`
- if item body executes `jump`, existing jump behavior clears branch frames
- if item body falls through, runtime resumes after the choice

### 7.4 Choice item IDs

Preserve optional v2 item `id`.

Recommended `RuntimeChoiceItem` extension:

```ts
interface RuntimeChoiceItem {
  readonly id?: string;
  readonly text: string;
  readonly targetRaw?: string;
  readonly targetLabel?: string;
}
```

For v2 body choices, `targetRaw` / `targetLabel` may be absent.
The selected branch body should be stored in pending choice internals, not exposed as UI data.

### 7.5 Conditional choice filtering

Filtering must happen at runtime, not compile time.

Reason:

- conditions depend on runtime `scenario.*` and `system.*` state
- save/load must preserve what the player saw at the pending choice moment

If all items are filtered out, runtime should not create an unresolvable pending choice.
Recommended behavior:

- return `RuntimeErrorEvent` with code such as `choice_no_available_items`
- leave state unblocked or stopped according to the final runtime design

This requires adding a runtime error code.

---

## 8. Condition compile/evaluation strategy

### 8.1 Existing condition evaluator is not sufficient

Current legacy `evaluateCondition` supports:

- `flag("name")`
- `!flag("name")`
- `var("name") OP literal`

DSL v2 condition AST supports:

- `scenario.*`
- `system.*`
- string / number / boolean / null literals
- `==`, `!=`, `>=`, `<=`, `>`, `<`
- `and`, `or`, `not`
- parentheses
- literal-to-literal comparison
- boolean reference shorthand

Therefore a new v2 condition evaluator is required.

### 8.2 Runtime state mapping

Recommended mapping:

- store v2 scenario variables in `state.variables` using the full path key, including root
- example: `scenario.mio.trust` -> `state.variables["scenario.mio.trust"]`

Reasons:

- avoids collision with legacy variable names
- preserves namespace in diagnostics and events
- keeps `RuntimeVariables` flat and snapshot-friendly

### 8.3 `scenario.*`

`ConditionReference` with root `scenario` evaluates as:

```ts
state.variables[expression.path] === true
```

Comparisons read:

```ts
state.variables[path]
```

Type policy:

- equality supports same-type comparison
- `null` support requires `RuntimeValue` extension
- ordering operators require both operands to be numbers
- missing variables evaluate false for boolean shorthand and false for comparisons, except `== null` can be defined later if null/missing distinction is needed

### 8.4 `system.*`

`system.*` cannot be evaluated correctly until std-system exists.

Initial compiler should reject `system.*` conditions unless an explicit compile option or registered system resolver exists.

Future strategy:

- std-system owns persistent system state
- core condition evaluator receives a resolver callback, for example:

```ts
resolveSystemValue(path: string, state: RuntimeState): RuntimeValue | null | undefined
```

Do not let core know std-system's internal state shape directly.

### 8.5 `if / elif / else`

Compiler can lower `elif` to nested `IfInstruction`:

```txt
if A:
  ...
elif B:
  ...
else:
  ...
```

becomes:

```txt
If(A, then, else=[If(B, then, else)])
```

But existing `IfInstruction.conditionExpression` is legacy `ConditionExpression`.
Either:

1. widen `IfInstruction.conditionExpression` to a shared condition union, or
2. add `V2IfInstruction`.

Recommendation:

- use a shared condition abstraction only if legacy evaluator can remain untouched
- otherwise add `V2IfInstruction` first, then consolidate later

---

## 9. State compile strategy

### 9.1 `set scenario.*`

For string / number / boolean literals, compile to existing core command:

```txt
set scenario.route.current = "common"
```

lowers to:

```txt
@set(name="scenario.route.current", value="common")
```

For `null`, existing `RuntimeValue` is insufficient.
Do not coerce `null` to string `"null"`.

For variable references:

```txt
set scenario.currentVoice = $scenario.nextVoice
```

requires runtime value expression evaluation.
Do not evaluate at compile time.

Recommended future state instruction:

```ts
interface SetStateInstruction {
  readonly type: "SetStateInstruction";
  readonly target: string;
  readonly value: TzrV2ValueExpression;
  readonly loc: SourceRange;
}
```

This avoids forcing variable references into legacy `TzrValue`.

### 9.2 `add scenario.*`

Compile to existing `@inc`:

```txt
add scenario.mio.trust += -1
```

lowers to:

```txt
@inc(name="scenario.mio.trust", by=-1)
```

No new runtime behavior is needed because current `@inc` adds to existing number or treats missing/non-number as `0`.
If v2 should reject add on non-number at runtime, that is a later stricter semantics change.

### 9.3 `system.*` mutation

Parser already rejects direct `set system.*` and `add system.*`.
Compiler should keep that invariant and may add defensive validation.

System mutation must go through `system.unlock*` sugar or `call system.*`.

---

## 10. `call` / `wait` compile strategy

### 10.1 `call`

Compile `CallStatement` to plugin `CommandInstruction` with the same dotted name:

```txt
call screen.open(id=notebook)
```

lowers to:

```txt
CommandInstruction name="screen.open" args=[id="notebook"]
```

Argument conversion for compile-ready subset:

- `StringValue` -> legacy `StringValue`
- `NumberValue` -> legacy `NumberValue`
- `BooleanValue` -> legacy `BooleanValue`
- `IdentifierValue` / dotted identifier -> legacy `StringValue`

Reason:

- DSL v2 value rules define bare identifiers as string-like asset/action IDs
- legacy `IdentifierValue` does not support dotted identifiers
- plugin schemas for current std plugins expect strings

Deferred args:

- `NullValue`
- `VariableReferenceValue`

These require either an extended plugin argument model or runtime expression evaluation before handler dispatch.

### 10.2 Plugin command schema validation

Existing `PluginCommandMap` can use dotted command names because it is a string-keyed record.
No parser restriction applies after DSL v2 compile.

For initial compiler:

- require `options.pluginCommands[name]` for `call`
- reuse existing plugin command validation where argument values can be converted to legacy values
- reject unsupported v2 values before schema validation

### 10.3 `wait namespace.event(...)`

Do not compile app/event wait to core `@wait(ms)`.
The names collide conceptually but have different semantics.

Required runtime model:

```ts
interface AppWaitInstruction {
  readonly type: "AppWaitInstruction";
  readonly name: string;
  readonly args: readonly RuntimeNamedArgument[];
  readonly loc: SourceRange;
}
```

or:

```ts
interface RuntimePendingWait {
  readonly kind: "duration" | "app";
}
```

Current `pendingWait` only stores `{ durationMs }`.
`wait screen.closed(id=notebook)` needs at least:

- event name
- args
- a host-owned way to clear/resolve it
- snapshot representation

Initial compiler should reject `WaitStatement` with a clear deferred diagnostic.

---

## 11. std visual / audio / system sugar compile strategy

### 11.1 std-visual

Current `@tsuzuru/plugin-std-visual` commands:

- `bg`
- `show`
- `hide`

Current plugin does not support:

- `clear sprites`
- `clear bg`
- transition
- coordinate placement

Compile-ready subset:

```txt
bg classroom
  -> bg("classroom")

show mio.normal at center
  -> show("mio.normal", position="center")

hide mio.normal
  -> hide("mio.normal")
```

Future command targets:

```txt
clear sprites
  -> clearSprites()

clear bg
  -> clearBg()

bg classroom with fade(duration=300)
  -> bg("classroom", transition="fade", duration=300)

show mio.normal at x=320 y=80
  -> show("mio.normal", x=320, y=80)
```

These require std-visual package changes before compiler support should be enabled.

### 11.2 std-audio

Current `@tsuzuru/plugin-std-audio` commands:

- `startBgm`
- `stopBgm`
- `se`
- `voice`

Compile mapping:

```txt
bgm rainLoop
  -> startBgm("rainLoop")

stopBgm
  -> stopBgm()

se doorOpen
  -> se("doorOpen")

voice mio_001
  -> voice("mio_001")
```

Parser currently does not implement audio transitions.
Do not plan compiler support for audio transition until parser/AST and std-audio plugin both support it.

### 11.3 std-system

There is no `@tsuzuru/plugin-std-system` package in the current workspace.

Future command targets:

```txt
system.unlockEnding trueEnd
  -> system.unlockEnding(id="trueEnd")

system.unlockCg cg001
  -> system.unlockCg(id="cg001")

system.unlockAchievement firstClear
  -> system.unlockAchievement(id="firstClear")
```

Initial compiler should reject `SystemUnlockStatement` as deferred unless std-system command definitions are introduced.

For `system.*` conditions:

- compile validation should require std-system support
- runtime evaluation should go through a resolver/callback, not hard-coded core access

---

## 12. Save/load implications

Do not implement save/load changes in the first design task.
The following impacts must be handled before DSL v2 runtime support is considered complete.

### 12.1 Conditional choice filtering

If filtering happens at choice emission time, `pendingChoice` snapshot should preserve the visible item list and item IDs exactly as shown.

Risk:

- after load, re-evaluating conditions could show different choices than the player originally saw

Recommendation:

- store filtered pending choices in snapshot
- include enough selected-item execution data or source instruction identity to resolve after restore

### 12.2 Choice item body instructions

If pending choice stores body instructions, snapshots remain JSON-serializable but can become larger.
This is consistent with current `branchFrames` snapshots, which already store instruction lists.

Longer-term cleanup:

- snapshot branch frames by instruction identity/path rather than duplicating instruction objects

### 12.3 Text inline events

Inline wait/se/voice requires text reveal position if save/load can occur mid-line.
Without that, restored state may replay audio or resume from the wrong text position.

Initial strategy:

- do not support inline event compilation until text runtime semantics and save/load policy are designed

### 12.4 App/event wait

`wait screen.closed(...)` needs snapshot data:

- wait name
- args
- pending resolver identity if any

Avoid storing callback/function references in runtime state.
Only serializable wait descriptors should be saved.

### 12.5 System state

`system.*` is persistent global state, not per-scenario local variables.

Save/load policy must decide:

- whether system state is included in scenario save data
- whether system state lives outside save slots
- how replay/loading older saves interacts with achievements/gallery unlocks

This belongs to std-system design, not DSL v2 compiler alone.

### 12.6 Runtime event shapes

Adding scene-target jumps, body choices, app waits, and rich text will change runtime event data.
Prefer additive fields first.
Do not remove existing legacy fields in the same work.

### 12.7 Scenario versioning

Current v0.1 docs say save data has no scenario identity/version compatibility guarantee.
DSL v2 makes this more important because:

- choice item IDs may be stable across script edits
- scene IDs are primary targets
- text inline state may need script identity

Do not implement scenario versioning as part of first compile work, but keep it as a release gate before DSL v2 is positioned as stable.

---

## 13. Phased implementation plan

### Phase 1: `compileTzrV2` skeleton and top-level validation

Likely files:

- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/src/dsl-v2/index.ts`
- `packages/core/src/index.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`

Tests:

- duplicate title policy
- duplicate character ids
- duplicate scene ids
- scene metadata collection
- dialogue references unknown character are rejected

Non-goals:

- no runtime execution
- no examples migration
- no legacy `compileTzr` change

Risk: low.

### Phase 2: narration/dialogue/jump/end compile

Likely files:

- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/src/ir.ts`
- `packages/core/src/runtime.ts`
- `packages/core/src/runtime-commands.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`
- `packages/core/tests/runtime.test.ts`

Tests:

- plain narration/dialogue compile to existing instructions
- `end` lowers to stop
- `jump sceneId` validates known scenes
- runtime can jump to scene instruction

Non-goals:

- no rich text
- no choice body execution
- no cross-file scenes

Risk: medium, because scene-target jump touches runtime.

### Phase 3: `set` / `add` compile

Likely files:

- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`

Tests:

- `set scenario.x = "a" | 1 | true`
- `add scenario.x += 1`
- variable keys use full `scenario.*` path
- `set null` and variable references produce deferred diagnostics

Non-goals:

- no null runtime value support yet
- no variable reference evaluation

Risk: low.

### Phase 4: choice without conditional filtering

Likely files:

- `packages/core/src/ir.ts`
- `packages/core/src/runtime-control.ts`
- `packages/core/src/runtime-types.ts`
- `packages/core/src/runtime-snapshot.ts`
- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`
- `packages/core/tests/runtime.test.ts`

Tests:

- body choice emits choice event
- choice item ID appears in runtime item
- resolving item pushes body branch frame
- body fallthrough resumes after choice
- body jump clears branch frame
- snapshot round-trip during pending body choice

Non-goals:

- no conditional item filtering yet
- no synthetic labels

Risk: high, because choice runtime shape changes.

### Phase 5: condition evaluator / `if` compile

Likely files:

- `packages/core/src/dsl-v2/condition.ts`
- `packages/core/src/ir.ts`
- `packages/core/src/runtime-control.ts`
- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/tests/dsl-v2-condition.test.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`
- `packages/core/tests/runtime.test.ts`

Tests:

- scenario boolean shorthand
- string/number/boolean comparisons
- `and` / `or` / `not` precedence
- parentheses
- `elif` lowering
- `system.*` rejected without resolver

Non-goals:

- no std-system state yet
- no null semantics unless RuntimeValue is extended in this phase

Risk: medium.

### Phase 6: conditional choice filtering

Likely files:

- `packages/core/src/runtime-control.ts`
- `packages/core/src/runtime-types.ts`
- `packages/core/src/runtime-snapshot.ts`
- `packages/core/tests/runtime.test.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`

Tests:

- condition-false item hidden
- item IDs preserved after filtering
- pendingChoice snapshot preserves filtered list
- all-filtered choice behavior is deterministic

Non-goals:

- no disabled choice display
- no compile-time filtering

Risk: medium.

### Phase 7: `call` / app `wait` compile/runtime support

Likely files:

- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/src/ir.ts`
- `packages/core/src/runtime.ts`
- `packages/core/src/runtime-types.ts`
- `packages/core/src/runtime-snapshot.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`
- `packages/core/tests/runtime.test.ts`

Tests:

- `call namespace.action(...)` validates plugin command registration
- static args convert correctly
- `wait namespace.event(...)` emits pending app wait
- app wait snapshot/restore
- unsupported null/variable ref args rejected until implemented

Non-goals:

- no host UI implementation
- no callback/function state in runtime

Risk: high, because wait state is public runtime API.

### Phase 8: std visual/audio sugar compile

Likely files:

- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`
- maybe std plugin tests if schemas are extended

Tests:

- `bg` -> `bg`
- `show ... at center` -> `show` with `position`
- `hide` -> `hide`
- `bgm` -> `startBgm`
- `stopBgm` -> `stopBgm`
- `se` -> `se`
- `voice` -> `voice`
- plugin registration required

Non-goals:

- no visual clear
- no visual transitions
- no coordinates
- no audio transitions

Risk: low for current plugin subset.

### Phase 9: std system plugin/sugar compile

Likely files:

- `packages/plugin-std-system/src/index.ts` if package is introduced
- `packages/core/src/dsl-v2/compiler.ts`
- `packages/core/src/dsl-v2/condition.ts`
- `packages/core/tests/dsl-v2-compiler.test.ts`
- new std-system tests

Tests:

- `system.unlockEnding`
- `system.unlockCg`
- `system.unlockAchievement`
- direct system mutation remains rejected
- `system.*` condition evaluation through resolver

Non-goals:

- no generic `system.set`
- no achievements UI/gallery UI

Risk: high, because system persistence needs a product decision.

### Phase 10: text inline runtime strategy

Likely files:

- `packages/core/src/ir.ts`
- `packages/core/src/runtime-types.ts`
- `packages/core/src/runtime.ts`
- `packages/core/src/runtime-snapshot.ts`
- `packages/preact` or `packages/standard-ui-preact` text rendering files
- `packages/core/tests/dsl-v2-compiler.test.ts`
- UI/runtime tests as needed

Tests:

- rich text lines preserve plain fallback text
- text spans preserve attributes
- inline delay does not affect parser text fallback
- inline wait blocks at correct point
- inline se/voice does not replay incorrectly after save/load

Non-goals:

- no advanced text animation editor
- no voice system policy beyond event emission

Risk: high.

### Phase 11: example migration

Likely files:

- a new v2-specific example scenario
- example compile path
- README for the example

Tests:

- example build
- basic runtime smoke test

Non-goals:

- do not migrate all existing examples at once
- do not remove legacy examples

Risk: medium.

### Phase 12: docs update

Likely files:

- `docs/design/design/dsl-v2.md`
- `docs/dsl.md`
- `docs/runtime.md`
- `docs/plugins/std-visual.md`
- `docs/plugins/std-audio.md`
- new std-system docs if introduced

Tests:

- docs examples compile/run where possible

Non-goals:

- do not document deferred features as implemented

Risk: medium.

### Phase 13: release gate

Likely files:

- `TODOS.md`
- release/readiness docs
- package exports

Checks:

- `pnpm --filter @tsuzuru/core test`
- `pnpm --filter @tsuzuru/core typecheck`
- `pnpm test`
- `pnpm typecheck`
- package builds

Non-goals:

- no breaking removal of legacy DSL

Risk: medium.

---

## 14. Explicit recommendations

1. Use `compileTzrV2` as a separate experimental public API.
2. Do not overload or replace `compileTzr` yet.
3. Add a v2 compiled document type instead of forcing `TzrV2Document` into legacy `CompiledTzrDocument.body`.
4. Keep `SceneInstruction`; make v2 jumps target scenes through `document.scenes`.
5. Do not introduce labels into DSL v2.
6. Do not use synthetic labels for choice item bodies; extend choice runtime to execute selected item bodies as branch frames.
7. Compile plain text, blank-line click waits, and `---` page breaks before rich text.
8. Reject rich text meta/inline events in the first compiler rather than silently flattening semantics.
9. Store v2 scenario variables as full `scenario.*` keys in existing runtime variables.
10. Add a v2 condition evaluator; do not try to squeeze v2 conditions into legacy `flag()` / `var()` conditions.
11. Compile std-audio sugar to current commands: `startBgm`, `stopBgm`, `se`, `voice`.
12. Compile only the current std-visual subset first: `bg`, named-placement `show`, `hide`.
13. Defer visual transitions, coordinate placement, clear visual commands, system unlocks, app waits, null values, variable-reference values, and rich text until their runtime/plugin support exists.
14. Runtime changes are unavoidable for scene-target jumps, body choices, conditional choice filtering, v2 condition evaluation, app waits, rich text inline events, and full `system.*` support.

Recommended first implementation task:

- create `packages/core/src/dsl-v2/compiler.ts`
- implement `compileTzrV2` skeleton
- validate title/character/scene declarations
- emit no runtime behavior beyond metadata/index construction
- add focused `dsl-v2-compiler.test.ts`

