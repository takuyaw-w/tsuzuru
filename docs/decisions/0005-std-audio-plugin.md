# 0005: Standard Audio Plugin

## Status

Accepted

## Context

visual novel では BGM / SE / Voice は頻出します。

一方で、Core は audio renderer に依存すべきではありません。Core が `HTMLAudioElement`、Web Audio API、browser autoplay handling、音声 file path、asset loader に依存すると、Tsuzuru の runtime state と実行モデルが特定 renderer / browser behavior に結び付きます。

ただし、公式標準 plugin として audio state / event の共通仕様は持ちたいです。

audio には種類ごとの性質の違いがあります。BGM は場面をまたいで継続する状態ですが、SE / Voice は一回性 event として扱う方が自然です。

## Decision

`@tsuzuru/plugin-std-audio` を提供します。

これは Tsuzuru 公式の standard plugin として扱います。sample plugin ではなく、共通 audio state / audio event を扱う標準 package です。

plugin state key は `stdAudio` とします。

```ts
runtimeState.plugins.stdAudio
```

提供する command は次の 4 つです。

```txt
@startBgm("assetId")
@stopBgm()
@se("assetId")
@voice("assetId")
```

`@stopBgm()` は parentheses 必須です。bare command form は採用しません。

## State Design

std-audio state は renderer 非依存のデータだけを持ちます。

```ts
{
  bgm: null,
  seEvents: [],
  voiceEvents: [],
  nextSeSequence: 1,
  nextVoiceSequence: 1,
}
```

`bgm` は未設定時に `null` です。BGM が設定されている場合は `assetId` だけを持つ object です。

```ts
bgm: null | { assetId: string }
```

`seEvents` は、SE の一回性 event を保持します。

```ts
seEvents: readonly { assetId: string, sequence: number }[]
```

`voiceEvents` は、Voice の一回性 event を保持します。

```ts
voiceEvents: readonly { assetId: string, sequence: number }[]
```

`nextSeSequence` / `nextVoiceSequence` は次に発生する event の sequence を保持します。

## Why BGM Is State

BGM は継続状態です。

scenario 上で一度開始された BGM は、停止されるか別の BGM で上書きされるまで続きます。そのため、runtime state 上では現在の BGM を `bgm` として保持します。

save/load でも、BGM は現在状態として復元されるべきです。

## Why SE / Voice Are One-Shot Events

SE / Voice は一回性 event として扱います。

理由:

- 再生済み event と現在継続中 state を混同しない
- renderer / app が sequence を見て未消費 event だけ再生できる
- 同一 `assetId` の連続再生も表現できる
- 前の voice を停止するかどうかは renderer / app の責務にできる

SE / Voice を現在状態として保持すると、同じ音を連続して鳴らす意図や、再生済み event の扱いが曖昧になります。

## Why No `currentVoice`

plugin state には `currentVoice` を持ちません。

Voice は一回性 event です。前の voice を止めるか、重ねるか、無視するかは renderer / app の判断です。

std-audio plugin は audio engine の再生状態を持ちません。`currentVoice` を持つと、plugin が実際の playback policy に踏み込み、renderer / app の責務と混ざります。

v0.2 初期では `@stopVoice` も提供しません。

## Why Sequence Starts at 1

`nextSeSequence` / `nextVoiceSequence` の初期値は `1` とします。

これにより、renderer / app 側の `lastConsumedSeSequence` / `lastConsumedVoiceSequence` を `0` 初期値にできます。

最初の event が `sequence: 1` になるため、未消費 event 判定も読みやすくなります。

```ts
let lastConsumedSeSequence = 0;

for (const event of audio.seEvents) {
  if (event.sequence > lastConsumedSeSequence) {
    playSe(event.assetId);
    lastConsumedSeSequence = event.sequence;
  }
}
```

## Save / Snapshot Policy

save 時は `seEvents` / `voiceEvents` を空にします。

```ts
{
  bgm: currentBgm,
  seEvents: [],
  voiceEvents: [],
  nextSeSequence: currentNextSeSequence,
  nextVoiceSequence: currentNextVoiceSequence,
}
```

方針:

- `bgm` は保存する
- `seEvents` は保存時に空にする
- `voiceEvents` は保存時に空にする
- `nextSeSequence` は保持する
- `nextVoiceSequence` は保持する

SE / Voice は一回性 event なので、load 後に過去 event が再生されるべきではありません。一方で、sequence counter は load 後も単調増加させたいので保持します。

このため、std-audio は helper として `prepareStdAudioStateForSnapshot(runtimeState)` を提供します。

```ts
import { createRuntimeSnapshot } from "@tsuzuru/core";
import { prepareStdAudioStateForSnapshot } from "@tsuzuru/plugin-std-audio";

const snapshot = createRuntimeSnapshot(
  prepareStdAudioStateForSnapshot(runtimeState),
);
```

Core の snapshot API には plugin 固有 hook を追加しません。Core は plugin state を汎用的に扱い、plugin 固有の save semantics は plugin 側 helper と app / save adapter 側の呼び出しで表現します。

## Why No Asset Resolver

std-audio state には file path を保存せず、`assetId` だけを保存します。

理由:

- scenario / runtime state を file layout に結合しない
- app ごとの asset map を許容する
- asset file の配置を変更しても save data の意味を保ちやすい
- bundler や hosting 環境ごとの path 解決を renderer / app 側に任せられる
- audio file format や loading strategy を plugin に固定しない

これは std-visual と同じ方針です。`assetId` は scenario と app の asset map の間の安定した識別子として扱います。

## Validation Policy

空文字の `assetId` は schema validation error にします。

```txt
@startBgm("")
@se("")
@voice("")
```

未対応追加引数も schema validation error にします。

```txt
@startBgm("main_theme", volume=0.8)
@se("click", volume=0.8)
@voice("alice_001", volume=0.8)
```

`@stopBgm()` は BGM 未設定でも no-op です。runtime warning は v0.2 初期では持ちません。

runtime warning を持たない理由は、std-audio の v0.2 初期 command set には std-visual の missing hide target に相当する runtime target error がないためです。

## Deferred Scope

次の機能はこの decision の scope 外です。

- volume
- loop
- fade
- channel
- stopVoice
- stopSe
- currentVoice
- actual playback
- asset resolver
- examples
- renderer components

これらは必要になった時点で別途設計します。

## Consequences

### Positive

- Core を audio renderer 非依存に保てる
- BGM state と one-shot event の責務が明確になる
- save/load semantics が明確になる
- renderer / app が自由に audio engine を選べる
- 同じ SE / Voice asset を連続再生する意図を表現できる
- asset path 解決を app 側に任せることで bundler / hosting 差分を吸収しやすい

### Negative

- renderer / app 側に event consumption 管理が必要
- actual playback は別途実装が必要
- volume / fade などはまだ扱えない
- audio file missing や browser autoplay 制約への対応は plugin では解決しない

## Reconsideration Criteria

次の条件が出てきた場合、この decision を見直します。

- `assetId` だけでは save/load や renderer 実装に不足する
- 複数 renderer 間で audio state / event の互換性を保てない
- BGM に volume / fade / loop / channel を標準 state として追加する必要が出る
- SE の loop / stop / channel 管理が standard plugin に必要になる
- Voice を一回性 event ではなく current state として扱う必要が明確になる
- browser autoplay 対応を standard plugin に含める必要が明確になる

## Related Documents

- `docs/plugins/std-audio.md`
- `docs/plugins/std-visual.md`
- `docs/decisions/0004-std-visual-plugin.md`
