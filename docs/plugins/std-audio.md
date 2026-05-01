# std-audio plugin

`@tsuzuru/plugin-std-audio` は、Tsuzuru 公式の標準 audio plugin です。

この plugin は、BGM、SE、Voice の再生意図を renderer 非依存の runtime state として管理します。`HTMLAudioElement` や Web Audio API を直接操作せず、`assetId` から実際の音声 file path / URL への解決も行いません。

renderer / app は、この plugin が保持する `assetId` と audio event をもとに、実際の音声再生、停止、autoplay 制約への対応を行います。

## Installation / Registration

plugin state を初期化するには、runtime state 作成時に `createStdAudioPlugin()` を登録します。

```ts
import { createInitialRuntimeState } from "@tsuzuru/core";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";

const runtimeState = createInitialRuntimeState(document, {
  plugins: [createStdAudioPlugin()],
});
```

`.tzr` 内で std-audio command を使う場合は、compile 時に command schema も登録します。

```ts
import { compileTzr } from "@tsuzuru/core";
import { stdAudioPluginCommands } from "@tsuzuru/plugin-std-audio";

const compiled = compileTzr(parsed.document, {
  pluginCommands: stdAudioPluginCommands,
});
```

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
  seEvents: [
    {
      sequence: number,
      assetId: string,
    },
  ],
  voiceEvents: [
    {
      sequence: number,
      assetId: string,
    },
  ],
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

## State Types

std-audio は次の型を export します。

```ts
export type StdAudioState
export type StdAudioBgm
export type StdAudioSeEvent
export type StdAudioVoiceEvent
```

`StdAudioSeEvent` と `StdAudioVoiceEvent` は、runtime state 上では同じ shape です。

```ts
{
  sequence: number,
  assetId: string,
}
```

ただし TypeScript の構造的部分型により相互代入されることを避けるため、型定義上は branded type として扱います。

brand は runtime state には保存しません。JSON として保存される値は `sequence` と `assetId` だけです。

## Commands

### `@startBgm(assetId)`

現在の BGM を設定します。

```txt
@startBgm("daily_theme")
```

`assetId` は非空文字列である必要があります。`@startBgm` を再実行すると、以前の BGM は常に上書きされます。同じ `assetId` を再指定してもエラーにはなりません。

実行後の state:

```ts
bgm: { assetId: "daily_theme" }
```

`@startBgm` は `bgm` だけを更新します。`seEvents` / `voiceEvents` には影響しません。

v0.2 初期では、`volume` / `loop` / `fade` / `channel` は扱いません。BGM の loop や fade 処理が必要な場合は、renderer / app 側で実装します。

### `@stopBgm`

現在の BGM を停止します。

```txt
@stopBgm
```

実行後の state:

```ts
bgm: null
```

BGM が設定されていない状態で `@stopBgm` を実行した場合は no-op です。runtime warning は出しません。

`@stopBgm` は引数を取りません。

Invalid:

```txt
@stopBgm("daily_theme")
```

`@stopBgm` は `bgm` だけを `null` にします。`seEvents` / `voiceEvents` / `nextSeSequence` / `nextVoiceSequence` には影響しません。

### `@se(assetId)`

SE を一回再生する event を追加します。

```txt
@se("door_open")
```

`assetId` は非空文字列である必要があります。

SE は現在状態ではなく、一回性 event として扱います。`@se` を実行すると `seEvents` に新しい event が追加されます。

```ts
seEvents: [
  { sequence: 1, assetId: "door_open" }
]
```

同じ `assetId` を連続して指定した場合も、常に新しい event として追加されます。

```txt
@se("door_open")
@se("door_open")
```

実行後の state:

```ts
seEvents: [
  { sequence: 1, assetId: "door_open" },
  { sequence: 2, assetId: "door_open" }
],
nextSeSequence: 3
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

### `@voice(assetId)`

Voice を一回再生する event を追加します。

```txt
@voice("alice_001")
```

`assetId` は非空文字列である必要があります。

Voice は現在状態ではなく、一回性 event として扱います。`@voice` を実行すると `voiceEvents` に新しい event が追加されます。

```ts
voiceEvents: [
  { sequence: 1, assetId: "alice_001" }
]
```

同じ `assetId` を連続して指定した場合も、常に新しい event として追加されます。

```txt
@voice("alice_001")
@voice("alice_001")
```

実行後の state:

```ts
voiceEvents: [
  { sequence: 1, assetId: "alice_001" },
  { sequence: 2, assetId: "alice_001" }
],
nextVoiceSequence: 3
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

新しい voice event を検知したときに、再生中の voice を停止してから次の voice を再生するかどうかは renderer / app 側が決めます。

v0.2 初期では `@startVoice` / `@stopVoice` は提供しません。

## Validation Behavior

`@startBgm` / `@se` / `@voice` の `assetId` は非空文字列である必要があります。

```txt
@startBgm("")
@se("")
@voice("")
```

これらは schema validation error です。

`@stopBgm` は引数なしのみ有効です。

```txt
@stopBgm
```

次のような引数付き形式は schema validation error です。

```txt
@stopBgm("daily_theme")
```

v0.2 初期では、未対応の追加引数を許可しません。

```txt
@startBgm("daily_theme", volume=0.8)
@se("door_open", volume=0.8)
@voice("alice_001", volume=0.8)
```

これらは schema validation error です。

未知 option は無視しません。未対応の option が書かれている場合、compile 時に検出できるようにします。

## Runtime Warning Behavior

v0.2 初期の std-audio plugin は runtime warning を持ちません。

```txt
@stopBgm:
  bgm が null でも no-op
  warning なし

@startBgm:
  常に bgm を上書き
  warning なし

@se:
  常に seEvents に追加
  warning なし

@voice:
  常に voiceEvents に追加
  warning なし
```

std-visual の `@hide("missing")` のように、指定した runtime target が存在しないことを検出する command が std-audio にはありません。そのため、v0.2 初期では runtime warning を定義しません。

## Design Boundaries

std-audio plugin は、次の機能を持ちません。

- audio playback implementation
- `HTMLAudioElement` / Web Audio API integration
- browser autoplay handling
- asset resolver
- asset path / URL resolution
- volume option
- loop option
- fade in / fade out
- audio channel management
- SE stop command
- Voice stop command
- current voice state
- bundled audio assets

これらは renderer / app 側、または将来の拡張で扱います。

## Renderer Responsibility

renderer / app は、`assetId` を実際の音声 path、import 済み asset、URL などに対応付けます。

```ts
const bgmAssets = {
  daily_theme: "/assets/audio/bgm/daily_theme.mp3",
} as const;

const seAssets = {
  door_open: "/assets/audio/se/door_open.mp3",
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

SE は `seEvents` を監視し、未処理の event だけを再生します。

```ts
let lastConsumedSeSequence = 0;

for (const event of audio.seEvents) {
  if (event.sequence > lastConsumedSeSequence) {
    playSe(seAssets[event.assetId]);
    lastConsumedSeSequence = event.sequence;
  }
}
```

Voice は `voiceEvents` を監視し、未処理の event だけを再生します。

```ts
let lastConsumedVoiceSequence = 0;

for (const event of audio.voiceEvents) {
  if (event.sequence > lastConsumedVoiceSequence) {
    stopCurrentVoiceIfNeeded();
    playVoice(voiceAssets[event.assetId]);
    lastConsumedVoiceSequence = event.sequence;
  }
}
```

音声ファイルが存在しない場合、再生に失敗した場合、または browser autoplay 制約により再生できない場合の扱いも renderer / app 側の責務です。

## Save / Load Behavior

BGM は現在状態なので save / load 対象です。

```ts
bgm: { assetId: "daily_theme" }
```

SE / Voice は一回性 event なので、過去の event は load 後に再生されるべきではありません。

そのため、std-audio の save data では `seEvents` / `voiceEvents` を空にする方針です。

```ts
{
  bgm: currentBgm,
  seEvents: [],
  voiceEvents: [],
  nextSeSequence: currentNextSeSequence,
  nextVoiceSequence: currentNextVoiceSequence,
}
```

`nextSeSequence` / `nextVoiceSequence` は保持します。これにより、load 後も sequence が単調増加し続けます。

```txt
BGM:
  - bgm は保存対象
  - load 後も現在 BGM として復元する

SE:
  - seEvents は save 時に空にする
  - 過去の SE は load 後に再生しない
  - nextSeSequence は保持する

Voice:
  - voiceEvents は save 時に空にする
  - 過去の Voice は load 後に再生しない
  - nextVoiceSequence は保持する
```

### Current Core Limitation

現時点の core snapshot API は、plugin state をそのまま clone します。plugin ごとの save serialization hook はまだありません。

そのため、この save behavior を実装するには、次のいずれかが必要です。

```txt
- core に plugin snapshot serialization hook を追加する
- std-audio 側に save 用 helper を提供し、app / save adapter 側で呼び出す
```

この制約が解消されるまでは、renderer / app 側で load 後の `lastConsumedSeSequence` / `lastConsumedVoiceSequence` を適切に初期化し、過去 event を再生しないようにする必要があります。

## Example

std-audio の Preact example は、専用 example として提供します。

```txt
examples/preact-std-audio
```

この example は、次の内容を示します。

```txt
- @startBgm / @stopBgm / @se / @voice を使う .tzr
- audio asset map
- AudioLayer / AudioController 相当の実装
- BGM の再生・停止
- SE / Voice event の lastConsumedSequence 処理
```

asset map は用途別に分けます。

```ts
// examples/preact-std-audio/src/assets.ts

export const bgmAssets = {
  daily_theme: "/assets/audio/bgm/daily_theme.mp3",
} as const;

export const seAssets = {
  door_open: "/assets/audio/se/door_open.mp3",
} as const;

export const voiceAssets = {
  alice_001: "/assets/audio/voice/alice_001.mp3",
} as const;
```

v0.2 初期では、実音声ファイルは同梱しません。著作権・ライセンス管理負荷を避けるためです。

動作確認する場合は、任意の音声ファイルを次の path に配置してください。

```txt
examples/preact-std-audio/public/assets/audio/bgm/daily_theme.mp3
examples/preact-std-audio/public/assets/audio/se/door_open.mp3
examples/preact-std-audio/public/assets/audio/voice/alice_001.mp3
```

音声ファイルが存在しない場合でも、example 自体は起動できるようにします。再生失敗時は console warning または画面上の notice で通知します。

## Deferred Scope

次の機能は v0.2 初期では扱いません。

```txt
- @bgm(assetId)
- @stopBgm(assetId)
- @startVoice(assetId)
- @stopVoice
- @stopSe
- volume option
- loop option
- fade option
- channel option
- currentVoice state
- audio resolver
- built-in audio player
- bundled audio assets
- automatic browser autoplay recovery
- voice line binding with speaker blocks
- audio sprite support
- crossfade
- per-scene audio policy
```

これらは必要になった時点で別途設計します。
