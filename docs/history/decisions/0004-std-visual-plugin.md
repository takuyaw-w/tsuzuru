# 0004: Standard Visual Plugin

## Status

Accepted

## Context

Tsuzuru には、背景や sprite を扱う visual command が必要です。visual novel では、背景変更、立ち絵表示、立ち絵非表示は頻出の authoring 操作です。

一方で、Core は renderer 非依存である必要があります。Core が DOM、Preact、Canvas、Pixi、画像 path、asset loader に依存すると、Tsuzuru の runtime state と実行モデルが特定 renderer に結び付いてしまいます。

visual behavior は公式に提供したい一方で、Core に hardcode するべきではありません。

## Decision

`@tsuzuru/plugin-std-visual` を提供します。

これは Tsuzuru 公式の standard plugin として扱います。sample plugin ではなく、共通 visual state を扱う標準 package です。

plugin state key は `stdVisual` とします。

```ts
runtimeState.plugins.stdVisual
```

提供する command は次の 3 つです。

```txt
@bg
@show
@hide
```

## State Design

std-visual state は renderer 非依存のデータだけを持ちます。

```ts
{
  background: null,
  sprites: {},
}
```

`background` は未設定時に `null` です。背景が設定されている場合は `assetId` だけを持つ object です。

```ts
background: null | { assetId: string }
```

`sprites` は `assetId` を key にします。

```ts
sprites: {
  [assetId: string]: {
    position: "left" | "center" | "right"
  }
}
```

sprite object は `{ position }` だけを持ちます。`assetId` は key としてすでに表現されているため、object 内には重複して保存しません。

## Why Renderer-Independent State

Core と plugin は DOM、Preact、Pixi、Canvas などに依存しません。

renderer / app は、`assetId` を実際の画像、import 済み asset、URL、CSS class などに対応付けます。`position` の実際の座標や layout も renderer / app が決めます。

これにより、Tsuzuru の scenario execution と save/load 対象 state を特定 renderer から切り離せます。将来、Preact 以外の renderer や別 visual plugin を追加する余地も残ります。

## Why AssetId Only

std-visual state には file path を保存せず、`assetId` だけを保存します。

理由:

- scenario / runtime state を file layout に結合しない
- app ごとの asset map を許容する
- asset file の配置を変更しても save data の意味を保ちやすい
- bundler や hosting 環境ごとの path 解決を renderer / app 側に任せられる

`assetId` は scenario と app の asset map の間の安定した識別子として扱います。

## Why `@bg`, `@show`, `@hide`

command 名は短くします。

```txt
@bg("classroom")
@show("alice_smile")
@hide("alice_smile")
```

これらは visual novel authoring で頻出し、scenario file 上で読みやすいからです。

`@background`、`@showSprite`、`@hideSprite` のような冗長な名前は避けます。Tsuzuru Script は narrative flow を読みやすく保つ必要があり、よく使う presentation command は短い方が適しています。

## Validation Policy

空文字の `assetId` は不正な入力です。次の command は schema validation error にします。

```txt
@bg("")
@show("")
@hide("")
```

`@show` の `position` は `"left" | "center" | "right"` の固定値だけを許可します。不正な値は schema validation error です。

```txt
@show("alice", position="top")
```

missing hide target は script 構造としては不正ではありません。

```txt
@hide("missing")
```

これは有効な非空 `assetId` を指定していますが、実行時点で対象 sprite が表示されていない状態です。そのため validation error ではなく、no-op + runtime warning とします。

## Warning Policy

`@hide("missing")` は runtime warning を通知します。

```ts
plugin.stdVisual.hideTargetNotFound
```

plugin は `console.warn` を直接呼びません。runtime diagnostics / logger 経由で warning を通知します。

理由:

- test で検証しやすい
- editor / debug UI / host app が warning を集約しやすい
- runtime error と warning を区別できる
- plugin ごとの warning code を安定させられる

## Deferred Scope

次の機能はこの decision の scope 外です。

- transition
- duration
- clear background command
- character / expression model
- zIndex / order
- renderer components
- asset resolver
- examples

これらは必要になった時点で別途設計します。

## Consequences

### Positive

- std-visual は v0.2 初期の標準 visual state として単純で安定する
- Core を renderer 非依存に保てる
- renderer implementer の責務が明確になる
- save/load 対象の visual state を runtime state に集約できる
- scenario DSL では短く読みやすい command を使える

### Negative

- asset path 解決は app 側で実装する必要がある
- transition、duration、zIndex などの高度な visual novel 機能はまだ使えない
- 同じ position に複数 sprite がある場合の実際の配置は renderer ごとに決める必要がある

## Reconsideration Criteria

次の条件が出てきた場合、この decision を見直します。

- `assetId` だけでは save/load や renderer 実装に不足する
- 複数 renderer 間で visual state の互換性を保てない
- transition / duration / zIndex を標準 state に追加する必要が出る
- character / expression model を official plugin に含める必要が明確になる

## Related Documents

- `AGENTS.md`
- `docs/plugin-api.md`
- `docs/history/decisions/0002-core-preact-boundary.md`
- `docs/history/decisions/0003-macro-vs-plugin.md`
- `docs/plugins/std-visual.md`
