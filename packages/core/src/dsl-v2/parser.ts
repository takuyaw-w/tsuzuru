import type { SourceLocation, SourceRange } from "../ast.js";
import { createDiagnostic, type ParseDiagnostic } from "../diagnostic.js";
import type {
  TzrV2CharacterDeclaration,
  TzrV2Document,
  TzrV2ParseOptions,
  TzrV2ParseResult,
  TzrV2SceneBodyLine,
  TzrV2SceneDeclaration,
  TzrV2TitleDeclaration,
  TzrV2TopLevelDeclaration,
} from "./ast.js";

interface SourceLine {
  readonly original: string;
  readonly code: string;
  readonly line: number;
}

interface CommentScanResult {
  readonly lines: readonly SourceLine[];
  readonly errors: readonly ParseDiagnostic[];
}

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseTzrV2(source: string, options: TzrV2ParseOptions = {}): TzrV2ParseResult {
  const filePath = options.filePath ?? "<anonymous>";
  const parser = new TzrV2Parser(source, filePath);
  return parser.parse();
}

export function isValidTzrV2Identifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}

export function isValidTzrV2DottedIdentifier(value: string): boolean {
  return value.split(".").every((part) => part.length > 0 && isValidTzrV2Identifier(part));
}

class TzrV2Parser {
  private readonly lines: readonly SourceLine[];
  private readonly errors: ParseDiagnostic[];
  private cursor = 0;

  public constructor(source: string, private readonly filePath: string) {
    const sourceLines = source.replace(/\r\n?/g, "\n").split("\n");
    const scanned = stripComments(sourceLines, filePath);
    this.lines = scanned.lines;
    this.errors = [...scanned.errors];
  }

  public parse(): TzrV2ParseResult {
    const declarations: TzrV2TopLevelDeclaration[] = [];

    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        this.cursor += 1;
        continue;
      }

      const indent = this.validateIndent(line);
      if (indent !== 0) {
        this.addError(line, 1, "Top-level declarations must not be indented.");
        this.cursor += 1;
        continue;
      }

      const declaration = this.parseTopLevelDeclaration(line);
      if (declaration !== undefined) {
        declarations.push(declaration);
      }
    }

    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return {
      ok: true,
      document: {
        type: "TzrV2Document",
        filePath: this.filePath,
        sourceLines: this.lines.map((line) => line.original),
        declarations,
      },
      errors: [],
    };
  }

  private parseTopLevelDeclaration(line: SourceLine): TzrV2TopLevelDeclaration | undefined {
    const trimmed = line.code.trim();
    if (trimmed.startsWith("title")) {
      const declaration = this.parseTitle(line);
      this.cursor += 1;
      return declaration;
    }
    if (trimmed.startsWith("character")) {
      const declaration = this.parseCharacter(line);
      this.cursor += 1;
      return declaration;
    }
    if (trimmed.startsWith("scene")) {
      return this.parseScene(line);
    }

    this.addError(line, firstContentColumn(line), "Expected a DSL v2 top-level declaration.");
    this.cursor += 1;
    return undefined;
  }

  private parseTitle(line: SourceLine): TzrV2TitleDeclaration | undefined {
    const match = /^title\s+(.+)$/.exec(line.code.trim());
    if (match === null) {
      this.addError(line, firstContentColumn(line), 'title must use `title "..."` syntax.');
      return undefined;
    }

    const titleSource = match[1] ?? "";
    const titleColumn = line.code.indexOf(titleSource) + 1;
    const title = this.parseStringLiteral(line, titleSource.trim(), titleColumn);
    if (title === undefined) {
      return undefined;
    }

    return {
      type: "TitleDeclaration",
      title,
      loc: this.lineRange(line),
    };
  }

  private parseCharacter(line: SourceLine): TzrV2CharacterDeclaration | undefined {
    const match = /^character\s+(\S+)\s+name=(.+)$/.exec(line.code.trim());
    if (match === null) {
      this.addError(line, firstContentColumn(line), 'character must use `character id name="..."` syntax.');
      return undefined;
    }

    const id = match[1] ?? "";
    if (!this.validateIdentifier(id, line, line.code.indexOf(id) + 1)) {
      return undefined;
    }

    const nameSource = (match[2] ?? "").trim();
    const nameColumn = line.code.indexOf(nameSource) + 1;
    const name = this.parseStringLiteral(line, nameSource, nameColumn);
    if (name === undefined) {
      return undefined;
    }

    return {
      type: "CharacterDeclaration",
      id,
      name,
      loc: this.lineRange(line),
    };
  }

  private parseScene(line: SourceLine): TzrV2SceneDeclaration | undefined {
    const match = /^scene\s+(\S+)(?:\s+(.+))?:$/.exec(line.code.trim());
    const headerColumn = firstContentColumn(line);
    this.cursor += 1;

    if (match === null) {
      this.addError(line, headerColumn, 'scene must use `scene id:` or `scene id "title":` syntax.');
      return undefined;
    }

    const id = match[1] ?? "";
    if (!this.validateIdentifier(id, line, line.code.indexOf(id) + 1)) {
      return undefined;
    }

    const titleSource = match[2]?.trim();
    const title =
      titleSource === undefined
        ? undefined
        : this.parseStringLiteral(line, titleSource, line.code.indexOf(titleSource) + 1);
    const body = this.collectSceneBody();
    const end = body.at(-1)?.loc.end ?? this.lineRange(line).end;

    if (titleSource !== undefined && title === undefined) {
      return undefined;
    }

    return {
      type: "SceneDeclaration",
      id,
      ...(title === undefined ? {} : { title }),
      body,
      loc: { start: this.location(line.line, headerColumn), end },
    };
  }

  private collectSceneBody(): readonly TzrV2SceneBodyLine[] {
    const body: TzrV2SceneBodyLine[] = [];

    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        this.cursor += 1;
        continue;
      }

      const indent = this.validateIndent(line);
      if (indent === 0) {
        break;
      }

      if (indent !== 2) {
        this.addError(line, 1, `Expected 2 spaces, but found ${indent} spaces.`);
        this.cursor += 1;
        continue;
      }

      body.push({
        type: "SceneBodyLine",
        text: line.code.slice(2).trimEnd(),
        indentLevel: 1,
        loc: {
          start: this.location(line.line, 3),
          end: this.location(line.line, line.code.length + 1),
        },
      });
      this.cursor += 1;
    }

    return body;
  }

  private parseStringLiteral(line: SourceLine, source: string, column: number): string | undefined {
    if (source.startsWith("'")) {
      this.addError(line, column, "Only double-quoted string literals are supported.");
      return undefined;
    }
    if (source.startsWith("`")) {
      this.addError(line, column, "Backtick string literals are not supported.");
      return undefined;
    }
    if (!source.startsWith('"') || !source.endsWith('"') || source.length < 2) {
      this.addError(line, column, "String literal must be double-quoted.");
      return undefined;
    }

    let value = "";
    let escaped = false;
    for (let index = 1; index < source.length - 1; index += 1) {
      const char = source[index] ?? "";
      if (escaped) {
        switch (char) {
          case '"':
            value += '"';
            break;
          case "\\":
            value += "\\";
            break;
          case "n":
            value += "\n";
            break;
          case "t":
            value += "\t";
            break;
          default:
            this.addError(line, column + index, `Unsupported string escape \\${char}.`);
            return undefined;
        }
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        this.addError(line, column + index, "Unexpected double quote in string literal.");
        return undefined;
      }
      value += char;
    }

    if (escaped) {
      this.addError(line, column + source.length - 1, "String literal cannot end with an incomplete escape.");
      return undefined;
    }

    return value;
  }

  private validateIdentifier(value: string, line: SourceLine, column: number): boolean {
    if (isValidTzrV2Identifier(value)) {
      return true;
    }
    this.addError(line, column, `Invalid identifier "${value}".`);
    return false;
  }

  private validateIndent(line: SourceLine): number {
    let indent = 0;
    for (let index = 0; index < line.original.length; index += 1) {
      const char = line.original[index];
      if (char === " ") {
        indent += 1;
        continue;
      }
      if (char === "\t") {
        this.addError(line, index + 1, "Tabs are not allowed for indentation.");
        return indent;
      }
      if (char === "　") {
        this.addError(line, index + 1, "Full-width spaces are not allowed for indentation.");
        return indent;
      }
      break;
    }

    if (indent % 2 !== 0) {
      this.addError(line, 1, "Indentation must use 2 spaces per level.");
    }

    return indent;
  }

  private isIgnorable(line: SourceLine): boolean {
    return line.code.trim() === "";
  }

  private addError(line: SourceLine, column: number, message: string): void {
    this.errors.push(createDiagnostic(this.location(line.line, Math.max(column, 1)), message, line.original));
  }

  private currentRequired(): SourceLine {
    const line = this.lines[this.cursor];
    if (line === undefined) {
      throw new Error("Parser cursor moved beyond input.");
    }
    return line;
  }

  private isAtEnd(): boolean {
    return this.cursor >= this.lines.length;
  }

  private lineRange(line: SourceLine): SourceRange {
    return {
      start: this.location(line.line, firstContentColumn(line)),
      end: this.location(line.line, line.original.length + 1),
    };
  }

  private location(line: number, column: number): SourceLocation {
    return { filePath: this.filePath, line, column };
  }
}

function stripComments(sourceLines: readonly string[], filePath: string): CommentScanResult {
  const errors: ParseDiagnostic[] = [];
  const lines: SourceLine[] = [];
  let inBlockComment = false;
  let blockCommentStart: SourceLocation | undefined;

  for (const [index, original] of sourceLines.entries()) {
    let code = "";
    let inString = false;
    let escaped = false;
    let cursor = 0;
    const lineNumber = index + 1;

    while (cursor < original.length) {
      const char = original[cursor] ?? "";
      const next = original[cursor + 1];

      if (inBlockComment) {
        if (char === "/" && next === "*") {
          errors.push(
            createDiagnostic(
              { filePath, line: lineNumber, column: cursor + 1 },
              "Nested block comments are not allowed.",
              original,
            ),
          );
          code += "  ";
          cursor += 2;
          continue;
        }
        if (char === "*" && next === "/") {
          inBlockComment = false;
          code += "  ";
          cursor += 2;
          continue;
        }
        code += " ";
        cursor += 1;
        continue;
      }

      if (escaped) {
        code += char;
        escaped = false;
        cursor += 1;
        continue;
      }

      if (char === "\\") {
        code += char;
        escaped = inString;
        cursor += 1;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        code += char;
        cursor += 1;
        continue;
      }

      if (!inString && char === "/" && next === "/") {
        code += " ".repeat(original.length - cursor);
        break;
      }

      if (!inString && char === "/" && next === "*") {
        inBlockComment = true;
        blockCommentStart = { filePath, line: lineNumber, column: cursor + 1 };
        code += "  ";
        cursor += 2;
        continue;
      }

      code += char;
      cursor += 1;
    }

    lines.push({ original, code, line: lineNumber });
  }

  if (inBlockComment && blockCommentStart !== undefined) {
    const sourceLine = sourceLines[blockCommentStart.line - 1] ?? "";
    errors.push(createDiagnostic(blockCommentStart, "Block comment must be closed with */.", sourceLine));
  }

  return { lines, errors };
}

function firstContentColumn(line: SourceLine): number {
  const match = /\S/.exec(line.code);
  return match === null ? 1 : match.index + 1;
}
