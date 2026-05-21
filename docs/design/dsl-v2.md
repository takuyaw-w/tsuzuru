# Tsuzuru DSL v2 Design

## Status

DSL v2 is the current supported scenario authoring path on `main`.

This document defines the current design direction for Tsuzuru DSL v2. The
v1.0 stable subset is tracked separately in
[`dsl-support-matrix.md`](dsl-support-matrix.md).

DSL v2 is not a small extension of the old DSL. It is the current scenario
authoring syntax path and keeps the existing runtime, plugin architecture, and
shared instruction model reusable.

Current implementation note:

- Parser, compiler, condition support, and DSL v2 AST types are implemented under `packages/core/src/` as `parser.ts`, `compiler.ts`, `condition-parser.ts`, `condition-evaluator.ts`, and `scenario-ast.ts`.
- Current `parseTzr` / `compileTzr` APIs are exported from `@tsuzuru/core`.
- The old DSL parser/compiler previously associated with these names, legacy AST, legacy compiler, and macro API were removed during the DSL v2 cleanup.
- A runnable example exists at [`examples/preact-basic`](../../../examples/preact-basic/).
- Compile/runtime support covers a practical subset including scenes,
  narration, dialogue, scene jumps, choices, conditional choices, `if`, state
  updates, `end`, timed waits, and the standard plugin sugar listed in the
  support matrix.
- Some syntax remains parser-only, design-only, or unsupported at runtime. Use
  the support matrix to distinguish current stable candidates from deferred
  syntax.
- Editor tooling such as syntax highlighting, VS Code extension support, LSP
  diagnostics, and GUI editor features is optional tooling. It is not part of
  the v1.0 engine release gate, and future editor grammars should follow the
  support matrix.

---

## 1. Design Goals

Tsuzuru DSL v2 is an ASCII-first, indentation-based DSL for visual novel scenarios.

The goals are:

- Keep scenario files readable as scripts.
- Keep the grammar strict enough to parse, validate, compile, and allow future
  editor tooling.
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

@tsuzuru/plugin-std-text-sound:
  textSound
  stopTextSound

@tsuzuru/plugin-std-effect:
  shake
  flash
  pulse
  blur

@tsuzuru/plugin-std-transition:
  transition fade(...)
  transition wipe(...)
  transition flash(...)
  transition pageTurn(...)
  transition blurFade(...)
  transition slide(...)
  bg <assetRef> with fade(...)
  bg <assetRef> with pageTurn(...)
  bg <assetRef> with blurFade(...)
  bg <assetRef> with slide(...)

@tsuzuru/plugin-std-camera:
  camera
  camera focus
  reset camera

@tsuzuru/plugin-std-particle:
  particle
  stopParticle

@tsuzuru/plugin-std-system:
  call system.unlockEnding(id=...)
  call system.unlockCg(id=...)
  call system.unlockAchievement(id=...)
```

The inline audio entries above describe parser-level design syntax only. They
are not part of the v1.0 stable subset; use statement-level `se` and `voice`
for current runnable scenarios.

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

v1.0 stable subset note: plain text lines inside narration, dialogue shorthand,
and `say` blocks are stable candidates. Blank-line click waits, `---` page
breaks, and `:meta` metadata are parser-level design syntax today; they are
rejected by the compiler and are not part of the v1.0 stable subset. See
[`dsl-support-matrix.md`](dsl-support-matrix.md) for the current support status.

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

Implementation status: `:meta` is parser-only and not part of the v1.0 stable
subset. Current compiler behavior rejects text block metadata; renderer and
save/load behavior are post-v1.0 design work.

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

Implementation status: this section describes parser-level design syntax.
Inline `{text}`, `{delay}`, `{wait}`, `{se}`, and `{voice}` are parsed but
compile-rejected today. They are not part of the v1.0 stable subset; v1.0 text
authoring should use plain narration/dialogue text and statement-level plugin
commands such as `se` / `voice`.

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

v1.0 stable condition references are `scenario.*` only. Condition parsing
accepts `system.*` as parser-level design syntax, but the compiler rejects
`system.*` condition references and runtime evaluation remains unsupported until
a renderer-neutral std-system condition resolver is designed.

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
system.cgs.cg001.unlocked
system.achievements.firstClear.unlocked
```

Rules:

- Not part of the v1.0 stable condition subset.
- Can be parsed in conditions, but compile/runtime condition evaluation remains
  post-v1.0 design work.
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

- `left` / `center` / `right` are standard presets and are the v1.0
  std-visual placement target.
- `x=<number> y=<number>` is parser-level future syntax. It is compile-rejected
  on `main` and is not part of the v1.0 stable subset.
- Coordinate origin, units, anchors, safe area, and responsive layout behavior
  require a future renderer contract before coordinate placement can become
  stable.

### 21.5 `show` Update Behavior

Repeated `show` for the same `assetRef` updates the existing sprite placement.  
It does not add a second sprite.

```txt
show mio.normal at center
show mio.normal at right
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
bg library with pageTurn(direction="left", duration=800)
bg rooftop with blurFade(duration=700)
bg hallway with slide(direction="right", duration=650)
show mio.normal at center with dissolve(duration=300)
hide mio.normal with fade(duration=300)
clear sprites with fade(duration=300)
clear bg with fade(duration=500)
```

### 22.3 Standard Transitions

```txt
fade(duration=<ms>)
dissolve(duration=<ms>)
wipe(direction=<direction>, duration=<ms>)
flash(color=<color>, duration=<ms>)
pageTurn(direction=<direction>, duration=<ms>)
blurFade(duration=<ms>)
slide(direction=<direction>, duration=<ms>)
```

Rules:

- For `show`, `hide`, and `clear`, standard std-visual transition metadata is
  `fade` or `dissolve`.
- For `bg`, `fade`, `wipe`, `flash`, `pageTurn`, `blurFade`, and `slide` are
  screen transitions handled by `@tsuzuru/plugin-std-transition`.
- For std-visual metadata, `duration` is required, uses ms, and must be an
  integer greater than or equal to `0`.
- For bg screen transitions, `duration` is optional and uses the
  std-transition effect defaults. If supplied, it must be a positive integer.
- Custom transition names are not accepted by the current parser; they may be
  considered later with renderer, app, or plugin registration.
- Compiler output stores `show` / `hide` / `clear` transition metadata as std
  visual command arguments.
- Compiler output for `bg ... with <screenTransition>(...)` appends a
  std-transition event command and then updates std-visual background state.
- The std visual plugin stores std-visual transition metadata on surviving
  background and sprite state objects.
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

Current v1.0 stable candidates are `bgm <assetRef>`, `stopBgm`, `se <assetRef>`,
and `voice <assetRef>`. Audio transition syntax such as `bgm ... with
fadeIn(...)` and `stopBgm with fadeOut(...)` remains design-only until parser,
compiler, plugin, and renderer behavior are implemented together.

### 23.1 BGM

```txt
bgm rainLoop
```

Rules:

- `bgm` is always treated as looped background music.
- `loop` option is not supported.
- `bgm ... with fadeIn(...)` remains design-only and is not current stable
  syntax.

### 23.2 Stop BGM

```txt
stopBgm
```

Rules:

- `stopBgm ... with fadeOut(...)` remains design-only and is not current
  stable syntax.

### 23.3 SE / Voice

```txt
se doorOpen
voice mio_001
```

Rules:

- `se` and `voice` are one-shot events.
- Statement-level `se` and `voice` are supported.
- `se` and `voice` do not have transitions.

### 23.4 Text Sound

```txt
textSound mio
stopTextSound
```

Rules:

- `textSound` and `stopTextSound` are sugar for `@tsuzuru/plugin-std-text-sound`.
- Normal text sound selection should use app-side narration / character defaults.
- `textSound` sets an advanced renderer-neutral override profile ID.
- `stopTextSound` clears the override profile ID.
- Actual playback is renderer / app policy tied to text reveal.
- `tone` / `noise` / `mix` profiles, `note: "C5"`, volume, interval,
  punctuation skip, and speaker mapping are not DSL syntax.

### 23.5 AssetRef

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

`AudioTransitionOpt` is retained here as a design fragment only. Current parser
and compiler support the no-transition audio statements listed in the support
matrix.

### 23.6 Audio Transition Validation

This section describes future transition validation rules. It is not part of
the v1.0 stable subset and is not current runnable syntax.

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

## 24. Effect Statements

Effect statements are sugar for `@tsuzuru/plugin-std-effect`.

Effects are one-shot events. They are not durable visual state and should not be
stored as replayable save data.

### 24.1 Syntax

```txt
shake <target> [intensity=<intensity>] duration=<ms>
flash color="<hex>" duration=<ms>
pulse <target> [intensity=<intensity>] duration=<ms>
blur screen amount=<number> duration=<ms>
```

### 24.2 Examples

```txt
shake screen intensity=strong duration=400
shake message intensity=light duration=180
shake sprites duration=240

flash color="#ffffff" duration=120
flash color="#ff3333" duration=180

pulse screen intensity=normal duration=240
pulse message intensity=light duration=180
pulse sprites intensity=strong duration=260

blur screen amount=6 duration=300
```

### 24.3 Rules

- `shake` and `pulse` target is `screen`, `message`, or `sprites`.
- `intensity` is `light`, `normal`, or `strong`.
- `intensity` defaults to `normal` when omitted.
- `duration` uses milliseconds and must be an integer greater than or equal to
  `0`.
- `flash color` must be HEX: `#RGB`, `#RRGGBB`, or `#RRGGBBAA`.
- MVP `blur` only accepts `screen`.
- `blur amount` must be a number greater than or equal to `0`.
- Actual animation is renderer / app responsibility.

### 24.4 Runtime Model

The std-effect plugin stores events under `runtimeState.plugins.stdEffect`:

```ts
{
  events: StdEffectEvent[],
  nextSequence: number,
}
```

Each command appends an event using `nextSequence`, then increments
`nextSequence`. Renderers consume events by sequence and run CSS or native
animations. Snapshot preparation clears `events` and preserves `nextSequence`.

### 24.5 BNF

```bnf
EffectStatement
  ::= ShakeStatement
   | FlashStatement
   | PulseStatement
   | BlurStatement

ShakeStatement
  ::= "shake" EffectTarget EffectNamedArgs NEWLINE

FlashStatement
  ::= "flash" EffectNamedArgs NEWLINE

PulseStatement
  ::= "pulse" EffectTarget EffectNamedArgs NEWLINE

BlurStatement
  ::= "blur" "screen" EffectNamedArgs NEWLINE

EffectTarget
  ::= "screen" | "message" | "sprites"
```

---

## 24.6 Screen Transition Statements

Screen transition statements are sugar for
`@tsuzuru/plugin-std-transition`.

Screen transitions are one-shot events for the whole screen surface. They are
not background or sprite state, and they do not block runtime stepping. Use
`wait` when scenario timing needs to line up with the transition duration.

### 24.6.1 Syntax

```txt
transition fade([duration=<ms>], [color="<color>"])
transition wipe([direction="<direction>"], [duration=<ms>])
transition flash([color="<color>"], [duration=<ms>])
transition pageTurn([direction="<direction>"], [duration=<ms>])
transition blurFade([duration=<ms>], [color="<color>"])
transition slide([direction="<direction>"], [duration=<ms>])

bg <assetRef> with fade(...)
bg <assetRef> with pageTurn(...)
bg <assetRef> with blurFade(...)
bg <assetRef> with slide(...)
```

### 24.6.2 Examples

```txt
transition fade(duration=500)
wait 500

transition wipe(direction="left", duration=600)
wait 600

transition flash(color="#ffffff", duration=180)
wait 180

bg library with pageTurn(direction="left", duration=800)
wait 800

bg rooftop with blurFade(duration=700)
wait 700
```

### 24.6.3 Rules

- Effect is `fade`, `wipe`, `flash`, `pageTurn`, `blurFade`, or `slide`.
- `duration` is optional, uses milliseconds, and must be a positive integer.
- Default duration is `400` for `fade`, `500` for `wipe`, `180` for `flash`,
  `800` for `pageTurn`, `700` for `blurFade`, and `600` for `slide`.
- `wipe`, `pageTurn`, and `slide` direction is optional and defaults to
  `"left"`.
- Direction is `"left" | "right" | "up" | "down"`.
- `fade color` defaults to `"#000000"`.
- `wipe color` defaults to `"#000000"`.
- `flash color` defaults to `"#ffffff"`.
- `pageTurn color` defaults to `"#ffffff"`.
- `blurFade color` defaults to `"#000000"`.
- `slide color` defaults to `"#000000"`.
- Extra named arguments are rejected.
- Runtime blocking is intentionally not part of transition execution.
- `bg ... with <screenTransition>(...)` appends the transition event and then
  updates std-visual background state.

### 24.6.4 Runtime Model

The std-transition plugin stores events under
`runtimeState.plugins.stdTransition`:

```ts
{
  events: StdTransitionEvent[],
  nextSequence: number,
}
```

Each command appends an event using `nextSequence`, then increments
`nextSequence`. Snapshot preparation clears `events` and preserves
`nextSequence` so load / restore does not replay old transitions.

---

## 25. Camera Statements

Camera statements are sugar for `@tsuzuru/plugin-std-camera`.

Camera is durable presentation state. It is saved and restored with runtime
snapshots and is not treated as a one-shot event.

### 25.1 Syntax

```txt
camera [x=<number>] [y=<number>] [zoom=<number>] [duration=<ms>] [easing=<easing>]
camera focus <assetId> [zoom=<number>] [duration=<ms>] [easing=<easing>]
reset camera [duration=<ms>] [easing=<easing>]
```

### 25.2 Examples

```txt
camera x=0 y=0 zoom=1 duration=300
camera x=80 y=-20 zoom=1.15 duration=500
camera zoom=1.08 duration=240
camera focus tone_stand zoom=1.2 duration=400
reset camera duration=300
```

### 25.3 Rules

- `camera` requires at least one of `x`, `y`, or `zoom`.
- Omitted `x`, `y`, and `zoom` values keep the current camera value.
- `camera` clears `focusTarget`.
- `camera focus` requires a positional asset id.
- `camera focus` stores `focusTarget` and resets x/y pan to `0`.
- `zoom` must be greater than `0`.
- `duration` uses milliseconds and must be an integer greater than or equal to
  `0`.
- `easing` is `linear`, `ease`, `easeIn`, or `easeOut`.
- Actual transform and focus target coordinate policy are renderer / app
  responsibility.

### 25.4 Runtime Model

The std-camera plugin stores state under `runtimeState.plugins.stdCamera`:

```ts
{
  x: number,
  y: number,
  zoom: number,
  focusTarget: string | null,
  transition: {
    durationMs: number,
    easing: "linear" | "ease" | "easeIn" | "easeOut",
  } | null,
}
```

Initial state has `x: 0`, `y: 0`, `zoom: 1`, `focusTarget: null`, and
`transition: null`. Camera commands store the latest transition object.

### 25.5 BNF

```bnf
CameraStatement
  ::= CameraMoveStatement
   | CameraFocusStatement
   | ResetCameraStatement

CameraMoveStatement
  ::= "camera" CameraNamedArgs NEWLINE

CameraFocusStatement
  ::= "camera" "focus" IDENT CameraNamedArgs NEWLINE

ResetCameraStatement
  ::= "reset" "camera" CameraNamedArgs? NEWLINE
```

---

## 26. `@tsuzuru/plugin-std-particle`

Particle statements are sugar for `@tsuzuru/plugin-std-particle`.

Particles are durable overlay state. They are not one-shot events and should not
be mixed into std-effect. They also stay separate from std-visual because they
represent environmental overlays rather than the current background or sprites.

### 26.1 Syntax

```txt
particle <type> [intensity=<intensity>]
stopParticle
```

Examples:

```txt
particle rain intensity=normal
particle snow
particle sakura intensity=strong
particle dust intensity=light
stopParticle
```

Rules:

- `type` is required and must be `rain`, `snow`, `sakura`, or `dust`.
- `intensity` is optional and defaults to `normal`.
- `intensity` must be `light`, `normal`, or `strong`.
- Running `particle ...` replaces the current particle.
- MVP supports one particle at a time.
- `stopParticle` takes no arguments and clears the current particle.
- `stopParticle` is a no-op when no particle is active.

### 26.2 Runtime State

The std-particle plugin stores state under `runtimeState.plugins.stdParticle`:

```ts
{
  current: {
    type: "rain" | "snow" | "sakura" | "dust",
    intensity: "light" | "normal" | "strong",
  } | null,
}
```

Initial state:

```ts
{
  current: null,
}
```

Particle state is durable presentation state and may be saved/restored with
runtime snapshots as-is. There is no `prepareStdParticleStateForSnapshot()`
helper.

Actual DOM / CSS / canvas rendering is renderer or app responsibility.

### 26.3 Grammar Fragment

```bnf
ParticleStatement
  ::= "particle" ParticleType ParticleNamedArgs? NEWLINE

ParticleType
  ::= "rain" | "snow" | "sakura" | "dust"

ParticleNamedArgs
  ::= "intensity" "=" ParticleIntensity

ParticleIntensity
  ::= "light" | "normal" | "strong"

StopParticleStatement
  ::= "stopParticle" NEWLINE
```

Deferred:

- multiple simultaneous particle layers
- wind / direction / speed / size / color / density options
- smoke / fog / embers / leaves / custom particle definitions

## 27. `@tsuzuru/plugin-std-system`

### 26.1 Position

```txt
scenario.* is Core
system.* is provided by @tsuzuru/plugin-std-system
direct set/add mutation of system.* is prohibited
system.* updates go through call system.*
```

std-system intentionally does not add dedicated DSL sugar. It uses the same
`call namespace.action(...)` syntax available to user plugins.

### 26.2 Minimal Semantic Actions

```txt
call system.unlockEnding(id=trueEnd)
call system.unlockCg(id=cg001)
call system.unlockAchievement(id=firstClear)
```

### 26.3 Meaning

```txt
system.unlockEnding(id=<id>)
  => unlock ending

system.unlockCg(id=<id>)
  => unlock CG

system.unlockAchievement(id=<id>)
  => unlock achievement
```

### 26.4 Recommended System State Path

```txt
system.endings.<id>.unlocked
system.cgs.<id>.unlocked
system.achievements.<id>.unlocked
```

### 26.5 Condition References

```txt
if system.endings.trueEnd.unlocked:
  jump trueExtra

if system.cgs.cg001.unlocked:
  jump cgHint

if system.achievements.firstClear.unlocked:
  jump bonusScene
```

Condition parsing accepts `system.*` references, but compile/runtime condition
evaluation remains deferred and is not part of the v1.0 stable subset. The
compiler rejects `if system.*` until a renderer-neutral system condition
resolver is added.

### 26.6 Validation

- `id` is required.
- `id` may be `IDENT` or `STRING`.
- Empty `id` is not allowed.
- Extra arguments are not allowed.
- Re-unlocking the same ID is no-op.
- No warning is emitted for re-unlock no-op.
- `set system.*` and `add system.*` are prohibited.

### 26.7 Not Adopted

```txt
call system.set(path=..., value=...)
unlock ending trueEnd
```

Generic `system.set` and dedicated `unlock ...` sugar are not adopted.

---

## 28. File Splitting and Assets

### 27.1 File Splitting

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

### 27.2 Assets

Policy:

- DSL uses asset IDs only.
- Mapping asset IDs to paths or URLs is handled by asset manifest, app, or renderer.
- Compiler may optionally validate asset IDs against an asset manifest.

---

## 29. Reserved / Not Adopted

### 28.1 Not Adopted

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

### 28.2 Reserved

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

## 30. Full Example

This example shows the broader DSL design direction, including syntax that is
parser-only or design-only today. For the current v1.0 stable-scope planning
subset, use [`dsl-support-matrix.md`](dsl-support-matrix.md).

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

## 31. Implementation Phases

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
  std-text-sound sugar
  textSound / stopTextSound

Phase 10:
  std-effect sugar
  shake / flash / pulse / blur

Phase 11:
  std-particle sugar
  particle / stopParticle

Phase 12:
  std-system plugin
  call system.unlockEnding(id=...)
  call system.unlockCg(id=...)
  call system.unlockAchievement(id=...)
```
