# Tsuzuru DSL v2 Design

## Status

Current supported DSL path on `feature/new-dsl`, still experimental.

This document defines the current design direction for Tsuzuru DSL v2.

DSL v2 is not a small extension of the old DSL. It is the current scenario authoring syntax path on this branch and is implemented experimentally while keeping the existing runtime, plugin architecture, and shared instruction model reusable.

Current implementation note:

- Parser, compiler, condition support, and DSL v2 AST types are implemented under `packages/core/src/` as `parser.ts`, `compiler.ts`, `condition-parser.ts`, `condition-evaluator.ts`, and `scenario-ast.ts`.
- Current `parseTzr` / `compileTzr` APIs are exported from `@tsuzuru/core`.
- The old DSL parser/compiler previously associated with these names, legacy AST, legacy compiler, and macro API were removed during the DSL v2 cleanup.
- A runnable example exists at [`examples/dsl-v2-basic`](../../../examples/dsl-v2-basic/).
- Compile/runtime support covers a practical subset including scenes, narration, dialogue, scene jumps, choices, conditional choices, `if`, state updates, `end`, and std visual/audio sugar.
- Some syntax remains parser-only, draft-only, or unsupported at runtime.

---

## 1. Design Goals

Tsuzuru DSL v2 is an ASCII-first, indentation-based DSL for visual novel scenarios.

The goals are:

- Keep scenario files readable as scripts.
- Keep the grammar strict enough to parse, validate, compile, and support editor tooling.
- Treat scenes as the primary control-flow unit.
- Treat dialogue and narration as first-class syntax.
- Avoid raw JavaScript / TypeScript execution in scenario files.
- Allow plugin and app behavior through typed `call` / `wait`.
- Keep the Core DSL small.
- Provide visual, audio, and system behavior through official standard plugins.

---

## 2. Core and Standard Plugin Boundary

### 2.1 Core DSL

The following syntax belongs to the Core DSL:

```txt
title
character
scene

say
<characterId>:
narration

choice
if
elif
else

jump
end

set
add

call
wait
```

### 2.2 Official Standard Plugin Sugar

The following syntax is not Core. It is official standard plugin sugar.

```txt
@tsuzuru/plugin-std-visual:
  bg
  show
  hide
  clear sprites
  clear bg
  visual transitions

@tsuzuru/plugin-std-audio:
  bgm
  stopBgm
  se
  voice
  inline {se}
  inline {voice}

@tsuzuru/plugin-std-system:
  system.*
  system.unlockEnding
  system.unlockCg
  system.unlockAchievement
```

---

## 3. Lexical Rules

### 3.1 Identifier

Identifiers must be ASCII-only and JavaScript / TypeScript friendly.

```bnf
IDENT ::= LETTER { LETTER | DIGIT | "_" }

LETTER ::= "A" ... "Z" | "a" ... "z" | "_"
DIGIT  ::= "0" ... "9"
```

Valid examples:

```txt
start
commonRoute
chapter2Start
trueEnd
mio
mio_normal
cg001
hasNotebook
```

Invalid examples:

```txt
true-end
mio-normal
1stRoute
美緒
has notebook
```

### 3.2 Dotted Identifier

```bnf
DOTTED_IDENT ::= IDENT { "." IDENT }
```

Valid examples:

```txt
mio.normal
scenario.mio.trust
system.endings.trueEnd.unlocked
screen.open
```

Invalid examples:

```txt
mio.normal-face
scenario.mio-trust.value
system.true-ending.seen
```

---

## 4. String Literals

Only double-quoted strings are allowed.

```txt
"雨の駅"
"common_route"
"mio-001"
```

Invalid:

```txt
'雨の駅'
`雨の駅`
```

### 4.1 String Escapes

```txt
\"   double quote
\\   backslash
\n   newline
\t   tab
```

---

## 5. Comments

DSL v2 supports JavaScript-like comments.

### 5.1 Line Comment

```txt
// comment
```

### 5.2 Block Comment

```txt
/*
  block comment
*/
```

### 5.3 Rules

- `//` comments continue until the end of the line.
- `/* ... */` comments may span multiple lines.
- Nested block comments are not allowed.
- Comments may appear between statements.
- Inline comments after statements are allowed.
- Comments inside text blocks are treated as comments.
- To display comment markers as text, escape them.

Example:

```txt
scene start:
  // Set background
  bg stationRain // rainy station background

  /*
    Temporarily disabled
    show mio.normal at center
  */

  narration:
    雨がホームの端をぼかしていた。
    ---
```

---

## 6. Indentation Rules

- Indentation uses 2 spaces.
- Tabs are invalid.
- Full-width spaces are invalid.
- Block headers must end with `:`.
- Nested blocks must be indented exactly one level deeper.
- Blank lines outside text blocks are ignored.
- Blank lines inside text blocks have semantic meaning.

Valid:

```txt
choice "Question":
  "A":
    jump a
  "B":
    jump b
```

Invalid:

```txt
choice "Question":
    "A":
      jump a
```

Reason:

```txt
Expected 2 spaces, but found 4 spaces.
```

---

## 7. Top-level Declarations

### 7.1 `title`

```txt
title "雨の駅"
```

### 7.2 `character`

```txt
character mio name="美緒"
character haru name="晴"
```

Rules:

- The first argument is the internal character ID.
- Character ID must be `IDENT`.
- Display name is specified with `name`.
- Dialogue must reference character ID.
- Display-name based dialogue is not allowed.

Invalid:

```txt
say "美緒":
  遅いよ。
```

---

## 8. Scene

```txt
scene start "雨のホーム":
  ...
```

Rules:

- Scene ID must be `IDENT`.
- Scene title is optional.
- Scene body is an indented block.
- `jump` targets must be static scene IDs.
- Dynamic jump is not allowed.

Valid:

```txt
jump commonRoute
```

Invalid:

```txt
jump $scenario.nextScene
jump "commonRoute"
```

---

## 9. Dialogue and Narration

### 9.1 Dialogue Shorthand

```txt
mio:
  遅いよ。
```

### 9.2 Explicit Dialogue

```txt
say mio:
  遅いよ。
```

Both forms compile into the same `SayStatement`.

### 9.3 Narration

```txt
narration:
  雨がホームの端をぼかしていた。
```

`narrate:` is not adopted.

---

## 10. Text Block Semantics

Text block semantics apply inside `say` / character dialogue / `narration`.

### 10.1 Normal Text Line

```txt
遅いよ。
```

Meaning:

```txt
text + lineBreak
```

### 10.2 Blank Line

```txt
遅いよ。

三十分も待ったんだから。
```

Meaning:

```txt
clickWait
page is kept
```

### 10.3 Page Break

```txt
遅いよ。
---
三十分も待ったんだから。
```

Meaning:

```txt
pageBreak
clickWait + clear current page
```

`---` is valid only inside a text block at the same text indentation level.

Valid:

```txt
mio:
  hogehoge
  ---
```

Invalid:

```txt
mio:
  hogehoge
---
```

A trailing `---` at the end of a text block is valid.

```txt
mio:
  hogehoge
  ---
```

Meaning:

```txt
display text
wait for click
clear page
continue to next statement
```

---

## 11. Text Block `:meta`

`:meta` defines initial metadata for the entire current dialogue or narration block.

```txt
mio:
  :meta
    delay=70
    mood=annoyed
    color=#ff5555
    bold=true
    size=28
  それは違う。
```

Rules:

- `:meta` may appear at most once in a `say` / character dialogue / `narration` block.
- `:meta` must appear before any text, blank line, page break, or inline control.
- `:meta` applies to the current block only.
- `:meta` does not carry over to the next block.
- `:meta` in the middle of a text block is a compile error.

Supported attributes:

```txt
color=<color>
bold=<boolean>
italic=<boolean>
size=<number>
delay=<ms>
mood=<identifier|string>
```

`voice` is not allowed in `:meta`. Voice is an inline event.

---

## 12. Inline Markup

Inline markup may appear inside normal text lines.

General rules:

- Inline markup is single-line only.
- Inline markup cannot span multiple lines.
- Nesting is allowed where the markup has a text range.
- Named arguments are used.
- Inline markup attributes are whitespace-separated.

---

### 12.1 `{text ...|...}`

Text decoration.

```txt
{text color=#ff5555|赤い文字}
{text bold=true|太字}
{text italic=true|斜体}
{text size=32|大きい文字}
{text color=#ff5555 bold=true size=32|赤く太く大きい文字}
```

Validation:

- At least one attribute is required.
- Supported attributes are `color`, `bold`, `italic`, and `size`.
- Inline text must not be empty.
- Single-line only.
- Nesting is allowed.

#### `color`

Only HEX colors are allowed.

```txt
#RGB
#RRGGBB
#RRGGBBAA
```

Valid:

```txt
{text color=#f55|赤}
{text color=#ff5555|赤}
{text color=#ff5555cc|半透明赤}
```

Invalid:

```txt
{text color=red|赤}
{text color=rgb(255,0,0)|赤}
{text color=rgba(255,0,0,0.8)|赤}
```

#### `size`

```txt
size=<integer>
```

Rules:

- Must be an integer greater than or equal to `1`.
- Standard renderer treats it as px-equivalent.
- DSL defines it as Tsuzuru text size unit.
- Recommended range: `8 <= size <= 96`.
- Values outside the recommended range may produce warnings.

#### `bold` / `italic`

```txt
bold=<boolean>
italic=<boolean>
```

Valid:

```txt
{text bold=true|強調}
{text italic=true|斜体}
{text bold=false|通常}
```

Invalid:

```txt
{text bold=yes|不可}
{text bold=1|不可}
{text italic=on|不可}
```

---

### 12.2 `{delay ms=...|...}`

Changes text reveal delay for the specified range.

```txt
{delay ms=20|この範囲だけ速く表示}
```

Validation:

- `ms` is required.
- Attributes other than `ms` are not allowed.
- `ms` must be an integer greater than or equal to `0`.
- `ms=0` means instant display.
- Target text must not be empty.
- Single-line only.
- Nesting is allowed.

Example:

```txt
mio:
  :meta
    delay=70
  普通の速度。
  {delay ms=20|ここだけ速い。}
  また普通の速度。
```

---

### 12.3 `{wait ms=...}`

Inline timed wait.

```txt
{wait ms=500}
```

Validation:

- `ms` is required.
- Attributes other than `ms` are not allowed.
- `ms` must be an integer greater than or equal to `0`.
- `ms=0` is valid but effectively no-op.
- It has no text range.
- Single-line only.
- Nesting is not allowed.

Example:

```txt
mio:
  ……えっと、{wait ms=500}ありがとう。
```

---

### 12.4 `{se assetId=...}` / `{voice assetId=...}`

Inline audio events.

```txt
{se assetId=doorOpen}
{voice assetId=mio_001}
```

Validation:

- `assetId` is required.
- Attributes other than `assetId` are not allowed.
- `assetId` must not be an empty string.
- `assetId` value may be:
  - identifier
  - dotted identifier
  - string literal
  - variable reference
- It has no text range.
- Single-line only.
- Nesting is not allowed.

Valid:

```txt
{se assetId=doorOpen}
{se assetId=door.open}
{se assetId="door-open"}

{voice assetId=mio_001}
{voice assetId=mio.normal_001}
{voice assetId=$scenario.currentVoice}
```

Invalid:

```txt
{se}
{se id=doorOpen}
{se assetId=""}
{se assetId=doorOpen volume=80}
{se assetId=doorOpen|text}
```

Runtime policy:

- `se` / `voice` are events in the text stream.
- They do not generate visible characters.
- Playback, stop, overlap, skip behavior, and page transition behavior are not defined by DSL.
- They are handled by `@tsuzuru/plugin-std-audio`, renderer, or audio layer.

---

## 13. Text Block Escapes

Text blocks use backslash escapes.

| Source | Rendered |
|---|---|
| `\{` | `{` |
| `\}` | `}` |
| `\|` | `|` |
| `\\` | `\` |
| `\//` | `//` |
| `\---` | `---` |

Example:

```txt
mio:
  \{wait ms=500\} は本文として表示される。
  \// これはコメントではなく本文。
  \--- これは page break ではなく本文。
```

---

## 14. Choice

### 14.1 Basic Choice

```txt
choice "どう答える？":
  "正直に謝る":
    jump apologize

  "言い訳する":
    jump dodge
```

### 14.2 Optional Choice Item ID

```txt
choice "どう答える？":
  "正直に謝る" id=apologize:
    jump apologize

  "言い訳する" id=excuse:
    jump dodge
```

Rules:

- Label is required.
- `id` is optional.
- If `id` is omitted, no internal ID is generated.
- Authors should specify `id` when stable logging, replay, analytics, or translation support is needed.

### 14.3 Conditional Choice Item

```txt
choice "どうする？":
  "手帳を開く" id=openNotebook if scenario.inventory.hasNotebook:
    call screen.open(id=notebook)
    wait screen.closed(id=notebook)

  "立ち去る" id=leave:
    jump hallway
```

Rules:

- `id` must appear before `if`.
- If the condition is false, the choice item is hidden.
- Disabled choice display is not adopted.

---

## 15. Conditions

### 15.1 Supported Namespaces

```txt
scenario.*
system.*
```

`system.*` is valid only when `@tsuzuru/plugin-std-system` is registered.

Invalid:

```txt
vars.*
flags.*
inventory.*
plugin.*
```

### 15.2 Literals

```txt
string
number
boolean
null
```

### 15.3 Comparison Operators

```txt
==
!=
>=
<=
>
<
```

### 15.4 Logical Operators

```txt
and
or
not
```

### 15.5 Parentheses

```txt
if scenario.inventory.hasNotebook and (scenario.mio.trust >= 3 or system.endings.trueEnd.unlocked):
  jump specialRoute
```

### 15.6 Boolean Shorthand

Boolean shorthand is allowed only for variable references.

```txt
if scenario.inventory.hasNotebook:
  jump notebookRoute
```

This is equivalent to:

```txt
if scenario.inventory.hasNotebook == true:
```

Invalid:

```txt
if true:
if false:
if "text":
if 1:
if null:
```

### 15.7 `null`

`null` may be used only as a comparison operand.

Valid:

```txt
if scenario.selectedRoute == null:
  jump defaultRoute
```

Invalid:

```txt
if null:
  jump route
```

### 15.8 Literal-to-literal Comparison

Literal-to-literal comparison is allowed.

```txt
if 1 == 1:
  jump debugRoute
```

This may produce a constant-condition warning.

### 15.9 Operator Precedence

```txt
1. parentheses
2. not
3. comparison
4. and
5. or
```

### 15.10 Condition BNF

```bnf
Condition          ::= OrExpr

OrExpr             ::= AndExpr { "or" AndExpr }

AndExpr            ::= NotExpr { "and" NotExpr }

NotExpr            ::= [ "not" ] ConditionAtom

ConditionAtom      ::= BooleanReference
                     | ComparisonExpr
                     | "(" Condition ")"

BooleanReference   ::= VariableRef

ComparisonExpr     ::= Comparable COMPARISON_OP Comparable

Comparable         ::= VariableRef
                     | Literal

VariableRef        ::= "scenario" "." Path
                     | "system" "." Path

Path               ::= IDENT { "." IDENT }

Literal            ::= STRING
                     | NUMBER
                     | BOOLEAN
                     | NULL

COMPARISON_OP      ::= "==" | "!=" | ">=" | "<=" | ">" | "<"
```

---

## 16. If / Elif / Else

```txt
if scenario.mio.trust >= 3:
  mio:
    少しだけ、信じてもいいかも。

elif scenario.mio.trust <= -1:
  mio:
    今は話したくない。

else:
  narration:
    雨音だけが、二人の間を満たしていた。
    ---
```

### BNF

```bnf
IfStatement ::= IfBlock { ElifBlock } ElseBlockOpt

IfBlock ::= "if" Condition ":" NEWLINE
            INDENT BlockBody DEDENT

ElifBlock ::= "elif" Condition ":" NEWLINE
              INDENT BlockBody DEDENT

ElseBlockOpt ::= [ ElseBlock ]

ElseBlock ::= "else" ":" NEWLINE
              INDENT BlockBody DEDENT
```

Rules:

- `if` is required.
- `elif` may appear zero or more times.
- `else` may appear zero or one time.
- `else` must be the last block in the chain.
- `elif` cannot appear after `else`.
- `if`, `elif`, and `else` must be at the same indentation level.

---

## 17. Variables

### 17.1 `scenario.*`

Core scenario variables.

```txt
scenario.mio.trust
scenario.inventory.hasNotebook
scenario.route.current
```

Rules:

- Dotted paths with two or more levels are allowed.
- Each segment must be `IDENT`.
- Hyphens are not allowed.

### 17.2 `system.*`

Global persistent state provided by `@tsuzuru/plugin-std-system`.

```txt
system.endings.trueEnd.unlocked
system.gallery.cgs.cg001.unlocked
system.achievements.firstClear.unlocked
```

Rules:

- Valid only when `@tsuzuru/plugin-std-system` is registered.
- Can be referenced in conditions.
- Direct mutation via `set` / `add` is not allowed.
- Mutation must go through `call system.*`.

---

## 18. Variable Mutation

### 18.1 `set`

```txt
set scenario.inventory.hasNotebook = true
set scenario.route.current = "common"
set scenario.selectedRoute = null
set scenario.currentSpeaker = scenario.name
```

### 18.2 `add`

```txt
add scenario.mio.trust += 1
add scenario.mio.trust += -1
add scenario.money += 500
```

Rules:

- `set` / `add` may target only `scenario.*`.
- `system.*` is not allowed.
- `set` may assign string, number, boolean, null, or an existing `scenario.*`
  variable reference.
- `system.*` variable references remain deferred for `set`.
- `add` accepts number only.
- `add` right-hand side must be a number literal.

Invalid:

```txt
set system.endings.trueEnd.unlocked = true
add system.playCount += 1
```

---

## 19. Values

Value types:

```txt
string literal
number
boolean
null
identifier literal
dotted identifier literal
variable reference
```

Examples:

```txt
id=notebook                  // string "notebook"
assetId=mio.normal           // string "mio.normal"
value=1                      // number
enabled=true                 // boolean
value=null                   // null
id=$scenario.currentScreen   // variable reference
```

### 19.1 Variable Reference

```txt
$scenario.currentScreen
$scenario.mio.trust
$system.endings.trueEnd.unlocked
```

Named argument variable references use `$scenario.*` or `$system.*`.

For `set` right-hand-side values, `scenario.*` is also accepted as a variable
reference:

```txt
set scenario.currentSpeaker = scenario.name
```

`system.*` references in `set` are parser-recognized but remain
compile-unsupported.

---

## 20. `call` / `wait`

### 20.1 Syntax

```txt
call <namespace.action>(<namedArgs>)
wait <namespace.event>(<namedArgs>)
wait <durationMs>
```

### 20.2 Examples

```txt
call screen.open(id=notebook)
wait screen.closed(id=notebook)

call inventory.add(itemId=notebook, count=1)

wait hotspot.selected()
wait minigame.finished(id=lockpick, result=success)
wait 1000
```

### 20.3 Rules

- `wait <durationMs>` is the current compile-supported timed wait authoring
  form. Duration is milliseconds and must be a non-negative number literal.
- Namespaced `wait <namespace.event>(...)` remains design syntax and is not
  compile-supported yet.
- Parentheses are required for `call` and namespaced `wait`.
- Empty parentheses are required when there are no arguments.
- Arguments must be named args.
- Positional args are not allowed.
- Multiple arguments are comma-separated.
- Trailing comma is not allowed.
- Namespaced name must have at least two segments.
- Each segment must be `IDENT`.
- Hyphens are not allowed.

### 20.4 BNF

```bnf
CallStatement ::= "call" NamespacedName "(" NamedArgsOpt ")" NEWLINE
WaitStatement ::= "wait" Number NEWLINE
                | "wait" NamespacedName "(" NamedArgsOpt ")" NEWLINE

NamedArgsOpt  ::= [ NamedArg { "," NamedArg } ]
NamedArg      ::= IDENT "=" Value

NamespacedName ::= IDENT "." IDENT { "." IDENT }
```

---

## 21. Visual Statements

Visual statements are sugar for `@tsuzuru/plugin-std-visual`.

### 21.1 Syntax

```txt
bg <assetRef> [with <transition>]

show <assetRef> at <placement> [with <transition>]

hide <assetRef> [with <transition>]

clear sprites [with <transition>]

clear bg [with <transition>]
```

### 21.2 Examples

```txt
bg stationRain
bg "station-rain"

show mio.normal at center
show mio.normal at x=320 y=80

hide mio.normal

clear sprites
clear bg
```

### 21.3 AssetRef

```bnf
AssetRef ::= DOTTED_IDENT | STRING
```

Variable reference is not allowed.

Invalid:

```txt
bg $scenario.currentBackground
show $scenario.currentSprite at center
```

### 21.4 Placement

```txt
left
center
right
x=<number> y=<number>
```

Rules:

- `left` / `center` / `right` are standard presets.
- `x` / `y` use viewport top-left origin.
- Positive `x` goes right.
- Positive `y` goes down.
- Both `x` and `y` are required for coordinate placement.
- Unit is Tsuzuru viewport coordinate.

### 21.5 `show` Update Behavior

Repeated `show` for the same `assetRef` updates the existing sprite placement.  
It does not add a second sprite.

```txt
show mio.normal at center
show mio.normal at x=320 y=80
```

Result:

```txt
mio.normal placement is updated
```

### 21.6 `hide` Missing Target

```txt
hide mio.normal
```

If the target does not exist:

```txt
no-op + runtime warning
```

Warning code candidate:

```txt
plugin.stdVisual.hideTargetNotFound
```

### 21.7 `clear`

```txt
clear sprites
```

Compiles to the std visual `clearSprites` command. It removes all visible
sprites. Background is unchanged. No warning if empty.

```txt
clear bg
```

Compiles to the std visual `clearBg` command. It sets background to `null`.
Sprites are unchanged. No warning if already empty.

---

## 22. Visual Transitions

### 22.1 Syntax

```txt
<visualStatement> with <transitionName>(<namedArgs>)
```

### 22.2 Examples

```txt
bg classroom with fade(duration=500)
show mio.normal at center with dissolve(duration=300)
hide mio.normal with fade(duration=300)
clear sprites with fade(duration=300)
clear bg with fade(duration=500)
```

### 22.3 Standard Transitions

```txt
fade(duration=<ms>)
dissolve(duration=<ms>)
```

Rules:

- `duration` is required.
- `duration` uses ms.
- `duration` must be an integer greater than or equal to `0`.
- Negative numbers, decimals, and non-number values are parser errors.
- Standard transitions are `fade` and `dissolve`.
- Custom transition names are not accepted by the current parser; they may be
  considered later with renderer, app, or plugin registration.
- Compiler output stores transition metadata as std visual command arguments.
- The std visual plugin stores transition metadata on surviving background and
  sprite state objects.
- `hide`, `clear sprites`, and `clear bg` accept transition metadata, but do not
  retain it in plugin state after the target is removed.
- Transition animation execution is renderer / app responsibility.

### 22.4 BNF

```bnf
VisualStatement
  ::= BgStatement
   | ShowStatement
   | HideStatement
   | ClearVisualStatement

BgStatement
  ::= "bg" AssetRef TransitionOpt NEWLINE

ShowStatement
  ::= "show" AssetRef "at" Placement TransitionOpt NEWLINE

HideStatement
  ::= "hide" AssetRef TransitionOpt NEWLINE

ClearVisualStatement
  ::= "clear" ClearVisualTarget TransitionOpt NEWLINE

ClearVisualTarget
  ::= "sprites"
   | "bg"

TransitionOpt
  ::= [ "with" TransitionCall ]

TransitionCall
  ::= IDENT "(" NamedArgsOpt ")"

Placement
  ::= PresetPlacement
   | CoordinatePlacement

PresetPlacement
  ::= "left"
   | "center"
   | "right"

CoordinatePlacement
  ::= "x" "=" NUMBER "y" "=" NUMBER
```

---

## 23. Audio Statements

Audio statements are sugar for `@tsuzuru/plugin-std-audio`.

### 23.1 BGM

```txt
bgm rainLoop
bgm rainLoop with fadeIn(duration=1000)
```

Rules:

- `bgm` is always treated as looped background music.
- `loop` option is not supported.
- `bgm` may use `fadeIn`.

### 23.2 Stop BGM

```txt
stopBgm
stopBgm with fadeOut(duration=1000)
```

Rules:

- `stopBgm` may use `fadeOut`.

### 23.3 SE / Voice

```txt
se doorOpen
voice mio_001
```

Rules:

- `se` and `voice` are one-shot events.
- Statement-level `se` and `voice` are supported.
- `se` and `voice` do not have transitions.

### 23.4 AssetRef

```bnf
AssetRef ::= DOTTED_IDENT | STRING
```

Variable references are not allowed in audio statement asset refs.

Invalid:

```txt
bgm $scenario.currentBgm
se $scenario.currentSe
voice $scenario.currentVoice
```

### 23.5 BNF

```bnf
AudioStatement
  ::= BgmStatement
   | StopBgmStatement
   | SeStatement
   | VoiceStatement

BgmStatement
  ::= "bgm" AssetRef AudioTransitionOpt NEWLINE

StopBgmStatement
  ::= "stopBgm" AudioTransitionOpt NEWLINE

SeStatement
  ::= "se" AssetRef NEWLINE

VoiceStatement
  ::= "voice" AssetRef NEWLINE

AudioTransitionOpt
  ::= [ "with" AudioTransitionCall ]

AudioTransitionCall
  ::= IDENT "(" NamedArgsOpt ")"
```

### 23.6 Audio Transition Validation

```txt
bgm:
  - no transition, or fadeIn(duration=<ms>)
  - fadeOut is not allowed

stopBgm:
  - no transition, or fadeOut(duration=<ms>)
  - fadeIn is not allowed

se:
  - transition is not allowed

voice:
  - transition is not allowed
```

### 23.7 Runtime Policy

DSL does not define:

- how existing BGM is stopped
- whether BGM transition crossfades
- whether voices overlap or stop previous voices
- skip behavior
- page break behavior

These are responsibilities of the audio plugin, renderer, or audio layer.

---

## 24. `@tsuzuru/plugin-std-system`

### 24.1 Position

```txt
scenario.* is Core
system.* is provided by @tsuzuru/plugin-std-system
direct set/add mutation of system.* is prohibited
system.* updates go through call system.*
```

### 24.2 Minimal Semantic Actions

```txt
call system.unlockEnding(id=trueEnd)
call system.unlockCg(id=cg001)
call system.unlockAchievement(id=firstClear)
```

### 24.3 Meaning

```txt
system.unlockEnding(id=<id>)
  => unlock ending

system.unlockCg(id=<id>)
  => unlock CG

system.unlockAchievement(id=<id>)
  => unlock achievement
```

### 24.4 Recommended System State Path

```txt
system.endings.<id>.unlocked
system.gallery.cgs.<id>.unlocked
system.achievements.<id>.unlocked
```

### 24.5 Condition Examples

```txt
if system.endings.trueEnd.unlocked:
  jump trueExtra

if system.gallery.cgs.cg001.unlocked:
  jump cgHint

if system.achievements.firstClear.unlocked:
  jump bonusScene
```

### 24.6 Validation

- `id` is required.
- `id` may be `IDENT` or `STRING`.
- Empty `id` is not allowed.
- Extra arguments are not allowed.
- Re-unlocking the same ID is no-op.
- No warning is emitted for re-unlock no-op.

### 24.7 Not Adopted

```txt
call system.set(path=..., value=...)
```

Generic `system.set` is not adopted.

---

## 25. File Splitting and Assets

### 25.1 File Splitting

The following are not included in the DSL for now:

```txt
import
include
use
```

Policy:

- Scenario file bundling is handled by config.
- Entry file and entry scene are handled by config.
- Cross-file scene resolution is handled by compiler / config layer.

### 25.2 Assets

Policy:

- DSL uses asset IDs only.
- Mapping asset IDs to paths or URLs is handled by asset manifest, app, or renderer.
- Compiler may optionally validate asset IDs against an asset manifest.

---

## 26. Reserved / Not Adopted

### 26.1 Not Adopted

```txt
raw script
while
for
function
async
await
dynamic jump
display-name based say
direct set/add mutation of system.*
flags.*
vars.*
```

### 26.2 Reserved

```txt
macro
include
import
use
return
callScene
disabled choice
asset manifest DSL
named text preset / style
```

---

## 27. Full Example

```txt
title "雨の駅"

character haru name="晴"
character mio name="美緒"

scene start "雨のホーム":
  bg stationRain with fade(duration=500)
  bgm rainLoop with fadeIn(duration=1000)
  show mio.normal at center with dissolve(duration=300)

  narration:
    雨がホームの端をぼかしていた。
    晴は改札の前で立ち止まった。
    ---

  mio:
    :meta
      delay=70
      mood=annoyed

    {voice assetId=mio_001}遅いよ。

    三十分も待ったんだから。
    ---
    {delay ms=20|言い訳しないで。}
    それは{text color=#ff5555 bold=true|嘘}でしょ。
    ……えっと、{wait ms=500}ちゃんと説明して。

  say haru:
    ごめん。電車が止まってて。

  choice "どう答える？":
    "正直に謝る" id=apologize:
      add scenario.mio.trust += 1
      jump apologize

    "言い訳する" id=excuse:
      add scenario.mio.trust += -1
      jump dodge

    "手帳を見せる" id=showNotebook if scenario.inventory.hasNotebook:
      call screen.open(id=notebook)
      wait screen.closed(id=notebook)


scene apologize:
  haru:
    本当は、来るのが怖かった。
    ---

  mio:
    {voice assetId=mio_002}……そっか。

  call system.unlockAchievement(id=honestApology)

  jump common


scene dodge:
  haru:
    いや、本当に信号が全部赤で。

  mio:
    もういい。
    ---

  hide mio.normal with fade(duration=300)
  jump badAir


scene common:
  if scenario.mio.trust >= 1:
    mio:
      少しだけ、信じてもいいかも。

  elif scenario.mio.trust <= -1:
    mio:
      今は話したくない。

  else:
    narration:
      雨音だけが、二人の間を満たしていた。
      ---

  end
```

---

## 28. Implementation Phases

The specification is written as a complete design, but implementation should be split.

```txt
Phase 1:
  lexer / indentation / title / character / scene / narration / say / jump / end

Phase 2:
  text block control
  blank-line clickWait
  --- pageBreak
  comments
  escape

Phase 3:
  inline markup
  {text}
  {delay}
  {wait}
  {se}
  {voice}

Phase 4:
  choice
  if / elif / else
  condition evaluator

Phase 5:
  scenario variables
  set / add

Phase 6:
  call / wait

Phase 7:
  std-visual sugar
  bg / show / hide / clear
  visual transition

Phase 8:
  std-audio sugar
  bgm / stopBgm / se / voice
  audio transition

Phase 9:
  std-system plugin
  system.*
  unlockEnding / unlockCg / unlockAchievement
```
