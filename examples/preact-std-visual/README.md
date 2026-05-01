# Preact std-visual Example

この example は、`@tsuzuru/plugin-std-visual` の `@bg` / `@show` / `@hide` が Preact app からどう見えるかを確認するための最小構成です。

`@tsuzuru/plugin-std-visual` は描画を行いません。背景や sprite の `assetId` と `position` を `runtimeState.plugins.stdVisual` に保持するだけです。

この example では `src/VisualLayer.tsx` が `getStdVisualState(runtimeState)` で visual state を読み、背景画像と sprite 画像を描画します。`left` / `center` / `right` の実際の配置も、この component 側の CSS で決めています。

画像 path の対応表は `src/assets.ts` にあります。`assetId` が対応表に存在しない場合、example 側で warning を出し、missing 表示を出します。

シナリオは `scenario/main.tzr` です。現行 DSL の named argument 構文に合わせて、`position="left"` の形式で `@show` を書いています。

## Run

リポジトリ root から実行します。

```sh
pnpm --filter @tsuzuru/example-preact-std-visual dev
```

production build:

```sh
pnpm --filter @tsuzuru/example-preact-std-visual build
```

typecheck:

```sh
pnpm --filter @tsuzuru/example-preact-std-visual typecheck
```
