# Tsuzuru

Tsuzuru は、TypeScript / Vite / Preact を前提とした、Web-first なノベルゲームエンジンです。

`.tzr` という読みやすいシナリオ DSL を使い、シナリオ記述・コンパイル・ランタイム実行・Preact による表示を分離することを目指しています。

## 現在のステータス

Tsuzuru は v0.1 scope complete / stabilization complete の状態です。

v0.1 で予定していたコア設計、最小機能、examples、README / docs、quality gates は完了確認済みです。ただし、production ready な完成製品ではなく、v0.1 範囲を固定した初期実装です。

実装済みの主な要素:

- `.tzr` パーサー
- compiler
- runtime
- runtime event
- choice / jump / if
- variables / flags
- plugin command registration / validation
- macro expansion
- `@tsuzuru/core`
- `@tsuzuru/preact`
- Preact basic example
- basic save/load example
- DSL / runtime / plugin / macro docs

未実装または post-v0.1 候補:

- `create-tsuzuru`
- `@tsuzuru/vite`
- cross-file jump existence validation
- macro argument schema validation
- save data migration / compatibility metadata
- GUI editor
- TyranoScript / KAG / Ren'Py 互換
- Live2D
- Pixi integration
- backlog
- skip mode
- auto mode
- gallery
- cloud save

## 設計方針

Tsuzuru の基本方針は次の通りです。

```txt
シナリオファイルは物語の流れを記述する。
runtime behavior、rendering、plugins、reusable logic は TypeScript に置く。
```

`.tzr` ファイルを、任意の JavaScript / TypeScript 実行環境にはしません。

つまり、以下のような記述は許可しない方針です。

```txt
@set(name="score", value=Math.random())
@bg(name=`school_${time}`)
@if(calcSomething())
```

代わりに、シナリオ側では制約された DSL を使い、拡張は TypeScript plugin / macro として実装します。

## パッケージ構成

現在の主な構成は以下です。

```txt
packages/
  core/
  preact/

examples/
  basic/
  preact-basic/

docs/
  decisions/
```

### `@tsuzuru/core`

Tsuzuru の中核パッケージです。

主な責務:

- `.tzr` parser
- AST
- compiler
- IR
- runtime
- condition evaluation
- jump / choice
- variables / flags
- plugin command validation
- macro expansion
- runtime snapshot / restore

`@tsuzuru/core` は Preact、DOM、CSS、Vite、browser storage に依存しません。

### `@tsuzuru/preact`

Preact 向け adapter です。

主な責務:

- `useRuntime`
- `RuntimeView`
- visible event handling
- auto-step behavior
- click-to-advance
- choice selection
- save/load adapter utilities

`RuntimeView` は最小表示用の convenience component に留め、full game UI framework にはしません。

シナリオ実行の本質的なロジックは `@tsuzuru/core` に置きます。

## Quickstart

v0.1 では `create-tsuzuru` は作りません。project creation path は manual setup と既存 examples です。clean checkout から現在の実装を試すには、リポジトリルートで以下を実行します。

```sh
pnpm install
pnpm --filter @tsuzuru/example-basic start
pnpm --filter @tsuzuru/example-preact-basic dev
```

`examples/basic` は Node 上で `@tsuzuru/core` の parse / compile / runtime 実行を確認します。`examples/preact-basic` は Vite + Preact で `useRuntime`、`RuntimeView`、choice、wait、plugin command、localStorage save/load を確認します。

新規プロジェクトを作る場合は、v0.1 では `examples/preact-basic` の構成を参考に手動で Vite + Preact project を作り、`@tsuzuru/core` と `@tsuzuru/preact` を組み込んでください。`.tzr` は Vite の `?raw` import またはホスト側の手動読み込みで文字列として渡します。`npm create tsuzuru` と `@tsuzuru/vite` は post-v0.1 候補です。

## DSL の例

`.tzr` は以下のような構文です。

```txt
#scene("prologue")

@bg("school_evening")

The classroom was unusually quiet.

:: Haruka
You're late again.

:: Yu
I made it, so it's fine.

? What do you do?
- "Apologize" -> #apologize
- "Make a joke" -> #joke

#label("apologize")

:: Yu
Sorry. I'll come earlier tomorrow.

@inc(name="haruka_affection", by=1)
@jump("#after_choice")

#label("joke")

:: Yu
This was a perfectly calculated arrival.

@dec(name="haruka_affection", by=1)
@jump("#after_choice")

#label("after_choice")

@if(var("haruka_affection") >= 1)
:: Haruka
At least you apologized.
@else
:: Haruka
You never change.
@endif
```

主な記号の意味:

| 記号 | 意味 |
|---|---|
| `#scene(...)` | scene declaration |
| `#label(...)` | jump target |
| `:: Speaker` | speaker block |
| `@command(...)` | runtime command |
| `$macro(...)` | compile-time macro |
| `?` | choice block |
| `- "Text" -> target` | choice item |
| `@if` / `@else` / `@endif` | conditional block |

## 開発環境

依存関係のインストール:

```sh
pnpm install
```

テスト:

```sh
pnpm test
```

型チェック:

```sh
pnpm typecheck
```

## パッケージ別コマンド

### Core

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/core build
```

### Preact

```sh
pnpm --filter @tsuzuru/preact test
pnpm --filter @tsuzuru/preact typecheck
pnpm --filter @tsuzuru/preact build
```

### Basic Example

実行:

```sh
pnpm --filter @tsuzuru/example-basic start
```

ビルド:

```sh
pnpm --filter @tsuzuru/example-basic build
```

型チェック:

```sh
pnpm --filter @tsuzuru/example-basic typecheck
```

### Preact Example

開発サーバー:

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

ビルド:

```sh
pnpm --filter @tsuzuru/example-preact-basic build
```

型チェック:

```sh
pnpm --filter @tsuzuru/example-preact-basic typecheck
```

## ドキュメント

主要ドキュメント:

```txt
docs/
  dsl.md
  runtime.md
  plugin-api.md
  macro-api.md
  architecture.md
  roadmap.md
  decisions/
```

### 設計判断ログ

重要な設計判断は `docs/decisions/` に記録します。

```txt
docs/decisions/
  0001-dsl-is-not-js.md
  0002-core-preact-boundary.md
  0003-macro-vs-plugin.md
```

## Plugin と Macro

Tsuzuru では plugin と macro を明確に分けます。

```txt
plugin = runtime command extension
macro  = compile-time presentation shorthand
```

### Plugin

Plugin は runtime behavior を拡張します。

例:

```txt
@bg("school_evening")
@show(character="haruka", pose="smile", at="center")
@shake(target="screen", duration=300)
```

Plugin command は compiler で登録・検証され、runtime で handler に dispatch されます。

### Macro

Macro は compile-time shorthand です。

例:

```txt
$enter("haruka", "smile", "center")
```

Macro は compile 時に通常の command instruction へ展開され、runtime IR には残りません。

v0.1 では、macro が jump / choice / if などの narrative flow を隠すことは避けます。

## v0.1 の範囲

v0.1 では、以下を目標にします。

- `.tzr` で小規模なノベルゲームシナリオを書ける
- `@tsuzuru/core` で parse / compile / runtime 実行できる
- compile 時に主要な DSL エラーを検出できる
- plugin command を登録・検証できる
- macro を compile-time に展開できる
- Preact で runtime を表示・操作できる
- save/load を example で確認できる
- examples が clean checkout から動く
- README / docs が実装と一致している

## v0.1 に含めないもの

以下は v0.1 には含めません。

- GUI editor
- visual scripting editor
- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility
- arbitrary JavaScript / TypeScript inside `.tzr`
- scenario-local macro definitions
- `create-tsuzuru`
- `@tsuzuru/vite`
- cross-file jump existence validation
- macro argument schema validation
- save data scenario identity / version / migration
- Live2D
- Pixi integration
- backlog
- skip mode
- auto mode
- gallery
- achievements
- cloud save
- save data compatibility guarantees across scenario/runtime changes

v0.1 の save/load は example での確認用です。`RuntimeSaveData` は scenario identity、scenario version、migration metadata を含まず、scenario や runtime/event shape が変わった後の互換性は保証しません。

## Codex / Agent 運用

このリポジトリでは Codex 用に以下を整備しています。

```txt
AGENTS.md
TODOS.md

.agents/
  skills/
  prompts/
```

作業を Codex に依頼するときは、基本的に以下の形式を使います。

```txt
Use the tsuzuru-codex-workflow skill.
Use the <target-skill> skill.

TODOS.md の以下だけを実装してください。

- <TODO item>
```

詳しくは以下を参照してください。

```txt
.agents/prompts/README.md
.agents/skills/
```

## ライセンス

未定義です。

公開・配布方針が決まった段階で明記します。
