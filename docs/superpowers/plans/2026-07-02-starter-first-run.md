# Starter 初回体験改善 実装計画

> **実装担当エージェント向け:** この計画を実装するときは、必ず `superpowers:subagent-driven-development` 推奨、または `superpowers:executing-plans` を使って、タスクごとに進める。手順はチェックボックス形式で進捗管理する。

**目標:** `create-tsuzuru` が生成する starter を package manager 中立にし、npm 起点で初回起動と `scenario/main.tzr` 編集まで迷わず進める状態にする。

**構成:** 生成テンプレートは package manager 固定を持たず、install は利用者が選んだ package manager で明示的に行う。CLI は起動に使われた package manager に応じて `install -> check:scenario -> dev` を案内し、README は npm を基本にした初回体験を説明する。

**技術:** TypeScript、Vitest、`create-tsuzuru` template、Vite、Preact、Tsuzuru の現行 `.tzr` DSL。

---

## 変更するファイル

- 変更: `packages/create-tsuzuru/templates/basic/package.json`
  - 生成 starter の scripts と package manager 固定の有無を管理する。
- 変更: `packages/create-tsuzuru/templates/basic/README.md`
  - 生成された project を初めて触る人向けの手順を書く。
- 変更: `packages/create-tsuzuru/templates/basic/scenario/main.tzr`
  - README から指しやすい初回編集ポイントを提供する。変更が不要なら触らない。
- 変更: `packages/create-tsuzuru/src/index.ts`
  - `create-tsuzuru` 実行後に表示する next steps を出力する。
- 変更: `packages/create-tsuzuru/tests/create-project.test.ts`
  - 生成されたファイルの内容を検証する。
- 変更: `packages/create-tsuzuru/tests/index.test.ts`
  - CLI next steps を検証する。

## タスク 1: 生成 starter の期待値を test に追加する

**対象ファイル:**

- 変更: `packages/create-tsuzuru/tests/create-project.test.ts`

- [ ] **手順 1: package.json の期待値を更新する**

`packages/create-tsuzuru/tests/create-project.test.ts` の `"includes a check:scenario script"` test を、package manager 中立性を検証する test に置き換える。

test body は次の内容にする。

```ts
it("uses package-manager neutral starter scripts", async () => {
  const root = await createTempRoot();

  await createProject({ cwd: root, projectName: "my-game" });
  const packageJson = JSON.parse(await readFile(join(root, "my-game", "package.json"), "utf8")) as {
    readonly packageManager?: string;
    readonly scripts: Record<string, string>;
  };

  expect(packageJson.packageManager).toBeUndefined();
  expect(packageJson.scripts.dev).toBe("vite");
  expect(packageJson.scripts.build).toBe("tsuzuru check && vite build");
  expect(packageJson.scripts["check:scenario"]).toBe("tsuzuru check");
  expect(packageJson.scripts.typecheck).toBe("tsc -p tsconfig.json --noEmit");
});
```

- [ ] **手順 2: README の初回導線の期待値を追加する**

同じファイルの `"generates a creator-facing app shell"` test に、既存の `readmeSource` 検証を残したまま、次の assertion を追加する。

```ts
expect(readmeSource).toContain("npm install");
expect(readmeSource).toContain("npm run dev");
expect(readmeSource).toContain("npm run check:scenario");
expect(readmeSource).toContain("scenario/main.tzr を編集");
expect(readmeSource).toContain("npm 以外を使っている場合");
expect(readmeSource).not.toContain("pnpm dev");
expect(readmeSource).not.toContain("pnpm install --prefer-offline");
```

- [ ] **手順 3: 対象を絞った test を実行し、失敗を確認する**

実行する。

```sh
rtk pnpm --filter create-tsuzuru test -- --run tests/create-project.test.ts
```

実装前の期待結果:

- 生成された `package.json` の `dev` がまだ `pnpm install --prefer-offline && vite` なので失敗する。
- 生成された `package.json` にまだ `packageManager` があるので失敗する。
- README に npm 起点の新しい初回導線がまだないので失敗する。

## タスク 2: 生成 starter の package.json を package manager 中立にする

**対象ファイル:**

- 変更: `packages/create-tsuzuru/templates/basic/package.json`

- [ ] **手順 1: template package.json を更新する**

`packages/create-tsuzuru/templates/basic/package.json` を変更し、install を script 内で実行しない形にする。
また、`packageManager` field を削除する。

最終形は次の内容にする。

```json
{
  "name": "{{projectName}}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsuzuru check && vite build",
    "check:scenario": "tsuzuru check",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tsuzuru/config": "^1.0.0",
    "@tsuzuru/core": "^1.0.0",
    "@tsuzuru/plugin-std-audio": "^1.0.0",
    "@tsuzuru/plugin-std-effect": "^1.0.0",
    "@tsuzuru/plugin-std-visual": "^1.0.0",
    "@tsuzuru/preact": "^1.0.0",
    "@tsuzuru/standard-game-storage": "^1.0.0",
    "@tsuzuru/standard-ui-preact": "^1.0.0",
    "preact": "^10.29.3"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.10.5",
    "@tsuzuru/cli": "^1.0.0",
    "@tsuzuru/vite-plugin": "^1.0.0",
    "typescript": "^6.0.3",
    "vite": "^8.1.2"
  }
}
```

- [ ] **手順 2: package script test を再実行する**

実行する。

```sh
rtk pnpm --filter create-tsuzuru test -- --run tests/create-project.test.ts
```

この時点の期待結果:

- package script の期待値は通る。
- README の期待値は、タスク 3 が終わるまでは失敗してよい。

## タスク 3: 生成 starter の README を初回体験向けに書き直す

**対象ファイル:**

- 変更: `packages/create-tsuzuru/templates/basic/README.md`
- 変更: `packages/create-tsuzuru/templates/basic/scenario/main.tzr`

- [ ] **手順 1: README の冒頭を書き直す**

`packages/create-tsuzuru/templates/basic/README.md` の冒頭を、次の構成にする。

````md
# {{projectName}}

Tsuzuru でノベルゲームを作るためのスターターです。

まずは、生成された project を起動して、`scenario/main.tzr` を少し編集し、ブラウザ上の表示が変わるところまで確認します。

## 起動する

依存関係を入れます。

```sh
npm install
```

開発サーバーを起動します。

```sh
npm run dev
```

シナリオだけを確認したい場合は、次のコマンドを使います。

```sh
npm run check:scenario
```

公開用に build する場合は、次のコマンドを使います。

```sh
npm run build
```

npm 以外を使っている場合は、同じ script 名を使ってください。

```sh
pnpm install
pnpm dev
```

```sh
yarn install
yarn dev
```

## 最初に編集する

まず `scenario/main.tzr` を編集します。

```tzr
mio:
  こんにちは。
  これは Tsuzuru のスターターです。
```

たとえば、このセリフを好きな文章に変えて保存します。
ブラウザに戻ると、Start 後の表示が変わります。
````

後続の説明は残す。ただし、Preact、runtime、plugin、storage、theme の詳細は、初回起動と `.tzr` 編集の後に置く。

- [ ] **手順 2: よく編集するファイルの案内を残す**

初回導線の後に、次のような短いファイル案内を置く。

````md
## よく編集するファイル

- `scenario/main.tzr`
  セリフ、ナレーション、背景、キャラクター表示、選択肢、分岐を書きます。

- `public/assets/images/`
  背景や立ち絵の画像を置きます。

- `public/assets/audio/`
  BGM、効果音、ボイスを置きます。

- `src/assets.ts`
  `.tzr` で使う asset id と、実際の画像や音声ファイルをつなぎます。

- `tsuzuru.config.ts`
  シナリオの場所や storage の宣言的な設定をまとめています。
````

- [ ] **手順 3: 詳細説明は後半に残す**

次の話題は、初回起動と `.tzr` 編集の説明より後に残す。

- `classroom` や `mio_smile` などの asset id
- `src/App.tsx` で title screen を変えること
- `src/themes/localTheme.ts` で theme を変えること
- Load / Config が starter では placeholder であること
- `src/ui/GameRoot.tsx` が standard UI との接続点であること

文章は日本語にする。
legacy DSL syntax は追加しない。

- [ ] **手順 4: scenario の文言を README と合わせる**

README が既存の starter セリフを指すので、`packages/create-tsuzuru/templates/basic/scenario/main.tzr` の該当箇所は次の形を保つ。

```tzr
mio:
  こんにちは。
  これは Tsuzuru のスターターです。
```

macro、preset、stage syntax、legacy syntax は追加しない。

- [ ] **手順 5: 生成 project の test を実行する**

実行する。

```sh
rtk pnpm --filter create-tsuzuru test -- --run tests/create-project.test.ts
```

期待結果:

- 生成された package scripts の検証が通る。
- README の初回導線の検証が通る。
- legacy DSL syntax exclusion の検証が通る。

## タスク 4: CLI next steps をそろえる

**対象ファイル:**

- 変更: `packages/create-tsuzuru/tests/index.test.ts`
- 変更: `packages/create-tsuzuru/src/index.ts`

- [ ] **手順 1: CLI next steps の期待値を更新する**

`packages/create-tsuzuru/tests/index.test.ts` の `it.each` cases を更新し、どの package manager でも install、scenario check、dev の順に表示されることを検証する。

期待値は次の配列にする。

```ts
{
  name: "npm",
  userAgent: "npm/11.0.0 node/v25.0.0 linux x64 workspaces/false",
  expectedNextSteps: ["npm install", "npm run check:scenario", "npm run dev"],
},
{
  name: "pnpm",
  userAgent: "pnpm/11.0.0 npm/? node/v25.0.0 linux x64",
  expectedNextSteps: ["pnpm install", "pnpm check:scenario", "pnpm dev"],
},
{
  name: "yarn",
  userAgent: "yarn/1.22.22 npm/? node/v25.0.0 linux x64",
  expectedNextSteps: ["yarn install", "yarn check:scenario", "yarn dev"],
},
{
  name: "unknown",
  userAgent: "bun/1.3.0 npm/? node/v25.0.0 linux x64",
  expectedNextSteps: ["npm install", "npm run check:scenario", "npm run dev"],
},
```

- [ ] **手順 2: CLI test を実行し、失敗を確認する**

実行する。

```sh
rtk pnpm --filter create-tsuzuru test -- --run tests/index.test.ts
```

実装前の期待結果:

- pnpm は現在 `pnpm dev` だけを出すので失敗する。
- unknown は現在 pnpm fallback なので失敗する。

- [ ] **手順 3: package manager detection の fallback を npm にする**

`packages/create-tsuzuru/src/index.ts` の `detectPackageManager` fallback を npm にする。

```ts
function detectPackageManager(userAgent = process.env.npm_config_user_agent): PackageManager {
  if (userAgent?.startsWith("pnpm/")) return "pnpm";
  if (userAgent?.startsWith("npm/")) return "npm";
  if (userAgent?.startsWith("yarn/")) return "yarn";
  return "npm";
}
```

- [ ] **手順 4: pnpm next steps を更新する**

`getNextStepCommands` の pnpm branch を次の内容にする。

```ts
case "pnpm":
  return ["pnpm install", "pnpm check:scenario", "pnpm dev"];
```

関数全体は次の形にする。

```ts
function getNextStepCommands(packageManager = detectPackageManager()): NextStepCommands {
  switch (packageManager) {
    case "npm":
      return ["npm install", "npm run check:scenario", "npm run dev"];
    case "pnpm":
      return ["pnpm install", "pnpm check:scenario", "pnpm dev"];
    case "yarn":
      return ["yarn install", "yarn check:scenario", "yarn dev"];
  }
}
```

- [ ] **手順 5: CLI test を再実行する**

実行する。

```sh
rtk pnpm --filter create-tsuzuru test -- --run tests/index.test.ts
```

期待結果:

- npm、pnpm、yarn、unknown user agent のすべてで test が通る。

## タスク 5: 検証してコミットする

**対象ファイル:**

- 変更: `packages/create-tsuzuru/templates/basic/package.json`
- 変更: `packages/create-tsuzuru/templates/basic/README.md`
- 変更: `packages/create-tsuzuru/templates/basic/scenario/main.tzr`
- 変更: `packages/create-tsuzuru/src/index.ts`
- 変更: `packages/create-tsuzuru/tests/create-project.test.ts`
- 変更: `packages/create-tsuzuru/tests/index.test.ts`

- [ ] **手順 1: create-tsuzuru の対象を絞った check を実行する**

実行する。

```sh
rtk pnpm --filter create-tsuzuru test
rtk pnpm --filter create-tsuzuru typecheck
```

期待結果:

- どちらも通る。

- [ ] **手順 2: repository quality check を実行する**

実行する。

```sh
rtk pnpm format:check
rtk pnpm lint
rtk pnpm check
rtk git diff --check
```

期待結果:

- すべて通る。

- [ ] **手順 3: final diff を確認する**

実行する。

```sh
rtk git diff --stat
rtk git diff -- packages/create-tsuzuru/templates/basic/package.json packages/create-tsuzuru/templates/basic/README.md packages/create-tsuzuru/src/index.ts packages/create-tsuzuru/tests/create-project.test.ts packages/create-tsuzuru/tests/index.test.ts
```

期待結果:

- 差分は計画した starter、CLI、test の範囲に収まっている。
- legacy DSL syntax が入っていない。
- template に package manager lockfile が追加されていない。

- [ ] **手順 4: 実装をコミットする**

実行する。

```sh
git add packages/create-tsuzuru/templates/basic/package.json packages/create-tsuzuru/templates/basic/README.md packages/create-tsuzuru/src/index.ts packages/create-tsuzuru/tests/create-project.test.ts packages/create-tsuzuru/tests/index.test.ts
git add packages/create-tsuzuru/templates/basic/scenario/main.tzr
git commit -m "fix(create-tsuzuru): improve starter first-run flow"
```

`scenario/main.tzr` が変更されていない場合は、`git add` から外す。

期待結果:

- 実装 commit が 1 つ作成される。
- working tree には意図した差分だけが残る。
