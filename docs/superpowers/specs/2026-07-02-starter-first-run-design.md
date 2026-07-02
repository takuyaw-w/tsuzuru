# Starter 初回体験改善 Design

## 目的

`create-tsuzuru` で生成した project を、npm や Vite に詳しくない人でも最初に起動しやすい状態にする。

最初の成功体験は、次の流れに固定する。

```sh
npm install
npm run dev
```

その後、`scenario/main.tzr` を少し編集し、ブラウザ上の表示が変わることを確認できる状態にする。

## 方針

生成 project は package manager 中立にする。

- npm を初回説明の基本にする
- pnpm や yarn は、利用者がすでに使っている場合の補足にする
- 生成 project の script 内で package install を自動実行しない
- 生成 project を pnpm 必須に見せない

## 対象ファイル

主な対象は次のファイルとする。

- `packages/create-tsuzuru/templates/basic/package.json`
- `packages/create-tsuzuru/templates/basic/README.md`
- `packages/create-tsuzuru/templates/basic/scenario/main.tzr`
- `packages/create-tsuzuru/src/index.ts`
- `packages/create-tsuzuru/tests/create-project.test.ts`
- `packages/create-tsuzuru/tests/index.test.ts`

`scenario/main.tzr` は大きく変えない。README から指しやすい初回編集ポイントが必要な場合だけ、文言を小さく調整する。

## 変更内容

### 生成 project の package script

`dev` script は `vite` のみにする。

```json
"dev": "vite"
```

`pnpm install --prefer-offline` は削除する。
install は利用者が選んだ package manager で明示的に行う。

生成 project の `packageManager` は削除する。
これにより、starter が pnpm を必須にしているように見える状態を避ける。

### 生成 project の README

README は生成後ユーザー向けに書く。

先頭の導線は次の順にする。

1. 依存関係を入れる
2. 開発サーバーを起動する
3. `scenario/main.tzr` を編集する
4. ブラウザで変化を見る

基本コマンドは npm で示す。

```sh
npm install
npm run dev
```

pnpm と yarn は、すでに使っている人向けの補足に留める。

README では、最初から Preact、runtime、plugin、storage、theme の詳細を前面に出さない。
それらは「慣れてきたら」以降に置く。

### CLI の next steps

`npm create tsuzuru@latest my-game` で生成した場合は、npm の手順を案内する。

pnpm や yarn で起動された場合も、install、scenario check、dev の順に案内する。

例:

```txt
cd my-game
pnpm install
pnpm check:scenario
pnpm dev
```

ただし、生成 project 自体は pnpm に固定しない。

### Test

次を test で確認する。

- generated `package.json` の `dev` script が `vite` であること
- generated `package.json` に `packageManager` がないこと
- generated README が npm の初回手順を含むこと
- generated README が `scenario/main.tzr` の編集を案内していること
- CLI next steps が各 package manager に対して期待どおりであること

## やらないこと

この作業では次を行わない。

- UI の大幅な見た目変更
- save/load の実装追加
- Load / Config ボタンの機能追加
- plugin API の変更
- runtime の変更
- examples 全体の再整理

## 完了条件

- `create-tsuzuru` の generated starter が package manager 中立になっている
- npm 起点の初回導線が README と CLI の両方で分かる
- `scenario/main.tzr` を編集する最初の体験が README に明記されている
- 関連 test が更新されている
- focused check が通る
