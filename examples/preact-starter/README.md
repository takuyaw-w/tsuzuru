# Tsuzuru Preact Starter Example

この example は、`create-tsuzuru` で生成される starter に近い最小構成です。
最初に見る example として、`scenario/main.tzr` を編集し、画面上の表示が変わる流れを確認します。

## 役割

- 生成 starter に近い Preact app の最小導線を確認する
- title screen から 16:9 の game screen へ進む流れを見る
- `.tzr` scenario、asset map、local theme の関係を見る

統合的な save/load、backlog、auto、skip、read tracking を見たい場合は `examples/preact-basic` を使います。

## 起動

```sh
pnpm --filter @tsuzuru/example-preact-starter dev
```

## よく見るファイル

- `scenario/main.tzr`
  物語を書きます。背景、キャラクター、セリフ、選択肢、分岐をここで編集します。

- `src/assets.ts`
  背景、キャラクター画像、音声を登録します。シナリオで使う `bg classroom` や `show mio_smile` の id と対応します。

- `src/App.tsx`
  title screen と game screen を切り替えます。作品タイトル、説明文、メニュー表示を変更できます。

- `src/themes/localTheme.ts`
  作品用の固定 theme を編集します。`App.tsx` で `TsuzuruThemeProvider` に渡しています。

- `src/ui/GameRoot.tsx`
  `@tsuzuru/standard-ui-preact` の `TsuzuruGame` を使って本編画面を表示します。

## 素材の置き場所

- `public/assets/images/`
- `public/assets/audio/`

## チェック

```sh
pnpm --filter @tsuzuru/example-preact-starter check:scenario
pnpm --filter @tsuzuru/example-preact-starter test
pnpm --filter @tsuzuru/example-preact-starter typecheck
pnpm --filter @tsuzuru/example-preact-starter build
pnpm --filter @tsuzuru/example-preact-starter test:ui
```

## 補足

Load / Config は starter では未実装です。必要になったら app 側で save/load や設定画面を追加してください。
Theme は作品単位で固定し、`.tzr` scenario から切り替えない想定です。
