import type { SourceLocation, SourceRange } from "./ast.js";
import { createDiagnostic, type ParseDiagnostic } from "./diagnostic.js";
import type {
  TzrV2ConditionBinaryExpression,
  TzrV2ConditionBooleanLiteral,
  TzrV2ConditionComparisonExpression,
  TzrV2ConditionExpression,
  TzrV2ConditionLiteral,
  TzrV2ConditionNullLiteral,
  TzrV2ConditionNumberLiteral,
  TzrV2ConditionParseResult,
  TzrV2ConditionReference,
  TzrV2ConditionStringLiteral,
  TzrV2ConditionUnaryExpression,
  TzrV2ParseOptions,
} from "./scenario-ast.js";
import { isValidTzrV2DottedIdentifier } from "./parser.js";

type ComparisonOperator = "==" | "!=" | ">=" | "<=" | ">" | "<";
type LogicalOperator = "and" | "or" | "not";

type ConditionToken =
  | { readonly type: "reference"; readonly value: string; readonly loc: SourceRange }
  | { readonly type: "string"; readonly value: string; readonly loc: SourceRange }
  | { readonly type: "number"; readonly value: number; readonly loc: SourceRange }
  | { readonly type: "boolean"; readonly value: boolean; readonly loc: SourceRange }
  | { readonly type: "null"; readonly loc: SourceRange }
  | { readonly type: "operator"; readonly value: ComparisonOperator | LogicalOperator; readonly loc: SourceRange }
  | { readonly type: "leftParen"; readonly loc: SourceRange }
  | { readonly type: "rightParen"; readonly loc: SourceRange }
  | { readonly type: "eof"; readonly loc: SourceRange };

interface TokenizeResult {
  readonly tokens: readonly ConditionToken[];
  readonly errors: readonly ParseDiagnostic[];
}

export function parseTzrV2ConditionExpression(
  source: string,
  options: TzrV2ParseOptions = {},
): TzrV2ConditionParseResult {
  const filePath = options.filePath ?? "<anonymous>";
  const tokenizer = tokenizeConditionExpression(source, filePath);
  if (tokenizer.errors.length > 0) {
    return { ok: false, errors: tokenizer.errors };
  }

  const parser = new TzrV2ConditionExpressionParser(source, filePath, tokenizer.tokens);
  return parser.parse();
}

class TzrV2ConditionExpressionParser {
  private readonly errors: ParseDiagnostic[] = [];
  private cursor = 0;

  public constructor(
    private readonly source: string,
    private readonly filePath: string,
    private readonly tokens: readonly ConditionToken[],
  ) {}

  public parse(): TzrV2ConditionParseResult {
    if (this.peek().type === "eof") {
      this.addErrorAt(1, "Condition expression must not be empty.");
      return { ok: false, errors: this.errors };
    }

    const expression = this.parseOrExpression();
    if (expression !== undefined && this.peek().type !== "eof") {
      const token = this.peek();
      this.addError(token.loc.start, `Unexpected token "${tokenText(token)}" after condition expression.`);
    }

    if (expression === undefined || this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return { ok: true, expression, errors: [] };
  }

  private parseOrExpression(): TzrV2ConditionExpression | undefined {
    let left = this.parseAndExpression();
    if (left === undefined) {
      return undefined;
    }

    while (this.matchOperator("or")) {
      const operator = this.previous();
      const right = this.parseAndExpression();
      if (right === undefined) {
        this.addError(operator.loc.start, 'Missing right-hand side for condition operator "or".');
        return undefined;
      }
      left = {
        type: "ConditionBinaryExpression",
        operator: "or",
        left,
        right,
        loc: rangeFrom(left.loc.start, right.loc.end),
      } satisfies TzrV2ConditionBinaryExpression;
    }

    return left;
  }

  private parseAndExpression(): TzrV2ConditionExpression | undefined {
    let left = this.parseComparisonExpression();
    if (left === undefined) {
      return undefined;
    }

    while (this.matchOperator("and")) {
      const operator = this.previous();
      const right = this.parseComparisonExpression();
      if (right === undefined) {
        this.addError(operator.loc.start, 'Missing right-hand side for condition operator "and".');
        return undefined;
      }
      left = {
        type: "ConditionBinaryExpression",
        operator: "and",
        left,
        right,
        loc: rangeFrom(left.loc.start, right.loc.end),
      } satisfies TzrV2ConditionBinaryExpression;
    }

    return left;
  }

  private parseComparisonExpression(): TzrV2ConditionExpression | undefined {
    const left = this.parseNotExpression();
    if (left === undefined) {
      return undefined;
    }

    const operator = this.peek();
    if (operator.type !== "operator" || !isComparisonOperator(operator.value)) {
      if (isConditionLiteral(left)) {
        this.addError(left.loc.start, "Condition literals must be used in a comparison.");
        return undefined;
      }
      return left;
    }

    this.advance();
    if (this.peek().type === "eof") {
      this.addError(operator.loc.start, `Missing right-hand side for condition operator "${operator.value}".`);
      return undefined;
    }

    const right = this.parseNotExpression();
    if (right === undefined) {
      return undefined;
    }

    const next = this.peek();
    if (next.type === "operator" && isComparisonOperator(next.value)) {
      this.addError(next.loc.start, "Chained comparison expressions are not supported.");
      return undefined;
    }

    return {
      type: "ConditionComparisonExpression",
      operator: operator.value,
      left,
      right,
      loc: rangeFrom(left.loc.start, right.loc.end),
    } satisfies TzrV2ConditionComparisonExpression;
  }

  private parseNotExpression(): TzrV2ConditionExpression | undefined {
    if (!this.matchOperator("not")) {
      return this.parsePrimaryExpression();
    }

    const operator = this.previous();
    if (this.peek().type === "eof") {
      this.addError(operator.loc.start, 'Missing expression after "not".');
      return undefined;
    }

    const expression = this.parseNotExpression();
    if (expression === undefined) {
      return undefined;
    }
    if (isConditionLiteral(expression)) {
      this.addError(expression.loc.start, "Condition literals must be used in a comparison.");
      return undefined;
    }

    return {
      type: "ConditionUnaryExpression",
      operator: "not",
      expression,
      loc: rangeFrom(operator.loc.start, expression.loc.end),
    } satisfies TzrV2ConditionUnaryExpression;
  }

  private parsePrimaryExpression(): TzrV2ConditionExpression | undefined {
    const token = this.peek();
    if (this.match("leftParen")) {
      const expression = this.parseOrExpression();
      if (expression === undefined) {
        return undefined;
      }
      if (!this.match("rightParen")) {
        this.addError(token.loc.start, "Condition expression is missing closing parenthesis.");
        return undefined;
      }
      return expression;
    }

    if (token.type === "reference") {
      this.advance();
      return this.parseReferenceToken(token);
    }
    if (token.type === "string") {
      this.advance();
      return { type: "ConditionStringLiteral", value: token.value, loc: token.loc } satisfies TzrV2ConditionStringLiteral;
    }
    if (token.type === "number") {
      this.advance();
      return { type: "ConditionNumberLiteral", value: token.value, loc: token.loc } satisfies TzrV2ConditionNumberLiteral;
    }
    if (token.type === "boolean") {
      this.advance();
      return {
        type: "ConditionBooleanLiteral",
        value: token.value,
        loc: token.loc,
      } satisfies TzrV2ConditionBooleanLiteral;
    }
    if (token.type === "null") {
      this.advance();
      return { type: "ConditionNullLiteral", value: null, loc: token.loc } satisfies TzrV2ConditionNullLiteral;
    }
    if (token.type === "eof") {
      this.addError(token.loc.start, "Unexpected end of condition expression.");
      return undefined;
    }

    this.addError(token.loc.start, `Unexpected token "${tokenText(token)}".`);
    return undefined;
  }

  private parseReferenceToken(token: Extract<ConditionToken, { type: "reference" }>): TzrV2ConditionReference | undefined {
    const parts = token.value.split(".");
    if (!isValidTzrV2DottedIdentifier(token.value) || parts.length < 2) {
      this.addError(token.loc.start, `Invalid dotted identifier "${token.value}".`);
      return undefined;
    }

    const root = parts[0];
    if (root !== "scenario" && root !== "system") {
      this.addError(token.loc.start, `Invalid reference root "${root}".`);
      return undefined;
    }

    return {
      type: "ConditionReference",
      path: token.value,
      root,
      loc: token.loc,
    };
  }

  private match(type: ConditionToken["type"]): boolean {
    if (this.peek().type !== type) {
      return false;
    }
    this.advance();
    return true;
  }

  private matchOperator(operator: LogicalOperator): boolean {
    const token = this.peek();
    if (token.type !== "operator" || token.value !== operator) {
      return false;
    }
    this.advance();
    return true;
  }

  private advance(): ConditionToken {
    if (this.cursor < this.tokens.length - 1) {
      this.cursor += 1;
    }
    return this.previous();
  }

  private peek(): ConditionToken {
    const token = this.tokens[this.cursor];
    if (token === undefined) {
      throw new Error("Condition parser cursor moved beyond input.");
    }
    return token;
  }

  private previous(): ConditionToken {
    const token = this.tokens[this.cursor - 1];
    if (token === undefined) {
      throw new Error("Condition parser previous token is unavailable.");
    }
    return token;
  }

  private addError(location: SourceLocation, message: string): void {
    this.errors.push(createDiagnostic(location, message, this.source));
  }

  private addErrorAt(column: number, message: string): void {
    this.addError({ filePath: this.filePath, line: 1, column }, message);
  }
}

function tokenizeConditionExpression(source: string, filePath: string): TokenizeResult {
  const tokens: ConditionToken[] = [];
  const errors: ParseDiagnostic[] = [];
  let cursor = 0;

  const location = (column: number): SourceLocation => ({ filePath, line: 1, column });
  const range = (startColumn: number, endColumn: number): SourceRange => ({
    start: location(startColumn),
    end: location(endColumn),
  });
  const addError = (column: number, message: string): void => {
    errors.push(createDiagnostic(location(column), message, source));
  };

  while (cursor < source.length) {
    const char = source[cursor] ?? "";
    const column = cursor + 1;

    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "leftParen", loc: range(column, column + 1) });
      cursor += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rightParen", loc: range(column, column + 1) });
      cursor += 1;
      continue;
    }

    if (char === "'") {
      addError(column, "Only double-quoted string literals are supported.");
      break;
    }
    if (char === "`") {
      addError(column, "Backtick string literals are not supported.");
      break;
    }
    if (char === '"') {
      const token = readStringToken(source, filePath, cursor);
      if (token.error !== undefined) {
        errors.push(token.error);
        break;
      }
      tokens.push(token.token);
      cursor = token.nextIndex;
      continue;
    }

    if (char === "&" && source[cursor + 1] === "&") {
      addError(column, "Unsupported condition operator `&&`.");
      break;
    }
    if (char === "|" && source[cursor + 1] === "|") {
      addError(column, "Unsupported condition operator `||`.");
      break;
    }
    if (char === "!" && source[cursor + 1] === "=" && source[cursor + 2] === "=") {
      addError(column, "Unsupported condition operator `!==`.");
      break;
    }
    if (char === "=" && source[cursor + 1] === "=" && source[cursor + 2] === "=") {
      addError(column, "Unsupported condition operator `===`.");
      break;
    }
    if (char === "!") {
      if (source[cursor + 1] === "=") {
        tokens.push({ type: "operator", value: "!=", loc: range(column, column + 2) });
        cursor += 2;
        continue;
      }
      addError(column, "Unsupported condition operator `!`.");
      break;
    }
    if (char === "=" && source[cursor + 1] === "=") {
      tokens.push({ type: "operator", value: "==", loc: range(column, column + 2) });
      cursor += 2;
      continue;
    }
    if (char === ">" || char === "<") {
      const operator = source[cursor + 1] === "=" ? `${char}=` : char;
      tokens.push({
        type: "operator",
        value: operator as ComparisonOperator,
        loc: range(column, column + operator.length),
      });
      cursor += operator.length;
      continue;
    }

    if (isNumberStart(source, cursor)) {
      const token = readNumberToken(source, filePath, cursor);
      tokens.push(token.token);
      cursor = token.nextIndex;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const token = readWordToken(source, filePath, cursor);
      tokens.push(token.token);
      cursor = token.nextIndex;
      continue;
    }

    addError(column, `Unexpected token "${char}".`);
    break;
  }

  const eofColumn = source.length + 1;
  tokens.push({ type: "eof", loc: range(eofColumn, eofColumn) });

  return { tokens, errors };
}

function readStringToken(
  source: string,
  filePath: string,
  startIndex: number,
):
  | { readonly token: Extract<ConditionToken, { type: "string" }>; readonly nextIndex: number; readonly error?: undefined }
  | { readonly error: ParseDiagnostic } {
  let value = "";
  let escaped = false;
  let cursor = startIndex + 1;

  const location = (column: number): SourceLocation => ({ filePath, line: 1, column });
  const range = (startColumn: number, endColumn: number): SourceRange => ({
    start: location(startColumn),
    end: location(endColumn),
  });

  while (cursor < source.length) {
    const char = source[cursor] ?? "";
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
          return {
            error: createDiagnostic(location(cursor + 1), `Unsupported string escape \\${char}.`, source),
          };
      }
      escaped = false;
      cursor += 1;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      cursor += 1;
      continue;
    }
    if (char === '"') {
      return {
        token: {
          type: "string",
          value,
          loc: range(startIndex + 1, cursor + 2),
        },
        nextIndex: cursor + 1,
      };
    }

    value += char;
    cursor += 1;
  }

  return {
    error: createDiagnostic(location(startIndex + 1), "String literal must be double-quoted.", source),
  };
}

function readNumberToken(
  source: string,
  filePath: string,
  startIndex: number,
): { readonly token: Extract<ConditionToken, { type: "number" }>; readonly nextIndex: number } {
  let cursor = startIndex;
  if (source[cursor] === "-") {
    cursor += 1;
  }
  while (/\d/.test(source[cursor] ?? "")) {
    cursor += 1;
  }
  if (source[cursor] === "." && /\d/.test(source[cursor + 1] ?? "")) {
    cursor += 1;
    while (/\d/.test(source[cursor] ?? "")) {
      cursor += 1;
    }
  }

  const raw = source.slice(startIndex, cursor);
  const startColumn = startIndex + 1;
  const endColumn = cursor + 1;
  return {
    token: {
      type: "number",
      value: Number(raw),
      loc: {
        start: { filePath, line: 1, column: startColumn },
        end: { filePath, line: 1, column: endColumn },
      },
    },
    nextIndex: cursor,
  };
}

function readWordToken(
  source: string,
  filePath: string,
  startIndex: number,
): { readonly token: ConditionToken; readonly nextIndex: number } {
  let cursor = startIndex;
  while (/[A-Za-z0-9_.-]/.test(source[cursor] ?? "")) {
    cursor += 1;
  }

  const value = source.slice(startIndex, cursor);
  const loc = {
    start: { filePath, line: 1, column: startIndex + 1 },
    end: { filePath, line: 1, column: cursor + 1 },
  };

  if (value === "and" || value === "or" || value === "not") {
    return { token: { type: "operator", value, loc }, nextIndex: cursor };
  }
  if (value === "true" || value === "false") {
    return { token: { type: "boolean", value: value === "true", loc }, nextIndex: cursor };
  }
  if (value === "null") {
    return { token: { type: "null", loc }, nextIndex: cursor };
  }

  return { token: { type: "reference", value, loc }, nextIndex: cursor };
}

function isNumberStart(source: string, index: number): boolean {
  const char = source[index] ?? "";
  if (/\d/.test(char)) {
    return true;
  }
  return char === "-" && /\d/.test(source[index + 1] ?? "");
}

function isComparisonOperator(value: string): value is ComparisonOperator {
  return value === "==" || value === "!=" || value === ">=" || value === "<=" || value === ">" || value === "<";
}

function isConditionLiteral(expression: TzrV2ConditionExpression): expression is TzrV2ConditionLiteral {
  return (
    expression.type === "ConditionStringLiteral" ||
    expression.type === "ConditionNumberLiteral" ||
    expression.type === "ConditionBooleanLiteral" ||
    expression.type === "ConditionNullLiteral"
  );
}

function rangeFrom(start: SourceLocation, end: SourceLocation): SourceRange {
  return { start, end };
}

function tokenText(token: ConditionToken): string {
  switch (token.type) {
    case "reference":
      return token.value;
    case "string":
      return "string";
    case "number":
      return String(token.value);
    case "boolean":
      return String(token.value);
    case "null":
      return "null";
    case "operator":
      return token.value;
    case "leftParen":
      return "(";
    case "rightParen":
      return ")";
    case "eof":
      return "end of input";
  }
}
