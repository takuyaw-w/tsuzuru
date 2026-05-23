# {{projectName}}

Tsuzuru でノベルゲームを作るためのスターターです。

起動するとタイトル画面が表示され、Start を押すと本編が始まります。
まずは Preact や runtime の詳細を知らなくても、シナリオと素材から編集できます。

## 起動

```bash
pnpm dev
```

シナリオだけを確認したい場合:

```bash
pnpm check:scenario
```

公開用の build:

```bash
pnpm install
pnpm build
```

## まず編集するファイル

- `scenario/main.tzr`
  セリフ、ナレーション、背景、キャラクター表示、選択肢、分岐を書きます。

- `public/assets/images/`
  背景や立ち絵の画像を置きます。

- `public/assets/audio/`
  BGM、効果音、ボイスを置きます。

- `tsuzuru.config.ts`
  シナリオの場所や storage の宣言的な設定をまとめています。
  save slot 数を変える場合は `storage.slots` を変更してください。

## シナリオを書く

`scenario/main.tzr` では、次のような id を使います。

```tzr
bg classroom
show mio_smile at center
```

この starter では、最初から次の素材を登録しています。

| assetId | ファイル |
| --- | --- |
| `classroom` | `public/assets/images/classroom.svg` |
| `mio_smile` | `public/assets/images/mio_smile.svg` |

画像を差し替える場合は、同じファイル名で置き換えるのが一番簡単です。
新しい assetId を増やす場合は、`src/assets.ts` に対応を追加してください。

## タイトル画面を変える

タイトルや subtitle は `src/App.tsx` で変更できます。
タイトル画面の見た目は `src/screens/TitleScreen.tsx` と `src/styles.css` にあります。

Load / Config は starter では未実装です。ボタンだけ置いてあります。
save/load や設定画面が必要になったら、`tsuzuru.config.ts` の `storage` 設定から storage を生成できます。
実際の save/load には、アプリ側で保存データの作成と画面の接続を追加してください。

## 慣れてきたら

`src/ui/GameRoot.tsx` は、`@tsuzuru/standard-ui-preact` の `TsuzuruGame` を使って本編画面を表示しています。
UI を細かく変えたい場合は、ここからカスタマイズできます。

## ファイル構成

```txt
scenario/main.tzr
public/assets/images/
public/assets/audio/
src/App.tsx
src/assets.ts
src/screens/TitleScreen.tsx
src/ui/GameRoot.tsx
src/styles.css
```
