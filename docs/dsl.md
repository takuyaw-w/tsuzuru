# Tsuzuru DSL

This document defines the currently implemented `.tzr` parser surface for `@tsuzuru/core`.

## Scope

The parser is line-oriented and produces an AST only. A separate compiler pass performs initial same-file structural validation. Neither layer executes scenarios, expands macros, validates plugin command names, or renders UI.

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

Not supported yet:

- runtime execution
- Preact UI
- plugin command validation
- macro expansion
- save/load
- `@if(...)`, `@else`, `@endif`
- cross-file jump validation
- Vite plugin behavior

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

Unknown command names are not parse errors yet.

Core-owned command names are registered by `@tsuzuru/core`:

- flow: `jump`, `stop`, `wait`
- text flow: `waitClick`, `page`
- state: `set`, `inc`, `dec`, `flag`, `unflag`

The current compiler recognizes `@jump(...)` for target validation. Other command names are preserved but not validated yet. Plugin command validation is not implemented.

## Macro Calls

Macro calls use `$name(...)` and share the same argument syntax as commands.

```txt
$enter("haruka", "smile", "center")
```

The parser keeps macro calls in the AST. Expansion is not implemented.

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

Malformed choice items are parse errors. Choice rendering and resolution belong to later runtime/UI layers.

The current compiler validates same-file choice targets against labels in the same document.

## Compiler Diagnostics

The current compiler reports:

- duplicate scenes
- duplicate labels
- invalid jump target formats
- missing same-file `@jump("#label")` targets
- missing same-file choice targets

Example:

```txt
scenario/main.tzr:5:1
Unknown label "#missing".
```

Validation not implemented yet:

- unknown command names
- unknown macro names
- command or macro schemas
- cross-file target existence
- conditional syntax

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
