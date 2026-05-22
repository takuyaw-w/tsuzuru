# Tsuzuru

Tsuzuru は、TypeScript / Vite / Preact を主軸とした、Web-first なノベルゲームエンジンです。

`.tzr` という読みやすいシナリオ DSL を使い、シナリオ記述・コンパイル・ランタイム実行・framework adapter による表示を分離することを目指しています。Core は framework-neutral に保ちつつ、v0.x の公式 UI stack、templates、examples は Preact-based JSX に集中します。Vue support は初期スコープ外で、需要が明確になった時点で optional adapter として再検討します。

## 現在のステータス

Tsuzuru は現在、`main` を source of truth として DSL v2 を中心に整備中です。

DSL v2 は、現在新しく作るシナリオの current supported DSL path です。`parseTzr` / `compileTzr` は current DSL APIs として公開されており、現在の runnable examples は [`examples/preact-starter`](examples/preact-starter/) と [`examples/preact-basic`](examples/preact-basic/) です。

旧 DSL parser/compiler、legacy AST、legacy compiler、macro API は削除済みです。現在の `parseTzr` / `compileTzr` は DSL v2 実装を指します。削除結果と残した shared runtime/IR は [`docs/plans/legacy-dsl-cleanup.md`](docs/plans/legacy-dsl-cleanup.md) で管理しています。

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
- `@tsuzuru/standard-ui-preact`
- `@tsuzuru/standard-game-storage`
- `@tsuzuru/plugin-std-visual`
- `@tsuzuru/plugin-std-audio`
- `@tsuzuru/plugin-std-text-sound`
- `@tsuzuru/plugin-std-effect`
- `@tsuzuru/plugin-std-camera`
- `@tsuzuru/plugin-std-particle`
- `@tsuzuru/plugin-std-system`
- Preact starter example
- Preact basic integration example
- DSL v2 design notes
- legacy cleanup plan

未実装または post-v0.1 候補:

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

代わりに、シナリオ側では制約された DSL を使い、拡張は TypeScript plugin と runtime handler として実装します。macro API は削除済みで、DSL v2 の current feature ではありません。

## パッケージ構成

現在の主な構成は以下です。

```txt
packages/
  core/
  config/
  cli/
  vite-plugin/
  create-tsuzuru/
  preact/
  standard-ui-preact/
  standard-game-storage/
  plugin-std-visual/
  plugin-std-audio/
  plugin-std-text-sound/
  plugin-std-effect/
  plugin-std-camera/
  plugin-std-particle/
  plugin-std-system/

examples/
  preact-basic/
  preact-starter/

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

### Official UI Stack

Tsuzuru Core is framework-neutral, but the official v0.x UI stack, templates, and examples are focused on Preact-based JSX. Vue support is out of the initial scope and may be reconsidered later as an optional adapter.

## Quickstart

ゲーム制作者向けの current starter example は [`examples/preact-starter`](examples/preact-starter/) です。clean checkout から試すには、リポジトリルートで以下を実行します。

```sh
pnpm install --frozen-lockfile
pnpm --filter @tsuzuru/example-preact-starter dev
```

ビルド確認:

```sh
pnpm --filter @tsuzuru/example-preact-starter build
```

`examples/preact-starter` はタイトル画面、16:9 のゲーム画面、メッセージウィンドウ、選択肢、背景、キャラクター、asset map を持つ最小ノベルゲーム雛形です。

低レベル統合の確認には [`examples/preact-basic`](examples/preact-basic/) も利用できます。`examples/preact-basic` は core runtime と各 std plugin の統合、save/load、settings、backlog などを含む実装リファレンスです。

`create-tsuzuru` は default の basic/Preact template と `--template preact` alias を生成できます。`--template html` / `--template vue` は対応していません。生成物は `@tsuzuru/vite-plugin` を使い、`.tzr` を query なしで直接 import します。pnpm 利用時は `pnpm create tsuzuru my-game` の後、`cd my-game` と `pnpm dev` で starter を起動できます。

Release smoke test:

```sh
pnpm run smoke:create-tsuzuru
```

This is the registry smoke. It checks that the published `create-tsuzuru` package can generate a project
that installs, validates its scenario, and builds. The explicit alias is:

```sh
pnpm run smoke:create-tsuzuru:registry
```

For CI and local release readiness from this repository, use the local tarball smoke:

```sh
pnpm run smoke:create-tsuzuru:local
```

The local smoke packs `create-tsuzuru` and generated `@tsuzuru/*` dependencies from the workspace as local tarballs, then installs the generated project with `pnpm install --prefer-offline`. External template dependencies such as `preact`, `typescript`, and `vite` still use the normal registry-backed pnpm install flow.

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

- DSL v2: `parseTzr` / `compileTzr`
- Legacy implementation previously behind these names: removed

関連ドキュメント:

- [Preact starter example](examples/preact-starter/)
- [Preact basic integration example](examples/preact-basic/)
- [DSL v2 design notes](docs/design/dsl-v2.md)
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

package inventory / script coverage / docs inventory の同期確認:

```sh
pnpm inventory:check
```

examples の scenario / unit test / typecheck / build 確認:

```sh
pnpm examples:check
```

`examples:check` は example 単体検証用で、必要な workspace package build を先に実行します。release readiness では `packages:build` 済みの `dist` を使う `examples:check:self` を使い、example の `check:scenario:self` / `typecheck:self` / `build:self` で package build の重複を避けます。通常の `check:scenario` は `tsuzuru check` bin を使い、`check:scenario:self` は clean install で pnpm bin shim が CLI build 前に作られない場合を避けるため、build 済み CLI entry を直接実行します。

Browser E2E smoke for examples:

```sh
pnpm examples:e2e
```

`examples:e2e` runs the Playwright Save -> Load -> Restore smoke for the
Preact example. It is intentionally separate from root `test` and
`release-readiness:check`. GitHub Actions exposes it through the optional
`Examples E2E` workflow, which can be run manually and on a nightly schedule.
When the workflow fails, inspect the uploaded Playwright report and
`test-results` artifacts.

publish 対象 package の build:

```sh
pnpm packages:build
```

`packages:build` は release readiness 用の package build gate です。publish 対象 package を明示順に `build:self` で build し、root release flow 内では依存 package の再 build を避けます。package 単体の `build` は clean checkout でも動くよう、必要な依存 package build を引き続き内包します。

`packages:typecheck:self` は `packages:build` 後に使う package typecheck gate です。root `typecheck` は `packages:build` で依存 package の `dist` を一度作ってから、各 package の `typecheck:self` を実行します。package 単体の `typecheck` は clean checkout でも動くよう、必要な依存 package build を引き続き内包します。

publish 前の tarball 内容確認:

```sh
pnpm publish-readiness:check
```

`publish-readiness:check` は build 済み `dist` を前提に tarball 内容を検査します。clean checkout では先に `pnpm packages:build` を実行してください。

release 前の推奨確認:

```sh
pnpm release-readiness:check
```

This runs package builds, examples, pack dry-run, publish-readiness, and local create-tsuzuru smoke in order.
Template `pnpm-lock.yaml` は現時点では同梱していません。local smoke で generated project の `@tsuzuru/*` dependency を local tarball に書き換えるため、lockfile 採用は rewrite 後の整合性設計と合わせて扱います。`pnpm packages:graph:check` は experimental TypeScript project reference graph の optional / manual validation です。v1.0 required gate や `release-readiness:check` には含めず、正式な package graph は [`docs/plans/typescript-build-graph.md`](docs/plans/typescript-build-graph.md) の post-v1.0 build-system task として扱います。

v1.0 release gate の required / optional / manual / design readiness 分類は
[`docs/plans/v1.0-release-gate.md`](docs/plans/v1.0-release-gate.md) に整理しています。
実 publish / tag / GitHub release の手順は
[`docs/plans/v1.0-manual-publish-checklist.md`](docs/plans/v1.0-manual-publish-checklist.md)
に分離しています。readiness review では `pnpm release:version`、publish、tag、push、GitHub release 作成を実行しません。

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

### Preact Basic Example

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
  design/dsl-v2.md
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

std visual/audio/effect/camera/particle command は DSL v2 compiler が runtime `CommandInstruction` に変換し、runtime で handler に dispatch します。`compileTzr(document, { plugins })` に std plugin を渡すと、compiler が plugin command metadata に基づいて command name と argument shape を検証します。

## v0.1 の範囲

v0.1 では、以下を目標にします。

- `.tzr` で小規模なノベルゲームシナリオを書ける
- `@tsuzuru/core` で DSL v2 parse / compile / runtime 実行できる
- compile 時に主要な DSL エラーを検出できる
- std visual/audio/effect/camera/particle command を runtime handler に dispatch できる
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
- `@tsuzuru/vite`
- `@tsuzuru/html`
- `create-tsuzuru --template vue`
- official Vue adapter / UI packages
- cross-file jump existence validation
- macro argument schema validation
- save data migration framework
- Live2D
- Pixi integration
- backlog
- skip mode
- auto mode
- gallery
- achievements
- cloud save
- save data compatibility guarantees across scenario/runtime changes

v1.0 の save/load 互換性 promise は migration ではなく validation /
rejection です。core は `RuntimeSnapshot.version === 2` と
`RuntimeSaveSlot.version === 1` の検証境界を持ち、scenario identity /
scenario version mismatch や invalid nested snapshot を loadable data として
扱いません。save data migration framework はまだありません。scenario や
runtime/event shape が変わった後の互換性は保証対象外です。

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

## License

MIT
