# 0005: Standard Audio Plugin

## Status

Accepted

## Context

Tsuzuru には、BGM、SE、Voice を扱う audio command が必要です。visual novel では、場面に応じた BGM 再生、効果音、台詞音声は頻出の authoring 操作です。

一方で、Core は renderer 非依存である必要があります。Core が `HTMLAudioElement`、Web Audio API、browser autoplay handling、音声 file path、asset loader に依存すると、Tsuzuru の runtime state と実行モデルが特定 renderer / browser behavior に結び付いてしまいます。

audio behavior は公式に提供したい一方で、Core に hardcode するべきではありません。

また、audio には visual と異なる性質があります。BGM は現在状態として保持できますが、SE と Voice は一回性の再生 event として扱う必要があります。

## Decision

`@tsuzuru/plugin-std-audio` を提供します。

これは Tsuzuru 公式の standard plugin として扱います。sample plugin ではなく、共通 audio state / audio event を扱う標準 package です。

plugin state key は `stdAudio` とします。

```ts
runtimeState.plugins.stdAudio
```

提供する command は次の 4 つです。

```txt
@startBgm
@stopBgm
@se
@voice
```

次の command は v0.3 scope では提供しません。

```txt
@bgm
@stopBgm(assetId)
@startVoice
@stopVoice
@stopSe
```

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
seEvents: [
  {
    sequence: number,
    assetId: string,
  }
]
```

`voiceEvents` は、Voice の一回性 event を保持します。

```ts
voiceEvents: [
  {
    sequence: number,
    assetId: string,
  }
]
```

`sequence` は event の発生順を表します。最初の event は `1` から始まります。

```ts
nextSeSequence: 1
nextVoiceSequence: 1
```

renderer / app 側は `lastConsumedSeSequence` / `lastConsumedVoiceSequence` のような値を保持し、未処理の event だけを再生します。

## Why Renderer-Independent State

Core と plugin は `HTMLAudioElement`、Web Audio API、browser autoplay handling、音声 decoder、asset loader などに依存しません。

renderer / app は、`assetId` を実際の音声 file path、import 済み asset、URL、blob、stream などに対応付けます。BGM の再生・停止、SE の再生、Voice の再生、autoplay 制約への対応も renderer / app が決めます。

これにより、Tsuzuru の scenario execution と save/load 対象 state を特定 renderer や browser API から切り離せます。将来、Preact 以外の renderer や別 audio implementation を追加する余地も残ります。

## Why AssetId Only

std-audio state には file path を保存せず、`assetId` だけを保存します。

理由:

- scenario / runtime state を file layout に結合しない
- app ごとの asset map を許容する
- asset file の配置を変更しても save data の意味を保ちやすい
- bundler や hosting 環境ごとの path 解決を renderer / app 側に任せられる
- audio file format や loading strategy を plugin に固定しない

`assetId` は scenario と app の asset map の間の安定した識別子として扱います。

## Why `@startBgm` and `@stopBgm`

BGM は場面をまたいで継続する現在状態です。そのため、開始と停止を明示する command にします。

```txt
@startBgm("daily_theme")
@stopBgm
```

`@bgm("daily_theme")` は短い一方で、BGM が継続状態であることや `@stopBgm` との対称性がやや弱くなります。

`@stopBgm("daily_theme")` は提供しません。BGM は単数管理であり、停止対象を `assetId` で指定する必要がないからです。もし引数を許可すると、現在の BGM と指定 `assetId` が異なる場合の挙動を追加で定義する必要があります。

`@stopBgm` は「現在の BGM を止める」command として扱います。

## Why `@se`

SE は一回だけ発生する再生 event です。

```txt
@se("door_open")
```

SE は BGM のような現在状態ではありません。同じ `assetId` が連続して指定された場合でも、scenario author は「同じ音をもう一度鳴らす」ことを意図している可能性があります。

そのため、`@se` は常に新しい event を `seEvents` に追加します。

```ts
seEvents: [
  { sequence: 1, assetId: "door_open" },
  { sequence: 2, assetId: "door_open" }
]
```

`@playSe` のような冗長な名前は採用しません。SE は visual novel authoring で頻出し、`@se` だけで意味が明確だからです。

v0.3 scope では `@stopSe` は提供しません。loop SE、channel、SE 停止は将来の拡張として扱います。

## Why `@voice`

Voice は BGM のような継続状態ではなく、台詞に紐づく一回性 event に近いものとして扱います。

```txt
@voice("alice_001")
```

そのため、`@startVoice` / `@stopVoice` は v0.3 scope では提供しません。

`@voice` は常に新しい event を `voiceEvents` に追加します。

```ts
voiceEvents: [
  { sequence: 1, assetId: "alice_001" },
  { sequence: 2, assetId: "alice_001" }
]
```

再生中の voice を新しい voice で停止するか、重ねるか、最後まで流すかは renderer / app 側の責務です。

plugin state には `currentVoice` を持ちません。`currentVoice` を持つと、Voice を一回性 event として扱う方針と二重管理になります。

## Why Separate `seEvents` and `voiceEvents`

SE と Voice はどちらも一回性 event ですが、用途が異なります。

```ts
seEvents: StdAudioSeEvent[]
voiceEvents: StdAudioVoiceEvent[]
```

配列を分けることで、renderer / app 側は SE と Voice を別の playback policy で処理できます。

- SE は複数同時再生を許容しやすい
- Voice は前の voice を停止してから次を再生する実装があり得る
- 音量、出力先、UI 表示などの扱いも分かれやすい

event object 自体には `type: "se"` / `type: "voice"` を持たせません。配列名で種別が分かるため、runtime state としては冗長だからです。

ただし、TypeScript の構造的部分型により `StdAudioSeEvent` と `StdAudioVoiceEvent` が相互代入されることを避けるため、型定義上は branded type として扱います。

brand は runtime state には保存しません。JSON として保存される値は `sequence` と `assetId` だけです。

## Sequence Policy

`seEvents` / `voiceEvents` の event には `sequence` を持たせます。

```ts
{
  sequence: number,
  assetId: string,
}
```

`sequence` は event の発生順を表します。renderer / app 側は最後に処理した sequence を保持し、未処理の event だけを再生します。

```ts
let lastConsumedSeSequence = 0;

for (const event of audio.seEvents) {
  if (event.sequence > lastConsumedSeSequence) {
    playSe(event.assetId);
    lastConsumedSeSequence = event.sequence;
  }
}
```

初期値は次の通りです。

```ts
nextSeSequence: 1
nextVoiceSequence: 1
```

最初の event の `sequence` は `1` です。これにより renderer / app 側の `lastConsumedSeSequence` / `lastConsumedVoiceSequence` を `0` 初期値にできます。

`nextSeSequence` / `nextVoiceSequence` は state に保持します。将来 event 配列を prune しても sequence が重複しないようにするためです。

## Validation Policy

空文字の `assetId` は不正な入力です。次の command は schema validation error にします。

```txt
@startBgm("")
@se("")
@voice("")
```

`@stopBgm` は引数なしのみ有効です。

```txt
@stopBgm
```

次の command は schema validation error です。

```txt
@stopBgm("daily_theme")
```

v0.3 scope では、未対応の追加引数を許可しません。

```txt
@startBgm("daily_theme", volume=0.8)
@se("door_open", volume=0.8)
@voice("alice_001", volume=0.8)
```

未知 option は無視しません。未対応の option が書かれている場合、compile 時に検出できるようにします。

## Warning Policy

v0.3 scope の std-audio plugin は runtime warning を持ちません。

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

std-visual の `@hide("missing")` は、指定した sprite が runtime state に存在しないことを検出できるため warning 対象です。

一方、std-audio の v0.3 command set には同等の missing runtime target がありません。`@stopBgm` は対象指定なしで現在の BGM を止める command なので、BGM が存在しない場合も no-op として扱います。

## Save / Load Policy

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

### Current Core Limitation

現時点の core snapshot API は、plugin state をそのまま clone します。plugin ごとの save serialization hook はまだありません。

そのため、この save behavior を実装するには、次のいずれかが必要です。

```txt
- core に plugin snapshot serialization hook を追加する
- std-audio 側に save 用 helper を提供し、app / save adapter 側で呼び出す
```

この limitation が解消されるまでは、renderer / app 側で load 後の `lastConsumedSeSequence` / `lastConsumedVoiceSequence` を適切に初期化し、過去 event を再生しないようにする必要があります。

## Deferred Scope

次の機能はこの decision の scope 外です。

- `@bgm(assetId)`
- `@stopBgm(assetId)`
- `@startVoice(assetId)`
- `@stopVoice`
- `@stopSe`
- volume option
- loop option
- fade in / fade out
- audio channel management
- current voice state
- audio asset resolver
- built-in audio player
- bundled audio assets
- automatic browser autoplay recovery
- voice line binding with speaker blocks
- audio sprite support
- crossfade
- per-scene audio policy
- plugin snapshot serialization hook implementation
- examples

これらは必要になった時点で別途設計します。

## Consequences

### Positive

- std-audio は標準 audio state / event として単純で安定する
- Core を renderer 非依存に保てる
- renderer implementer の責務が明確になる
- BGM は現在状態として save/load しやすい
- SE / Voice は一回性 event として扱える
- 同じ SE / Voice asset を連続再生する意図を表現できる
- scenario DSL では読みやすい command を使える
- asset path 解決を app 側に任せることで bundler / hosting 差分を吸収しやすい

### Negative

- asset path 解決は app 側で実装する必要がある
- 実際の audio playback は renderer / app 側で実装する必要がある
- browser autoplay 制約への対応は plugin では解決しない
- `seEvents` / `voiceEvents` の消費管理を renderer / app 側で行う必要がある
- current core snapshot API だけでは `seEvents` / `voiceEvents` を save 時に自動破棄できない
- volume、fade、loop、channel などの高度な audio 機能はまだ使えない

## Reconsideration Criteria

次の条件が出てきた場合、この decision を見直します。

- `assetId` だけでは save/load や renderer 実装に不足する
- 複数 renderer 間で audio state / event の互換性を保てない
- BGM に volume / fade / loop / channel を標準 state として追加する必要が出る
- SE の loop / stop / channel 管理が standard plugin に必要になる
- Voice を一回性 event ではなく current state として扱う必要が明確になる
- `@voice` と speaker block を公式に結合する必要が出る
- plugin snapshot serialization hook の設計により save/load policy を再整理する必要が出る
- browser autoplay 対応を standard plugin に含める必要が明確になる

## Related Documents

- `AGENTS.md`
- `docs/plugin-api.md`
- `docs/plugins/std-audio.md`
- `docs/plugins/std-visual.md`
- `docs/decisions/0002-core-preact-boundary.md`
- `docs/decisions/0003-macro-vs-plugin.md`
- `docs/decisions/0004-std-visual-plugin.md`
