# std-audio plugin

> Status: DSL v2-first. Runtime handlers and plugin command metadata are
> current, and `createStdAudioPlugin()` exposes metadata for compiler
> validation. The
> current runnable integration is
> [`examples/preact-basic`](../../examples/preact-basic/).

`@tsuzuru/plugin-std-audio` は、Tsuzuru 公式の standard audio plugin です。

この plugin は、BGM state と SE / Voice の一回性 event を renderer / app 非依存の runtime state として管理します。

この plugin は次のことを行いません。

- 実際の音声再生
- Web Audio / `HTMLAudioElement` の制御
- `assetId` から audio path / URL への解決
- volume / loop / fade / channel 制御

renderer / app は、この plugin が保持する `assetId` と event をもとに、実際の音声再生、停止、autoplay 制約への対応を行います。

## Installation / Registration

plugin state を初期化するには、runtime state 作成時に `createStdAudioPlugin()` を登録します。

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdAudioPlugin()],
});
```

DSL v2 compiler は、対応済みの `bgm` / `stopBgm` / `se` / `voice` statement を runtime `CommandInstruction` に変換します。compile 時に `plugins: [createStdAudioPlugin()]` を渡すと、std audio command metadata に基づいて command name と argument shape を検証します。

runtime 実行時は std-audio command handler を渡します。

```ts
import { stepRuntime } from "@tsuzuru/core";
import { createStdAudioCommandHandlers } from "@tsuzuru/plugin-std-audio";

const result = stepRuntime(document, runtimeState, {
  commandHandlers: createStdAudioCommandHandlers(),
});
```

## Runtime State

std-audio の状態は `runtimeState.plugins.stdAudio` に保存されます。

```ts
runtimeState.plugins.stdAudio
```

state の形は次のとおりです。

```ts
{
  bgm: null | { assetId: string },
  seEvents: readonly { assetId: string, sequence: number }[],
  voiceEvents: readonly { assetId: string, sequence: number }[],
  nextSeSequence: number,
  nextVoiceSequence: number,
}
```

初期 state は次の値です。

```ts
{
  bgm: null,
  seEvents: [],
  voiceEvents: [],
  nextSeSequence: 1,
  nextVoiceSequence: 1,
}
```

renderer / app から state を読む場合は `getStdAudioState(runtimeState)` を使えます。`stdAudio` state が初期化されていない場合、この helper は例外を投げます。

```ts
import { getStdAudioState } from "@tsuzuru/plugin-std-audio";

const audio = getStdAudioState(runtimeState);
```

## Commands

### `bgm assetId`

現在の BGM を設定します。

```txt
bgm main_theme
```

仕様:

- `bgm` を `{ assetId }` に設定する
- 既存 BGM は常に上書きする
- 同じ `assetId` の再指定でも warning は出さない
- `seEvents` / `voiceEvents` / sequence には影響しない

実行後の state:

```ts
bgm: { assetId: "main_theme" }
```

### `stopBgm`

現在の BGM を停止します。

```txt
stopBgm
```

仕様:

- `bgm` を `null` にする
- BGM 未設定でも no-op
- BGM 未設定時に warning は出さない
- `seEvents` / `voiceEvents` / `nextSeSequence` / `nextVoiceSequence` には影響しない

実行後の state:

```ts
bgm: null
```

### `se assetId`

SE を一回再生する event を追加します。

```txt
se click
```

仕様:

- `seEvents` に一回性 event を append する
- event shape は `{ assetId, sequence }`
- `sequence` は `nextSeSequence` から採番する
- 実行後に `nextSeSequence` を +1 する
- 同じ `assetId` の連続実行でも毎回 append する
- `bgm` / `voiceEvents` / `nextVoiceSequence` には影響しない

実行後の state:

```ts
seEvents: [
  { assetId: "click", sequence: 1 },
],
nextSeSequence: 2
```

renderer / app は `lastConsumedSeSequence` のような値を保持し、未処理の SE event だけを再生します。

```ts
let lastConsumedSeSequence = 0;

for (const event of audio.seEvents) {
  if (event.sequence > lastConsumedSeSequence) {
    playSe(event.assetId);
    lastConsumedSeSequence = event.sequence;
  }
}
```

### `voice assetId`

Voice を一回再生する event を追加します。

```txt
voice alice_001
```

仕様:

- `voiceEvents` に一回性 event を append する
- event shape は `{ assetId, sequence }`
- `sequence` は `nextVoiceSequence` から採番する
- 実行後に `nextVoiceSequence` を +1 する
- 同じ `assetId` の連続実行でも毎回 append する
- `bgm` / `seEvents` / `nextSeSequence` には影響しない

実行後の state:

```ts
voiceEvents: [
  { assetId: "alice_001", sequence: 1 },
],
nextVoiceSequence: 2
```

renderer / app は `lastConsumedVoiceSequence` のような値を保持し、未処理の Voice event だけを再生します。

```ts
let lastConsumedVoiceSequence = 0;

for (const event of audio.voiceEvents) {
  if (event.sequence > lastConsumedVoiceSequence) {
    playVoice(event.assetId);
    lastConsumedVoiceSequence = event.sequence;
  }
}
```

`voice` は一回性 event です。v0.2 初期では、`stopVoice` や current voice state は提供しません。再生中の voice を停止してから次の voice を再生するか、重ねるか、無視するかは renderer / app 側が決めます。

## Validation Behavior

`bgm` / `se` / `voice` の `assetId` は非空文字列である必要があります。

```txt
bgm ""
se ""
voice ""
```

これらは validation error です。

`stopBgm` は引数なしのみ有効です。次のような引数付き形式は validation error です。

```txt
stopBgm "main_theme"
```

v0.2 初期では、未対応の追加引数を許可しません。

```txt
bgm main_theme volume=0.8
se click volume=0.8
voice alice_001 volume=0.8
```

これらは validation error です。未知 option は無視しません。

runtime では、これらの statement は `startBgm` / `stopBgm` / `se` / `voice` の `CommandInstruction` として handler に渡されます。

## Save / Snapshot Behavior

std-audio は save 用 helper として `prepareStdAudioStateForSnapshot(runtimeState)` を提供します。

```ts
import { createRuntimeSnapshot } from "@tsuzuru/core";
import { prepareStdAudioStateForSnapshot } from "@tsuzuru/plugin-std-audio";

const snapshot = createRuntimeSnapshot(
  prepareStdAudioStateForSnapshot(runtimeState),
);
```

save 時の方針:

- `bgm` は保存する
- `seEvents` は空配列にする
- `voiceEvents` は空配列にする
- `nextSeSequence` は保持する
- `nextVoiceSequence` は保持する

例:

```ts
{
  bgm: { assetId: "main_theme" },
  seEvents: [],
  voiceEvents: [],
  nextSeSequence: 3,
  nextVoiceSequence: 2,
}
```

SE / Voice は一回性 event なので、load 後に再生されるべきではありません。そのため、save 時に `seEvents` / `voiceEvents` は破棄されます。

一方で、sequence counter は保持します。これにより、load 後に発生する SE / Voice event も単調増加した sequence を持てます。

`prepareStdAudioStateForSnapshot(runtimeState)` は元の `runtimeState` を mutate せず、新しい `RuntimeState` を返します。`runtimeState.plugins.stdAudio` が初期化されていない場合は、`getStdAudioState(runtimeState)` と同じく例外を投げます。

## Renderer / App Responsibility

renderer / app は、std-audio state と event を実際の音声再生へ接続します。

主な責務:

- `assetId` から音声ファイル path / URL への解決
- BGM の再生・停止
- SE event の消費管理
- Voice event の消費管理
- `lastConsumedSeSequence` / `lastConsumedVoiceSequence` 相当の管理
- audio file missing 時の表示・warning
- volume / fade / channel などの演出制御

例:

```ts
const bgmAssets = {
  main_theme: "/assets/audio/bgm/main_theme.mp3",
} as const;

const seAssets = {
  click: "/assets/audio/se/click.mp3",
} as const;

const voiceAssets = {
  alice_001: "/assets/audio/voice/alice_001.mp3",
} as const;
```

BGM は `audio.bgm` の変化を見て再生・停止します。

```ts
const bgm = audio.bgm;

if (bgm === null) {
  stopCurrentBgm();
} else {
  playBgm(bgmAssets[bgm.assetId]);
}
```

SE / Voice は sequence を使って未消費 event だけを再生します。消費済み sequence の保持場所や、save/load 時の扱いは renderer / app が決めます。

## Design Boundaries

std-audio plugin は、v0.2 初期では次の機能を持ちません。

- actual audio playback
- asset resolver
- volume
- loop option
- fade
- channel
- currentVoice state
- stopVoice command
- SE / Voice stop command
- renderer components

これらは renderer / app 側、または将来の拡張で扱います。
