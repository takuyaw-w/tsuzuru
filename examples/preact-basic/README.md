# Tsuzuru Preact Basic Example

この example は、Tsuzuru の Preact stack をまとめて確認する統合 reference です。
`scenario/main.tzr` の短いシナリオを、standard UI、standard plugins、save/load、preferences、backlog、auto、skip、read tracking と一緒に動かします。

## 役割

- core runtime、Preact adapter、standard UI layers の接続を見る
- visual / audio / text-sound / effect / camera / particle / system plugin の基本的な使い方を見る
- save/load、settings、backlog、auto、skip、read tracking を app 側の実装例として見る
- starter より広い機能を確認する reference として使う

最初に `.tzr` を編集して表示が変わる流れだけを見たい場合は `examples/preact-starter` を使います。

## 起動

```sh
pnpm --filter @tsuzuru/example-preact-basic dev
```

## よく見るファイル

- `scenario/main.tzr`
  scenario の entry です。`include` で分割された `.tzr` files を読み込みます。

- `scenario/`
  会話、分岐、state updates、plugin commands、waits などを含む scenario files を置きます。

- `src/assets.ts`
  scenario asset id と example 側の presentation mapping を定義します。

- `src/screens/`
  title、save、load、settings、backlog、gallery など、project-specific screens を実装します。

- `tsuzuru.config.ts`
  scenario files、plugins、storage settings を宣言します。

## 操作

- title screen で Start を選ぶと game に入ります。
- Click、Enter、Space で message を進めます。
- 表示途中の text は、最初の advance で全文表示になります。
- runtime menu から Save、Load、Backlog、Settings、Title へ移動できます。
- Auto は text 表示後に進み、choices で停止します。
- Skip は現在 session で既読の messages だけ進み、choices で停止します。

## チェック

```sh
pnpm --filter @tsuzuru/example-preact-basic check:scenario
pnpm --filter @tsuzuru/example-preact-basic test
pnpm --filter @tsuzuru/example-preact-basic typecheck
pnpm --filter @tsuzuru/example-preact-basic build
pnpm --filter @tsuzuru/example-preact-basic test:ui
```

`test:ui` は Playwright で title、settings、runtime、choice、localStorage-backed Save -> Load -> Restore path を確認します。

## 補足

この example は real audio files を bundle していません。
`src/assets.ts` は BGM / SE / Voice ids を host-owned public paths に mapping します。
browser が missing audio files を報告しても、app の動作確認は止まりません。
