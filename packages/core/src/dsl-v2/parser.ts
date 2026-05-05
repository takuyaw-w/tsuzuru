import type { SourceLocation, SourceRange } from "../ast.js";
import { createDiagnostic, type ParseDiagnostic } from "../diagnostic.js";
import type {
  TzrV2CharacterDeclaration,
  TzrV2DialogueStatement,
  TzrV2Document,
  TzrV2EndStatement,
  TzrV2InlineAssetId,
  TzrV2InlineDelaySpan,
  TzrV2InlineNode,
  TzrV2InlineSeEvent,
  TzrV2InlineTextAttribute,
  TzrV2InlineTextSpan,
  TzrV2InlineVoiceEvent,
  TzrV2InlineWaitEvent,
  TzrV2JumpStatement,
  TzrV2NarrationStatement,
  TzrV2ParseOptions,
  TzrV2ParseResult,
  TzrV2SceneDeclaration,
  TzrV2SceneStatement,
  TzrV2TextBlockItem,
  TzrV2TextBlockMeta,
  TzrV2TextBlockMetaAttribute,
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

interface ParsedTextBlock {
  readonly meta?: TzrV2TextBlockMeta;
  readonly lines: readonly TzrV2TextBlockItem[];
}

interface ParsedInlineContent {
  readonly nodes: readonly TzrV2InlineNode[];
  readonly text: string;
  readonly nextIndex: number;
}

interface ParsedInlineMarkup {
  readonly node: TzrV2InlineTextSpan | TzrV2InlineDelaySpan | TzrV2InlineWaitEvent | TzrV2InlineSeEvent | TzrV2InlineVoiceEvent;
  readonly nextIndex: number;
}

interface InlineRawAttribute {
  readonly key: string;
  readonly value: string;
  readonly keyColumn: number;
  readonly valueColumn: number;
  readonly loc: SourceRange;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

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
    const textBlock = this.collectTextBlock(header, 1);
    const lines = textBlock.lines;
    const end = lines.at(-1)?.loc.end ?? headerLoc.end;
    return {
      type: "NarrationStatement",
      ...(textBlock.meta === undefined ? {} : { meta: textBlock.meta }),
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
    const textBlock = this.collectTextBlock(header, 1);
    const lines = textBlock.lines;
    const end = lines.at(-1)?.loc.end ?? headerLoc.end;
    return {
      type: "DialogueStatement",
      speaker,
      explicit: true,
      ...(textBlock.meta === undefined ? {} : { meta: textBlock.meta }),
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
    const textBlock = this.collectTextBlock(header, 1);
    const lines = textBlock.lines;
    const end = lines.at(-1)?.loc.end ?? headerLoc.end;
    return {
      type: "DialogueStatement",
      speaker,
      explicit: false,
      ...(textBlock.meta === undefined ? {} : { meta: textBlock.meta }),
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

  private collectTextBlock(header: SourceLine, headerIndentLevel: number): ParsedTextBlock {
    const items: TzrV2TextBlockItem[] = [];
    let meta: TzrV2TextBlockMeta | undefined;
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
      if (line.code.trim() === ":meta" && indent !== expectedIndent) {
        this.addError(line, 1, ":meta must be indented at the text block level.");
        this.cursor += 1;
        continue;
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
      if (rawText === ":meta") {
        if (items.length > 0) {
          this.addError(line, expectedIndent + 1, ":meta must appear before text block items.");
          this.cursor += 1;
          continue;
        }
        if (meta !== undefined) {
          this.addError(line, expectedIndent + 1, "Duplicate :meta block.");
          this.cursor += 1;
          continue;
        }

        meta = this.parseTextBlockMeta(line, headerIndentLevel + 1);
        continue;
      }

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

      const parsedText = this.parseTextBlockText(line, rawText, expectedIndent + 1);
      if (parsedText !== undefined) {
        items.push({
          type: "TextLine",
          text: parsedText.text,
          inline: parsedText.nodes,
          loc,
        });
      }
      this.cursor += 1;
    }

    if (items.length === 0) {
      this.addError(header, firstContentColumn(header), "Text block must include at least one indented text line.");
    }

    return {
      ...(meta === undefined ? {} : { meta }),
      lines: items,
    };
  }

  private parseTextBlockMeta(header: SourceLine, metaIndentLevel: number): TzrV2TextBlockMeta {
    const headerRange = this.lineRange(header);
    const attributes: TzrV2TextBlockMetaAttribute[] = [];
    const seen = new Set<string>();
    const expectedAttributeIndent = (metaIndentLevel + 1) * 2;
    this.cursor += 1;

    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        this.cursor += 1;
        continue;
      }

      const indent = this.validateIndent(line);
      if (indent <= metaIndentLevel * 2) {
        break;
      }
      if (indent !== expectedAttributeIndent) {
        this.addError(line, 1, `:meta attributes must be indented ${expectedAttributeIndent} spaces.`);
        this.cursor += 1;
        continue;
      }

      const source = line.code.slice(expectedAttributeIndent).trim();
      const attribute = this.parseTextBlockMetaAttribute(line, source, expectedAttributeIndent + 1, seen);
      if (attribute !== undefined) {
        attributes.push(attribute);
        seen.add(attribute.name);
      }
      this.cursor += 1;
    }

    if (attributes.length === 0) {
      this.addError(header, firstContentColumn(header), ":meta must include at least one attribute.");
    }

    const end = attributes.at(-1)?.loc.end ?? headerRange.end;
    return {
      type: "TextBlockMeta",
      attributes,
      loc: { start: headerRange.start, end },
    };
  }

  private parseTextBlockMetaAttribute(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    seen: ReadonlySet<string>,
  ): TzrV2TextBlockMetaAttribute | undefined {
    const equalsIndex = source.indexOf("=");
    if (equalsIndex === -1) {
      this.addError(line, sourceColumn, ":meta attribute must use key=value syntax.");
      return undefined;
    }

    const key = source.slice(0, equalsIndex).trim();
    const valueSource = source.slice(equalsIndex + 1).trim();
    const keyColumn = sourceColumn + source.indexOf(key);
    const valueColumn = sourceColumn + equalsIndex + 1 + source.slice(equalsIndex + 1).search(/\S/);

    if (key.length === 0 || valueSource.length === 0) {
      this.addError(line, sourceColumn, ":meta attribute must use key=value syntax.");
      return undefined;
    }
    if (key === "voice") {
      this.addError(line, keyColumn, "voice is not allowed in :meta.");
      return undefined;
    }
    if (!["color", "bold", "italic", "size", "delay", "mood"].includes(key)) {
      this.addError(line, keyColumn, `Unknown :meta attribute "${key}".`);
      return undefined;
    }
    if (seen.has(key)) {
      this.addError(line, keyColumn, `Duplicate :meta attribute "${key}".`);
      return undefined;
    }

    const loc = {
      start: this.location(line.line, keyColumn),
      end: this.location(line.line, valueColumn + valueSource.length),
    };

    if (key === "color") {
      if (!COLOR_PATTERN.test(valueSource)) {
        this.addError(line, valueColumn, "Invalid :meta color value.");
        return undefined;
      }
      return { type: "TextBlockColorMetaAttribute", name: "color", value: valueSource, loc };
    }

    if (key === "bold" || key === "italic") {
      if (valueSource !== "true" && valueSource !== "false") {
        this.addError(line, valueColumn, `Invalid :meta ${key} value.`);
        return undefined;
      }
      return { type: "TextBlockBooleanMetaAttribute", name: key, value: valueSource === "true", loc };
    }

    if (key === "size" || key === "delay") {
      if (!/^-?\d+$/.test(valueSource)) {
        this.addError(line, valueColumn, `Invalid :meta ${key} value.`);
        return undefined;
      }
      const value = Number(valueSource);
      const min = key === "size" ? 1 : 0;
      if (value < min) {
        this.addError(line, valueColumn, `Invalid :meta ${key} value.`);
        return undefined;
      }
      return { type: "TextBlockNumberMetaAttribute", name: key, value, loc };
    }

    if (valueSource.startsWith("'") || valueSource.startsWith("`")) {
      this.parseStringLiteral(line, valueSource, valueColumn);
      this.addError(line, valueColumn, "Invalid :meta mood value.");
      return undefined;
    }
    if (valueSource.startsWith('"')) {
      const value = this.parseStringLiteral(line, valueSource, valueColumn);
      return value === undefined
        ? undefined
        : { type: "TextBlockMoodMetaAttribute", name: "mood", value, valueKind: "string", loc };
    }
    if (!isValidTzrV2Identifier(valueSource)) {
      this.addError(line, valueColumn, "Invalid :meta mood value.");
      return undefined;
    }
    return { type: "TextBlockMoodMetaAttribute", name: "mood", value: valueSource, valueKind: "identifier", loc };
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

  private parseTextBlockText(line: SourceLine, source: string, sourceColumn: number): ParsedInlineContent | undefined {
    return this.parseInlineContent(line, source, sourceColumn, 0, false);
  }

  private parseInlineContent(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    startIndex: number,
    stopOnClosingBrace: boolean,
  ): ParsedInlineContent | undefined {
    const nodes: TzrV2InlineNode[] = [];
    let text = "";
    let textStartIndex: number | undefined;

    const flushText = (endIndex: number): void => {
      if (text.length === 0 || textStartIndex === undefined) {
        text = "";
        textStartIndex = undefined;
        return;
      }
      nodes.push({
        type: "InlineText",
        text,
        loc: {
          start: this.location(line.line, sourceColumn + textStartIndex),
          end: this.location(line.line, sourceColumn + endIndex),
        },
      });
      text = "";
      textStartIndex = undefined;
    };

    const appendText = (value: string, index: number): void => {
      if (textStartIndex === undefined) {
        textStartIndex = index;
      }
      text += value;
    };

    let index = startIndex;
    while (index < source.length) {
      const char = source[index] ?? "";
      if (stopOnClosingBrace && char === "}") {
        flushText(index);
        return {
          nodes,
          text: nodes.map((node) => node.text).join(""),
          nextIndex: index + 1,
        };
      }

      if (!stopOnClosingBrace && char === "}") {
        this.addError(line, sourceColumn + index, "Unescaped `}` is not valid in text.");
        return undefined;
      }

      if (char === "{") {
        flushText(index);
        const markup = this.parseInlineMarkup(line, source, sourceColumn, index);
        if (markup === undefined) {
          return undefined;
        }
        nodes.push(markup.node);
        index = markup.nextIndex;
        continue;
      }

      if (char === "\\") {
        const escape = this.parseTextEscape(line, source, sourceColumn, index);
        if (escape === undefined) {
          return undefined;
        }
        appendText(escape.text, index);
        index = escape.nextIndex;
        continue;
      }

      appendText(char, index);
      index += 1;
    }

    if (stopOnClosingBrace) {
      this.addError(line, sourceColumn + startIndex - 1, "Inline markup must be closed with `}`.");
      return undefined;
    }

    flushText(source.length);
    return {
      nodes,
      text: nodes.map((node) => node.text).join(""),
      nextIndex: source.length,
    };
  }

  private parseInlineMarkup(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    startIndex: number,
  ): ParsedInlineMarkup | undefined {
    const nameStart = startIndex + 1;
    let nameEnd = nameStart;
    while (nameEnd < source.length) {
      const char = source[nameEnd];
      if (char === undefined || /\s|\||\}/.test(char)) {
        break;
      }
      nameEnd += 1;
    }

    const name = source.slice(nameStart, nameEnd);
    if (name.length === 0) {
      this.addError(line, sourceColumn + startIndex, "Malformed inline markup.");
      return undefined;
    }
    if (name === "wait" || name === "se" || name === "voice") {
      return this.parseInlineEventMarkup(line, source, sourceColumn, startIndex, name, nameEnd);
    }
    if (name !== "text" && name !== "delay") {
      this.addError(line, sourceColumn + startIndex, `Unknown inline markup "${name}".`);
      return undefined;
    }

    let pipeIndex: number | undefined;
    for (let index = nameEnd; index < source.length; index += 1) {
      const char = source[index];
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === "|") {
        pipeIndex = index;
        break;
      }
      if (char === "}") {
        this.addError(line, sourceColumn + index, "Inline markup must include `|`.");
        return undefined;
      }
    }

    if (pipeIndex === undefined) {
      this.addError(line, sourceColumn + startIndex, "Inline markup must be closed with `}`.");
      return undefined;
    }

    const attributesSource = source.slice(nameEnd, pipeIndex).trim();
    const children = this.parseInlineContent(line, source, sourceColumn, pipeIndex + 1, true);
    if (children === undefined) {
      return undefined;
    }
    if (children.text.length === 0) {
      this.addError(line, sourceColumn + pipeIndex + 1, "Inline markup text must not be empty.");
      return undefined;
    }

    const loc = {
      start: this.location(line.line, sourceColumn + startIndex),
      end: this.location(line.line, sourceColumn + children.nextIndex),
    };

    if (name === "text") {
      const attributes = this.parseInlineTextAttributes(line, attributesSource, sourceColumn + nameEnd);
      if (attributes === undefined) {
        return undefined;
      }
      return {
        node: {
          type: "InlineTextSpan",
          attributes,
          children: children.nodes,
          text: children.text,
          loc,
        },
        nextIndex: children.nextIndex,
      };
    }

    const ms = this.parseInlineDelayAttributes(line, attributesSource, sourceColumn + nameEnd);
    if (ms === undefined) {
      return undefined;
    }
    return {
      node: {
        type: "InlineDelaySpan",
        ms,
        children: children.nodes,
        text: children.text,
        loc,
      },
      nextIndex: children.nextIndex,
    };
  }

  private parseInlineEventMarkup(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    startIndex: number,
    name: "wait" | "se" | "voice",
    nameEnd: number,
  ): ParsedInlineMarkup | undefined {
    let closingIndex: number | undefined;
    for (let index = nameEnd; index < source.length; index += 1) {
      const char = source[index];
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === "|") {
        this.addError(line, sourceColumn + index, `{${name}} does not support text ranges.`);
        return undefined;
      }
      if (char === "}") {
        closingIndex = index;
        break;
      }
    }

    if (closingIndex === undefined) {
      this.addError(line, sourceColumn + startIndex, "Inline event markup must be closed with `}`.");
      return undefined;
    }

    const attributesSource = source.slice(nameEnd, closingIndex).trim();
    const attributesColumn = sourceColumn + nameEnd;
    const loc = {
      start: this.location(line.line, sourceColumn + startIndex),
      end: this.location(line.line, sourceColumn + closingIndex + 1),
    };

    if (name === "wait") {
      const ms = this.parseInlineWaitAttributes(line, attributesSource, attributesColumn);
      if (ms === undefined) {
        return undefined;
      }
      return {
        node: {
          type: "InlineWaitEvent",
          ms,
          text: "",
          loc,
        },
        nextIndex: closingIndex + 1,
      };
    }

    const assetId = this.parseInlineAssetIdAttributes(line, name, attributesSource, attributesColumn);
    if (assetId === undefined) {
      return undefined;
    }
    return {
      node: {
        type: name === "se" ? "InlineSeEvent" : "InlineVoiceEvent",
        assetId,
        text: "",
        loc,
      },
      nextIndex: closingIndex + 1,
    };
  }

  private parseInlineTextAttributes(
    line: SourceLine,
    source: string,
    sourceColumn: number,
  ): readonly TzrV2InlineTextAttribute[] | undefined {
    if (source.trim().length === 0) {
      this.addError(line, sourceColumn, "{text} requires at least one attribute.");
      return undefined;
    }

    const attributes = this.parseInlineRawAttributes(line, source, sourceColumn);
    if (attributes === undefined) {
      return undefined;
    }

    const parsed: TzrV2InlineTextAttribute[] = [];
    const seen = new Set<string>();
    for (const attribute of attributes) {
      if (!["color", "bold", "italic", "size"].includes(attribute.key)) {
        this.addError(line, attribute.keyColumn, `Unknown {text} attribute "${attribute.key}".`);
        return undefined;
      }
      if (seen.has(attribute.key)) {
        this.addError(line, attribute.keyColumn, `Duplicate {text} attribute "${attribute.key}".`);
        return undefined;
      }
      seen.add(attribute.key);

      if (attribute.key === "color") {
        if (!COLOR_PATTERN.test(attribute.value)) {
          this.addError(line, attribute.valueColumn, "Invalid {text} color value.");
          return undefined;
        }
        parsed.push({ type: "InlineTextColorAttribute", name: "color", value: attribute.value, loc: attribute.loc });
        continue;
      }

      if (attribute.key === "bold" || attribute.key === "italic") {
        if (attribute.value !== "true" && attribute.value !== "false") {
          this.addError(line, attribute.valueColumn, `Invalid {text} ${attribute.key} value.`);
          return undefined;
        }
        parsed.push({
          type: "InlineTextBooleanAttribute",
          name: attribute.key,
          value: attribute.value === "true",
          loc: attribute.loc,
        });
        continue;
      }

      if (!/^-?\d+$/.test(attribute.value) || Number(attribute.value) < 1) {
        this.addError(line, attribute.valueColumn, "Invalid {text} size value.");
        return undefined;
      }
      parsed.push({ type: "InlineTextSizeAttribute", name: "size", value: Number(attribute.value), loc: attribute.loc });
    }

    return parsed;
  }

  private parseInlineDelayAttributes(line: SourceLine, source: string, sourceColumn: number): number | undefined {
    const attributes = this.parseInlineRawAttributes(line, source, sourceColumn);
    if (attributes === undefined) {
      return undefined;
    }

    let ms: number | undefined;
    for (const attribute of attributes) {
      if (attribute.key !== "ms") {
        this.addError(line, attribute.keyColumn, `Unknown {delay} attribute "${attribute.key}".`);
        return undefined;
      }
      if (ms !== undefined) {
        this.addError(line, attribute.keyColumn, 'Duplicate {delay} attribute "ms".');
        return undefined;
      }
      if (!/^-?\d+$/.test(attribute.value) || Number(attribute.value) < 0) {
        this.addError(line, attribute.valueColumn, "Invalid {delay} ms value.");
        return undefined;
      }
      ms = Number(attribute.value);
    }

    if (ms === undefined) {
      this.addError(line, sourceColumn, "{delay} requires ms.");
      return undefined;
    }

    return ms;
  }

  private parseInlineWaitAttributes(line: SourceLine, source: string, sourceColumn: number): number | undefined {
    const attributes = this.parseInlineRawAttributes(line, source, sourceColumn);
    if (attributes === undefined) {
      return undefined;
    }

    let ms: number | undefined;
    for (const attribute of attributes) {
      if (attribute.key !== "ms") {
        this.addError(line, attribute.keyColumn, `Unknown {wait} attribute "${attribute.key}".`);
        return undefined;
      }
      if (ms !== undefined) {
        this.addError(line, attribute.keyColumn, 'Duplicate {wait} attribute "ms".');
        return undefined;
      }
      if (!/^-?\d+$/.test(attribute.value) || Number(attribute.value) < 0) {
        this.addError(line, attribute.valueColumn, "Invalid {wait} ms value.");
        return undefined;
      }
      ms = Number(attribute.value);
    }

    if (ms === undefined) {
      this.addError(line, sourceColumn, "{wait} requires ms.");
      return undefined;
    }

    return ms;
  }

  private parseInlineAssetIdAttributes(
    line: SourceLine,
    name: "se" | "voice",
    source: string,
    sourceColumn: number,
  ): TzrV2InlineAssetId | undefined {
    const attributes = this.parseInlineRawAttributes(line, source, sourceColumn);
    if (attributes === undefined) {
      return undefined;
    }

    let assetIdAttribute: InlineRawAttribute | undefined;
    for (const attribute of attributes) {
      if (attribute.key !== "assetId") {
        this.addError(line, attribute.keyColumn, `Unknown {${name}} attribute "${attribute.key}".`);
        return undefined;
      }
      if (assetIdAttribute !== undefined) {
        this.addError(line, attribute.keyColumn, `Duplicate {${name}} attribute "assetId".`);
        return undefined;
      }
      assetIdAttribute = attribute;
    }

    if (assetIdAttribute === undefined) {
      this.addError(line, sourceColumn, `{${name}} requires assetId.`);
      return undefined;
    }

    return this.parseInlineAssetIdValue(line, name, assetIdAttribute);
  }

  private parseInlineAssetIdValue(
    line: SourceLine,
    name: "se" | "voice",
    attribute: InlineRawAttribute,
  ): TzrV2InlineAssetId | undefined {
    const value = attribute.value;
    if (value.length === 0) {
      this.addError(line, attribute.valueColumn, `{${name}} assetId must not be empty.`);
      return undefined;
    }
    if (value.startsWith('"')) {
      const parsed = this.parseStringLiteral(line, value, attribute.valueColumn);
      if (parsed === undefined) {
        this.addError(line, attribute.valueColumn, `Invalid {${name}} assetId value.`);
        return undefined;
      }
      if (parsed.length === 0) {
        this.addError(line, attribute.valueColumn, `{${name}} assetId must not be empty.`);
        return undefined;
      }
      return { type: "InlineStringAssetId", value: parsed, loc: attribute.loc };
    }

    if (value.startsWith("$")) {
      const path = value.slice(1);
      if (!isValidTzrV2DottedIdentifier(path)) {
        this.addError(line, attribute.valueColumn, `Invalid {${name}} variable assetId.`);
        return undefined;
      }
      return { type: "InlineVariableAssetId", path, loc: attribute.loc };
    }

    if (!isValidTzrV2DottedIdentifier(value)) {
      this.addError(line, attribute.valueColumn, `Invalid {${name}} assetId value.`);
      return undefined;
    }

    return { type: "InlineIdentifierAssetId", value, loc: attribute.loc };
  }

  private parseInlineRawAttributes(
    line: SourceLine,
    source: string,
    sourceColumn: number,
  ): readonly InlineRawAttribute[] | undefined {
    const trimmed = source.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const attributes: InlineRawAttribute[] = [];
    const parts = trimmed.split(/\s+/);
    let searchStart = 0;
    for (const part of parts) {
      const partOffset = source.indexOf(part, searchStart);
      searchStart = partOffset + part.length;
      const equalsIndex = part.indexOf("=");
      if (equalsIndex === -1) {
        this.addError(line, sourceColumn + partOffset, "Inline markup attributes must use key=value syntax.");
        return undefined;
      }

      const key = part.slice(0, equalsIndex);
      const value = part.slice(equalsIndex + 1);
      if (key.length === 0) {
        this.addError(line, sourceColumn + partOffset, "Inline markup attributes must use key=value syntax.");
        return undefined;
      }
      attributes.push({
        key,
        value,
        keyColumn: sourceColumn + partOffset,
        valueColumn: sourceColumn + partOffset + equalsIndex + 1,
        loc: {
          start: this.location(line.line, sourceColumn + partOffset),
          end: this.location(line.line, sourceColumn + partOffset + part.length),
        },
      });
    }

    return attributes;
  }

  private parseTextEscape(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    index: number,
  ): { readonly text: string; readonly nextIndex: number } | undefined {
    const next = source[index + 1];
    if (next === undefined) {
      this.addError(line, sourceColumn + index, "Incomplete text block escape.");
      return undefined;
    }

    if (next === "/" && source[index + 2] === "/") {
      return { text: "//", nextIndex: index + 3 };
    }

    if (next === "-" && source[index + 2] === "-" && source[index + 3] === "-") {
      return { text: "---", nextIndex: index + 4 };
    }

    if (next === "{" || next === "}" || next === "|" || next === "\\") {
      return { text: next, nextIndex: index + 2 };
    }

    this.addError(line, sourceColumn + index, `Invalid text block escape \\${next}.`);
    return undefined;
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
