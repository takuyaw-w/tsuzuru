---
schema_version: 1
document_type: adversarial_review
subject: tsuzuru_tzr_dsl
status: batch_a_resolved
verified_date: 2026-07-19
verified_commit: 8e555fb
source_of_truth: main
implementation_scope:
  - packages/core/src/parser.ts
  - packages/core/src/condition-parser.ts
  - packages/core/src/compiler.ts
  - packages/core/src/condition-evaluator.ts
  - packages/core/src/runtime.ts
  - packages/core/src/runtime-control.ts
  - packages/vite-plugin/src/index.ts
finding_count: 9
confirmed_defect_count: 4
design_risk_count: 5
resolved_finding_count: 4
---

# `.tzr` DSL 敵対的検証レポート

## 1. 結論

現行DSLは、通常の構文誤り、インデント、重複宣言、未知のジャンプ先、
プラグイン引数などに対して広いテストを持ち、基本的な堅牢性は高い。

一方、正常系テストの外側では、次の優先課題が確認できた。

1. `__proto__` をscene IDまたはcharacter IDに使うと、コンパイル結果の
   辞書が通常のJavaScriptオブジェクトのプロトタイプとして書き換わり、
   ViteプラグインのJSON直列化後に索引・メタデータから消失する。
2. `set` の数値リテラルが安全整数範囲と有限値を検証せず、丸めや
   `Infinity -> null` の直列化変質を起こす。
3. 条件式のネストを深くすると、診断ではなく未捕捉の `RangeError` で落ちる。
4. 通常の段落区切りに見える空行が、未サポートのクリック待ち構文として
   暗黙に解釈され、parse成功後にcompile失敗する。

最初の改善バッチで `ADV-001`、`ADV-002`、`ADV-003`、`ADV-004` を解決した。
残る作者のミスを早期に発見する静的診断は、warning APIとstrict modeを設計してから
`ADV-005` 以降として進める。

## 2. 判定規則

### 2.1 重大度

| 値 | 意味 |
| --- | --- |
| `critical` | 通常の利用経路で任意コード実行、広範なデータ破壊、回避不能な停止を起こす |
| `high` | 正常にコンパイルされたシナリオが、配布経路や保存経路で無言の変質・欠落を起こす |
| `medium` | 作者の入力により実行時停止、コンパイラ停止、発見しにくい論理誤りを起こす |
| `low` | 主に一貫性、診断品質、将来互換性に影響する |

### 2.2 状態

| 値 | 意味 |
| --- | --- |
| `confirmed_defect` | 公開APIまたは実配布経路で、意図しない挙動を再現した |
| `design_risk` | 現行仕様どおりでも作者体験または保守性に明確な危険がある |
| `accepted_boundary` | 意図的制約として妥当であり、変更対象にしない |

## 3. 検証方法

- 設計資料:
  - `docs/design/dsl-v2.md`
  - `docs/design/dsl-support-matrix.md`
- 実装:
  - parser、condition parser、compiler、condition evaluator、runtime
  - Viteプラグインのコンパイル済みドキュメント直列化
- 既存テスト:
  - `packages/core/tests` の26ファイル、511テスト
- 決定的プローブ:
  - `parseTzr`、`parseTzrConditionExpression`、`compileTzr`
  - `createInitialRuntimeState`、`stepRuntime`、`jumpRuntime`
- ランダムプローブ:
  - 最大200文字のASCII、制御文字、全角空白、NBSP、BOMを混ぜた
    5,000入力を `parseTzr` に投入
- 深さプローブ:
  - 括弧を100、500、1,000、2,000、5,000段にした条件式を投入

既存のcoreテストはすべて成功し、ランダム5,000入力では例外は発生しなかった。
したがって、以下の問題は既存テストの失敗ではなく、未カバーの境界である。

## 4. 優先順位

| 順位 | ID | 重大度 | 状態 | 要約 | 推奨バッチ |
| ---: | --- | --- | --- | --- | --- |
| 1 | `ADV-001` | high | resolved | `__proto__` IDがJSON直列化で消失する | A |
| 2 | `ADV-002` | high | resolved | 数値が丸め・非有限値化・`null`化する | A |
| 3 | `ADV-003` | medium | resolved | 深い条件式がスタックオーバーフローする | A |
| 4 | `ADV-004` | medium | resolved | 空行が暗黙の未サポート構文になる | A |
| 5 | `ADV-005` | medium | design_risk | `end` / `jump` 後の到達不能文を受理する | B |
| 6 | `ADV-006` | medium | design_risk | 条件付きchoiceが実行時に0件になり得る | B |
| 7 | `ADV-007` | medium | design_risk | 明白な条件型不一致を実行時まで遅延する | B |
| 8 | `ADV-008` | medium | design_risk | 未定義変数と明示的 `null` が等価になる | C |
| 9 | `ADV-009` | low | confirmed_defect | 空の表示文字列を広く受理する | C |

## 5. Findings

### ADV-001: `__proto__` IDが辞書のプロトタイプを書き換える

- severity: `high`
- status: `resolved`
- resolved_commit: `9b40ef4`
- confidence: `high`
- category: `identifier-safety`, `serialization`, `runtime-index`
- affected:
  - `packages/core/src/compiler.ts::buildSceneIndexes`
  - `packages/core/src/compiler.ts::buildMetadata`
  - `packages/vite-plugin/src/index.ts`

#### Reproduction

```tzr
character __proto__ name="Prototype"

scene start:
  jump __proto__

scene __proto__:
  __proto__:
    到達した。
  end
```

#### Observed

- parse成功
- compile成功
- コンパイル直後は `document.scenes["__proto__"]` が取得できる
- `Object.keys(document.scenes)` には `__proto__` が現れない
- `Object.keys(document.metadata.characters)` にも `__proto__` が現れない
- Viteプラグインは `JSON.stringify(result.document)` を使うため、生成モジュールでは
  `__proto__` scene索引とcharacterメタデータが欠落する

#### Root cause

`Record<string, ...> = {}` に対して `record["__proto__"] = value` と代入している。
これはown propertyの追加ではなく、オブジェクトのプロトタイプ変更として扱われる。
さらにVite生成moduleへJSONをobject literalとして埋め込むと、JSON文字列に残った
`"__proto__"` もJavaScript評価時にprototype設定として再解釈される。

#### Improvement

1. scene、character、source-line mapを構築する共通ヘルパーを用意し、
   `Object.fromEntries` または `Object.create(null)` を使う。
2. JSON往復後にもすべての有効なidentifierが保持されることを契約テストにする。
3. 防御を二重化する場合は、`__proto__`、`prototype`、`constructor` を
   identifierとして拒否する。ただし辞書実装の安全化を主修正とし、予約語拒否だけに
   依存しない。

#### Regression tests

- `scene __proto__:` の索引がown propertyになる
- `character __proto__` のメタデータがown propertyになる
- `JSON.parse(JSON.stringify(document))` 後にscene jumpできる
- project compileおよびVite変換後にも同じ結果になる
- `constructor`、`toString` など他のObject prototype名も保持される

#### Compatibility

既存の通常IDには影響しない。`__proto__` を拒否する案を追加する場合のみ、
これまで構文上受理されていた入力への破壊的変更になる。

#### Resolution

compiled recordを`Object.fromEntries`で構築し、project source-line mapを
prototypeなしのrecordへ変更した。Vite生成moduleはobject literalではなく
`JSON.parse`で復元し、`__proto__`をown propertyとして維持する。

### ADV-002: 数値リテラルが無言で変質する

- severity: `high`
- status: `resolved`
- resolved_commit: `199ba5f`
- confidence: `high`
- category: `numeric-safety`, `serialization`, `save-load`
- affected:
  - `packages/core/src/parser.ts`
  - `packages/core/src/condition-parser.ts`
  - `packages/core/src/compiler.ts::compileSetLiteralValue`

#### Reproduction A: 安全整数外

```tzr
scene start:
  set scenario.score = 9007199254740993
  end
```

Observed compiled value: `9007199254740992`

#### Reproduction B: 非有限値

```tzr
scene start:
  set scenario.score = 999999999999999999999999999999999999999999999999999999
  end
```

桁数を十分に増やすと、parserの `Number(raw)` は `Infinity` を生成する。
compileは成功するが、ViteプラグインのJSON直列化では `Infinity` が `null` になる。
結果として、直接コンパイルと配布ビルドで値が異なる。

#### Improvement

1. すべての数値リテラルに `Number.isFinite` を適用する。
2. 整数リテラルには `Number.isSafeInteger` を適用する。
3. DSLで必要な数値範囲を明文化する。
4. `set`、`add`、`wait`、condition、plugin argumentsで共通の数値検証を使う。
5. エラーには元のリテラルと許容範囲を含める。

#### Regression tests

- 最大・最小安全整数は成功する
- 安全整数外はparseまたはcompile診断になる
- オーバーフローする小数・整数は診断になる
- compiled documentの全NumberValueがfiniteである
- JSON往復前後で値が一致する

#### Compatibility

安全整数外または非有限値に依存するシナリオだけが拒否される。これらは現状でも
値を正確に表現できないため、拒否が望ましい。

#### Resolution

共通のnumber literal parserを導入し、すべてのsource由来numberにfinite検証を、
整数構文にsafe-integer検証を適用した。

### ADV-003: 深い条件式が未捕捉の `RangeError` を起こす

- severity: `medium`
- status: `resolved`
- resolved_commit: `33093af`
- confidence: `high`
- category: `parser-robustness`, `resource-limit`, `diagnostics`
- affected: `packages/core/src/condition-parser.ts`

#### Reproduction

```txt
(((( ... 5,000 levels ... (scenario.flag) ... ))))
```

#### Observed

| depth | result |
| ---: | --- |
| 100 | parse成功 |
| 500 | parse成功 |
| 1,000 | parse成功 |
| 2,000 | parse成功 |
| 5,000 | `RangeError: Maximum call stack size exceeded` |

通常のランダム5,000入力では例外がなかったため、問題は主に再帰深度に限定される。

#### Improvement

- tokenizerまたはparserで最大ネスト深度を数え、上限超過をsource-location付き診断にする。
- 上限値は実装詳細として十分低く固定する。視覚ノベルの条件式に数百段のネストは不要。
- 将来、反復型parserへ変更しても、入力上限自体はDoS防止として残す。

#### Regression tests

- 上限ちょうどは成功する
- 上限+1は例外ではなく `ok: false` を返す
- 深い `not` 連鎖と括弧連鎖の両方を検証する
- `parseTzr` 内のif条件でも同じ診断になる

#### Resolution

括弧と単項`not`を合算した最大ネスト深度を128に固定し、上限超過を
source-location付きparse diagnosticとして返す。

### ADV-004: 通常の空行が暗黙の未サポート構文になる

- severity: `medium`
- status: `resolved`
- resolved_commit: `8430267`
- confidence: `high`
- category: `authoring-ux`, `stable-subset`, `parser-compiler-gap`
- affected:
  - `packages/core/src/parser.ts`
  - `packages/core/src/compiler.ts`
  - `docs/design/dsl-support-matrix.md`

#### Reproduction

```tzr
scene start:
  narration:
    最初の段落。

    次の段落。
```

#### Observed

- parse成功
- 空行は `TextClickWait` ASTになる
- compileは `Text click wait is not compile-supported yet.` で失敗する

明示的な記号ではなく、一般的な文章整形である空行がparser-only機能を起動するため、
作者は「plain narrationがstable」という説明から失敗を予測しにくい。

#### Improvement options

推奨はOption A。

- Option A: v1 stable subsetでは空行を段落区切りまたは無視として扱い、クリック待ちは
  将来の明示構文へ移す。
- Option B: `TextClickWait` をcompile/runtimeまで実装してstableへ昇格する。
- Option C: 現状維持。ただしparser段階で「空行は未サポートのクリック待ちになる」と
  直接診断し、parse成功にしない。

Option Bはrenderer、backlog、save/loadの設計を早期固定するため、現在の境界方針とは
相性が悪い。

#### Regression tests

- plain text内の段落空行に対する確定仕様
- 末尾空行とブロック間空行の区別
- CRLFでも同じ挙動
- author-facing診断が空行の位置を指す

#### Resolution

Option Aを採用した。text block内の空行は先頭、末尾、連続、LF、CRLFを問わず
authoring whitespaceとして無視し、`TextClickWait`を暗黙生成しない。

### ADV-005: `end` / `jump` 後の到達不能文を受理する

- severity: `medium`
- status: `design_risk`
- confidence: `high`
- category: `control-flow`, `static-analysis`, `authoring-error`

#### Reproduction

```tzr
scene start:
  end
  narration:
    この文は実行されない。
```

```tzr
scene start:
  jump next
  narration:
    この文も実行されない。

scene next:
  end
```

どちらもcompile成功し、到達不能なinstructionが出力される。

#### Improvement

- scene bodyおよびif/choiceの各bodyで、無条件terminator後の文を診断する。
- 最初はwarningとして導入し、CLI strict modeでerrorに昇格できる形が安全。
- `if` は全branchがterminateする場合にだけ後続文を到達不能と判定する。
- choiceは全itemがterminateしても選択自体が必ず表示されるとは限らないため、
  条件付きitemを考慮する。

#### Regression tests

- 直列の `end` / `jump` 後を検出
- nested if/choice body内を検出
- 条件分岐の一部だけがterminateする場合は誤検出しない
- scene境界を越えて到達不能扱いしない

### ADV-006: 条件付きchoiceが実行時に0件になり得る

- severity: `medium`
- status: `design_risk`
- confidence: `high`
- category: `control-flow`, `choice`, `runtime-error`

#### Reproduction

```tzr
scene start:
  choice "どうする？":
    "鍵を使う" if scenario.hasKey:
      end
```

compileは成功する。`scenario.hasKey` がtrueでなければ、runtimeは
`choice_no_available_items` を返して進行を停止する。

#### Improvement

- すべてのitemがconditionalであるchoiceにcompile warningを出す。
- 作者向けに、最低1つのunconditional fallbackを推奨する。
- 将来 `else` choice itemを設計する場合も、汎用言語化せずchoice内だけの制約構文にする。
- 意図的に0件をruntime errorにしたい用途のため、warning抑制方法を用意してもよい。

#### Regression tests

- unconditional itemが1つ以上あればwarningなし
- 全item conditionalならwarning
- runtimeの `choice_no_available_items` は防御として維持

### ADV-007: 明白な条件型不一致を実行時まで遅延する

- severity: `medium`
- status: `design_risk`
- confidence: `high`
- category: `condition`, `static-analysis`, `runtime-error`

#### Reproduction

```tzr
scene start:
  if scenario.score > "ten":
    end
```

compileは成功するが、runtimeは `condition_invalid_numeric_comparison` を返す。
`>`、`>=`、`<`、`<=` は両operandがnumberである必要があるため、string literalを
含む時点で成功する可能性がない。

#### Improvement

- relational operatorの片側がstring、boolean、null literalならcompile errorにする。
- literal同士は完全に型検証する。
- referenceの型が不明な場合は現状どおりruntime検証を残す。
- 将来変数schemaを導入する場合は、任意JSではなく宣言的な型情報として設計する。

#### Regression tests

- `scenario.score > 1` は成功
- `scenario.score > "1"` はcompile失敗
- `1 > "1"`、`true < 1`、`null >= 0` はcompile失敗
- equality operatorの異型比較は現行仕様を明文化して別扱いにする

### ADV-008: 未定義scenario変数と明示的 `null` が等価になる

- severity: `medium`
- status: `design_risk`
- confidence: `high`
- category: `condition`, `state`, `typo-detection`
- affected: `packages/core/src/condition-evaluator.ts::normalizeEqualityValue`

#### Observed semantics

`state.variables[path]` が存在しない場合は `undefined` になるが、equality比較では
`undefined` を `null` に正規化する。そのため次はtrueになる。

```tzr
if scenario.hasNotebok == null:
  // `hasNotebook` のタイプミスでもtrue
```

未初期化をfalse相当として扱える利便性はある一方、変数名のタイプミスが診断されず、
明示的に `null` を設定した状態とも区別できない。

#### Improvement

- 現行挙動を破壊せず、CLI strict modeまたはproject configで既知のscenario変数を
  検証できるようにする。
- 最小案は、同一project内の `set` / `add` targetを収集し、一度も書かれない参照を
  warningにする。
- host初期値を使うproject向けには、宣言的な変数schemaまたは既知変数リストを渡せる
  拡張点を用意する。
- `undefined == null` の現行仕様はDSL文書に明記する。

#### Compatibility

未定義変数を直ちにruntime errorへ変えると既存シナリオを壊すため、最初は任意の
静的診断として導入する。

### ADV-009: 空の表示文字列を受理する

- severity: `low`
- status: `confirmed_defect`
- confidence: `high`
- category: `metadata`, `authoring-ux`, `validation`

#### Reproduction

```tzr
title ""
character a name=""

scene start "":
  choice "":
    "":
      end
```

parse、compileとも成功する。空タイトル、空character名、空scene title、空question、
空choice labelは表示面で意味を持たず、アクセシビリティ上も識別できない。

#### Improvement

- 表示用必須文字列にはtrim後のnon-empty検証を適用する。
- document titleとscene titleを省略可能のままにするが、指定した空文字列は拒否する。
- 空白だけ、タブescapeだけ、改行escapeだけの値も同じ規則で検証する。
- 意図的な無名話者はcharacter名の空文字ではなく、narrationまたは専用UI設定で扱う。

#### Regression tests

- `""` と空白だけの文字列を拒否
- 日本語および通常の表示名は成功
- optional titleの未指定は成功

## 6. Accepted boundaries

以下は攻撃入力として確認したが、現行制約または防御が妥当なため改善項目にしない。

- BOM付きUTF-8 sourceは正常にparseできた。
- duplicate choice item IDはparserが拒否した。
- duplicate named call argumentは `Duplicate call argument` で拒否した。
- unknown jump target、unknown speaker、duplicate title/character/sceneはcompilerが拒否した。
- 条件付きchoiceが0件になった場合、runtimeは専用errorを返し、誤った選択状態を
  作らない。
- ランダム5,000入力で `parseTzr` の未捕捉例外はなかった。
- `wait` は非有限値と負値をcompilerで拒否する。小数ミリ秒を許可する現行仕様は
  直ちに欠陥とは判定しないが、整数ミリ秒に限定するかは文書化した方がよい。

## 7. 推奨実装バッチ

### Batch A: 直列化安全性とparser停止防止

- `ADV-001`: prototype-safe record構築
- `ADV-002`: 共通数値リテラル検証
- `ADV-003`: 条件式ネスト上限
- `ADV-004`: 空行のstable subset方針決定

完了条件:

- 公開API、project compiler、Vite直列化のJSON往復テストが通る
- adversarial numeric fixturesがすべて明示診断になる
- 深い条件式が例外を投げない
- 空行の意味がparser、compiler、support matrixで一致する

### Batch B: 制御フロー診断

- `ADV-005`: 到達不能文warning
- `ADV-006`: fallbackなしconditional choice warning
- `ADV-007`: 静的に確定するcondition型エラー

完了条件:

- compiler diagnosticにwarningを追加する設計が、既存の `TzrCompileResult` とCLI表示を
  壊さずに定義されている
- strict modeの有無とerror昇格規則が明文化されている

### Batch C: 作者向けstrict validation

- `ADV-008`: 未定義scenario変数診断
- `ADV-009`: non-empty表示文字列

完了条件:

- host初期状態を使うprojectを誤検出しない拡張点がある
- optional metadataと空文字列を区別する

## 8. 実装時の推奨検証

```sh
rtk pnpm --filter @tsuzuru/core test
rtk pnpm --filter @tsuzuru/core typecheck
rtk pnpm --filter @tsuzuru/vite-plugin test
rtk pnpm --filter @tsuzuru/vite-plugin typecheck
rtk pnpm --filter @tsuzuru/example-preact-basic check:scenario
rtk pnpm --filter @tsuzuru/example-preact-basic build
rtk pnpm examples:check
rtk pnpm test
rtk pnpm typecheck
rtk git diff --check
```

`ADV-001` と `ADV-002` はViteのJSON直列化で顕在化するため、core単体テストだけで
完了判定しない。

## 9. 今回実行した検証

| Check | Result |
| --- | --- |
| `rtk pnpm --filter @tsuzuru/core test` | 26 files / 520 tests passed |
| `rtk pnpm --filter @tsuzuru/core typecheck` | passed |
| `rtk pnpm --filter @tsuzuru/vite-plugin test` | 1 file / 18 tests passed |
| `rtk pnpm --filter @tsuzuru/vite-plugin typecheck` | passed |
| deep condition probe | depth 5,000を上限128の診断として処理 |
| `rtk pnpm --filter @tsuzuru/example-preact-basic check:scenario:self` | 4 documents passed |
| `rtk pnpm --filter @tsuzuru/example-preact-basic build` | passed |
| `rtk pnpm test` | passed |
| `rtk pnpm typecheck` | passed |
| `rtk pnpm release-readiness:check` | package build、全example、pack、publish readiness、local create smokeを含めてpassed |
| `rtk pnpm format:check` / `lint` / `check` | passed |
| `rtk git diff --check` | passed |

clean worktreeではpnpmが `tsuzuru` bin shimを生成しなかったため、通常の
`check:scenario` とそれを使う `examples:check` は `spawn ENOENT` になった。
同じscenario検査はbuild済みCLIを直接使う `check:scenario:self` と
`release-readiness:check` 内の `examples:check:self` で完走した。

## 10. レポート更新規則

AIまたは人がこの文書を更新するときは次を守る。

1. finding IDは再利用しない。
2. 解決済みfindingは削除せず、`status: resolved` と解決commitを追記する。
3. 再現不能になった場合は、実行したcommitとcommandを記録する。
4. 新規findingには最低限 `severity`、`status`、`confidence`、`Reproduction`、
   `Observed`、`Improvement`、`Regression tests` を含める。
5. parser成功、compile成功、runtime成功、Vite JSON往復成功を別々に判定する。
6. 将来機能の提案は、確認済み欠陥と混ぜず `design_risk` として記録する。
