# Tsuzuru Preact Starter

この example は、Tsuzuru でノベルゲームを作るための最小スターターです。

起動するとタイトル画面が表示され、Start から 16:9 のゲーム画面へ進みます。
`scenario/main.tzr` と `src/assets.ts` を編集すれば、自分の物語と素材に差し替えられます。
`scenario/main.tzr` は `@tsuzuru/vite-plugin` により、アプリから直接読み込まれます。

## 起動

```bash
pnpm install
pnpm --filter @tsuzuru/example-preact-starter dev
```

## まず編集するファイル

- `scenario/main.tzr`
  物語を書きます。背景、キャラクター、セリフ、選択肢、分岐をここで編集します。

- `src/assets.ts`
  背景・キャラクター画像・音声を登録します。シナリオで使う `bg classroom` や `show mio_smile` の id と対応します。

- `src/screens/TitleScreen.tsx`
  タイトル画面をカスタマイズします。作品タイトル、説明文、メニュー表示を変更できます。

- `src/themes/localTheme.ts`
  作品用の固定テーマを編集します。`App.tsx` で `TsuzuruThemeProvider` に渡しています。

## 素材の置き場所

- `public/assets/images/`
- `public/assets/audio/`

## 構成

```txt
examples/preact-starter/
  scenario/main.tzr
  src/assets.ts
  src/themes/localTheme.ts
  src/screens/TitleScreen.tsx
  src/ui/GameRoot.tsx
  public/assets/images/
  public/assets/audio/
```

`App.tsx` はタイトル画面とゲーム画面の切り替え、固定テーマの適用だけを持ちます。runtime 統合の詳細は `src/ui/GameRoot.tsx` に閉じ込めています。
テーマは作品単位で固定し、`.tzr` シナリオから切り替えないでください。

## チェック

```sh
pnpm --filter @tsuzuru/example-preact-starter check:scenario
pnpm --filter @tsuzuru/example-preact-starter typecheck
pnpm --filter @tsuzuru/example-preact-starter build
pnpm --filter @tsuzuru/example-preact-starter test:ui
```

## 次にやること

- `scenario/main.tzr` のセリフを書き換える
- `src/assets.ts` に自分の画像を登録する
- `TitleScreen.tsx` のタイトルを変更する
- `src/themes/localTheme.ts` の theme tokens を編集し、作品に合う固定テーマにする

Load / Config は starter では未実装です。必要になったら save/load や設定画面を追加してください。
