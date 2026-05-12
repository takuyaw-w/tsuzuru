# std-text-sound plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdTextSoundPlugin()` exposes metadata for compiler
> validation. The runnable integrations are
> [`examples/preact-basic`](../../examples/preact-basic/) and
> [`examples/vue-basic`](../../examples/vue-basic/).

`@tsuzuru/plugin-std-text-sound` は、いわゆる popopo / text blip sound に相当する Tsuzuru 公式の standard plugin です。

この plugin は、文字表示音の有効な sound id を renderer / app 非依存の runtime state として管理します。

この plugin は次のことを行いません。

- 実際の音声再生
- `Audio` / `AudioContext` / DOM の制御
- timer や text reveal の制御
- `assetId` から audio file / tone profile への解決
- volume / interval / punctuation skip / speaker-specific mapping の保持

renderer / app は、この plugin が保持する `assetId` をもとに、文字送りと同期して実際の再生を行います。

## Installation / Registration

plugin state を初期化するには、runtime state 作成時に `createStdTextSoundPlugin()` を登録します。

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdTextSoundPlugin } from "@tsuzuru/plugin-std-text-sound";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdTextSoundPlugin()],
});
```

runtime 実行時は std-text-sound command handler を渡します。

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdTextSoundCommandHandlers } from "@tsuzuru/plugin-std-text-sound";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdTextSoundCommandHandlers(),
});
```

## Runtime State

std-text-sound の状態は `runtimeState.plugins.stdTextSound` に保存されます。

```ts
runtimeState.plugins.stdTextSound
```

state の形は次のとおりです。

```ts
{
  current: null | { assetId: string },
}
```

初期 state は次の値です。

```ts
{
  current: null,
}
```

renderer / app から state を読む場合は `getStdTextSoundState(runtimeState)` を使えます。`stdTextSound` state が初期化されていない場合、この helper は例外を投げます。

## Commands

### `textSound assetId`

現在の text sound を設定します。

```txt
textSound soft
```

仕様:

- `current` を `{ assetId }` に設定する
- 既存 text sound は常に上書きする
- `assetId` は空文字不可
- 追加引数は不可

実行後の state:

```ts
current: { assetId: "soft" }
```

### `stopTextSound`

現在の text sound を停止します。

```txt
stopTextSound
```

仕様:

- `current` を `null` にする
- text sound 未設定でも no-op
- text sound 未設定時に warning は出さない
- 引数は不可

実行後の state:

```ts
current: null
```

## Presentation Policy

文字ごとの throttle、空白 / 改行 / 句読点で鳴らさない方針、volume、speaker-specific mapping は plugin state には入れません。

`examples/preact-basic` と `examples/vue-basic` では、example-owned presentation policy として次を実装しています。

- text reveal の timed character callback に同期する
- 空白、改行、句読点では鳴らさない
- reveal-all では鳴らさない
- text reveal disabled では鳴らさない
- 最小 interval を入れる
- `assets.ts` の `textSound.soft` tone profile を Web Audio oscillator に接続する

実音声素材は同梱していません。将来 audio file mapping に差し替える場合も、plugin package はその mapping shape を知りません。
