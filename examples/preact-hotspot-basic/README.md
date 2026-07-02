# Tsuzuru Preact Hotspot Basic Example

この example は、`@tsuzuru/plugin-std-hotspot` を使った探索 ADV 風の最小 reference です。
透明な rectangular hotspot を画面に置き、click された領域に応じて inspection scene へ jump します。

## 役割

- hotspot command と hotspot plugin state の基本を見る
- 960x540 viewport 上に透明な click target を置く流れを見る
- desk、window、bookshelf、door の inspection scene へ分岐する流れを見る
- exploration scene に戻るときに stale hotspot を clear する流れを見る

visual novel としての標準的な starter を見たい場合は `examples/preact-starter` を使います。
save/load や settings まで含む統合 reference を見たい場合は `examples/preact-basic` を使います。

## 起動

```sh
pnpm --filter @tsuzuru/example-preact-hotspot-basic dev
```

## よく見るファイル

- `scenario/main.tzr`
  hotspot を配置し、click 後の jump 先を定義します。

- `src/assets.ts`
  背景など、scenario asset id と表示用 asset をつなぎます。

- `src/ui/GameRoot.tsx`
  standard UI と hotspot layer の接続を確認します。

## チェック

```sh
pnpm --filter @tsuzuru/example-preact-hotspot-basic check:scenario
pnpm --filter @tsuzuru/example-preact-hotspot-basic test
pnpm --filter @tsuzuru/example-preact-hotspot-basic typecheck
pnpm --filter @tsuzuru/example-preact-hotspot-basic build
pnpm --filter @tsuzuru/example-preact-hotspot-basic test:ui
```
