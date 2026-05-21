# std-visual plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdVisualPlugin()` exposes metadata for compiler
> validation. The
> current runnable integration is
> [`examples/preact-basic`](../../examples/preact-basic/).

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

DSL v2 compiler は、対応済みの `bg` / `show` / `hide` / `clear bg` / `clear sprites` statement を runtime `CommandInstruction` に変換します。compile 時に `plugins: [createStdVisualPlugin()]` を渡すと、std visual command metadata に基づいて command name と argument shape を検証します。

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
  background: null | {
    assetId: string,
    transition?: {
      effect: "cut" | "fade" | "pageTurn" | "blurFade" | "slide" | "wipeLeft" | "wipeRight",
      durationMs: number,
      direction?: "left" | "right" | "up" | "down",
      color?: string
    }
  },
  sprites: {
    [assetId: string]: {
      position: "left" | "center" | "right",
      transition?: {
        type: string,
        durationMs: number
      }
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

## Save/load policy

std-visual state is durable runtime plugin state. `background`, `sprites`, and
surviving transition metadata are kept as-is in `RuntimeSnapshot`.

std-visual does not have one-shot runtime events and does not require a
`prepareStdVisualStateForSnapshot` helper. `hide`, `clear bg`, and
`clear sprites` remove state during runtime execution; after that, the cleared
state remains cleared across snapshot / restore.

Renderer and app concerns are not part of the snapshot: asset path resolution,
pixel coordinates, responsive layout, safe areas, z-order policy, and actual
transition animation execution remain renderer-owned. v1.0 also does not
promise plugin state migration if the std-visual state shape changes later.

## Commands

### `bg assetId`

現在の背景を設定します。

```txt
bg classroom
bg library with fade(duration=500)
bg station with pageTurn(direction="left", duration=800)
bg rooftop with blurFade(duration=700)
bg hallway with slide(direction="up", duration=650)
bg library with wipeLeft(duration=450)
bg classroom with wipeRight(duration=450)
```

`assetId` は非空文字列である必要があります。`bg` を再実行すると、以前の背景は常に上書きされます。同じ `assetId` を再指定してもエラーにはなりません。`bg ... with ...` は背景切り替え演出であり、std-visual の renderer-independent background transition metadata として background state に保存されます。独立した std-transition plugin、standalone `transition` statement、GSAP dependency は採用しません。

実行後の state:

```ts
background: { assetId: "classroom" }
```

transition 付きの state:

```ts
background: {
  assetId: "library",
  transition: { effect: "fade", durationMs: 500, color: "#000000" },
}
```

初期対応 effect は `fade` / `pageTurn` / `blurFade` / `slide` / `wipeLeft` / `wipeRight` です。未指定の `bg assetId` は即時切り替えです。内部的には `cut` 相当の扱いですが、既存 state 互換のため transition metadata は省略できます。

default:

| effect | duration | direction | color |
| --- | ---: | --- | --- |
| `fade` | `500` | none | `"#000000"` |
| `pageTurn` | `800` | `"left"` | `"#ffffff"` |
| `blurFade` | `700` | none | `"#000000"` |
| `slide` | `650` | `"left"` | `"#000000"` |
| `wipeLeft` | `450` | none | `"#000000"` |
| `wipeRight` | `450` | none | `"#000000"` |

transition 実行は runtime を block しません。シナリオ上で厳密な待機が必要な場合は `wait` と組み合わせます。

### `show assetId at position`

sprite を表示、または既存 sprite の位置を更新します。

```txt
show alice_smile at center
show bob_normal at left
show alice_smile at center with dissolve(duration=250)
```

`assetId` は非空文字列である必要があります。`position` は `"left" | "center" | "right"` のいずれかです。runtime command handler では省略時に `"center"` になります。DSL sugar では現在 `at <placement>` が必須です。transition が指定された場合、sprite state に保存されます。

v1.0 で安定対象にする sprite placement は preset の `"left" | "center" | "right"` のみです。
`show asset at x=... y=...` のような coordinate placement は parser-level future syntax であり、現在の compiler は reject します。
std-visual state は coordinate / anchor / safe-area 情報を保持しません。
実際の pixel 位置、responsive layout、safe area への対応は renderer / app 側の責務であり、coordinate placement を安定化するには別途 renderer contract が必要です。

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

現在、sprite の `order` / `zIndex` は扱いません。

### `hide assetId`

`assetId` を指定して sprite を非表示にします。

```txt
hide alice_smile
hide alice_smile with fade(duration=100)
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

`hide` の transition metadata は command validation と handler argument validation には使われますが、sprite は削除されるため state には残りません。

### `clearBg`

現在の背景を消します。

```txt
clear bg
clear bg with dissolve(duration=100)
```

runtime command name は `clearBg` です。実行後、`background` は `null` になります。sprites は変更されません。すでに `background` が `null` の場合も no-op で、warning は出ません。

### `clearSprites`

すべての sprite を消します。

```txt
clear sprites
clear sprites with fade(duration=100)
```

runtime command name は `clearSprites` です。実行後、`sprites` は `{}` になります。background は変更されません。すでに sprites が空の場合も no-op で、warning は出ません。

`clearBg` / `clearSprites` の transition metadata は command validation と handler argument validation には使われますが、対象 state が削除されるため state には残りません。

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

`show` / `hide` / `clearBg` / `clearSprites` の plugin command は optional named args として `transition` と `duration` を受け取れます。現在の標準 sprite / clear transition 名は `"fade"` / `"dissolve"` です。`transition` と `duration` は必ず一緒に指定する必要があり、`duration` は `0` 以上の有限整数です。DSL sugar では `show` / `hide` / `clear` の `with fade(duration=300)` を `transition` / `duration` command args に変換します。

`bg` の plugin command は background transition metadata として `transition` / `duration` / `direction` / `color` を受け取れます。`transition` は `"fade"` / `"pageTurn"` / `"blurFade"` / `"slide"` / `"wipeLeft"` / `"wipeRight"`、`duration` は正の整数、`direction` は `"left"` / `"right"` / `"up"` / `"down"`、`color` は string です。`pageTurn` の direction は `"left"` / `"right"` に制限されます。`wipeLeft` / `wipeRight` は `direction` を受け取りません。未対応引数は validation error です。

一方、`hide missing` は script の構造としては有効です。対象 sprite が runtime state に存在しないだけなので、validation error ではなく no-op + runtime warning になります。

## Design Boundaries

std-visual plugin は、次の機能を持ちません。

- renderer 実装
- DOM / Preact component
- asset resolver
- asset path 解決
- transition animation execution
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
