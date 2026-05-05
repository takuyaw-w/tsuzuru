import type { SourceLocation, SourceRange } from "../ast.js";
import { createDiagnostic, type ParseDiagnostic } from "../diagnostic.js";
import type {
  TzrV2CharacterDeclaration,
  TzrV2DialogueStatement,
  TzrV2Document,
  TzrV2EndStatement,
  TzrV2JumpStatement,
  TzrV2NarrationStatement,
  TzrV2ParseOptions,
  TzrV2ParseResult,
  TzrV2SceneDeclaration,
  TzrV2SceneStatement,
  TzrV2TextBlockItem,
  TzrV2TextLine,
  TzrV2TitleDeclaration,
  TzrV2TopLevelDeclaration,
} from "./ast.js";

interface SourceLine {
  readonly original: string;
  readonly code: string;
  readonly line: number;
  readonly hasComment: boolean;
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
    const keyword = line.code.trim().match(/^\S+/)?.[0];
    if (keyword === "title") {
      const declaration = this.parseTitle(line);
      this.cursor += 1;
      return declaration;
    }
    if (keyword === "character") {
      const declaration = this.parseCharacter(line);
      this.cursor += 1;
      return declaration;
    }
    if (keyword === "scene") {
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

  private collectSceneBody(): readonly TzrV2SceneStatement[] {
    const body: TzrV2SceneStatement[] = [];

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

      if (indent % 2 !== 0) {
        this.cursor += 1;
        continue;
      }

      const indentLevel = indent / 2;
      if (indentLevel !== 1) {
        this.addError(line, 1, "Scene statements must be indented 2 spaces.");
        this.cursor += 1;
        continue;
      }

      const statement = this.parseSceneStatement(line);
      if (statement !== undefined) {
        body.push(statement);
      }
    }

    return body;
  }

  private parseSceneStatement(line: SourceLine): TzrV2SceneStatement | undefined {
    const source = line.code.slice(2).trimEnd();
    const statementColumn = 3;

    if (source === "narration:") {
      return this.parseNarrationStatement(line);
    }
    if (source === "narration") {
      this.addError(line, statementColumn, "narration block must end with `:`.");
      this.cursor += 1;
      return undefined;
    }
    if (source.startsWith("say ")) {
      return this.parseExplicitSayStatement(line, source, statementColumn);
    }
    if (source.startsWith("jump")) {
      return this.parseJumpStatement(line, source, statementColumn);
    }
    if (source.startsWith("end")) {
      return this.parseEndStatement(line, source, statementColumn);
    }
    if (source === "---") {
      this.addError(line, statementColumn, "`---` is only valid inside a text block.");
      this.cursor += 1;
      return undefined;
    }
    if (/^\S+:$/.test(source)) {
      return this.parseShorthandDialogueStatement(line, source, statementColumn);
    }

    this.addError(line, statementColumn, "Unsupported DSL v2 scene body statement.");
    this.cursor += 1;
    return undefined;
  }

  private parseNarrationStatement(header: SourceLine): TzrV2NarrationStatement {
    const headerLoc = this.lineRange(header);
    this.cursor += 1;
    const lines = this.collectTextBlock(header, 1);
    const end = lines.at(-1)?.loc.end ?? headerLoc.end;
    return {
      type: "NarrationStatement",
      lines,
      loc: { start: this.location(header.line, 3), end },
    };
  }

  private parseExplicitSayStatement(
    header: SourceLine,
    source: string,
    statementColumn: number,
  ): TzrV2DialogueStatement | undefined {
    const match = /^say\s+(\S+):$/.exec(source);
    if (match === null) {
      this.addError(header, statementColumn, "say block must use `say speaker:` syntax.");
      this.cursor += 1;
      return undefined;
    }

    const speaker = match[1] ?? "";
    const speakerColumn = header.code.indexOf(speaker) + 1;
    if (!this.validateIdentifier(speaker, header, speakerColumn)) {
      this.cursor += 1;
      return undefined;
    }

    const headerLoc = this.lineRange(header);
    this.cursor += 1;
    const lines = this.collectTextBlock(header, 1);
    const end = lines.at(-1)?.loc.end ?? headerLoc.end;
    return {
      type: "DialogueStatement",
      speaker,
      explicit: true,
      lines,
      loc: { start: this.location(header.line, statementColumn), end },
    };
  }

  private parseShorthandDialogueStatement(
    header: SourceLine,
    source: string,
    statementColumn: number,
  ): TzrV2DialogueStatement | undefined {
    const speaker = source.slice(0, -1).trim();
    const speakerColumn = header.code.indexOf(speaker) + 1;
    if (!this.validateIdentifier(speaker, header, speakerColumn)) {
      this.cursor += 1;
      return undefined;
    }

    const headerLoc = this.lineRange(header);
    this.cursor += 1;
    const lines = this.collectTextBlock(header, 1);
    const end = lines.at(-1)?.loc.end ?? headerLoc.end;
    return {
      type: "DialogueStatement",
      speaker,
      explicit: false,
      lines,
      loc: { start: this.location(header.line, statementColumn), end },
    };
  }

  private parseJumpStatement(line: SourceLine, source: string, statementColumn: number): TzrV2JumpStatement | undefined {
    const match = /^jump(?:\s+(.+))?$/.exec(source);
    if (match === null) {
      this.addError(line, statementColumn, "jump statement must use `jump target` syntax.");
      this.cursor += 1;
      return undefined;
    }

    const target = (match[1] ?? "").trim();
    if (target.length === 0) {
      this.addError(line, statementColumn, "jump target is required.");
      this.cursor += 1;
      return undefined;
    }
    if (!this.validateIdentifier(target, line, line.code.indexOf(target) + 1)) {
      this.cursor += 1;
      return undefined;
    }

    this.cursor += 1;
    return {
      type: "JumpStatement",
      target,
      loc: this.lineRange(line),
    };
  }

  private parseEndStatement(line: SourceLine, source: string, statementColumn: number): TzrV2EndStatement | undefined {
    if (source !== "end") {
      this.addError(line, statementColumn, "end statement must not have arguments.");
      this.cursor += 1;
      return undefined;
    }

    this.cursor += 1;
    return {
      type: "EndStatement",
      loc: this.lineRange(line),
    };
  }

  private collectTextBlock(header: SourceLine, headerIndentLevel: number): readonly TzrV2TextBlockItem[] {
    const items: TzrV2TextBlockItem[] = [];
    const expectedIndent = (headerIndentLevel + 1) * 2;

    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        if (line.hasComment) {
          this.cursor += 1;
          continue;
        }

        const nextTextLine = this.findNextTextBlockLine(this.cursor + 1, headerIndentLevel);
        if (nextTextLine === undefined) {
          break;
        }

        if (items.length === 0) {
          this.addError(line, 1, "Text block must not start with a blank line.");
          this.cursor += 1;
          continue;
        }

        items.push({
          type: "TextClickWait",
          loc: this.lineRange(line),
        });
        this.cursor += 1;
        continue;
      }

      const indent = this.validateIndent(line);
      if (indent <= headerIndentLevel * 2) {
        break;
      }
      if (indent !== expectedIndent) {
        if (line.code.trim() === "---") {
          this.addError(line, 1, "`---` must be indented at the text block level.");
        } else {
          this.addError(line, 1, `Text block lines must be indented ${expectedIndent} spaces.`);
        }
        this.cursor += 1;
        continue;
      }

      const rawText = line.code.slice(expectedIndent).trimEnd();
      const loc = {
        start: this.location(line.line, expectedIndent + 1),
        end: this.location(line.line, line.code.length + 1),
      };
      if (rawText === "---") {
        items.push({
          type: "TextPageBreak",
          loc,
        });
        this.cursor += 1;
        continue;
      }

      const text = this.parseTextBlockText(line, rawText, expectedIndent + 1);
      if (text !== undefined) {
        items.push({
          type: "TextLine",
          text,
          loc,
        });
      }
      this.cursor += 1;
    }

    if (items.length === 0) {
      this.addError(header, firstContentColumn(header), "Text block must include at least one indented text line.");
    }

    return items;
  }

  private findNextTextBlockLine(startCursor: number, headerIndentLevel: number): SourceLine | undefined {
    for (let index = startCursor; index < this.lines.length; index += 1) {
      const line = this.lines[index];
      if (line === undefined) {
        return undefined;
      }
      if (line.code.trim() === "") {
        continue;
      }
      const indent = countIndent(line.original);
      return indent > headerIndentLevel * 2 ? line : undefined;
    }
    return undefined;
  }

  private parseTextBlockText(line: SourceLine, source: string, sourceColumn: number): string | undefined {
    let text = "";

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index] ?? "";
      if (char !== "\\") {
        text += char;
        continue;
      }

      const next = source[index + 1];
      if (next === undefined) {
        this.addError(line, sourceColumn + index, "Incomplete text block escape.");
        return undefined;
      }

      if (next === "/" && source[index + 2] === "/") {
        text += "//";
        index += 2;
        continue;
      }

      if (next === "-" && source[index + 2] === "-" && source[index + 3] === "-") {
        text += "---";
        index += 3;
        continue;
      }

      if (next === "{" || next === "}" || next === "|" || next === "\\") {
        text += next;
        index += 1;
        continue;
      }

      this.addError(line, sourceColumn + index, `Invalid text block escape \\${next}.`);
      return undefined;
    }

    return text;
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
    let hasComment = false;
    let cursor = 0;
    const lineNumber = index + 1;

    while (cursor < original.length) {
      const char = original[cursor] ?? "";
      const next = original[cursor + 1];

      if (inBlockComment) {
        hasComment = true;
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
        if (original[cursor - 1] === "\\") {
          code += char;
          cursor += 1;
          continue;
        }
        hasComment = true;
        code += " ".repeat(original.length - cursor);
        break;
      }

      if (!inString && char === "/" && next === "*") {
        inBlockComment = true;
        hasComment = true;
        blockCommentStart = { filePath, line: lineNumber, column: cursor + 1 };
        code += "  ";
        cursor += 2;
        continue;
      }

      code += char;
      cursor += 1;
    }

    lines.push({ original, code, line: lineNumber, hasComment });
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

function countIndent(text: string): number {
  let indent = 0;
  for (const char of text) {
    if (char !== " ") {
      break;
    }
    indent += 1;
  }
  return indent;
}
