import type {
  ChoiceBlock,
  ChoiceItem,
  CommandStatement,
  JumpTarget,
  LabelDeclaration,
  MacroStatement,
  NarrationBlock,
  PositionalArgument,
  SceneDeclaration,
  SourceLocation,
  SourceRange,
  SpeakerBlock,
  TextLine,
  TzrArgument,
  TzrDocument,
  TzrStatement,
  TzrValue,
} from "./ast.js";
import { createDiagnostic, type ParseDiagnostic } from "./diagnostic.js";

export type ParseResult =
  | { readonly ok: true; readonly document: TzrDocument; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly ParseDiagnostic[] };

export interface ParseOptions {
  readonly filePath?: string;
}

interface SourceLine {
  readonly text: string;
  readonly line: number;
}

interface CallParts {
  readonly name: string;
  readonly args: readonly TzrArgument[];
  readonly loc: SourceRange;
}

export function parseTzr(source: string, options: ParseOptions = {}): ParseResult {
  const filePath = options.filePath ?? "<anonymous>";
  const parser = new TzrParser(source, filePath);
  return parser.parse();
}

class TzrParser {
  private readonly lines: readonly SourceLine[];
  private readonly errors: ParseDiagnostic[] = [];
  private cursor = 0;

  public constructor(source: string, private readonly filePath: string) {
    this.lines = source.replace(/\r\n?/g, "\n").split("\n").map((text, index) => ({
      text,
      line: index + 1,
    }));
  }

  public parse(): ParseResult {
    const body: TzrStatement[] = [];

    while (!this.isAtEnd()) {
      const current = this.current();
      if (current === undefined) {
        break;
      }

      if (current.text.trim() === "") {
        this.cursor += 1;
        continue;
      }

      const statement = this.parseStatement();
      if (statement !== undefined) {
        body.push(statement);
      }
    }

    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return {
      ok: true,
      document: {
        type: "Document",
        filePath: this.filePath,
        body,
      },
      errors: [],
    };
  }

  private parseStatement(): TzrStatement | undefined {
    const line = this.current();
    if (line === undefined) {
      return undefined;
    }

    const trimmed = line.text.trimStart();
    if (trimmed.startsWith("#scene(")) {
      return this.parseScene();
    }
    if (trimmed.startsWith("#label(")) {
      return this.parseLabel();
    }
    if (trimmed.startsWith("::")) {
      return this.parseSpeakerBlock();
    }
    if (trimmed.startsWith("@")) {
      return this.parseCommand();
    }
    if (trimmed.startsWith("$")) {
      return this.parseMacro();
    }
    if (trimmed.startsWith("?")) {
      return this.parseChoice();
    }
    if (trimmed.startsWith("-")) {
      this.addError(line, line.text.indexOf("-") + 1, "Choice item must follow a choice question.");
      this.cursor += 1;
      return undefined;
    }

    return this.parseNarrationBlock();
  }

  private parseScene(): SceneDeclaration | undefined {
    const line = this.currentRequired();
    const loc = this.lineRange(line);
    const id = this.parseSingleStringDeclaration(line, "#scene");
    this.cursor += 1;
    return id === undefined ? undefined : { type: "SceneDeclaration", id, loc };
  }

  private parseLabel(): LabelDeclaration | undefined {
    const line = this.currentRequired();
    const loc = this.lineRange(line);
    const id = this.parseSingleStringDeclaration(line, "#label");
    this.cursor += 1;
    return id === undefined ? undefined : { type: "LabelDeclaration", id, loc };
  }

  private parseSpeakerBlock(): SpeakerBlock | undefined {
    const header = this.currentRequired();
    const column = header.text.indexOf("::") + 1;
    const speaker = header.text.slice(column + 1).trim();
    this.cursor += 1;

    if (speaker.length === 0) {
      this.addError(header, column, "Speaker name is required.");
      return undefined;
    }

    const lines = this.collectTextLines();
    const end = lines.at(-1)?.loc.end ?? this.lineRange(header).end;
    return {
      type: "SpeakerBlock",
      speaker,
      lines,
      loc: { start: this.location(header.line, column), end },
    };
  }

  private parseNarrationBlock(): NarrationBlock {
    const first = this.currentRequired();
    const lines = this.collectTextLines();
    const last = lines.at(-1) ?? this.textLine(first);
    return {
      type: "NarrationBlock",
      lines,
      loc: { start: lines[0]?.loc.start ?? this.lineRange(first).start, end: last.loc.end },
    };
  }

  private parseCommand(): CommandStatement | undefined {
    const line = this.currentRequired();
    const call = this.parseCall(line, "@");
    this.cursor += 1;
    if (call === undefined) {
      return undefined;
    }

    const jumpTarget = call.name === "jump" ? this.extractJumpTarget(line, call.args) : undefined;
    return {
      type: "CommandStatement",
      name: call.name,
      args: call.args,
      ...(jumpTarget === undefined ? {} : { jumpTarget }),
      loc: call.loc,
    };
  }

  private parseMacro(): MacroStatement | undefined {
    const line = this.currentRequired();
    const call = this.parseCall(line, "$");
    this.cursor += 1;
    return call === undefined
      ? undefined
      : {
          type: "MacroStatement",
          name: call.name,
          args: call.args,
          loc: call.loc,
        };
  }

  private parseChoice(): ChoiceBlock | undefined {
    const questionLine = this.currentRequired();
    const column = questionLine.text.indexOf("?") + 1;
    const question = questionLine.text.slice(column).trim();
    this.cursor += 1;

    if (question.length === 0) {
      this.addError(questionLine, column, "Choice question is required.");
    }

    const items: ChoiceItem[] = [];
    while (!this.isAtEnd()) {
      const line = this.current();
      if (line === undefined || line.text.trim() === "") {
        break;
      }

      const trimmed = line.text.trimStart();
      if (!trimmed.startsWith("-")) {
        break;
      }

      const item = this.parseChoiceItem(line);
      if (item !== undefined) {
        items.push(item);
      }
      this.cursor += 1;
    }

    if (items.length === 0) {
      this.addError(questionLine, column, "Choice must include at least one item.");
    }

    const end = items.at(-1)?.loc.end ?? this.lineRange(questionLine).end;
    return {
      type: "ChoiceBlock",
      question,
      items,
      loc: { start: this.location(questionLine.line, column), end },
    };
  }

  private parseChoiceItem(line: SourceLine): ChoiceItem | undefined {
    const itemPattern = /^\s*-\s*"((?:\\.|[^"\\])*)"\s*->\s*(\S+)\s*$/;
    const match = itemPattern.exec(line.text);
    const column = line.text.indexOf("-") + 1;
    if (match === null) {
      this.addError(line, column, 'Choice item must use `- "Text" -> #label` syntax.');
      return undefined;
    }

    const text = unescapeString(match[1] ?? "");
    const rawTarget = match[2] ?? "";
    return {
      text,
      target: parseJumpTarget(rawTarget),
      loc: this.lineRange(line),
    };
  }

  private collectTextLines(): TextLine[] {
    const lines: TextLine[] = [];
    while (!this.isAtEnd()) {
      const line = this.current();
      if (line === undefined || line.text.trim() === "") {
        break;
      }
      if (isDirectiveLine(line.text)) {
        break;
      }
      lines.push(this.textLine(line));
      this.cursor += 1;
    }
    return lines;
  }

  private textLine(line: SourceLine): TextLine {
    return {
      text: line.text.trimEnd(),
      loc: this.lineRange(line),
    };
  }

  private parseSingleStringDeclaration(line: SourceLine, keyword: "#scene" | "#label"): string | undefined {
    const pattern = new RegExp(`^\\s*\\${keyword}\\("((?:\\\\.|[^"\\\\])*)"\\)\\s*$`);
    const match = pattern.exec(line.text);
    if (match === null) {
      const column = line.text.indexOf(keyword) + 1;
      this.addError(line, column, `${keyword} must use ${keyword}("id") syntax.`);
      return undefined;
    }
    return unescapeString(match[1] ?? "");
  }

  private parseCall(line: SourceLine, sigil: "@" | "$"): CallParts | undefined {
    const startIndex = line.text.indexOf(sigil);
    const pattern = sigil === "@" ? /^\s*@([A-Za-z_][A-Za-z0-9_]*)\((.*)\)\s*$/ : /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\((.*)\)\s*$/;
    const match = pattern.exec(line.text);
    if (match === null) {
      this.addError(line, startIndex + 1, `${sigil} call must use ${sigil}name(...) syntax.`);
      return undefined;
    }

    const name = match[1];
    const argsSource = match[2] ?? "";
    if (name === undefined) {
      this.addError(line, startIndex + 1, "Call name is required.");
      return undefined;
    }

    const argsStart = line.text.indexOf("(", startIndex) + 2;
    const args = this.parseArguments(line, argsSource, argsStart);
    return {
      name,
      args,
      loc: this.lineRange(line),
    };
  }

  private parseArguments(line: SourceLine, source: string, sourceColumn: number): readonly TzrArgument[] {
    if (source.trim() === "") {
      return [];
    }

    const parts = splitArguments(source);
    const args: TzrArgument[] = [];
    for (const part of parts) {
      const raw = part.text.trim();
      const column = sourceColumn + part.start + part.text.search(/\S/);
      const namedMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(raw);

      if (namedMatch !== null) {
        const name = namedMatch[1];
        const valueSource = namedMatch[2];
        if (name === undefined || valueSource === undefined) {
          this.addError(line, column, "Named argument is malformed.");
          continue;
        }
        const valueOffset = raw.indexOf(valueSource);
        const value = this.parseValue(line, valueSource, column + valueOffset);
        if (value !== undefined) {
          args.push({
            type: "NamedArgument",
            name,
            value,
            loc: { start: this.location(line.line, column), end: value.loc.end },
          });
        }
        continue;
      }

      const value = this.parseValue(line, raw, column);
      if (value !== undefined) {
        args.push({
          type: "PositionalArgument",
          value,
          loc: { start: this.location(line.line, column), end: value.loc.end },
        });
      }
    }
    return args;
  }

  private parseValue(line: SourceLine, source: string, column: number): TzrValue | undefined {
    const loc = {
      start: this.location(line.line, column),
      end: this.location(line.line, column + source.length),
    };

    const stringMatch = /^"((?:\\.|[^"\\])*)"$/.exec(source);
    if (stringMatch !== null) {
      return { type: "StringValue", value: unescapeString(stringMatch[1] ?? ""), loc };
    }

    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(source)) {
      return { type: "NumberValue", value: Number(source), loc };
    }

    if (source === "true" || source === "false") {
      return { type: "BooleanValue", value: source === "true", loc };
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(source)) {
      return { type: "IdentifierValue", name: source, loc };
    }

    this.addError(line, column, "Unsupported argument value.");
    return undefined;
  }

  private extractJumpTarget(line: SourceLine, args: readonly TzrArgument[]): JumpTarget | undefined {
    const first = args[0];
    if (first === undefined || first.type !== "PositionalArgument" || first.value.type !== "StringValue") {
      this.addError(line, line.text.indexOf("@jump") + 1, '@jump must receive a string target, for example @jump("#label").');
      return undefined;
    }
    return parseJumpTarget(first.value.value);
  }

  private addError(line: SourceLine, column: number, message: string): void {
    this.errors.push(createDiagnostic(this.location(line.line, Math.max(column, 1)), message, line.text));
  }

  private current(): SourceLine | undefined {
    return this.lines[this.cursor];
  }

  private currentRequired(): SourceLine {
    const line = this.current();
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
      start: this.location(line.line, 1),
      end: this.location(line.line, line.text.length + 1),
    };
  }

  private location(line: number, column: number): SourceLocation {
    return { filePath: this.filePath, line, column };
  }
}

function isDirectiveLine(text: string): boolean {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith("#scene(") ||
    trimmed.startsWith("#label(") ||
    trimmed.startsWith("::") ||
    trimmed.startsWith("@") ||
    trimmed.startsWith("$") ||
    trimmed.startsWith("?") ||
    trimmed.startsWith("-")
  );
}

function parseJumpTarget(raw: string): JumpTarget {
  const hashIndex = raw.indexOf("#");
  if (hashIndex === -1) {
    return raw.length === 0 ? { raw } : { raw, file: raw };
  }

  const file = raw.slice(0, hashIndex);
  const label = raw.slice(hashIndex + 1);
  return {
    raw,
    ...(file.length > 0 ? { file } : {}),
    ...(label.length > 0 ? { label } : {}),
  };
}

function splitArguments(source: string): readonly { readonly text: string; readonly start: number }[] {
  const parts: { text: string; start: number }[] = [];
  let start = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (char === "," && !inString) {
      parts.push({ text: source.slice(start, index), start });
      start = index + 1;
    }
  }

  parts.push({ text: source.slice(start), start });
  return parts;
}

function unescapeString(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
