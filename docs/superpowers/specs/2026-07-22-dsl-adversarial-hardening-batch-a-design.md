# DSL Adversarial Hardening Batch A Design

## Goal

Resolve `ADV-001` through `ADV-004` from
[`dsl-adversarial-review.md`](../../design/dsl-adversarial-review.md) without
changing the public parser/compiler API or promoting deferred text-control
syntax into the stable DSL.

## Scope

This change includes only Batch A:

- make compiled scene and character indexes safe for every valid identifier,
  including JavaScript prototype property names;
- reject numeric literals that cannot be represented safely and consistently
  through JSON serialization;
- reject excessively nested condition expressions with a normal parse
  diagnostic instead of allowing an uncaught stack overflow;
- treat blank lines inside plain narration and dialogue as authoring whitespace,
  not as implicit click-wait syntax.

Batch B compiler warnings and Batch C strict authoring validation remain out of
scope because they require separate warning and strict-mode API decisions.

## Design

### Prototype-safe indexes

Build all string-keyed compiled-document records from entries rather than by
assigning properties to `{}`. The resulting records must preserve
`__proto__`, `constructor`, and `toString` as own enumerable properties and
must survive a JSON round trip. Valid identifiers are not reserved or rejected.

The affected compiled records are:

- `CompiledTzrDocument.scenes`;
- `TzrDocumentMetadata.characters`;
- `TzrDocumentMetadata.scenes`.

The project compiler's source-line map is not emitted as part of the compiled
document, but it must also avoid prototype-sensitive assignment because file
IDs are user-controlled project inputs.

### Numeric literal safety

Use one parser-level numeric-literal conversion rule wherever `.tzr` source is
converted with `Number(...)`:

- every parsed number must be finite;
- integer syntax must produce a safe integer;
- finite decimal values remain supported, including the existing fractional
  forms used by camera zoom and coordinates;
- diagnostics identify the original literal and state whether it is non-finite
  or outside the safe integer range.

The rule applies to state updates, conditions, waits, generic/plugin arguments,
standard command sugar, text metadata, and inline parser-only numeric values.
Compiler/runtime validation remains as defense in depth for programmatically
constructed AST values.

### Condition nesting limit

The condition tokenizer rejects nesting beyond a fixed limit of 128 before the
recursive parser is entered. Parentheses and consecutive unary `not` operators
both count toward this limit. Depth 128 remains valid; depth 129 returns
`ok: false` with a source-located diagnostic. The same behavior applies through
`parseTzrConditionExpression` and conditions embedded in `parseTzr`.

The fixed limit is intentionally not public API or configuration. It is a
resource-safety boundary for an intentionally constrained scenario language.

### Blank lines in text blocks

Blank physical lines between text lines are ignored, matching ordinary
paragraph formatting expectations. Comment-only lines remain ignored. Leading,
trailing, consecutive, and CRLF blank lines do not produce AST nodes or compile
errors.

`TextClickWait` remains in the AST for compatibility with programmatically
constructed documents and deferred text-control design, but source parsing no
longer produces it implicitly. Explicit page-break and other deferred text
syntax remain unchanged and compile-rejected.

## Diagnostics

New numeric and nesting failures use existing `ParseDiagnostic` results and
preserve file, line, column, and source-line context. No exception should escape
the public parser for the covered adversarial inputs.

## Testing

Tests are added before implementation and must demonstrate the current failure:

- core compiler and project compiler JSON round trips preserve prototype-named
  IDs;
- the Vite transform emits and reloads those indexes;
- every numeric-literal entry path rejects unsafe or non-finite inputs while
  boundary-safe integers and finite decimals still parse;
- parenthesis and unary-`not` depth boundaries return parse results rather than
  throwing;
- blank lines in narration and dialogue compile as plain text for LF and CRLF.

Focused core and Vite checks run first. Because the changes affect public DSL
behavior and serialized documents, repository tests, typechecks, examples, and
the release-readiness gate run before completion is reported.

## Compatibility

Normal identifiers and representable numeric literals are unchanged. Inputs
that currently round, overflow, or serialize differently are intentionally
rejected. Blank lines inside text blocks change from implicit parser-only
click-wait nodes to ignored whitespace; this aligns parsing with the documented
stable subset and avoids promoting renderer/save-load semantics prematurely.
