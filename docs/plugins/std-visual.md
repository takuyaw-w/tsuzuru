# std-visual plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdVisualPlugin()` exposes metadata for compiler
> validation. The
> current runnable integration is
> [`examples/dsl-v2-basic`](../../examples/dsl-v2-basic/).

`@tsuzuru/plugin-std-visual` は、Tsuzuru 公式の標準 visual plugin です。

この plugin は、背景や sprite の表示状態を renderer 非依存の runtime state として管理します。DOM や Preact component は描画せず、`assetId` から実際の画像 path への解決も行いません。

renderer / app は、この plugin が保持する `assetId` をもとに画像 path や表示位置を決めます。

## Installation / Registration

plugin state を初期化するには、runtime state 作成時に `createStdVisualPlugin()` を登録します。

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdVisualPlugin()],
});
```

DSL v2 compiler は、対応済みの `bg` / `show` / `hide` statement を runtime `CommandInstruction` に変換します。compile 時に `plugins: [createStdVisualPlugin()]` を渡すと、std visual command metadata に基づいて command name と argument shape を検証します。

runtime 実行時は std-visual command handler を渡します。

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdVisualCommandHandlers } from "@tsuzuru/plugin-std-visual";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdVisualCommandHandlers(),
});
```

## Runtime State

std-visual の状態は `runtimeState.plugins.stdVisual` に保存されます。

```ts
runtimeState.plugins.stdVisual
```

state の形は次のとおりです。

```ts
{
  background: null | { assetId: string },
  sprites: {
    [assetId: string]: {
      position: "left" | "center" | "right"
    }
  }
}
```

初期 state は次の値です。

```ts
{
  background: null,
  sprites: {},
}
```

renderer / app から state を読む場合は `getStdVisualState(runtimeState)` を使えます。`stdVisual` state が初期化されていない場合、この helper は例外を投げます。

```ts
import { getStdVisualState } from "@tsuzuru/plugin-std-visual";

const visual = getStdVisualState(runtimeState);
```

## Commands

### `bg assetId`

現在の背景を設定します。

```txt
bg classroom
```

`assetId` は非空文字列である必要があります。`bg` を再実行すると、以前の背景は常に上書きされます。同じ `assetId` を再指定してもエラーにはなりません。

実行後の state:

```ts
background: { assetId: "classroom" }
```

v0.2 初期では、transition / duration は扱いません。背景を消すための clear background command もまだありません。

### `show assetId at position`

sprite を表示、または既存 sprite の位置を更新します。

```txt
show alice_smile
show bob_normal at left
```

`assetId` は非空文字列である必要があります。`position` は `"left" | "center" | "right"` のいずれかです。省略時は `"center"` になります。

実行後の state:

```ts
sprites: {
  alice_smile: { position: "center" },
  bob_normal: { position: "left" }
}
```

`sprites` の key は `assetId` です。sprite object 内に `assetId` は重複して保存しません。

同じ `assetId` に対して `show` を再実行すると、その sprite の state を上書きします。

```txt
show alice_smile at left
show alice_smile at right
```

結果:

```ts
sprites: {
  alice_smile: { position: "right" }
}
```

複数 sprite が同じ `position` を共有することもできます。実際の重なりや細かい座標調整は renderer / app 側の責務です。

v0.2 初期では、sprite の `order` / `zIndex` は扱いません。

### `hide assetId`

`assetId` を指定して sprite を非表示にします。

```txt
hide alice_smile
```

対象 sprite が存在する場合、`sprites` から削除されます。

```ts
delete runtimeState.plugins.stdVisual.sprites[assetId]
```

対象 sprite が存在しない場合は no-op です。ただし、runtime warning として次の code を通知します。

```ts
plugin.stdVisual.hideTargetNotFound
```

空文字 `assetId` は validation error です。missing target の warning は、非空文字列の `assetId` が実行時点で表示されていない場合だけ発生します。

## Validation Behavior

`bg` / `show` / `hide` の `assetId` は非空文字列である必要があります。

```txt
bg ""
show ""
hide ""
```

これらは validation error です。

`show` の `position` に `"left" | "center" | "right"` 以外を指定した場合も validation error です。

```txt
show alice at top
```

必須引数がない場合や、許可されていない余分な引数を渡した場合も validation error です。

一方、`hide missing` は script の構造としては有効です。対象 sprite が runtime state に存在しないだけなので、validation error ではなく no-op + runtime warning になります。

## Design Boundaries

std-visual plugin は、次の機能を持ちません。

- renderer 実装
- DOM / Preact component
- asset resolver
- asset path 解決
- transition / duration
- clear background command
- character ID / expression model
- background layers
- sprite order / zIndex

これらは renderer / app 側、または将来の拡張で扱います。

## Renderer Responsibility

renderer / app は、`assetId` を実際の画像 path や import 済み asset に対応付けます。

```ts
const backgroundAssets = {
  classroom: "/assets/backgrounds/classroom.png",
} as const;

const spriteAssets = {
  alice_smile: "/assets/sprites/alice_smile.png",
  bob_normal: "/assets/sprites/bob_normal.png",
} as const;
```

`position` は `"left" | "center" | "right"` という配置希望です。実際の CSS class、座標、画面幅ごとの調整、同じ position に複数 sprite がある場合の扱いは renderer / app が決めます。
