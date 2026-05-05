import type { SourceLocation, SourceRange, TextLine, TzrArgument, TzrValue } from "../ast.js";
import { createDiagnostic, type Diagnostic } from "../diagnostic.js";
import type {
  BodyChoiceInstruction,
  BodyChoiceInstructionItem,
  CommandInstruction,
  DeclarationIndexEntry,
  DialogueInstruction,
  NarrationInstruction,
  RuntimeDocument,
  SceneJumpInstruction,
  SceneInstruction,
  TzrInstruction,
  V2ElifInstructionBranch,
  V2IfInstruction,
} from "../ir.js";
import type {
  TzrV2CharacterDeclaration,
  TzrV2ChoiceItem,
  TzrV2ChoiceStatement,
  TzrV2ConditionExpression,
  TzrV2DialogueStatement,
  TzrV2Document,
  TzrV2IfStatement,
  TzrV2NarrationStatement,
  TzrV2SceneDeclaration,
  TzrV2SceneStatement,
  TzrV2SetStatement,
  TzrV2AddStatement,
  TzrV2TextBlockItem,
  TzrV2TextLine,
  TzrV2TitleDeclaration,
  TzrV2ValueExpression,
} from "./ast.js";

const DSL_V2_ADD_COMMAND_NAME = "__tsuzuru_v2_add";

export interface TzrV2CompileOptions {}

export type TzrV2CompileResult =
  | { readonly ok: true; readonly document: CompiledTzrV2Document; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export interface CompiledTzrV2Document extends RuntimeDocument {
  readonly type: "CompiledTzrV2Document";
  readonly source: TzrV2Document;
  readonly metadata: TzrV2DocumentMetadata;
  readonly labels: Readonly<Record<string, DeclarationIndexEntry>>;
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
}

export interface TzrV2DocumentMetadata {
  readonly title?: string;
  readonly characters: Readonly<Record<string, TzrV2CompiledCharacter>>;
  readonly scenes: Readonly<Record<string, TzrV2CompiledSceneMetadata>>;
}

export interface TzrV2CompiledCharacter {
  readonly id: string;
  readonly name: string;
  readonly loc: SourceRange;
}

export interface TzrV2CompiledSceneMetadata {
  readonly id: string;
  readonly title?: string;
  readonly loc: SourceRange;
}

export function compileTzrV2(document: TzrV2Document, _options: TzrV2CompileOptions = {}): TzrV2CompileResult {
  const compiler = new TzrV2Compiler(document);
  return compiler.compile();
}

class TzrV2Compiler {
  private readonly errors: Diagnostic[] = [];
  private title: TzrV2TitleDeclaration | undefined;
  private readonly characters = new Map<string, TzrV2CharacterDeclaration>();
  private readonly scenes = new Map<string, TzrV2SceneDeclaration>();

  public constructor(private readonly document: TzrV2Document) {}

  public compile(): TzrV2CompileResult {
    this.collectTopLevelDeclarations();
    this.validateScenePresence();
    this.validateSceneBodies();

    const compiled = this.buildCompiledDocument();

    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return {
      ok: true,
      document: compiled,
      errors: [],
    };
  }

  private collectTopLevelDeclarations(): void {
    for (const declaration of this.document.declarations) {
      switch (declaration.type) {
        case "TitleDeclaration":
          this.collectTitle(declaration);
          break;
        case "CharacterDeclaration":
          this.collectCharacter(declaration);
          break;
        case "SceneDeclaration":
          this.collectScene(declaration);
          break;
      }
    }
  }

  private collectTitle(title: TzrV2TitleDeclaration): void {
    if (this.title !== undefined) {
      this.addError(title.loc.start, "Duplicate title declaration.");
      return;
    }

    this.title = title;
  }

  private collectCharacter(character: TzrV2CharacterDeclaration): void {
    if (this.characters.has(character.id)) {
      this.addError(character.loc.start, `Duplicate character "${character.id}".`);
      return;
    }

    this.characters.set(character.id, character);
  }

  private collectScene(scene: TzrV2SceneDeclaration): void {
    if (this.scenes.has(scene.id)) {
      this.addError(scene.loc.start, `Duplicate scene "${scene.id}".`);
      return;
    }

    this.scenes.set(scene.id, scene);
  }

  private validateScenePresence(): void {
    if (this.scenes.size === 0) {
      this.addError(this.documentStartLocation(), "DSL v2 document must include at least one scene.");
    }
  }

  private validateSceneBodies(): void {
    for (const declaration of this.document.declarations) {
      if (declaration.type === "SceneDeclaration") {
        this.validateSceneStatements(declaration.body);
      }
    }
  }

  private validateSceneStatements(statements: readonly TzrV2SceneStatement[]): void {
    for (const statement of statements) {
      switch (statement.type) {
        case "DialogueStatement":
          this.validateDialogueSpeaker(statement.speaker, statement.loc.start);
          break;
        case "JumpStatement":
          this.validateJumpTarget(statement.target, statement.loc.start);
          break;
        case "IfStatement":
          this.validateIfStatement(statement);
          break;
        case "ChoiceStatement":
          this.validateChoiceStatement(statement);
          break;
        default:
          break;
      }
    }
  }

  private validateIfStatement(statement: TzrV2IfStatement): void {
    this.validateSupportedCondition(statement.condition);
    this.validateSceneStatements(statement.thenBranch);
    for (const branch of statement.elifBranches) {
      this.validateSupportedCondition(branch.condition);
      this.validateSceneStatements(branch.body);
    }
    if (statement.elseBranch !== undefined) {
      this.validateSceneStatements(statement.elseBranch);
    }
  }

  private validateChoiceStatement(statement: TzrV2ChoiceStatement): void {
    for (const item of statement.items) {
      this.validateSceneStatements(item.body);
    }
  }

  private validateDialogueSpeaker(speaker: string, location: SourceLocation): void {
    if (!this.characters.has(speaker)) {
      this.addError(location, `Unknown dialogue speaker "${speaker}".`);
    }
  }

  private validateJumpTarget(target: string, location: SourceLocation): void {
    if (!this.scenes.has(target)) {
      this.addError(location, `Unknown scene "${target}".`);
    }
  }

  private validateSupportedCondition(expression: TzrV2ConditionExpression): void {
    switch (expression.type) {
      case "ConditionReference":
        if (expression.root === "system") {
          this.addError(expression.loc.start, "system condition references are not compile-supported yet.");
        }
        break;
      case "ConditionStringLiteral":
      case "ConditionNumberLiteral":
      case "ConditionBooleanLiteral":
      case "ConditionNullLiteral":
        break;
      case "ConditionUnaryExpression":
        this.validateSupportedCondition(expression.expression);
        break;
      case "ConditionBinaryExpression":
      case "ConditionComparisonExpression":
        this.validateSupportedCondition(expression.left);
        this.validateSupportedCondition(expression.right);
        break;
    }
  }

  private buildCompiledDocument(): CompiledTzrV2Document {
    const instructions = this.buildInstructions();

    return {
      type: "CompiledTzrV2Document",
      filePath: this.document.filePath,
      source: this.document,
      metadata: this.buildMetadata(),
      instructions,
      labels: {},
      scenes: buildSceneIndexes(instructions),
    };
  }

  private buildInstructions(): readonly TzrInstruction[] {
    const instructions: TzrInstruction[] = [];

    for (const scene of this.scenes.values()) {
      instructions.push({
        type: "SceneInstruction",
        id: scene.id,
        loc: scene.loc,
      } satisfies SceneInstruction);
      instructions.push(...this.buildSceneBodyInstructions(scene.body));
    }

    return instructions;
  }

  private buildSceneBodyInstructions(statements: readonly TzrV2SceneStatement[]): readonly TzrInstruction[] {
    const instructions: TzrInstruction[] = [];

    for (const statement of statements) {
      switch (statement.type) {
        case "NarrationStatement":
          instructions.push(...this.buildNarrationInstruction(statement));
          break;
        case "DialogueStatement":
          instructions.push(...this.buildDialogueInstruction(statement));
          break;
        case "EndStatement":
          instructions.push(this.buildStopInstruction(statement.loc));
          break;
        case "JumpStatement":
          instructions.push(this.buildSceneJumpInstruction(statement.target, statement.loc));
          break;
        case "ChoiceStatement":
          instructions.push(this.buildBodyChoiceInstruction(statement));
          break;
        case "IfStatement":
          instructions.push(this.buildV2IfInstruction(statement));
          break;
        case "SetStatement":
          instructions.push(...this.buildSetInstruction(statement));
          break;
        case "AddStatement":
          instructions.push(this.buildAddInstruction(statement));
          break;
        default:
          this.addError(statement.loc.start, `DSL v2 statement "${statement.type}" is not compile-supported yet.`);
          break;
      }
    }

    return instructions;
  }

  private buildNarrationInstruction(statement: TzrV2NarrationStatement): readonly NarrationInstruction[] {
    const lines = this.compilePlainTextBlock(statement);
    if (lines === undefined) {
      return [];
    }

    return [
      {
        type: "NarrationInstruction",
        lines,
        loc: statement.loc,
      },
    ];
  }

  private buildDialogueInstruction(statement: TzrV2DialogueStatement): readonly DialogueInstruction[] {
    const lines = this.compilePlainTextBlock(statement);
    if (lines === undefined) {
      return [];
    }

    return [
      {
        type: "DialogueInstruction",
        speaker: statement.speaker,
        lines,
        loc: statement.loc,
      },
    ];
  }

  private buildStopInstruction(loc: SourceRange): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: "stop",
      args: [],
      loc,
    };
  }

  private buildSceneJumpInstruction(sceneId: string, loc: SourceRange): SceneJumpInstruction {
    return {
      type: "SceneJumpInstruction",
      sceneId,
      loc,
    };
  }

  private buildV2IfInstruction(statement: TzrV2IfStatement): V2IfInstruction {
    return {
      type: "V2IfInstruction",
      condition: statement.condition,
      thenBranch: this.buildSceneBodyInstructions(statement.thenBranch),
      elifBranches: statement.elifBranches.map(
        (branch): V2ElifInstructionBranch => ({
          condition: branch.condition,
          body: this.buildSceneBodyInstructions(branch.body),
          loc: branch.loc,
        }),
      ),
      ...(statement.elseBranch === undefined ? {} : { elseBranch: this.buildSceneBodyInstructions(statement.elseBranch) }),
      loc: statement.loc,
    };
  }

  private buildSetInstruction(statement: TzrV2SetStatement): readonly CommandInstruction[] {
    const value = this.compileSetValue(statement.value);
    if (value === undefined) {
      return [];
    }

    return [
      {
        type: "CommandInstruction",
        name: "set",
        args: [
          this.namedArgument("name", { type: "StringValue", value: statement.target.path, loc: statement.target.loc }, statement.target.loc),
          this.namedArgument("value", value, statement.value.loc),
        ],
        loc: statement.loc,
      },
    ];
  }

  private buildAddInstruction(statement: TzrV2AddStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: DSL_V2_ADD_COMMAND_NAME,
      args: [
        this.namedArgument("name", { type: "StringValue", value: statement.target.path, loc: statement.target.loc }, statement.target.loc),
        this.namedArgument("by", { type: "NumberValue", value: statement.value.value, loc: statement.value.loc }, statement.value.loc),
      ],
      loc: statement.loc,
    };
  }

  private compileSetValue(value: TzrV2ValueExpression): TzrValue | undefined {
    switch (value.type) {
      case "StringValue":
      case "NumberValue":
      case "BooleanValue":
        return value;
      case "NullValue":
        this.addError(value.loc.start, "set null value is not compile-supported yet.");
        return undefined;
      case "VariableReferenceValue":
        this.addError(value.loc.start, "set variable reference value is not compile-supported yet.");
        return undefined;
    }
  }

  private namedArgument(name: string, value: TzrValue, loc: SourceRange): TzrArgument {
    return {
      type: "NamedArgument",
      name,
      value,
      loc,
    };
  }

  private buildBodyChoiceInstruction(statement: TzrV2ChoiceStatement): BodyChoiceInstruction {
    return {
      type: "BodyChoiceInstruction",
      question: statement.question,
      items: statement.items.map((item) => this.buildBodyChoiceInstructionItem(item)),
      loc: statement.loc,
    };
  }

  private buildBodyChoiceInstructionItem(item: TzrV2ChoiceItem): BodyChoiceInstructionItem {
    if (item.condition !== undefined) {
      this.addError(item.loc.start, "Conditional choice items are not compile-supported yet.");
    }

    return {
      label: item.label,
      ...(item.id === undefined ? {} : { id: item.id }),
      body: this.buildSceneBodyInstructions(item.body),
      loc: item.loc,
    };
  }

  private compilePlainTextBlock(statement: TzrV2NarrationStatement | TzrV2DialogueStatement): readonly TextLine[] | undefined {
    let ok = true;
    const lines: TextLine[] = [];

    if (statement.meta !== undefined) {
      this.addError(statement.meta.loc.start, "Text block metadata is not compile-supported yet.");
      ok = false;
    }

    for (const item of statement.lines) {
      const line = this.compilePlainTextBlockItem(item);
      if (line === undefined) {
        ok = false;
        continue;
      }
      lines.push(line);
    }

    return ok ? lines : undefined;
  }

  private compilePlainTextBlockItem(item: TzrV2TextBlockItem): TextLine | undefined {
    switch (item.type) {
      case "TextLine":
        return this.compilePlainTextLine(item);
      case "TextClickWait":
        this.addError(item.loc.start, "Text click wait is not compile-supported yet.");
        return undefined;
      case "TextPageBreak":
        this.addError(item.loc.start, "Text page break is not compile-supported yet.");
        return undefined;
    }
  }

  private compilePlainTextLine(line: TzrV2TextLine): TextLine | undefined {
    let ok = true;

    for (const node of line.inline) {
      switch (node.type) {
        case "InlineText":
          break;
        case "InlineTextSpan":
          this.addError(node.loc.start, "Rich inline text is not compile-supported yet.");
          ok = false;
          break;
        case "InlineDelaySpan":
          this.addError(node.loc.start, "Inline delay is not compile-supported yet.");
          ok = false;
          break;
        case "InlineWaitEvent":
          this.addError(node.loc.start, "Inline wait is not compile-supported yet.");
          ok = false;
          break;
        case "InlineSeEvent":
          this.addError(node.loc.start, "Inline se is not compile-supported yet.");
          ok = false;
          break;
        case "InlineVoiceEvent":
          this.addError(node.loc.start, "Inline voice is not compile-supported yet.");
          ok = false;
          break;
      }
    }

    return ok
      ? {
          text: line.text,
          loc: line.loc,
        }
      : undefined;
  }

  private buildMetadata(): TzrV2DocumentMetadata {
    const characters: Record<string, TzrV2CompiledCharacter> = {};
    const scenes: Record<string, TzrV2CompiledSceneMetadata> = {};

    for (const character of this.characters.values()) {
      characters[character.id] = {
        id: character.id,
        name: character.name,
        loc: character.loc,
      };
    }

    for (const scene of this.scenes.values()) {
      scenes[scene.id] = {
        id: scene.id,
        ...(scene.title === undefined ? {} : { title: scene.title }),
        loc: scene.loc,
      };
    }

    return {
      ...(this.title === undefined ? {} : { title: this.title.title }),
      characters,
      scenes,
    };
  }

  private addError(location: SourceLocation, message: string): void {
    this.errors.push(createDiagnostic(location, message, this.sourceLine(location.line)));
  }

  private documentStartLocation(): SourceLocation {
    return {
      filePath: this.document.filePath,
      line: 1,
      column: 1,
    };
  }

  private sourceLine(line: number): string {
    return this.document.sourceLines[line - 1] ?? "";
  }
}

function buildSceneIndexes(instructions: readonly TzrInstruction[]): Readonly<Record<string, DeclarationIndexEntry>> {
  const scenes: Record<string, DeclarationIndexEntry> = {};

  for (const [statementIndex, instruction] of instructions.entries()) {
    if (instruction.type === "SceneInstruction") {
      scenes[instruction.id] = {
        id: instruction.id,
        statementIndex,
        loc: instruction.loc,
      };
    }
  }

  return scenes;
}
