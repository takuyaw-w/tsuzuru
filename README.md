# Tsuzuru

Tsuzuru は、TypeScript / Vite / Preact を前提とした、Web-first なノベルゲームエンジンです。

`.tzr` という読みやすいシナリオ DSL を使い、シナリオ記述・コンパイル・ランタイム実行・Preact による表示を分離することを目指しています。

## 現在のステータス

Tsuzuru は現在、`feature/new-dsl` ブランチで DSL v2 へ移行中です。

DSL v2 は、このブランチで新しく作るシナリオの current supported DSL path です。`parseTzrV2` / `compileTzrV2` は experimental DSL v2 APIs として公開されており、現在の runnable example は [`examples/dsl-v2-basic`](examples/dsl-v2-basic/) です。

旧 DSL の `parseTzr` / `compileTzr`、legacy AST、legacy compiler、macro API は削除済みです。削除結果と残した shared runtime/IR は [`docs/plans/legacy-dsl-cleanup.md`](docs/plans/legacy-dsl-cleanup.md) で管理しています。

このリポジトリは production ready な完成製品ではなく、初期実装と DSL v2 移行を進めている段階です。

実装済みの主な要素:

- DSL v2 parser / AST
- DSL v2 compiler for a practical runnable subset
- runtime
- runtime event
- scene jump / body choice / if
- variables
- plugin command metadata / runtime dispatch
- `@tsuzuru/core`
- `@tsuzuru/preact`
- DSL v2 basic example
- DSL v2 design notes
- legacy cleanup plan

未実装または post-v0.1 候補:

- `create-tsuzuru`
- `@tsuzuru/vite`
- cross-file jump existence validation
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
  dsl-v2-basic/

docs/
  design/
  plans/
  decisions/
```

### `@tsuzuru/core`

Tsuzuru の中核パッケージです。

主な責務:

- `.tzr` parser
- DSL v2 AST
- compiler
- IR
- runtime
- DSL v2 condition evaluation
- scene jump / body choice
- variables
- plugin command metadata / runtime dispatch
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

DSL v2 の current runnable example は [`examples/dsl-v2-basic`](examples/dsl-v2-basic/) です。clean checkout から試すには、リポジトリルートで以下を実行します。

```sh
pnpm install --frozen-lockfile
pnpm --filter @tsuzuru/example-dsl-v2-basic dev
```

ビルド確認:

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

`examples/dsl-v2-basic` は `parseTzrV2` / `compileTzrV2` で DSL v2 シナリオを compile し、core runtime と std visual/audio placeholder layers で実行します。

`create-tsuzuru` と `@tsuzuru/vite` はまだありません。`.tzr` は Vite の `?raw` import またはホスト側の手動読み込みで文字列として渡します。

## DSL v2 の例

DSL v2 は indentation-based なシナリオ構文です。

```txt
character mio name="美緒"

scene start:
  bg station
  bgm daily_theme
  show mio_smile at center

  mio:
    遅いよ。

  choice "どうする？":
    "手帳を見る" if scenario.hasNotebook:
      jump notebook

    "立ち去る":
      jump leave
```

API surface:

- DSL v2: `parseTzrV2` / `compileTzrV2`
- Removed legacy DSL APIs: `parseTzr` / `compileTzr`

関連ドキュメント:

- [DSL v2 basic example](examples/dsl-v2-basic/)
- [DSL v2 design notes](docs/design/design/dsl-v2.md)
- [Legacy DSL cleanup plan](docs/plans/legacy-dsl-cleanup.md)

Legacy DSL の `#scene(...)`, `#label(...)`, `@command(...)`, `$macro(...)`, `@if` / `@else` / `@endif` 構文は current supported path ではありません。旧 parser/compiler/API/tests/examples は削除済みで、DSL v2 を使用してください。

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

### DSL v2 Example

開発サーバー:

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic dev
```

ビルド:

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic build
```

型チェック:

```sh
pnpm --filter @tsuzuru/example-dsl-v2-basic typecheck
```

## ドキュメント

主要ドキュメント:

```txt
docs/
  design/design/dsl-v2.md
  runtime.md
  plugin-api.md
  architecture.md
  roadmap.md
  plans/legacy-dsl-cleanup.md
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

## Plugin

Plugin は runtime behavior を拡張します。

例:

```txt
bg school_evening
show haruka_smile at center
bgm daily_theme
```

std visual/audio command は DSL v2 compiler が runtime `CommandInstruction` に変換し、runtime で handler に dispatch します。legacy `compileTzr({ pluginCommands })` による plugin command validation path は削除済みです。

## v0.1 の範囲

v0.1 では、以下を目標にします。

- `.tzr` で小規模なノベルゲームシナリオを書ける
- `@tsuzuru/core` で DSL v2 parse / compile / runtime 実行できる
- compile 時に主要な DSL エラーを検出できる
- std visual/audio command を runtime handler に dispatch できる
- Preact で runtime を表示・操作できる
- DSL v2 example が clean checkout から動く
- README / docs が実装と一致している

## v0.1 に含めないもの

以下は v0.1 には含めません。

- GUI editor
- visual scripting editor
- TyranoScript compatibility
- KAG / KS compatibility
- Ren'Py compatibility
- arbitrary JavaScript / TypeScript inside `.tzr`
- macro API
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
