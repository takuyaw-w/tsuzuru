# Tsuzuru Roadmap

この文書は、Tsuzuru の今後の開発判断をそろえるための現行 roadmap です。
細かい実装 TODO ではなく、何を優先し、何を後回しにし、何をやらないかを明確にするために使います。

現在の実装詳細は、必要に応じて次の文書を参照してください。

- [Architecture](architecture.md)
- [DSL](dsl.md)
- [DSL support matrix](design/dsl-support-matrix.md)
- [Post-v1 feature boundary design](design/post-v1-feature-boundaries.md)
- [Runtime](runtime.md)
- [Plugin API](plugin-api.md)
- [v1.0 Release Gate](plans/v1.0-release-gate.md)

## プロダクト方針

Tsuzuru は、ブラウザ向けノベルゲームを作るための TypeScript 製エンジンです。

一番の軸は、既存エンジン互換の DSL ではなく、ノベルゲームの流れを素直に読める `.tzr` ファイルで書けることです。
シーン、会話、選択肢、分岐、演出コマンドが、できるだけそのまま読める形で並ぶことを重視します。

Tsuzuru が目指すもの:

- ノベルゲームの流れを `.tzr` に素直に書ける
- `.tzr` は JavaScript / TypeScript ではなく、意図的に小さいシナリオ DSL にする
- parser / compiler / runtime が静的に検査できる形を保つ
- 演出、UI、保存、アセット解決、配布方法は TypeScript 側で拡張できる
- 生成 starter から、ブラウザで動く静的 Web アプリとして配れる

Tsuzuru が目指さないもの:

- KAG / TyranoScript / Ren'Py 互換
- 任意 JavaScript / TypeScript を `.tzr` 内で実行する仕組み
- `.tzr` を汎用プログラミング言語にすること
- core runtime に DOM、Preact、Vite、browser storage、asset loading を持ち込むこと

基本方針:

```txt
シナリオの流れは .tzr に書く。
実行、演出、UI、保存、配布の責務は TypeScript 側に置く。
```

## 主な対象ユーザー

第一の対象は、ノベルゲームを作りたい人です。
npm、Vite、TypeScript に詳しいことは前提にしません。
ただし、Node.js を入れてコマンドを実行し、生成されたファイルを編集するところまでは受け入れる想定です。

開発者向けには、TypeScript で parser / compiler / runtime / plugin / UI を拡張できる構造を提供します。
ただし、入口の説明では package 境界や内部設計よりも、まず `.tzr` を編集してゲームの流れが変わる体験を優先します。

## 現在の状態

現在の Tsuzuru は、v1.0 系の package set を持つ初期段階のエンジンです。
成熟した商用ノベルゲームエンジンと同等ではありませんが、小規模な作品や実験を始めるための土台は揃っています。

現行の主な package:

- `@tsuzuru/core`
  - `.tzr` parser
  - compiler
  - project compiler
  - runtime IR
  - runtime stepping
  - choices / jumps / waits
  - scenario state
  - snapshot / restore
  - plugin command dispatch

- `@tsuzuru/config`
  - `defineTsuzuruConfig`
  - project config の型と Node config loading

- `@tsuzuru/cli`
  - `tsuzuru check`
  - scenario validation

- `@tsuzuru/vite-plugin`
  - Vite で `.tzr` を compiled runtime document として import する plugin
  - `include` を含む scenario project loading

- `create-tsuzuru`
  - Vite + Preact starter の project generator

- `@tsuzuru/preact`
  - core runtime と Preact の接続
  - `useRuntime`
  - `RuntimeView`
  - Preact-facing save / restore helpers

- `@tsuzuru/standard-ui-preact`
  - reusable Preact UI components
  - `TsuzuruGame`
  - standard runtime layers
  - title / message / choice / control / screen primitives

- `@tsuzuru/theme-standard`
- `@tsuzuru/theme-classic`
- `@tsuzuru/theme-dark-novel`
- `@tsuzuru/theme-minimal`
  - standard UI 向け CSS variable theme

- `@tsuzuru/standard-game-storage`
  - preferences
  - read tracking
  - save slot stores
  - standard runtime save adapter

- `@tsuzuru/plugin-std-visual`
- `@tsuzuru/plugin-std-audio`
- `@tsuzuru/plugin-std-text-sound`
- `@tsuzuru/plugin-std-effect`
- `@tsuzuru/plugin-std-camera`
- `@tsuzuru/plugin-std-particle`
- `@tsuzuru/plugin-std-hotspot`
- `@tsuzuru/plugin-std-system`
  - 標準演出・状態管理用の plugin command metadata と runtime handlers

現行 examples:

- `examples/preact-starter`
  - creator-facing starter example
- `examples/preact-basic`
  - core / Preact / standard UI / standard plugins / save-load / preferences / backlog / auto / skip / read tracking の統合 reference
- `examples/preact-hotspot-basic`
  - hotspot を使った探索 ADV の最小 example
- `examples/preact-sound-novel`
  - sound-novel presentation の example

## v1.x の重点

v1.x では、新機能を広げるよりも、使い始めの体験と作者体験を固めます。

### 1. 初回体験

目標は、npm や Vite を深く知らない人でも、次の流れを迷わず進められることです。

```sh
npm create tsuzuru@latest my-game
cd my-game
npm install
npm run dev
```

その後、`scenario/main.tzr` を少し編集し、ブラウザ上の表示が変わるところまでを最初の成功体験にします。

この段階では、package 構造や TypeScript plugin の説明を前面に出しすぎません。
まず「`.tzr` を書き換えるとノベルゲームの流れが変わる」ことを伝えます。

### 2. 作者体験

`.tzr` を書く人が迷わない状態を目指します。

優先すること:

- DSL syntax の説明を短く、実例中心にする
- エラーを、作者が次に直すべき場所が分かる形に近づける
- generated starter の `scenario/main.tzr` を編集しやすくする
- README / template README / example README の役割を分ける
- 「現在使える syntax」と「後で検討する syntax」を混ぜない

### 3. 信頼性

package として安心して試せる状態を保ちます。

優先すること:

- `release-readiness:check` を現行 package / example inventory と同期させる
- `create-tsuzuru` local smoke を維持する
- docs と実装の乖離を減らす
- root README、Japanese README、architecture、roadmap の役割を明確にする
- historical docs と current docs を分ける

## 直近でやること

### Roadmap / docs 整理

- `docs/roadmap.md` を現行 roadmap として維持する
- 旧 v0.1 scope は historical note として短く扱う
- current behavior は README、architecture、DSL docs、support matrix、package README に寄せる
- docs 内で、未実装機能を実装済みのように見せない

### README / README.ja.md の入口整理

- 外向けの最初の導線は `npm create tsuzuru@latest my-game` を基本にする
- pnpm は repository development / contributor 向けの補足に下げる
- 最初の価値を「package install」ではなく「`.tzr` を編集して画面に反映されること」に置く
- 既存 DSL 互換ではなく、素直に読める `.tzr` であることを明確にする

### `create-tsuzuru` starter の改善

- generated project の README を、生成後ユーザー向けにする
- `scenario/main.tzr`、`src/assets.ts`、`public/assets/*`、`tsuzuru.config.ts` の役割を短く説明する
- Load / Config など placeholder の意味を明確にする
- `.tzr` を少し編集するチュートリアルを入れる

### Examples の役割整理

- `examples/preact-starter` は、生成 starter に近い最小導線として保つ
- `examples/preact-basic` は、統合 reference として保つ
- `examples/preact-hotspot-basic` は、ADV / hotspot reference として保つ
- `examples/preact-sound-novel` は、sound novel presentation reference として保つ

Examples は「全部を最初に理解するもの」ではなく、目的別の reference として扱います。

### Quality gate / release readiness

- package / example inventory と root scripts を同期させる
- publish package contents の検査を維持する
- generated starter の smoke を維持する
- docs だけが古くなる状態を早めに検出できるようにする

## 後で検討すること

以下は有用ですが、v1.x の最初に広げすぎると初回体験がぼやけるため、設計を分けて扱います。
rich text、`system.*` condition resolver、visual coordinate placement、audio transitions の境界は
[`post-v1-feature-boundaries.md`](design/post-v1-feature-boundaries.md) にまとめています。

### Editor support

- syntax highlighting
- VS Code extension
- snippets
- diagnostics
- outline / jump target navigation

Editor tooling は `.tzr` authoring UX を大きく改善できます。
ただし、engine v1.x の必須条件ではなく、DSL support matrix と同期する別 topic として扱います。

### Rich text / inline events

- rich inline text
- inline waits
- inline audio events
- page breaks
- text block metadata

これらは text rendering、backlog、save/load、renderer contract に影響するため、個別設計が必要です。
現在の安定方向は plain narration / dialogue text です。

### `system.*` condition resolver

`call system.unlock...` による write-side behavior は plugin-dependent feature として扱えます。
一方で、`if system.*` のような read-side condition は、core と plugin state の境界を慎重に設計する必要があります。
最初の設計 scope は [`system-condition-resolver.md`](design/system-condition-resolver.md) にまとめています。

### Visual coordinate placement

`show asset at left/center/right` のような preset placement は扱いやすい一方、任意座標は renderer coordinate policy、responsive layout、safe area と結びつきます。
座標指定は、renderer contract を決めてから進めます。

### Audio transitions

`bgm ... with fadeIn(...)` や `stopBgm with fadeOut(...)` は、audio timing、restore、save/load と関係します。
statement-level audio command を先に安定させ、transition は別設計にします。

### Save data migration

現行方針は、互換性のない save data を安全に検証・拒否することです。
古い save data を移行する仕組みは、作品単位の運用や versioning policy と関係するため、v1.x 初期の必須範囲には入れません。

## Non-Goals

以下は当面の開発対象にしません。

- KAG / TyranoScript / Ren'Py compatibility
- 任意 JavaScript / TypeScript の `.tzr` 内実行
- generic macro system
- scenario-local macro definitions
- preset / stage / reusable staging syntax
- visual scripting editor
- GUI editor
- Live2D integration
- Pixi integration
- cloud save
- RPG / map / battle systems
- plugin marketplace
- advanced animation editor

将来検討する場合も、core DSL の制約や package boundary を崩さない独立 topic として扱います。

## v0.1 について

以前の v0.1 roadmap は、DSL v2 cleanup 前の歴史的な計画です。
旧 syntax、旧 parser/compiler semantics、macro API、削除済み example 名は、現在の機能ガイドではありません。

現在の public parser/compiler API は次です。

```ts
import { parseTzr, compileTzr } from "@tsuzuru/core";
```

現在の `.tzr` syntax は、`docs/dsl.md` と `docs/design/dsl-support-matrix.md` を参照してください。

削除済みの legacy syntax:

```txt
#scene(...)
#label(...)
:: Speaker
@command(...)
$macro(...)
@if(...)
@else
@endif
```

これらは historical context 以外では使いません。

## Roadmap の更新ルール

この文書は、次の場合に更新します。

- Tsuzuru の主対象ユーザーを変えるとき
- v1.x の重点を変えるとき
- package boundary を変えるとき
- current feature と future feature の扱いを変えるとき
- README や examples が新しい能力を示すようになったとき
- Non-Goals を見直すとき

細かい作業 checklist は、この文書ではなく dedicated plan docs や issue / TODO に置きます。
