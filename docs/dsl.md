# Tsuzuru DSL

This document defines the currently implemented `.tzr` syntax and compiler surface for `@tsuzuru/core`.

## Scope

The parser is line-oriented and produces an AST only. A separate compiler pass performs same-file structural validation, macro expansion, command registration checks, and command argument validation. Runtime execution and rendering remain separate.

Supported in the current parser:

- `#scene("id")`
- `#label("id")`
- speaker blocks with `:: Speaker`
- speaker block text
- narration text
- runtime command calls such as `@bg("school")`
- macro calls such as `$enter("haruka")`
- `@jump("#label")` with normalized jump target metadata
- choice blocks with `? Question` and `- "Text" -> #label`
- conditional blocks with `@if(...)`, `@else`, and `@endif`

Implemented outside the parser:

- runtime execution in `@tsuzuru/core`
- Preact runtime view helpers in `@tsuzuru/preact`
- macro expansion during compilation
- plugin command registration checks during compilation
- core command argument validation during compilation
- optional plugin command argument schema validation during compilation
- runtime snapshot and Preact save-data helpers

Not supported yet:

- cross-file jump existence validation
- Vite plugin behavior
- `create-tsuzuru`

## Files

Scenario files use the `.tzr` extension. The parser accepts a `filePath` option and includes it in AST source locations and parse diagnostics.

```ts
parseTzr(source, { filePath: "scenario/main.tzr" });
```

## Source Locations

AST nodes include source ranges with `filePath`, `line`, and `column`. Lines and columns are 1-based.

Jump targets also carry their own source range. Compiler diagnostics for missing labels point at the target token, not just the start of the command or choice item line.

Parse errors are returned as diagnostics:

```ts
{
  filePath: "scenario/main.tzr",
  line: 3,
  column: 1,
  message: "#scene must use #scene(\"id\") syntax.",
  sourceLine: "#scene(prologue)"
}
```

## Structure Declarations

Scenes and labels use function-like declarations with a single string argument.

```txt
#scene("prologue")
#label("after_choice")
```

Invalid:

```txt
#scene(prologue)
#label("start", "extra")
```

The parser records declarations only. Duplicate labels and missing jump targets are compiler concerns.

The current compiler reports duplicate scene ids and duplicate label ids in the same document.

## Narration

Plain non-empty lines become narration until a blank line or directive line is reached.

```txt
The classroom was unusually quiet.
The clock ticked louder than usual.
```

Multiple consecutive narration lines are grouped into one narration block.

## Speaker Blocks

Speaker blocks start with `::` followed by a speaker name. Subsequent plain text lines belong to the speaker until a blank line or directive line is reached.

```txt
:: Haruka
You're late again.
```

`::` without a speaker name is a parse error.

## Commands

Runtime commands use `@name(...)`.

```txt
@bg("school_evening")
@show(character="haruka", pose="smile", at=center)
@jump("#after_choice")
```

The parser accepts positional and named arguments. Supported values are:

- string literals: `"haruka"`
- numbers: `1`, `-1`, `1.5`
- booleans: `true`, `false`
- identifiers: `center`

Unknown command names are not parse errors. They are compiler errors unless the command is core-owned or registered as a plugin command.

Core-owned command names are registered by `@tsuzuru/core`:

- flow: `jump`, `stop`, `wait`
- text flow: `waitClick`, `page`
- state: `set`, `inc`, `dec`, `flag`, `unflag`

The current compiler validates core command arguments:

```txt
@jump("#label")                 # one positional string
@wait(500)                      # one positional number
@waitClick()                    # no arguments
@page()                         # no arguments
@stop()                         # no arguments
@set(name="route", value="a")   # named string name, value string/number/boolean
@inc(name="affection", by=1)    # named string name, number by
@dec(name="affection", by=1)    # named string name, number by
@flag("met_haruka")             # one positional string
@unflag("met_haruka")           # one positional string
```

Plugin commands must be registered through `compileTzr({ pluginCommands })`. A plugin command may also define an argument schema. See `docs/plugin-api.md`.

## Macro Calls

Macro calls use `$name(...)` and share the same argument syntax as commands.

```txt
$enter("haruka", "smile", "center")
```

The parser keeps macro calls in the AST. The compiler expands registered macros and removes macro instructions from the compiled IR.

Macros may return presentation-oriented command instructions, but the compiler rejects macro expansion results that create structural or narrative control-flow instructions:

- `SceneInstruction`
- `LabelInstruction`
- `IfInstruction`
- `ChoiceInstruction`
- `MacroInstruction`
- `@jump` command instructions

## Conditional Blocks

Conditional blocks use `@if(...)`, optional `@else`, and `@endif`.

```txt
@if(flag("met_haruka"))
:: Haruka
We meet again.
@else
:: Haruka
Nice to meet you.
@endif
```

The parser stores the condition as a raw string and parses both branches into nested AST statements. Nested `@if` blocks are supported.

```txt
@if(flag("met_haruka"))
@if(var("affection") >= 3)
@jump("#haruka_route")
@endif
@endif
```

Condition expressions are parsed into a constrained expression model and evaluated by the runtime. `@else` and `@endif` must appear inside an `@if` block. Missing `@endif` is a parse error.

## Jump Targets

`@jump(...)` must receive a string target.

```txt
@jump("#after_choice")
@jump("chapter-01.tzr")
@jump("chapter-01.tzr#start")
```

Jump targets are normalized into:

```ts
{ raw: "#start", label: "start" }
{ raw: "chapter-01.tzr", file: "chapter-01.tzr" }
{ raw: "chapter-01.tzr#start", file: "chapter-01.tzr", label: "start" }
```

The parser does not check whether files or labels exist.

The current compiler validates target shape and same-file labels. Valid target forms are:

- `#label`
- `file.tzr`
- `file.tzr#label`

Invalid target forms include:

- empty targets such as `@jump("")`
- missing labels such as `@jump("#")`
- missing cross-file labels such as `@jump("chapter-01.tzr#")`
- multiple `#` separators

Cross-file targets such as `chapter-01.tzr#start` are accepted without existence checks.

## Choices

Choices start with a question line and require at least one item.

```txt
? What do you do?
- "Apologize" -> #apologize
- "Make a joke" -> #joke
```

Choice item text must be a double-quoted string. Targets use the same normalization rules as jump targets.

Malformed choice items are parse errors. Choice rendering belongs to the Preact UI layer. Choice resolution belongs to the runtime.

The current compiler validates same-file choice targets against labels in the same document.

## Compiler Diagnostics

The current compiler reports:

- duplicate scenes
- duplicate labels
- invalid jump target formats
- missing same-file `@jump("#label")` targets
- missing same-file choice targets
- `#scene` or `#label` declarations inside `@if` branches
- unknown macros
- forbidden macro expansion results
- unknown non-core commands
- mismatched plugin command registry keys and definition names
- invalid core command arguments
- invalid plugin command arguments when a schema is registered

Example:

```txt
scenario/main.tzr:5:1
Unknown label "#missing".
```

Validation not implemented yet:

- macro argument schemas
- cross-file target existence

## Whitespace

Blank lines separate blocks and are otherwise ignored. Leading whitespace before directives is allowed. Text content preserves trailing text after trimming only line endings and trailing spaces.

## Example

```txt
#scene("prologue")

The classroom was unusually quiet.

:: Haruka
You're late again.

$enter("haruka", "smile", "center")

? What do you do?
- "Apologize" -> #apologize
- "Make a joke" -> #joke

#label("apologize")
@jump("#after_choice")
```
