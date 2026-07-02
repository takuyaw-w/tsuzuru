# Tsuzuru

[English](./README.md)

Tsuzuru は、読みやすい `.tzr` シナリオファイル、framework-neutral な core runtime、Preact ベースの公式 UI stack を使って、browser-first なノベルゲームを作るための TypeScript 製ビジュアルノベルエンジンです。

Tsuzuru は次のような読者・利用者を想定しています。

- 小さなシナリオ DSL で物語の流れを書きたいゲーム制作者
- parser、compiler、runtime、UI の境界を明示的に扱いたい TypeScript 開発者
- 編集可能な Vite + Preact starter から static web game を作り始めたい npm ユーザー

基本的な考え方はシンプルです。

```txt
Scenario files describe narrative flow.
Runtime behavior, rendering, plugins, assets, storage policy, and app screens
belong in TypeScript.
```

Tsuzuru は汎用 scripting language や KAG、TyranoScript、Ren'Py の clone を目指していません。`.tzr` は、parse、validate、compile しやすく、TypeScript plugins と接続しやすいように、意図的に制約された language です。

## Features

- **DSL v2 scenario authoring**: indentation-based な `.tzr` ファイルで、`title`、`character`、`include`、`scene`、narration、dialogue、choices、conditional choices、`if` / `elif` / `else`、`jump`、`end`、`wait`、`scenario.*` state updates を記述できます。
- **Core parser, compiler, and runtime**: `@tsuzuru/core` は `parseTzr`、`compileTzr`、`compileTzrProject`、runtime stepping、choices、jumps、waits、snapshots、restore helpers、plugin command dispatch primitives を export します。
- **Vite integration**: `@tsuzuru/vite-plugin` により、Vite apps で `.tzr` ファイルを compiled runtime documents として import できます。`include` もサポートします。
- **CLI and project config**: `@tsuzuru/cli` は `tsuzuru check` を提供し、`@tsuzuru/config` は `defineTsuzuruConfig` と Node config loading を提供します。
- **Preact adapter**: `@tsuzuru/preact` は `useRuntime`、`RuntimeView`、click-to-advance behavior、choice selection、save / restore adapter utilities により、core runtime を Preact に接続します。
- **Standard Preact UI**: `@tsuzuru/standard-ui-preact` は、再利用可能な visual novel UI components と、標準 plugin set 向けの高レベルな `TsuzuruGame` starter component を提供します。
- **Official themes**: `@tsuzuru/theme-standard`、`@tsuzuru/theme-classic`、`@tsuzuru/theme-dark-novel`、`@tsuzuru/theme-minimal` は、standard UI 向けの CSS variable themes を提供します。Themes は presentation packages であり、runtime plugins ではありません。
- **Standard plugins**: visual、audio、text-sound、effect、camera、particle、system unlock packages は、presentation state のための command metadata と runtime handlers を提供します。Rendering、asset resolution、playback policy、app screens は host 側の責務です。
- **Storage helpers**: `@tsuzuru/standard-game-storage` は preferences、read tracking、save slot stores、standard runtime save adapter を提供します。Save / Load screens を作成したり、app がいつ save するかを決めたりはしません。
- **Project generator**: `create-tsuzuru` は、title screen、16:9 game view、`.tzr` scenario、asset maps、project config、standard UI wiring を含む現在の Vite + Preact starter を作成します。

## Quick Start

npm ユーザー向けには、`create-tsuzuru` が想定される project-generator path です。

```sh
pnpm create tsuzuru my-game
cd my-game
pnpm dev
```

default template は現在の Vite + Preact starter です。同じ starter は明示的にも指定できます。

```sh
pnpm create tsuzuru my-game --template basic
pnpm create tsuzuru my-game --template preact
```

このコマンドは npm で利用できる generator と dependency versions を使います。この repository の current source を、対応する workspace packages がすべて publish される前に試す場合は、checkout 済みの starter example を使ってください。

```sh
pnpm install --frozen-lockfile
pnpm --filter @tsuzuru/example-preact-starter dev
```

Generated projects には、次の便利な scripts が含まれます。

```sh
pnpm check:scenario
pnpm typecheck
pnpm build
pnpm preview
```

starter では主に次のファイルを編集します。

- `scenario/main.tzr`: story、choices、scene flow
- `src/assets.ts`: scenario asset IDs と files の対応
- `public/assets/images/` と `public/assets/audio/`: game assets
- `tsuzuru.config.ts`: scenario files、compile-time plugins、project identity、declarative storage settings
- `src/themes/localTheme.ts`: game で使う fixed theme

生成された starter の Load と Config buttons は visible placeholders です。`tsuzuru.config.ts` では standard storage settings を宣言できますが、Save / Load、Settings、Backlog、Gallery、migration behavior は application code です。

Selected npm package pages:

- [`create-tsuzuru`](https://www.npmjs.com/package/create-tsuzuru)
- [`@tsuzuru/core`](https://www.npmjs.com/package/@tsuzuru/core)
- [`@tsuzuru/standard-ui-preact`](https://www.npmjs.com/package/@tsuzuru/standard-ui-preact)
- [`@tsuzuru` npm organization](https://www.npmjs.com/org/tsuzuru)

Source、issues、release notes は [GitHub](https://github.com/tsuzuru-engine/tsuzuru) にあります。

## Minimal Scenario

現在の Tsuzuru scenarios は DSL v2 を使います。

```tzr
title "Sample Game"

character mio name="Mio"

scene start:
  bg classroom with fade(duration=300)
  show mio_smile at center with dissolve(duration=250)

  mio:
    Hello.
    Welcome to Tsuzuru.

  choice "Continue?":
    "Continue" id=continue:
      jump next

scene next:
  narration:
    This is narration.

  end
```

現在の syntax entry point 全体は [`docs/dsl.md`](docs/dsl.md) を参照してください。stable-scope planning matrix は [`docs/design/dsl-support-matrix.md`](docs/design/dsl-support-matrix.md) にあります。

## Packages

この repository は、`packages/*` 配下の packages と `examples/*` 配下の runnable examples を持つ pnpm workspace です。

| Package | Role |
| --- | --- |
| [`@tsuzuru/core`](packages/core/) | Parser、compiler、project compiler、runtime IR、runtime stepping、state、choices、jumps、waits、snapshots、restore helpers、plugin command infrastructure。 |
| [`@tsuzuru/config`](packages/config/) | Browser-safe な project config types と `defineTsuzuruConfig`。Node config loading は explicit subpath から利用できます。 |
| [`@tsuzuru/cli`](packages/cli/) | Command line tools。現在は scenario validation のための `tsuzuru check` が中心です。 |
| [`@tsuzuru/vite-plugin`](packages/vite-plugin/) | `.tzr` ファイルを compiled runtime documents として import するための Vite plugin。 |
| [`create-tsuzuru`](packages/create-tsuzuru/) | 現在の Vite + Preact starter の project generator。 |
| [`@tsuzuru/preact`](packages/preact/) | Preact runtime adapter、runtime view、runtime hook、save / restore adapter utilities。 |
| [`@tsuzuru/standard-ui-preact`](packages/standard-ui-preact/) | 再利用可能な Preact UI components、standard runtime layers、themes helpers、`TsuzuruGame`。 |
| [`@tsuzuru/standard-game-storage`](packages/standard-game-storage/) | Preferences、read tracking、save slot stores、standard runtime save helpers。 |
| [`@tsuzuru/theme-standard`](packages/theme-standard/) | standard UI 向けの Standard CSS variable theme。 |
| [`@tsuzuru/theme-classic`](packages/theme-classic/) | standard UI 向けの Classic CSS variable theme。 |
| [`@tsuzuru/theme-dark-novel`](packages/theme-dark-novel/) | standard UI 向けの Dark novel CSS variable theme。 |
| [`@tsuzuru/theme-minimal`](packages/theme-minimal/) | standard UI 向けの Minimal CSS variable theme。 |
| [`@tsuzuru/plugin-std-visual`](packages/plugin-std-visual/) | Background and sprite state command handlers。 |
| [`@tsuzuru/plugin-std-audio`](packages/plugin-std-audio/) | BGM、sound effect、voice state / event command handlers。 |
| [`@tsuzuru/plugin-std-text-sound`](packages/plugin-std-text-sound/) | Text sound state、profile helpers、optional browser playback helpers。 |
| [`@tsuzuru/plugin-std-effect`](packages/plugin-std-effect/) | One-shot screen effect command handlers。 |
| [`@tsuzuru/plugin-std-camera`](packages/plugin-std-camera/) | Durable camera state command handlers。 |
| [`@tsuzuru/plugin-std-particle`](packages/plugin-std-particle/) | Durable particle state command handlers。 |
| [`@tsuzuru/plugin-std-system`](packages/plugin-std-system/) | endings、CGs、achievements 向けの durable unlock state。 |

Core は Preact、DOM、CSS、Vite、browser storage、asset loading から独立しています。UI adapters、standard UI、examples、applications が browser と framework behavior を所有します。

## Examples

現在の runnable examples はすべて Preact-based です。

| Example | Purpose |
| --- | --- |
| [`examples/preact-starter`](examples/preact-starter/) | creator-facing starter example。`scenario/main.tzr`、`src/assets.ts`、local theme を編集して小さなノベルゲームを作れます。 |
| [`examples/preact-basic`](examples/preact-basic/) | core runtime、Preact adapter、standard UI layers、standard plugins、save/load、preferences、backlog、auto mode、skip mode、read tracking を example-owned app behavior として確認する integration reference。 |
| [`examples/preact-hotspot-basic`](examples/preact-hotspot-basic/) | 透明な rectangular hotspot と scene jump で探索 ADV 風のクリック領域を確認する minimal example。 |
| [`examples/preact-sound-novel`](examples/preact-sound-novel/) | `TsuzuruGame` の novel message presentation と text reveal controls を使う long-form sound-novel presentation example。 |

よく使う example commands:

```sh
pnpm --filter @tsuzuru/example-preact-starter dev
pnpm --filter @tsuzuru/example-preact-starter check:scenario
pnpm --filter @tsuzuru/example-preact-starter typecheck
pnpm --filter @tsuzuru/example-preact-starter build
```

Repository-level example validation:

```sh
pnpm examples:check
pnpm examples:e2e
```

`examples:e2e` は Playwright browser smoke suite で、root unit test flow とは意図的に分離されています。

## Documentation

まずは以下を参照してください。

- [Architecture](docs/architecture.md): package boundaries と runtime pipeline。
- [DSL](docs/dsl.md): 現在の `.tzr` syntax entry point。
- [DSL support matrix](docs/design/dsl-support-matrix.md): current stable、parser-only、plugin-dependent、deferred syntax status。
- [Roadmap](docs/roadmap.md): 現在の product direction と near-term focus。
- [Runtime](docs/runtime.md): runtime state、events、choices、waits、variables、snapshots、restore behavior。
- [Plugin API](docs/plugin-api.md): plugin command metadata と runtime handler boundaries。
- [Plugin docs](docs/plugins/): standard visual、audio、text-sound、effect、camera、particle、system、Vite plugin の詳細。
- [Themes](docs/themes.md): official theme package boundaries と usage。
- [Screen primitives](docs/ui/screen-primitives.md): project-specific screens のための reusable UI building blocks。
- [Release notes](docs/releases/): release records と publish notes。

Historical design records と古い implementation plans は `docs/history/` 配下にあります。現在の implementation surface を確認したい場合は、architecture、roadmap、DSL、support matrix、package README files、current examples を優先してください。

## Development

Dependencies を install します。

```sh
pnpm install --frozen-lockfile
```

Useful root checks:

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm test
pnpm typecheck
pnpm examples:check
pnpm release-readiness:check
```

Focused package checks では pnpm filters を使います。

```sh
pnpm --filter @tsuzuru/core test
pnpm --filter @tsuzuru/core typecheck
pnpm --filter @tsuzuru/standard-ui-preact test
pnpm --filter @tsuzuru/standard-ui-preact typecheck
```

Release and publish readiness helpers:

```sh
pnpm packages:build
pnpm publish-readiness:check
pnpm run pack:dry-run
pnpm run smoke:create-tsuzuru:local
```

`release-readiness:check` は、package builds、example self-checks、pack dry-runs、publish-readiness、local `create-tsuzuru` smoke を順に実行します。実際の versioning、npm publish、git tags、GitHub releases は maintainer actions であり、通常の readiness checks ではありません。

## Current Status and Limitations

workspace は現在 `1.0.0` package versions を持っていますが、Tsuzuru は成熟した visual novel engines と比べるとまだ early stage です。現在の web-first TypeScript / Vite / Preact workflow を試すこと、実験的な game を作ること、現在の package boundaries に沿って開発することに向いています。public surface は意図的に小さく、まだ進化中のものとして扱ってください。

Current limitations include:

- official templates と examples は Preact-based です。現在の official Vue adapter や Vue template はありません。
- GUI editor、visual scripting editor、Live2D integration、Pixi integration、cloud save はありません。
- `.tzr` ファイル内で arbitrary JavaScript や TypeScript を実行することはできません。
- generic macros、presets、reusable staging syntax、scenario-local procedures は実装されていません。
- rich inline text、inline waits/events、inline audio events、text block page breaks、text block metadata は deferred syntax です。
- visual coordinate placement と audio transition syntax は future design work です。
- `system.*` condition reads は current stable DSL subset には含まれません。
- save data migration は提供していません。現在の helpers は任意の古い saves を migrate するのではなく、incompatible data を validate して reject します。
- `@tsuzuru/standard-ui-preact` は reusable components と starter runtime wiring を提供しますが、Save / Load、Settings、Backlog、Gallery などの project screens と asset policy は application code です。

何が stable、plugin-dependent、parser-only、deferred なのかを簡潔に確認するには、[DSL support matrix](docs/design/dsl-support-matrix.md) を参照してください。

## License

MIT
