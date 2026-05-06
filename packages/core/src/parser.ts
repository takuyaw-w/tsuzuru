import type { SourceLocation, SourceRange } from "./ast.js";
import { parseTzrConditionExpression } from "./condition-parser.js";
import { createDiagnostic, type ParseDiagnostic } from "./diagnostic.js";
import type {
  TzrAddStatement,
  TzrArgumentValue,
  TzrAudioAssetRef,
  TzrBgmStatement,
  TzrBgStatement,
  TzrBooleanValue,
  TzrCallStatement,
  TzrCharacterDeclaration,
  TzrChoiceItem,
  TzrChoiceStatement,
  TzrClearVisualStatement,
  TzrConditionExpression,
  TzrDialogueStatement,
  TzrDocument,
  TzrElifBranch,
  TzrEndStatement,
  TzrHideStatement,
  TzrIdentifierValue,
  TzrIfStatement,
  TzrInlineAssetId,
  TzrInlineDelaySpan,
  TzrInlineNode,
  TzrInlineSeEvent,
  TzrInlineTextAttribute,
  TzrInlineTextSpan,
  TzrInlineVoiceEvent,
  TzrInlineWaitEvent,
  TzrJumpStatement,
  TzrNamedArgument,
  TzrNarrationStatement,
  TzrNullValue,
  TzrNumberValue,
  TzrParseOptions,
  TzrParseResult,
  TzrSceneDeclaration,
  TzrSceneStatement,
  TzrSeStatement,
  TzrSetStatement,
  TzrShowStatement,
  TzrStatePath,
  TzrStopBgmStatement,
  TzrStringValue,
  TzrSystemUnlockId,
  TzrSystemUnlockKind,
  TzrSystemUnlockStatement,
  TzrTextBlockItem,
  TzrTextBlockMeta,
  TzrTextBlockMetaAttribute,
  TzrTextLine,
  TzrTitleDeclaration,
  TzrTopLevelDeclaration,
  TzrValueExpression,
  TzrVariableReferenceValue,
  TzrVisualAssetRef,
  TzrVisualCoordinatePlacement,
  TzrVisualNamedPlacement,
  TzrVisualPlacement,
  TzrVisualTransition,
  TzrVisualTransitionName,
  TzrVoiceStatement,
  TzrWaitStatement,
} from "./scenario-ast.js";

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
  readonly meta?: TzrTextBlockMeta;
  readonly lines: readonly TzrTextBlockItem[];
}

interface ParsedInlineContent {
  readonly nodes: readonly TzrInlineNode[];
  readonly text: string;
  readonly nextIndex: number;
}

interface ParsedInlineMarkup {
  readonly node: TzrInlineTextSpan | TzrInlineDelaySpan | TzrInlineWaitEvent | TzrInlineSeEvent | TzrInlineVoiceEvent;
  readonly nextIndex: number;
}

interface ParsedChoiceItemHeader {
  readonly label: string;
  readonly id?: string;
  readonly condition?: TzrConditionExpression;
}

interface ParsedConditionBranchHeader {
  readonly condition: TzrConditionExpression;
}

interface ParsedVisualStatementBody {
  readonly bodySource: string;
  readonly bodyColumn: number;
  readonly transition?: TzrVisualTransition;
}

type StateStatementKeyword = "set" | "add";
type CallWaitStatementKeyword = "call" | "wait";
type VisualAssetStatementKeyword = "bg" | "show" | "hide";
type AudioAssetStatementKeyword = "bgm" | "se" | "voice";
type SystemUnlockStatementName = "system.unlockEnding" | "system.unlockCg" | "system.unlockAchievement";

interface InlineRawAttribute {
  readonly key: string;
  readonly value: string;
  readonly keyColumn: number;
  readonly valueColumn: number;
  readonly loc: SourceRange;
}

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const NUMBER_LITERAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

export function parseTzr(source: string, options: TzrParseOptions = {}): TzrParseResult {
  const filePath = options.filePath ?? "<anonymous>";
  const parser = new TzrParser(source, filePath);
  return parser.parse();
}

export function isValidTzrIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}

export function isValidTzrDottedIdentifier(value: string): boolean {
  return value.split(".").every((part) => part.length > 0 && isValidTzrIdentifier(part));
}

class TzrParser {
  private readonly lines: readonly SourceLine[];
  private readonly errors: ParseDiagnostic[];
  private cursor = 0;

  public constructor(
    source: string,
    private readonly filePath: string,
  ) {
    const sourceLines = source.replace(/\r\n?/g, "\n").split("\n");
    const scanned = stripComments(sourceLines, filePath);
    this.lines = scanned.lines;
    this.errors = [...scanned.errors];
  }

  public parse(): TzrParseResult {
    const declarations: TzrTopLevelDeclaration[] = [];

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
        type: "TzrDocument",
        filePath: this.filePath,
        sourceLines: this.lines.map((line) => line.original),
        declarations,
      },
      errors: [],
    };
  }

  private parseTopLevelDeclaration(line: SourceLine): TzrTopLevelDeclaration | undefined {
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

  private parseTitle(line: SourceLine): TzrTitleDeclaration | undefined {
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

  private parseCharacter(line: SourceLine): TzrCharacterDeclaration | undefined {
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

  private parseScene(line: SourceLine): TzrSceneDeclaration | undefined {
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

  private collectSceneBody(): readonly TzrSceneStatement[] {
    return this.collectSceneStatements(1, "Scene statements must be indented 2 spaces.");
  }

  private collectSceneStatements(
    expectedIndentLevel: number,
    indentationMessage: string,
  ): readonly TzrSceneStatement[] {
    const body: TzrSceneStatement[] = [];
    const expectedIndent = expectedIndentLevel * 2;

    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        this.cursor += 1;
        continue;
      }

      const indent = this.validateIndent(line);
      if (indent < expectedIndent) {
        break;
      }

      if (indent % 2 !== 0) {
        this.cursor += 1;
        continue;
      }

      if (indent !== expectedIndent) {
        this.addError(line, 1, indentationMessage);
        this.cursor += 1;
        continue;
      }

      const statement = this.parseSceneStatement(line, expectedIndentLevel);
      if (statement !== undefined) {
        body.push(statement);
      }
    }

    return body;
  }

  private parseSceneStatement(line: SourceLine, indentLevel: number): TzrSceneStatement | undefined {
    const sourceIndent = indentLevel * 2;
    const source = line.code.slice(sourceIndent).trimEnd();
    const statementColumn = sourceIndent + 1;

    if (source === "narration:") {
      return this.parseNarrationStatement(line, indentLevel);
    }
    if (source === "narration") {
      this.addError(line, statementColumn, "narration block must end with `:`.");
      this.cursor += 1;
      return undefined;
    }
    if (source.startsWith("say ")) {
      return this.parseExplicitSayStatement(line, source, statementColumn, indentLevel);
    }
    if (source === "choice" || source === "choice:" || source.startsWith("choice ")) {
      return this.parseChoiceStatement(line, source, statementColumn, indentLevel);
    }
    if (source === "if" || source === "if:" || source.startsWith("if ")) {
      return this.parseIfStatement(line, source, statementColumn, indentLevel);
    }
    if (source === "elif" || source === "elif:" || source.startsWith("elif ")) {
      this.addError(line, statementColumn, "elif must follow an if statement.");
      this.cursor += 1;
      return undefined;
    }
    if (source === "else" || source === "else:" || source.startsWith("else ")) {
      this.addError(line, statementColumn, "else must follow an if statement.");
      this.cursor += 1;
      return undefined;
    }
    if (source === "set" || source.startsWith("set ")) {
      return this.parseSetStatement(line, source, statementColumn);
    }
    if (source === "add" || source.startsWith("add ")) {
      return this.parseAddStatement(line, source, statementColumn);
    }
    if (source === "call" || source.startsWith("call ")) {
      return this.parseCallStatement(line, source, statementColumn);
    }
    if (source === "wait" || source.startsWith("wait ")) {
      return this.parseWaitStatement(line, source, statementColumn);
    }
    if (source === "bg" || source.startsWith("bg ")) {
      return this.parseBgStatement(line, source, statementColumn);
    }
    if (source === "show" || source.startsWith("show ")) {
      return this.parseShowStatement(line, source, statementColumn);
    }
    if (source === "hide" || source.startsWith("hide ")) {
      return this.parseHideStatement(line, source, statementColumn);
    }
    if (source === "clear" || source.startsWith("clear ")) {
      return this.parseClearVisualStatement(line, source, statementColumn);
    }
    if (source === "bgm" || source.startsWith("bgm ")) {
      return this.parseBgmStatement(line, source, statementColumn);
    }
    if (source === "stopBgm" || source.startsWith("stopBgm ")) {
      return this.parseStopBgmStatement(line, source, statementColumn);
    }
    if (source === "se" || source.startsWith("se ")) {
      return this.parseSeStatement(line, source, statementColumn);
    }
    if (source === "voice" || source.startsWith("voice ")) {
      return this.parseVoiceStatement(line, source, statementColumn);
    }
    if (source === "system" || source.startsWith("system.")) {
      return this.parseSystemStatement(line, source, statementColumn);
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
      return this.parseShorthandDialogueStatement(line, source, statementColumn, indentLevel);
    }

    this.addError(line, statementColumn, "Unsupported DSL v2 scene body statement.");
    this.cursor += 1;
    return undefined;
  }

  private parseNarrationStatement(header: SourceLine, indentLevel: number): TzrNarrationStatement {
    const headerLoc = this.lineRange(header);
    const statementColumn = indentLevel * 2 + 1;
    this.cursor += 1;
    const textBlock = this.collectTextBlock(header, indentLevel);
    const lines = textBlock.lines;
    const end = lines.at(-1)?.loc.end ?? headerLoc.end;
    return {
      type: "NarrationStatement",
      ...(textBlock.meta === undefined ? {} : { meta: textBlock.meta }),
      lines,
      loc: { start: this.location(header.line, statementColumn), end },
    };
  }

  private parseExplicitSayStatement(
    header: SourceLine,
    source: string,
    statementColumn: number,
    indentLevel: number,
  ): TzrDialogueStatement | undefined {
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
    const textBlock = this.collectTextBlock(header, indentLevel);
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
    indentLevel: number,
  ): TzrDialogueStatement | undefined {
    const speaker = source.slice(0, -1).trim();
    const speakerColumn = header.code.indexOf(speaker) + 1;
    if (!this.validateIdentifier(speaker, header, speakerColumn)) {
      this.cursor += 1;
      return undefined;
    }

    const headerLoc = this.lineRange(header);
    this.cursor += 1;
    const textBlock = this.collectTextBlock(header, indentLevel);
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

  private parseChoiceStatement(
    header: SourceLine,
    source: string,
    statementColumn: number,
    indentLevel: number,
  ): TzrChoiceStatement | undefined {
    if (source === "choice" || source === "choice:") {
      this.addError(header, statementColumn, "choice question is required.");
      this.cursor += 1;
      return undefined;
    }
    if (!source.endsWith(":")) {
      this.addError(header, statementColumn, "choice header must end with `:`.");
      this.cursor += 1;
      return undefined;
    }

    const questionSource = source.slice("choice".length, -1).trim();
    const questionColumn = header.code.indexOf(questionSource) + 1;
    if (questionSource.length === 0) {
      this.addError(header, statementColumn, "choice question is required.");
      this.cursor += 1;
      return undefined;
    }
    if (!questionSource.startsWith('"')) {
      this.addError(header, questionColumn, "choice question must be a double-quoted string.");
      this.cursor += 1;
      return undefined;
    }

    const question = this.parseStringLiteral(header, questionSource, questionColumn);
    this.cursor += 1;
    const items = this.collectChoiceItems(header, indentLevel);
    const end = items.at(-1)?.loc.end ?? this.lineRange(header).end;

    if (question === undefined) {
      return undefined;
    }

    return {
      type: "ChoiceStatement",
      question,
      items,
      loc: { start: this.location(header.line, statementColumn), end },
    };
  }

  private collectChoiceItems(header: SourceLine, choiceIndentLevel: number): readonly TzrChoiceItem[] {
    const items: TzrChoiceItem[] = [];
    const seenIds = new Set<string>();
    const itemIndentLevel = choiceIndentLevel + 1;
    const expectedItemIndent = itemIndentLevel * 2;

    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        this.cursor += 1;
        continue;
      }

      const indent = this.validateIndent(line);
      if (indent <= choiceIndentLevel * 2) {
        break;
      }
      if (indent % 2 !== 0) {
        this.cursor += 1;
        continue;
      }
      if (indent !== expectedItemIndent) {
        this.addError(line, 1, `Choice items must be indented ${expectedItemIndent} spaces.`);
        this.cursor += 1;
        continue;
      }

      const item = this.parseChoiceItem(line, itemIndentLevel);
      if (item === undefined) {
        continue;
      }
      if (item.id !== undefined) {
        if (seenIds.has(item.id)) {
          this.addError(line, expectedItemIndent + 1, `Duplicate choice item id "${item.id}".`);
        } else {
          seenIds.add(item.id);
        }
      }
      items.push(item);
    }

    if (items.length === 0) {
      this.addError(header, firstContentColumn(header), "choice must include at least one item.");
    }

    return items;
  }

  private parseChoiceItem(header: SourceLine, itemIndentLevel: number): TzrChoiceItem | undefined {
    const sourceIndent = itemIndentLevel * 2;
    const source = header.code.slice(sourceIndent).trimEnd();
    const sourceColumn = sourceIndent + 1;
    const parsedHeader = this.parseChoiceItemHeader(header, source, sourceColumn);
    this.cursor += 1;
    const bodyIndentLevel = itemIndentLevel + 1;
    const body = this.collectSceneStatements(
      bodyIndentLevel,
      `Choice item body statements must be indented ${bodyIndentLevel * 2} spaces.`,
    );
    const end = body.at(-1)?.loc.end ?? this.lineRange(header).end;

    if (body.length === 0) {
      this.addError(header, sourceColumn, "Choice item body must include at least one statement.");
    }
    if (parsedHeader === undefined) {
      return undefined;
    }

    return {
      type: "ChoiceItem",
      label: parsedHeader.label,
      ...(parsedHeader.id === undefined ? {} : { id: parsedHeader.id }),
      ...(parsedHeader.condition === undefined ? {} : { condition: parsedHeader.condition }),
      body,
      loc: { start: this.location(header.line, sourceColumn), end },
    };
  }

  private parseChoiceItemHeader(
    line: SourceLine,
    source: string,
    sourceColumn: number,
  ): ParsedChoiceItemHeader | undefined {
    if (!source.endsWith(":")) {
      this.addError(line, sourceColumn, "choice item must end with `:`.");
      return undefined;
    }

    const headerSource = source.slice(0, -1).trimEnd();
    if (!headerSource.startsWith('"')) {
      this.addError(line, sourceColumn, "choice item label must be a double-quoted string.");
      return undefined;
    }

    const labelEndIndex = this.findStringLiteralEnd(headerSource);
    if (labelEndIndex === undefined) {
      this.addError(line, sourceColumn, "choice item label must be a double-quoted string.");
      return undefined;
    }

    const labelSource = headerSource.slice(0, labelEndIndex + 1);
    const label = this.parseStringLiteral(line, labelSource, sourceColumn);
    if (label === undefined) {
      return undefined;
    }

    const afterLabel = headerSource.slice(labelEndIndex + 1);
    const restStart = afterLabel.search(/\S/);
    const rest = restStart === -1 ? "" : afterLabel.slice(restStart);
    const restColumn = sourceColumn + labelEndIndex + 1 + Math.max(restStart, 0);
    if (rest.length === 0) {
      return { label };
    }

    if (rest === "if" || rest.startsWith("if ")) {
      return this.parseChoiceItemCondition(line, rest, restColumn, { label });
    }

    const idMatch = /^id=(\S*)(?:\s+(.+))?$/.exec(rest);
    if (idMatch === null) {
      this.addError(line, restColumn, 'choice item must use `"label":` or `"label" id=id:` syntax.');
      return undefined;
    }

    const id = idMatch[1] ?? "";
    const idColumn = restColumn + rest.indexOf(id);
    if (!isValidTzrIdentifier(id)) {
      this.addError(line, idColumn, `Invalid choice item id "${id}".`);
      return undefined;
    }

    const afterId = idMatch[2]?.trim();
    if (afterId === undefined || afterId.length === 0) {
      return { label, id };
    }
    if (afterId === "if" || afterId.startsWith("if ")) {
      const afterIdColumn = restColumn + rest.indexOf(afterId);
      return this.parseChoiceItemCondition(line, afterId, afterIdColumn, { label, id });
    }

    this.addError(
      line,
      restColumn + rest.indexOf(afterId),
      'choice item must use `"label":`, `"label" id=id:`, or `"label" id=id if condition:` syntax.',
    );
    return undefined;
  }

  private parseChoiceItemCondition(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    base: { readonly label: string; readonly id?: string },
  ): ParsedChoiceItemHeader | undefined {
    const conditionSource = source.slice("if".length).trim();
    if (conditionSource.length === 0) {
      this.addError(line, sourceColumn, "choice item condition is required.");
      return undefined;
    }
    if (hasChoiceItemIdToken(conditionSource)) {
      this.addError(line, sourceColumn + source.indexOf(conditionSource), "choice item id must appear before if.");
      return undefined;
    }

    const conditionColumn = sourceColumn + source.indexOf(conditionSource);
    const result = parseTzrConditionExpression(conditionSource, { filePath: this.filePath });
    if (!result.ok) {
      for (const error of result.errors) {
        this.addError(line, conditionColumn + error.column - 1, `Invalid choice item condition: ${error.message}`);
      }
      return undefined;
    }

    return {
      label: base.label,
      ...(base.id === undefined ? {} : { id: base.id }),
      condition: result.expression,
    };
  }

  private parseIfStatement(
    header: SourceLine,
    source: string,
    statementColumn: number,
    indentLevel: number,
  ): TzrIfStatement | undefined {
    const parsedHeader = this.parseConditionBranchHeader(header, source, "if", statementColumn);
    const headerRange = this.lineRange(header);
    this.cursor += 1;

    const bodyIndentLevel = indentLevel + 1;
    const thenBranch = this.collectSceneStatements(
      bodyIndentLevel,
      `If branch body statements must be indented ${bodyIndentLevel * 2} spaces.`,
    );
    if (thenBranch.length === 0) {
      this.addError(header, statementColumn, "If branch body must include at least one statement.");
    }

    const elifBranches: TzrElifBranch[] = [];
    let elseBranch: readonly TzrSceneStatement[] | undefined;
    let sawElse = false;
    let end = thenBranch.at(-1)?.loc.end ?? headerRange.end;

    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        this.cursor += 1;
        continue;
      }

      const indent = this.validateIndent(line);
      const continuationSource = line.code.slice(indent).trimEnd();
      if (!isIfChainContinuationSource(continuationSource)) {
        break;
      }

      const expectedIndent = indentLevel * 2;
      if (indent !== expectedIndent) {
        const parentIndent = Math.max(0, (indentLevel - 1) * 2);
        if (indent <= parentIndent) {
          break;
        }
        this.addError(
          line,
          firstContentColumn(line),
          "if / elif / else branch headers must align with the owning if statement.",
        );
        this.skipIndentedBlock(indent);
        continue;
      }

      const continuationColumn = expectedIndent + 1;
      if (continuationSource === "elif" || continuationSource === "elif:" || continuationSource.startsWith("elif ")) {
        if (sawElse) {
          this.addError(line, continuationColumn, "elif cannot appear after else.");
          this.skipIndentedBlock(indent);
          continue;
        }

        const branch = this.parseElifBranch(line, continuationSource, continuationColumn, indentLevel);
        if (branch !== undefined) {
          elifBranches.push(branch);
          end = branch.loc.end;
        }
        continue;
      }

      if (sawElse) {
        this.addError(line, continuationColumn, "Duplicate else branch.");
        this.skipIndentedBlock(indent);
        continue;
      }

      const parsedElse = this.parseElseBranch(line, continuationSource, continuationColumn, indentLevel);
      sawElse = true;
      if (parsedElse !== undefined) {
        elseBranch = parsedElse.body;
        end = parsedElse.end;
      }
    }

    if (parsedHeader === undefined) {
      return undefined;
    }

    return {
      type: "IfStatement",
      condition: parsedHeader.condition,
      thenBranch,
      elifBranches,
      ...(elseBranch === undefined ? {} : { elseBranch }),
      loc: { start: this.location(header.line, statementColumn), end },
    };
  }

  private parseElifBranch(
    header: SourceLine,
    source: string,
    statementColumn: number,
    indentLevel: number,
  ): TzrElifBranch | undefined {
    const parsedHeader = this.parseConditionBranchHeader(header, source, "elif", statementColumn);
    const headerRange = this.lineRange(header);
    this.cursor += 1;

    const bodyIndentLevel = indentLevel + 1;
    const body = this.collectSceneStatements(
      bodyIndentLevel,
      `Elif branch body statements must be indented ${bodyIndentLevel * 2} spaces.`,
    );
    if (body.length === 0) {
      this.addError(header, statementColumn, "Elif branch body must include at least one statement.");
    }

    if (parsedHeader === undefined) {
      return undefined;
    }

    return {
      type: "ElifBranch",
      condition: parsedHeader.condition,
      body,
      loc: { start: this.location(header.line, statementColumn), end: body.at(-1)?.loc.end ?? headerRange.end },
    };
  }

  private parseElseBranch(
    header: SourceLine,
    source: string,
    statementColumn: number,
    indentLevel: number,
  ): { readonly body: readonly TzrSceneStatement[]; readonly end: SourceLocation } | undefined {
    const validHeader = this.validateElseHeader(header, source, statementColumn);
    const headerRange = this.lineRange(header);
    this.cursor += 1;

    const bodyIndentLevel = indentLevel + 1;
    const body = this.collectSceneStatements(
      bodyIndentLevel,
      `Else branch body statements must be indented ${bodyIndentLevel * 2} spaces.`,
    );
    if (body.length === 0) {
      this.addError(header, statementColumn, "Else branch body must include at least one statement.");
    }

    if (!validHeader) {
      return undefined;
    }

    return {
      body,
      end: body.at(-1)?.loc.end ?? headerRange.end,
    };
  }

  private parseConditionBranchHeader(
    line: SourceLine,
    source: string,
    keyword: "if" | "elif",
    statementColumn: number,
  ): ParsedConditionBranchHeader | undefined {
    if (source === keyword || source === `${keyword}:`) {
      this.addError(line, statementColumn, `${keyword} condition is required.`);
      return undefined;
    }
    if (!source.endsWith(":")) {
      this.addError(line, statementColumn, `${keyword} header must end with \`:\`.`);
      return undefined;
    }

    const conditionSource = source.slice(keyword.length, -1).trim();
    if (conditionSource.length === 0) {
      this.addError(line, statementColumn, `${keyword} condition is required.`);
      return undefined;
    }

    const conditionColumn = statementColumn + source.indexOf(conditionSource);
    const result = parseTzrConditionExpression(conditionSource, { filePath: this.filePath });
    if (!result.ok) {
      for (const error of result.errors) {
        this.addError(line, conditionColumn + error.column - 1, `Invalid ${keyword} condition: ${error.message}`);
      }
      return undefined;
    }

    return { condition: result.expression };
  }

  private validateElseHeader(line: SourceLine, source: string, statementColumn: number): boolean {
    if (source === "else:") {
      return true;
    }
    if (source === "else") {
      this.addError(line, statementColumn, "else block must end with `:`.");
      return false;
    }

    this.addError(line, statementColumn, "else must not have a condition or arguments.");
    return false;
  }

  private skipIndentedBlock(headerIndent: number): void {
    this.cursor += 1;
    while (!this.isAtEnd()) {
      const line = this.currentRequired();
      if (this.isIgnorable(line)) {
        this.cursor += 1;
        continue;
      }
      const indent = this.validateIndent(line);
      if (indent <= headerIndent) {
        break;
      }
      this.cursor += 1;
    }
  }

  private parseSetStatement(line: SourceLine, source: string, statementColumn: number): TzrSetStatement | undefined {
    const parsed = this.parseStateStatementParts(line, source, "set", statementColumn);
    this.cursor += 1;
    if (parsed === undefined) {
      return undefined;
    }

    const value = this.parseSetValue(line, parsed.valueSource, parsed.valueColumn);
    if (value === undefined) {
      return undefined;
    }

    return {
      type: "SetStatement",
      target: parsed.target,
      value,
      loc: this.lineRange(line),
    };
  }

  private parseAddStatement(line: SourceLine, source: string, statementColumn: number): TzrAddStatement | undefined {
    const parsed = this.parseStateStatementParts(line, source, "add", statementColumn);
    this.cursor += 1;
    if (parsed === undefined) {
      return undefined;
    }

    const value = this.parseAddValue(line, parsed.valueSource, parsed.valueColumn);
    if (value === undefined) {
      return undefined;
    }

    return {
      type: "AddStatement",
      target: parsed.target,
      value,
      loc: this.lineRange(line),
    };
  }

  private parseStateStatementParts(
    line: SourceLine,
    source: string,
    keyword: StateStatementKeyword,
    statementColumn: number,
  ):
    | {
        readonly target: TzrStatePath;
        readonly valueSource: string;
        readonly valueColumn: number;
      }
    | undefined {
    const rest = source.slice(keyword.length).trim();
    if (rest.length === 0) {
      this.addError(line, statementColumn, `${keyword} target is required.`);
      return undefined;
    }

    const restColumn = statementColumn + source.indexOf(rest);
    const plusEqualsIndex = rest.indexOf("+=");
    const equalsIndex = rest.indexOf("=");
    if (keyword === "set" && plusEqualsIndex !== -1) {
      this.addError(line, restColumn + plusEqualsIndex, "set statement must use `=`, not `+=`.");
      return undefined;
    }
    if (keyword === "add" && plusEqualsIndex === -1 && equalsIndex !== -1) {
      this.addError(line, restColumn + equalsIndex, "add statement must use `+=`, not `=`.");
      return undefined;
    }

    const operatorIndex = keyword === "set" ? equalsIndex : plusEqualsIndex;
    const operator = keyword === "set" ? "=" : "+=";
    if (operatorIndex === -1) {
      this.addError(line, statementColumn, `${keyword} statement must include \`${operator}\`.`);
      return undefined;
    }

    const targetSource = rest.slice(0, operatorIndex).trim();
    if (targetSource.length === 0) {
      this.addError(line, statementColumn, `${keyword} target is required.`);
      return undefined;
    }
    const targetColumn = restColumn + rest.indexOf(targetSource);
    const target = this.parseStatePath(line, targetSource, targetColumn, keyword);
    if (target === undefined) {
      return undefined;
    }

    const valueStart = operatorIndex + operator.length;
    const valueRest = rest.slice(valueStart);
    const valueOffset = valueRest.search(/\S/);
    if (valueOffset === -1) {
      this.addError(line, restColumn + valueStart, `${keyword} value is required.`);
      return undefined;
    }

    return {
      target,
      valueSource: valueRest.slice(valueOffset).trimEnd(),
      valueColumn: restColumn + valueStart + valueOffset,
    };
  }

  private parseStatePath(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: StateStatementKeyword,
  ): TzrStatePath | undefined {
    const parts = source.split(".");
    if (!isValidTzrDottedIdentifier(source) || parts.length < 2) {
      this.addError(line, sourceColumn, `Invalid ${keyword} target dotted identifier.`);
      return undefined;
    }

    const root = parts[0];
    if (root === "system") {
      this.addError(line, sourceColumn, `${keyword} cannot target system.*.`);
      return undefined;
    }
    if (root !== "scenario") {
      this.addError(line, sourceColumn, `${keyword} target must start with scenario.`);
      return undefined;
    }

    return {
      type: "StatePath",
      path: source,
      root,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseSetValue(line: SourceLine, source: string, sourceColumn: number): TzrValueExpression | undefined {
    const loc = {
      start: this.location(line.line, sourceColumn),
      end: this.location(line.line, sourceColumn + source.length),
    };

    if (source.startsWith("'") || source.startsWith("`") || source.startsWith('"')) {
      return this.parseStringValue(line, source, sourceColumn);
    }
    if (source.startsWith("$")) {
      return this.parseVariableReferenceValue(line, source, sourceColumn);
    }
    if (NUMBER_LITERAL_PATTERN.test(source)) {
      return { type: "NumberValue", value: Number(source), loc } satisfies TzrNumberValue;
    }
    if (source === "true" || source === "false") {
      return { type: "BooleanValue", value: source === "true", loc } satisfies TzrBooleanValue;
    }
    if (source === "null") {
      return { type: "NullValue", value: null, loc } satisfies TzrNullValue;
    }

    if (/\s/.test(source)) {
      this.addError(line, sourceColumn + source.search(/\s/), "set statement must not have extra trailing tokens.");
      return undefined;
    }

    this.addError(line, sourceColumn, "Invalid set value.");
    return undefined;
  }

  private parseStringValue(line: SourceLine, source: string, sourceColumn: number): TzrStringValue | undefined {
    const literalEnd = source.startsWith('"') ? this.findStringLiteralEnd(source) : undefined;
    if (literalEnd !== undefined) {
      const trailing = source.slice(literalEnd + 1);
      if (trailing.trim().length > 0) {
        this.addError(
          line,
          sourceColumn + literalEnd + 1 + trailing.search(/\S/),
          "set statement must not have extra trailing tokens.",
        );
        return undefined;
      }
    }

    const value = this.parseStringLiteral(line, source, sourceColumn);
    if (value === undefined) {
      return undefined;
    }

    return {
      type: "StringValue",
      value,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseVariableReferenceValue(
    line: SourceLine,
    source: string,
    sourceColumn: number,
  ): TzrVariableReferenceValue | undefined {
    if (/\s/.test(source)) {
      this.addError(line, sourceColumn + source.search(/\s/), "set statement must not have extra trailing tokens.");
      return undefined;
    }

    const path = source.slice(1);
    const parts = path.split(".");
    if (!isValidTzrDottedIdentifier(path) || parts.length < 2) {
      this.addError(line, sourceColumn, "Invalid set variable reference.");
      return undefined;
    }

    const root = parts[0];
    if (root !== "scenario" && root !== "system") {
      this.addError(line, sourceColumn, `Invalid set variable reference root "${root}".`);
      return undefined;
    }

    return {
      type: "VariableReferenceValue",
      path,
      root,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseAddValue(line: SourceLine, source: string, sourceColumn: number): TzrNumberValue | undefined {
    if (/\s/.test(source)) {
      this.addError(line, sourceColumn + source.search(/\s/), "add statement must not have extra trailing tokens.");
      return undefined;
    }
    if (!NUMBER_LITERAL_PATTERN.test(source)) {
      this.addError(line, sourceColumn, "add value must be a number literal.");
      return undefined;
    }

    return {
      type: "NumberValue",
      value: Number(source),
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseCallStatement(line: SourceLine, source: string, statementColumn: number): TzrCallStatement | undefined {
    const parsed = this.parseCallWaitStatementParts(line, source, "call", statementColumn);
    this.cursor += 1;
    if (parsed === undefined) {
      return undefined;
    }

    return {
      type: "CallStatement",
      name: parsed.name,
      args: parsed.args,
      loc: this.lineRange(line),
    };
  }

  private parseWaitStatement(line: SourceLine, source: string, statementColumn: number): TzrWaitStatement | undefined {
    const parsed = this.parseCallWaitStatementParts(line, source, "wait", statementColumn);
    this.cursor += 1;
    if (parsed === undefined) {
      return undefined;
    }

    return {
      type: "WaitStatement",
      name: parsed.name,
      args: parsed.args,
      loc: this.lineRange(line),
    };
  }

  private parseCallWaitStatementParts(
    line: SourceLine,
    source: string,
    keyword: CallWaitStatementKeyword,
    statementColumn: number,
  ): { readonly name: string; readonly args: readonly TzrNamedArgument[] } | undefined {
    const rest = source.slice(keyword.length).trim();
    if (rest.length === 0) {
      this.addError(line, statementColumn, `${keyword} name is required.`);
      return undefined;
    }

    const restColumn = statementColumn + source.indexOf(rest);
    const openParenIndex = rest.indexOf("(");
    if (openParenIndex === -1) {
      this.addError(line, restColumn, `${keyword} statement must include parentheses.`);
      return undefined;
    }

    const nameSource = rest.slice(0, openParenIndex).trim();
    if (nameSource.length === 0) {
      this.addError(line, restColumn, `${keyword} name is required.`);
      return undefined;
    }

    const nameColumn = restColumn + rest.indexOf(nameSource);
    const nameParts = nameSource.split(".");
    if (!isValidTzrDottedIdentifier(nameSource)) {
      this.addError(line, nameColumn, `Invalid ${keyword} name dotted identifier.`);
      return undefined;
    }
    if (nameParts.length < 2) {
      this.addError(line, nameColumn, `${keyword} name must be namespaced.`);
      return undefined;
    }

    const closeParenIndex = this.findCallWaitClosingParenthesis(rest, openParenIndex);
    if (closeParenIndex === undefined) {
      this.addError(line, restColumn + openParenIndex, `${keyword} statement is missing closing parenthesis.`);
      return undefined;
    }

    const trailing = rest.slice(closeParenIndex + 1);
    if (trailing.trim().length > 0) {
      this.addError(
        line,
        restColumn + closeParenIndex + 1 + trailing.search(/\S/),
        `${keyword} statement must not have extra trailing tokens.`,
      );
      return undefined;
    }

    const argsSource = rest.slice(openParenIndex + 1, closeParenIndex);
    const args = this.parseNamedArguments(line, argsSource, restColumn + openParenIndex + 1, keyword);
    if (args === undefined) {
      return undefined;
    }

    return {
      name: nameSource,
      args,
    };
  }

  private findCallWaitClosingParenthesis(source: string, openParenIndex: number): number | undefined {
    let inString = false;
    let escaped = false;
    for (let index = openParenIndex + 1; index < source.length; index += 1) {
      const char = source[index] ?? "";
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = inString;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString && char === ")") {
        return index;
      }
    }
    return undefined;
  }

  private parseNamedArguments(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: CallWaitStatementKeyword,
  ): readonly TzrNamedArgument[] | undefined {
    if (source.trim().length === 0) {
      return [];
    }

    const parts = this.splitArgumentList(line, source, sourceColumn, keyword);
    if (parts === undefined) {
      return undefined;
    }

    const args: TzrNamedArgument[] = [];
    const seen = new Set<string>();
    for (const part of parts) {
      const argument = this.parseNamedArgument(line, part.source, part.column, keyword);
      if (argument === undefined) {
        return undefined;
      }
      if (seen.has(argument.name)) {
        this.addError(line, part.column, `Duplicate ${keyword} argument "${argument.name}".`);
        return undefined;
      }
      seen.add(argument.name);
      args.push(argument);
    }

    return args;
  }

  private splitArgumentList(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: CallWaitStatementKeyword,
  ): readonly { readonly source: string; readonly column: number }[] | undefined {
    const parts: { readonly source: string; readonly column: number }[] = [];
    let inString = false;
    let escaped = false;
    let partStart = 0;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index] ?? "";
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = inString;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString || char !== ",") {
        continue;
      }

      const part = source.slice(partStart, index);
      const trimmed = part.trim();
      if (trimmed.length === 0) {
        this.addError(line, sourceColumn + partStart, `Malformed ${keyword} argument list.`);
        return undefined;
      }
      parts.push({
        source: trimmed,
        column: sourceColumn + partStart + part.indexOf(trimmed),
      });
      partStart = index + 1;
    }

    const lastPart = source.slice(partStart);
    const trimmed = lastPart.trim();
    if (trimmed.length === 0) {
      this.addError(line, sourceColumn + partStart, `Malformed ${keyword} argument list.`);
      return undefined;
    }
    parts.push({
      source: trimmed,
      column: sourceColumn + partStart + lastPart.indexOf(trimmed),
    });
    return parts;
  }

  private parseNamedArgument(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: CallWaitStatementKeyword,
  ): TzrNamedArgument | undefined {
    const equalsIndex = source.indexOf("=");
    if (equalsIndex === -1) {
      this.addError(line, sourceColumn, "Positional arguments are not supported.");
      return undefined;
    }

    const name = source.slice(0, equalsIndex).trim();
    if (name.length === 0) {
      this.addError(line, sourceColumn, "Invalid argument name.");
      return undefined;
    }
    const nameColumn = sourceColumn + source.indexOf(name);
    if (!isValidTzrIdentifier(name)) {
      this.addError(line, nameColumn, "Invalid argument name.");
      return undefined;
    }

    const valueRest = source.slice(equalsIndex + 1);
    const valueOffset = valueRest.search(/\S/);
    if (valueOffset === -1) {
      this.addError(line, sourceColumn + equalsIndex + 1, `${keyword} argument value is required.`);
      return undefined;
    }

    const valueSource = valueRest.slice(valueOffset).trimEnd();
    const valueColumn = sourceColumn + equalsIndex + 1 + valueOffset;
    const value = this.parseArgumentValue(line, valueSource, valueColumn, keyword);
    if (value === undefined) {
      return undefined;
    }

    return {
      type: "NamedArgument",
      name,
      value,
      loc: {
        start: this.location(line.line, nameColumn),
        end: this.location(line.line, value.loc.end.column),
      },
    };
  }

  private parseArgumentValue(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: CallWaitStatementKeyword,
  ): TzrArgumentValue | undefined {
    const loc = {
      start: this.location(line.line, sourceColumn),
      end: this.location(line.line, sourceColumn + source.length),
    };

    if (source.startsWith("'") || source.startsWith("`") || source.startsWith('"')) {
      return this.parseArgumentStringValue(line, source, sourceColumn, keyword);
    }
    if (source.startsWith("$")) {
      return this.parseArgumentVariableReferenceValue(line, source, sourceColumn, keyword);
    }
    if (NUMBER_LITERAL_PATTERN.test(source)) {
      return { type: "NumberValue", value: Number(source), loc } satisfies TzrNumberValue;
    }
    if (source === "true" || source === "false") {
      return { type: "BooleanValue", value: source === "true", loc } satisfies TzrBooleanValue;
    }
    if (source === "null") {
      return { type: "NullValue", value: null, loc } satisfies TzrNullValue;
    }
    if (isValidTzrDottedIdentifier(source)) {
      return { type: "IdentifierValue", value: source, loc } satisfies TzrIdentifierValue;
    }
    if (/\s/.test(source)) {
      this.addError(line, sourceColumn + source.search(/\s/), `Invalid ${keyword} argument value.`);
      return undefined;
    }

    this.addError(line, sourceColumn, `Invalid ${keyword} argument value.`);
    return undefined;
  }

  private parseArgumentStringValue(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: CallWaitStatementKeyword,
  ): TzrStringValue | undefined {
    const literalEnd = source.startsWith('"') ? this.findStringLiteralEnd(source) : undefined;
    if (literalEnd !== undefined) {
      const trailing = source.slice(literalEnd + 1);
      if (trailing.trim().length > 0) {
        this.addError(
          line,
          sourceColumn + literalEnd + 1 + trailing.search(/\S/),
          `Invalid ${keyword} argument value.`,
        );
        return undefined;
      }
    }

    const value = this.parseStringLiteral(line, source, sourceColumn);
    if (value === undefined) {
      return undefined;
    }

    return {
      type: "StringValue",
      value,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseArgumentVariableReferenceValue(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: CallWaitStatementKeyword,
  ): TzrVariableReferenceValue | undefined {
    if (/\s/.test(source)) {
      this.addError(line, sourceColumn + source.search(/\s/), `Invalid ${keyword} argument variable reference.`);
      return undefined;
    }

    const path = source.slice(1);
    const parts = path.split(".");
    if (!isValidTzrDottedIdentifier(path) || parts.length < 2) {
      this.addError(line, sourceColumn, `Invalid ${keyword} argument variable reference.`);
      return undefined;
    }

    const root = parts[0];
    if (root !== "scenario" && root !== "system") {
      this.addError(line, sourceColumn, `Invalid ${keyword} argument variable reference root "${root}".`);
      return undefined;
    }

    return {
      type: "VariableReferenceValue",
      path,
      root,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseBgStatement(line: SourceLine, source: string, statementColumn: number): TzrBgStatement | undefined {
    const parsed = this.parseSingleVisualAssetStatement(line, source, "bg", statementColumn);
    this.cursor += 1;
    if (parsed === undefined) {
      return undefined;
    }

    return {
      type: "BgStatement",
      assetRef: parsed.assetRef,
      ...(parsed.transition === undefined ? {} : { transition: parsed.transition }),
      loc: this.lineRange(line),
    };
  }

  private parseHideStatement(line: SourceLine, source: string, statementColumn: number): TzrHideStatement | undefined {
    const parsed = this.parseSingleVisualAssetStatement(line, source, "hide", statementColumn);
    this.cursor += 1;
    if (parsed === undefined) {
      return undefined;
    }

    return {
      type: "HideStatement",
      assetRef: parsed.assetRef,
      ...(parsed.transition === undefined ? {} : { transition: parsed.transition }),
      loc: this.lineRange(line),
    };
  }

  private parseSingleVisualAssetStatement(
    line: SourceLine,
    source: string,
    keyword: "bg" | "hide",
    statementColumn: number,
  ): { readonly assetRef: TzrVisualAssetRef; readonly transition?: TzrVisualTransition } | undefined {
    const parsed = this.parseVisualStatementBody(line, source, keyword, statementColumn);
    if (parsed === undefined) {
      return undefined;
    }
    if (parsed.bodySource.length === 0) {
      this.addError(line, statementColumn, `${keyword} assetRef is required.`);
      return undefined;
    }

    const assetRef = this.parseVisualAssetRef(line, parsed.bodySource, parsed.bodyColumn, keyword);
    if (assetRef === undefined) {
      return undefined;
    }

    return {
      assetRef,
      ...(parsed.transition === undefined ? {} : { transition: parsed.transition }),
    };
  }

  private parseShowStatement(line: SourceLine, source: string, statementColumn: number): TzrShowStatement | undefined {
    const parsed = this.parseShowStatementParts(line, source, statementColumn);
    this.cursor += 1;
    if (parsed === undefined) {
      return undefined;
    }

    return {
      type: "ShowStatement",
      assetRef: parsed.assetRef,
      placement: parsed.placement,
      ...(parsed.transition === undefined ? {} : { transition: parsed.transition }),
      loc: this.lineRange(line),
    };
  }

  private parseShowStatementParts(
    line: SourceLine,
    source: string,
    statementColumn: number,
  ):
    | {
        readonly assetRef: TzrVisualAssetRef;
        readonly placement: TzrVisualPlacement;
        readonly transition?: TzrVisualTransition;
      }
    | undefined {
    const parsed = this.parseVisualStatementBody(line, source, "show", statementColumn);
    if (parsed === undefined) {
      return undefined;
    }

    const rest = parsed.bodySource;
    if (rest.length === 0) {
      this.addError(line, statementColumn, "show assetRef is required.");
      return undefined;
    }

    const restColumn = parsed.bodyColumn;
    const atIndex = findVisualStandaloneToken(rest, "at");
    if (atIndex === undefined) {
      this.addError(line, restColumn, "show statement must include `at`.");
      return undefined;
    }

    const assetSource = rest.slice(0, atIndex).trim();
    if (assetSource.length === 0) {
      this.addError(line, statementColumn, "show assetRef is required.");
      return undefined;
    }
    const assetRef = this.parseVisualAssetRef(line, assetSource, restColumn + rest.indexOf(assetSource), "show");
    if (assetRef === undefined) {
      return undefined;
    }

    const afterAt = rest.slice(atIndex + "at".length);
    const placementOffset = afterAt.search(/\S/);
    if (placementOffset === -1) {
      this.addError(line, restColumn + atIndex, "Invalid show placement.");
      return undefined;
    }

    const placementSource = afterAt.slice(placementOffset).trimEnd();
    const placement = this.parseVisualPlacement(
      line,
      placementSource,
      restColumn + atIndex + "at".length + placementOffset,
    );
    if (placement === undefined) {
      return undefined;
    }

    return {
      assetRef,
      placement,
      ...(parsed.transition === undefined ? {} : { transition: parsed.transition }),
    };
  }

  private parseVisualAssetRef(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: VisualAssetStatementKeyword,
  ): TzrVisualAssetRef | undefined {
    if (source.startsWith("$")) {
      this.addError(line, sourceColumn, `${keyword} visual assetRef must be static.`);
      return undefined;
    }

    if (source.startsWith("'") || source.startsWith("`")) {
      this.parseStringLiteral(line, source, sourceColumn);
      return undefined;
    }

    if (source.startsWith('"')) {
      const literalEnd = this.findStringLiteralEnd(source);
      if (literalEnd !== undefined) {
        const trailing = source.slice(literalEnd + 1);
        if (trailing.trim().length > 0) {
          this.addError(
            line,
            sourceColumn + literalEnd + 1 + trailing.search(/\S/),
            `${keyword} statement must not have extra trailing tokens.`,
          );
          return undefined;
        }
      }

      const value = this.parseStringLiteral(line, source, sourceColumn);
      if (value === undefined) {
        return undefined;
      }
      if (value.length === 0) {
        this.addError(line, sourceColumn, `${keyword} visual assetRef must not be empty.`);
        return undefined;
      }

      return {
        type: "VisualStringAssetRef",
        value,
        loc: {
          start: this.location(line.line, sourceColumn),
          end: this.location(line.line, sourceColumn + source.length),
        },
      };
    }

    const firstWhitespace = source.search(/\s/);
    if (firstWhitespace !== -1) {
      this.addError(line, sourceColumn + firstWhitespace, `${keyword} statement must not have extra trailing tokens.`);
      return undefined;
    }

    if (!isValidTzrDottedIdentifier(source)) {
      this.addError(line, sourceColumn, `Invalid ${keyword} visual assetRef.`);
      return undefined;
    }

    return {
      type: "VisualIdentifierAssetRef",
      value: source,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseVisualPlacement(line: SourceLine, source: string, sourceColumn: number): TzrVisualPlacement | undefined {
    if (source === "left" || source === "center" || source === "right") {
      return {
        type: "VisualNamedPlacement",
        value: source,
        loc: {
          start: this.location(line.line, sourceColumn),
          end: this.location(line.line, sourceColumn + source.length),
        },
      } satisfies TzrVisualNamedPlacement;
    }

    const coordinateMatch = /^x=(\S+)\s+y=(\S+)$/.exec(source);
    if (coordinateMatch !== null) {
      const xSource = coordinateMatch[1] ?? "";
      const ySource = coordinateMatch[2] ?? "";
      if (!NUMBER_LITERAL_PATTERN.test(xSource) || !NUMBER_LITERAL_PATTERN.test(ySource)) {
        this.addError(line, sourceColumn, "Malformed show coordinate placement.");
        return undefined;
      }

      return {
        type: "VisualCoordinatePlacement",
        x: Number(xSource),
        y: Number(ySource),
        loc: {
          start: this.location(line.line, sourceColumn),
          end: this.location(line.line, sourceColumn + source.length),
        },
      } satisfies TzrVisualCoordinatePlacement;
    }

    const hasX = /(?:^|\s)x=/.test(source);
    const hasY = /(?:^|\s)y=/.test(source);
    if (hasX !== hasY) {
      this.addError(line, sourceColumn, "show coordinate placement requires both x and y.");
      return undefined;
    }
    if (hasX && hasY) {
      this.addError(line, sourceColumn, "Malformed show coordinate placement.");
      return undefined;
    }

    this.addError(line, sourceColumn, "Invalid show placement.");
    return undefined;
  }

  private parseClearVisualStatement(
    line: SourceLine,
    source: string,
    statementColumn: number,
  ): TzrClearVisualStatement | undefined {
    const parsed = this.parseVisualStatementBody(line, source, "clear", statementColumn);
    if (parsed === undefined) {
      this.cursor += 1;
      return undefined;
    }

    const rest = parsed.bodySource;
    if (rest.length === 0) {
      this.addError(line, statementColumn, "clear target is required.");
      this.cursor += 1;
      return undefined;
    }

    const restColumn = parsed.bodyColumn;
    const parts = rest.split(/\s+/);
    const target = parts[0] ?? "";
    if (target !== "sprites" && target !== "bg") {
      this.addError(line, restColumn, "Invalid clear target.");
      this.cursor += 1;
      return undefined;
    }
    if (parts.length > 1) {
      this.addError(line, restColumn + target.length + 1, "clear statement must not have extra trailing tokens.");
      this.cursor += 1;
      return undefined;
    }

    this.cursor += 1;
    return {
      type: "ClearVisualStatement",
      target,
      ...(parsed.transition === undefined ? {} : { transition: parsed.transition }),
      loc: this.lineRange(line),
    };
  }

  private parseVisualStatementBody(
    line: SourceLine,
    source: string,
    keyword: "bg" | "show" | "hide" | "clear",
    statementColumn: number,
  ): ParsedVisualStatementBody | undefined {
    const rest = source.slice(keyword.length);
    const bodyOffset = rest.search(/\S/);
    if (bodyOffset === -1) {
      return {
        bodySource: "",
        bodyColumn: statementColumn + keyword.length,
      };
    }

    const trimmedRest = rest.slice(bodyOffset).trimEnd();
    const restColumn = statementColumn + keyword.length + bodyOffset;
    const withIndex = findVisualWithKeyword(trimmedRest);
    if (withIndex === undefined) {
      return {
        bodySource: trimmedRest,
        bodyColumn: restColumn,
      };
    }

    const bodySource = trimmedRest.slice(0, withIndex).trimEnd();
    const afterWith = trimmedRest.slice(withIndex + "with".length);
    const transitionOffset = afterWith.search(/\S/);
    if (transitionOffset === -1) {
      this.addError(line, restColumn + withIndex, "Visual transition is required after `with`.");
      return undefined;
    }

    const transitionSource = afterWith.slice(transitionOffset).trimEnd();
    const transitionColumn = restColumn + withIndex + "with".length + transitionOffset;
    const transition = this.parseVisualTransition(line, transitionSource, transitionColumn);
    if (transition === undefined) {
      return undefined;
    }

    return {
      bodySource,
      bodyColumn: restColumn,
      transition,
    };
  }

  private parseVisualTransition(
    line: SourceLine,
    source: string,
    sourceColumn: number,
  ): TzrVisualTransition | undefined {
    if (source.startsWith("(")) {
      this.addError(line, sourceColumn, "Visual transition name is required.");
      return undefined;
    }

    const openParenIndex = source.indexOf("(");
    if (openParenIndex === -1) {
      this.addError(line, sourceColumn, "Visual transition must include parentheses.");
      return undefined;
    }

    const name = source.slice(0, openParenIndex).trim();
    if (name.length === 0) {
      this.addError(line, sourceColumn, "Visual transition name is required.");
      return undefined;
    }
    if (!isValidTzrIdentifier(name)) {
      this.addError(line, sourceColumn, "Malformed visual transition syntax.");
      return undefined;
    }
    if (name !== "fade" && name !== "dissolve") {
      this.addError(line, sourceColumn, `Unknown visual transition "${name}".`);
      return undefined;
    }

    const closeParenIndex = this.findCallWaitClosingParenthesis(source, openParenIndex);
    if (closeParenIndex === undefined) {
      this.addError(line, sourceColumn + openParenIndex, "Visual transition is missing closing parenthesis.");
      return undefined;
    }

    const trailing = source.slice(closeParenIndex + 1);
    if (trailing.trim().length > 0) {
      this.addError(
        line,
        sourceColumn + closeParenIndex + 1 + trailing.search(/\S/),
        "Visual transition must not have extra trailing tokens.",
      );
      return undefined;
    }

    const argsSource = source.slice(openParenIndex + 1, closeParenIndex);
    const duration = this.parseVisualTransitionDuration(line, argsSource, sourceColumn + openParenIndex + 1);
    if (duration === undefined) {
      return undefined;
    }

    return {
      type: "VisualTransition",
      name: name satisfies TzrVisualTransitionName,
      duration,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + closeParenIndex + 1),
      },
    };
  }

  private parseVisualTransitionDuration(line: SourceLine, source: string, sourceColumn: number): number | undefined {
    if (source.trim().length === 0) {
      this.addError(line, sourceColumn, "Visual transition duration is required.");
      return undefined;
    }

    const parts = this.splitVisualTransitionArguments(line, source, sourceColumn);
    if (parts === undefined) {
      return undefined;
    }

    let duration: number | undefined;
    for (const part of parts) {
      const equalsIndex = part.source.indexOf("=");
      if (equalsIndex === -1) {
        this.addError(line, part.column, "Visual transition positional arguments are not supported.");
        return undefined;
      }

      const name = part.source.slice(0, equalsIndex).trim();
      const nameColumn = part.column + part.source.indexOf(name);
      if (name !== "duration") {
        this.addError(line, nameColumn, `Unknown visual transition argument "${name}".`);
        return undefined;
      }
      if (duration !== undefined) {
        this.addError(line, nameColumn, 'Duplicate visual transition argument "duration".');
        return undefined;
      }

      const valueRest = part.source.slice(equalsIndex + 1);
      const valueOffset = valueRest.search(/\S/);
      if (valueOffset === -1) {
        this.addError(line, part.column + equalsIndex + 1, "Invalid visual transition duration.");
        return undefined;
      }

      const value = valueRest.slice(valueOffset).trimEnd();
      const valueColumn = part.column + equalsIndex + 1 + valueOffset;
      if (!/^\d+$/.test(value)) {
        this.addError(line, valueColumn, "Invalid visual transition duration.");
        return undefined;
      }

      duration = Number(value);
    }

    if (duration === undefined) {
      this.addError(line, sourceColumn, "Visual transition duration is required.");
      return undefined;
    }

    return duration;
  }

  private splitVisualTransitionArguments(
    line: SourceLine,
    source: string,
    sourceColumn: number,
  ): readonly { readonly source: string; readonly column: number }[] | undefined {
    const parts: { readonly source: string; readonly column: number }[] = [];
    let partStart = 0;
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] !== ",") {
        continue;
      }

      const part = source.slice(partStart, index);
      const trimmed = part.trim();
      if (trimmed.length === 0) {
        this.addError(line, sourceColumn + partStart, "Malformed visual transition syntax.");
        return undefined;
      }
      parts.push({
        source: trimmed,
        column: sourceColumn + partStart + part.indexOf(trimmed),
      });
      partStart = index + 1;
    }

    const lastPart = source.slice(partStart);
    const trimmed = lastPart.trim();
    if (trimmed.length === 0) {
      this.addError(line, sourceColumn + partStart, "Malformed visual transition syntax.");
      return undefined;
    }
    parts.push({
      source: trimmed,
      column: sourceColumn + partStart + lastPart.indexOf(trimmed),
    });
    return parts;
  }

  private parseBgmStatement(line: SourceLine, source: string, statementColumn: number): TzrBgmStatement | undefined {
    const assetRef = this.parseSingleAudioAssetStatement(line, source, "bgm", statementColumn);
    this.cursor += 1;
    if (assetRef === undefined) {
      return undefined;
    }

    return {
      type: "BgmStatement",
      assetRef,
      loc: this.lineRange(line),
    };
  }

  private parseSeStatement(line: SourceLine, source: string, statementColumn: number): TzrSeStatement | undefined {
    const assetRef = this.parseSingleAudioAssetStatement(line, source, "se", statementColumn);
    this.cursor += 1;
    if (assetRef === undefined) {
      return undefined;
    }

    return {
      type: "SeStatement",
      assetRef,
      loc: this.lineRange(line),
    };
  }

  private parseVoiceStatement(
    line: SourceLine,
    source: string,
    statementColumn: number,
  ): TzrVoiceStatement | undefined {
    const assetRef = this.parseSingleAudioAssetStatement(line, source, "voice", statementColumn);
    this.cursor += 1;
    if (assetRef === undefined) {
      return undefined;
    }

    return {
      type: "VoiceStatement",
      assetRef,
      loc: this.lineRange(line),
    };
  }

  private parseSingleAudioAssetStatement(
    line: SourceLine,
    source: string,
    keyword: AudioAssetStatementKeyword,
    statementColumn: number,
  ): TzrAudioAssetRef | undefined {
    const rest = source.slice(keyword.length).trim();
    if (rest.length === 0) {
      this.addError(line, statementColumn, `${keyword} assetRef is required.`);
      return undefined;
    }

    return this.parseAudioAssetRef(line, rest, statementColumn + source.indexOf(rest), keyword);
  }

  private parseAudioAssetRef(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    keyword: AudioAssetStatementKeyword,
  ): TzrAudioAssetRef | undefined {
    if (source.startsWith("$")) {
      this.addError(line, sourceColumn, `${keyword} audio assetRef must be static.`);
      return undefined;
    }

    if (source.startsWith("'") || source.startsWith("`")) {
      this.parseStringLiteral(line, source, sourceColumn);
      return undefined;
    }

    if (source.startsWith('"')) {
      const literalEnd = this.findStringLiteralEnd(source);
      if (literalEnd !== undefined) {
        const trailing = source.slice(literalEnd + 1);
        if (trailing.trim().length > 0) {
          this.addError(
            line,
            sourceColumn + literalEnd + 1 + trailing.search(/\S/),
            `${keyword} statement must not have extra trailing tokens.`,
          );
          return undefined;
        }
      }

      const value = this.parseStringLiteral(line, source, sourceColumn);
      if (value === undefined) {
        return undefined;
      }
      if (value.length === 0) {
        this.addError(line, sourceColumn, `${keyword} audio assetRef must not be empty.`);
        return undefined;
      }

      return {
        type: "AudioStringAssetRef",
        value,
        loc: {
          start: this.location(line.line, sourceColumn),
          end: this.location(line.line, sourceColumn + source.length),
        },
      };
    }

    const firstWhitespace = source.search(/\s/);
    if (firstWhitespace !== -1) {
      this.addError(line, sourceColumn + firstWhitespace, `${keyword} statement must not have extra trailing tokens.`);
      return undefined;
    }

    if (!isValidTzrDottedIdentifier(source)) {
      this.addError(line, sourceColumn, `Invalid ${keyword} audio assetRef.`);
      return undefined;
    }

    return {
      type: "AudioIdentifierAssetRef",
      value: source,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private parseStopBgmStatement(
    line: SourceLine,
    source: string,
    statementColumn: number,
  ): TzrStopBgmStatement | undefined {
    if (source !== "stopBgm") {
      this.addError(
        line,
        statementColumn + "stopBgm".length + 1,
        "stopBgm statement must not have extra trailing tokens.",
      );
      this.cursor += 1;
      return undefined;
    }

    this.cursor += 1;
    return {
      type: "StopBgmStatement",
      loc: this.lineRange(line),
    };
  }

  private parseSystemStatement(
    line: SourceLine,
    source: string,
    statementColumn: number,
  ): TzrSystemUnlockStatement | undefined {
    const statementName = source.match(/^\S+/)?.[0] ?? "";
    if (!isSystemUnlockStatementName(statementName)) {
      this.addError(line, statementColumn, "Unknown system statement.");
      this.cursor += 1;
      return undefined;
    }

    const rest = source.slice(statementName.length).trim();
    if (rest.length === 0) {
      this.addError(line, statementColumn, `${statementName} id is required.`);
      this.cursor += 1;
      return undefined;
    }

    const id = this.parseSystemUnlockId(line, rest, statementColumn + source.indexOf(rest), statementName);
    this.cursor += 1;
    if (id === undefined) {
      return undefined;
    }

    return {
      type: "SystemUnlockStatement",
      kind: systemUnlockKind(statementName),
      id,
      loc: this.lineRange(line),
    };
  }

  private parseSystemUnlockId(
    line: SourceLine,
    source: string,
    sourceColumn: number,
    statementName: SystemUnlockStatementName,
  ): TzrSystemUnlockId | undefined {
    if (source.startsWith("$")) {
      this.addError(line, sourceColumn, `${statementName} id must be static.`);
      return undefined;
    }

    if (source.startsWith("'") || source.startsWith("`")) {
      this.parseStringLiteral(line, source, sourceColumn);
      return undefined;
    }

    if (source.startsWith('"')) {
      const literalEnd = this.findStringLiteralEnd(source);
      if (literalEnd !== undefined) {
        const trailing = source.slice(literalEnd + 1);
        if (trailing.trim().length > 0) {
          this.addError(
            line,
            sourceColumn + literalEnd + 1 + trailing.search(/\S/),
            `${statementName} statement must not have extra trailing tokens.`,
          );
          return undefined;
        }
      }

      const value = this.parseStringLiteral(line, source, sourceColumn);
      if (value === undefined) {
        return undefined;
      }
      if (value.length === 0) {
        this.addError(line, sourceColumn, `${statementName} id must not be empty.`);
        return undefined;
      }

      return {
        type: "SystemUnlockStringId",
        value,
        loc: {
          start: this.location(line.line, sourceColumn),
          end: this.location(line.line, sourceColumn + source.length),
        },
      };
    }

    const firstWhitespace = source.search(/\s/);
    if (firstWhitespace !== -1) {
      this.addError(
        line,
        sourceColumn + firstWhitespace,
        `${statementName} statement must not have extra trailing tokens.`,
      );
      return undefined;
    }

    if (!isValidTzrDottedIdentifier(source)) {
      this.addError(line, sourceColumn, `Invalid ${statementName} id.`);
      return undefined;
    }

    return {
      type: "SystemUnlockIdentifierId",
      value: source,
      loc: {
        start: this.location(line.line, sourceColumn),
        end: this.location(line.line, sourceColumn + source.length),
      },
    };
  }

  private findStringLiteralEnd(source: string): number | undefined {
    let escaped = false;
    for (let index = 1; index < source.length; index += 1) {
      const char = source[index] ?? "";
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        return index;
      }
    }
    return undefined;
  }

  private parseJumpStatement(line: SourceLine, source: string, statementColumn: number): TzrJumpStatement | undefined {
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

  private parseEndStatement(line: SourceLine, source: string, statementColumn: number): TzrEndStatement | undefined {
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
    const items: TzrTextBlockItem[] = [];
    let meta: TzrTextBlockMeta | undefined;
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

  private parseTextBlockMeta(header: SourceLine, metaIndentLevel: number): TzrTextBlockMeta {
    const headerRange = this.lineRange(header);
    const attributes: TzrTextBlockMetaAttribute[] = [];
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
  ): TzrTextBlockMetaAttribute | undefined {
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
    if (!isValidTzrIdentifier(valueSource)) {
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
    const nodes: TzrInlineNode[] = [];
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
  ): readonly TzrInlineTextAttribute[] | undefined {
    if (source.trim().length === 0) {
      this.addError(line, sourceColumn, "{text} requires at least one attribute.");
      return undefined;
    }

    const attributes = this.parseInlineRawAttributes(line, source, sourceColumn);
    if (attributes === undefined) {
      return undefined;
    }

    const parsed: TzrInlineTextAttribute[] = [];
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
      parsed.push({
        type: "InlineTextSizeAttribute",
        name: "size",
        value: Number(attribute.value),
        loc: attribute.loc,
      });
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
  ): TzrInlineAssetId | undefined {
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
  ): TzrInlineAssetId | undefined {
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
      if (!isValidTzrDottedIdentifier(path)) {
        this.addError(line, attribute.valueColumn, `Invalid {${name}} variable assetId.`);
        return undefined;
      }
      return { type: "InlineVariableAssetId", path, loc: attribute.loc };
    }

    if (!isValidTzrDottedIdentifier(value)) {
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
    if (isValidTzrIdentifier(value)) {
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

function isIfChainContinuationSource(source: string): boolean {
  return (
    source === "elif" ||
    source === "elif:" ||
    source.startsWith("elif ") ||
    source === "else" ||
    source === "else:" ||
    source.startsWith("else ")
  );
}

function hasChoiceItemIdToken(source: string): boolean {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (source.startsWith("id=", index) && (index === 0 || /\s/.test(source[index - 1] ?? ""))) {
      return true;
    }
  }
  return false;
}

function findVisualWithKeyword(source: string): number | undefined {
  return findVisualStandaloneToken(source, "with");
}

function findVisualStandaloneToken(source: string, token: string): number | undefined {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (!source.startsWith(token, index)) {
      continue;
    }
    const before = source[index - 1];
    const after = source[index + token.length];
    if ((before === undefined || /\s/.test(before)) && (after === undefined || /\s/.test(after))) {
      return index;
    }
  }
  return undefined;
}

function isSystemUnlockStatementName(value: string): value is SystemUnlockStatementName {
  return value === "system.unlockEnding" || value === "system.unlockCg" || value === "system.unlockAchievement";
}

function systemUnlockKind(statementName: SystemUnlockStatementName): TzrSystemUnlockKind {
  switch (statementName) {
    case "system.unlockEnding":
      return "ending";
    case "system.unlockCg":
      return "cg";
    case "system.unlockAchievement":
      return "achievement";
  }
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
