import type { SourceLocation, SourceRange, TextLine, TzrArgument, TzrValue } from "./ast.js";
import { isCoreCommandName } from "./commands.js";
import { createDiagnostic, type Diagnostic } from "./diagnostic.js";
import type {
  BodyChoiceInstruction,
  BodyChoiceInstructionItem,
  CommandInstruction,
  DeclarationIndexEntry,
  DialogueInstruction,
  ElifInstructionBranch,
  IfInstruction,
  NarrationInstruction,
  RuntimeDocument,
  SceneInstruction,
  SceneJumpInstruction,
  TzrInstruction,
} from "./ir.js";
import type { PluginCommandDefinition, PluginCommandMap } from "./plugin-command.js";
import { validatePluginCommandArguments } from "./plugin-command.js";
import type {
  TzrAddStatement,
  TzrArgumentValue,
  TzrAudioAssetRef,
  TzrBgmStatement,
  TzrBgStatement,
  TzrCallStatement,
  TzrCharacterDeclaration,
  TzrChoiceItem,
  TzrChoiceStatement,
  TzrClearVisualStatement,
  TzrConditionExpression,
  TzrDialogueStatement,
  TzrDocument,
  TzrHideStatement,
  TzrIfStatement,
  TzrNamedArgument,
  TzrNarrationStatement,
  TzrSceneDeclaration,
  TzrSceneStatement,
  TzrSeStatement,
  TzrSetStatement,
  TzrShowStatement,
  TzrStopBgmStatement,
  TzrTextBlockItem,
  TzrTextLine,
  TzrTitleDeclaration,
  TzrValueExpression,
  TzrVisualAssetRef,
  TzrVisualTransition,
  TzrVoiceStatement,
  TzrWaitStatement,
} from "./scenario-ast.js";

const DSL_ADD_COMMAND_NAME = "__tsuzuru_add";
const DSL_SET_REFERENCE_COMMAND_NAME = "__tsuzuru_set_reference";

export interface TzrCompilePluginDefinition {
  readonly name: string;
  readonly commands?: PluginCommandMap;
}

export type TzrCompilePluginCommandInput = PluginCommandMap | readonly PluginCommandDefinition[];

export interface TzrCompileOptions {
  readonly plugins?: readonly TzrCompilePluginDefinition[];
  readonly pluginCommands?: TzrCompilePluginCommandInput;
}

export type TzrCompileResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export interface CompiledTzrDocument extends RuntimeDocument {
  readonly type: "CompiledTzrDocument";
  readonly source: TzrDocument;
  readonly metadata: TzrDocumentMetadata;
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
}

export interface TzrDocumentMetadata {
  readonly title?: string;
  readonly characters: Readonly<Record<string, TzrCompiledCharacter>>;
  readonly scenes: Readonly<Record<string, TzrCompiledSceneMetadata>>;
}

export interface TzrCompiledCharacter {
  readonly id: string;
  readonly name: string;
  readonly loc: SourceRange;
}

export interface TzrCompiledSceneMetadata {
  readonly id: string;
  readonly title?: string;
  readonly loc: SourceRange;
}

export function compileTzr(document: TzrDocument, options: TzrCompileOptions = {}): TzrCompileResult {
  const compiler = new TzrCompiler(document, options);
  return compiler.compile();
}

class TzrCompiler {
  private readonly errors: Diagnostic[] = [];
  private readonly pluginCommands: ReadonlyMap<string, PluginCommandDefinition> | undefined;
  private title: TzrTitleDeclaration | undefined;
  private readonly characters = new Map<string, TzrCharacterDeclaration>();
  private readonly scenes = new Map<string, TzrSceneDeclaration>();

  public constructor(
    private readonly document: TzrDocument,
    options: TzrCompileOptions,
  ) {
    this.pluginCommands = this.collectPluginCommandDefinitions(options);
  }

  public compile(): TzrCompileResult {
    this.collectTopLevelDeclarations();
    this.validateScenePresence();
    this.validateSceneBodies();

    const compiled = this.buildCompiledDocument();
    this.validateCompiledPluginCommands(compiled.instructions);

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
        case "IncludeDirective":
          break;
      }
    }
  }

  private collectTitle(title: TzrTitleDeclaration): void {
    if (this.title !== undefined) {
      this.addError(title.loc.start, "Duplicate title declaration.");
      return;
    }

    this.title = title;
  }

  private collectCharacter(character: TzrCharacterDeclaration): void {
    if (this.characters.has(character.id)) {
      this.addError(character.loc.start, `Duplicate character "${character.id}".`);
      return;
    }

    this.characters.set(character.id, character);
  }

  private collectScene(scene: TzrSceneDeclaration): void {
    if (this.scenes.has(scene.id)) {
      this.addError(scene.loc.start, `Duplicate scene "${scene.id}".`);
      return;
    }

    this.scenes.set(scene.id, scene);
  }

  private collectPluginCommandDefinitions(
    options: TzrCompileOptions,
  ): ReadonlyMap<string, PluginCommandDefinition> | undefined {
    const registry = new Map<string, PluginCommandDefinition>();
    let enabled = options.pluginCommands !== undefined;

    if (options.pluginCommands !== undefined) {
      this.collectPluginCommandInput(registry, options.pluginCommands);
    }

    for (const plugin of options.plugins ?? []) {
      if (plugin.commands === undefined) {
        continue;
      }
      enabled = true;
      this.collectPluginCommandInput(registry, plugin.commands);
    }

    return enabled ? registry : undefined;
  }

  private collectPluginCommandInput(
    registry: Map<string, PluginCommandDefinition>,
    input: TzrCompilePluginCommandInput,
  ): void {
    if (Array.isArray(input)) {
      for (const command of input) {
        this.collectPluginCommandDefinition(registry, command.name, command);
      }
      return;
    }

    for (const [key, command] of Object.entries(input)) {
      this.collectPluginCommandDefinition(registry, key, command);
    }
  }

  private collectPluginCommandDefinition(
    registry: Map<string, PluginCommandDefinition>,
    key: string,
    command: PluginCommandDefinition,
  ): void {
    if (key !== command.name) {
      this.addError(
        this.documentStartLocation(),
        `Plugin command metadata key "${key}" must match command name "${command.name}".`,
      );
      return;
    }

    if (registry.has(command.name)) {
      this.addError(this.documentStartLocation(), `Duplicate plugin command metadata for "${command.name}".`);
      return;
    }

    registry.set(command.name, command);
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

  private validateSceneStatements(statements: readonly TzrSceneStatement[]): void {
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

  private validateIfStatement(statement: TzrIfStatement): void {
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

  private validateChoiceStatement(statement: TzrChoiceStatement): void {
    for (const item of statement.items) {
      if (item.condition !== undefined) {
        this.validateSupportedCondition(item.condition);
      }
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

  private validateSupportedCondition(expression: TzrConditionExpression): void {
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

  private buildCompiledDocument(): CompiledTzrDocument {
    const instructions = this.buildInstructions();

    return {
      type: "CompiledTzrDocument",
      filePath: this.document.filePath,
      source: this.document,
      metadata: this.buildMetadata(),
      instructions,
      scenes: buildSceneIndexes(instructions),
    };
  }

  private buildInstructions(): readonly TzrInstruction[] {
    const instructions: TzrInstruction[] = [];

    for (const declaration of this.document.declarations) {
      switch (declaration.type) {
        case "SceneDeclaration":
          instructions.push({
            type: "SceneInstruction",
            id: declaration.id,
            loc: declaration.loc,
          } satisfies SceneInstruction);
          instructions.push(...this.buildSceneBodyInstructions(declaration.body));
          break;
        default:
          break;
      }
    }

    return instructions;
  }

  private buildSceneBodyInstructions(statements: readonly TzrSceneStatement[]): readonly TzrInstruction[] {
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
          instructions.push(this.buildIfInstruction(statement));
          break;
        case "SetStatement":
          instructions.push(...this.buildSetInstruction(statement));
          break;
        case "AddStatement":
          instructions.push(this.buildAddInstruction(statement));
          break;
        case "WaitStatement": {
          const instruction = this.buildWaitInstruction(statement);
          if (instruction !== undefined) {
            instructions.push(instruction);
          }
          break;
        }
        case "CallStatement": {
          const instruction = this.buildCallInstruction(statement);
          if (instruction !== undefined) {
            instructions.push(instruction);
          }
          break;
        }
        case "BgStatement":
          instructions.push(...this.buildBgInstruction(statement));
          break;
        case "ShowStatement":
          instructions.push(...this.buildShowInstruction(statement));
          break;
        case "HideStatement":
          instructions.push(...this.buildHideInstruction(statement));
          break;
        case "ClearVisualStatement":
          instructions.push(this.buildClearVisualInstruction(statement));
          break;
        case "BgmStatement":
          instructions.push(this.buildBgmInstruction(statement));
          break;
        case "StopBgmStatement":
          instructions.push(this.buildStopBgmInstruction(statement));
          break;
        case "SeStatement":
          instructions.push(this.buildSeInstruction(statement));
          break;
        case "VoiceStatement":
          instructions.push(this.buildVoiceInstruction(statement));
          break;
        default:
          this.addError(statement.loc.start, `DSL v2 statement "${statement.type}" is not compile-supported yet.`);
          break;
      }
    }

    return instructions;
  }

  private buildNarrationInstruction(statement: TzrNarrationStatement): readonly NarrationInstruction[] {
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

  private buildDialogueInstruction(statement: TzrDialogueStatement): readonly DialogueInstruction[] {
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

  private buildIfInstruction(statement: TzrIfStatement): IfInstruction {
    return {
      type: "IfInstruction",
      condition: statement.condition,
      thenBranch: this.buildSceneBodyInstructions(statement.thenBranch),
      elifBranches: statement.elifBranches.map(
        (branch): ElifInstructionBranch => ({
          condition: branch.condition,
          body: this.buildSceneBodyInstructions(branch.body),
          loc: branch.loc,
        }),
      ),
      ...(statement.elseBranch === undefined
        ? {}
        : { elseBranch: this.buildSceneBodyInstructions(statement.elseBranch) }),
      loc: statement.loc,
    };
  }

  private buildSetInstruction(statement: TzrSetStatement): readonly CommandInstruction[] {
    if (statement.value.type === "VariableReferenceValue") {
      return this.buildSetReferenceInstruction(statement);
    }

    const value = this.compileSetLiteralValue(statement.value);
    if (value === undefined) {
      return [];
    }

    return [
      {
        type: "CommandInstruction",
        name: "set",
        args: [
          this.namedArgument(
            "name",
            { type: "StringValue", value: statement.target.path, loc: statement.target.loc },
            statement.target.loc,
          ),
          this.namedArgument("value", value, statement.value.loc),
        ],
        loc: statement.loc,
      },
    ];
  }

  private buildSetReferenceInstruction(statement: TzrSetStatement): readonly CommandInstruction[] {
    const value = statement.value;
    if (value.type !== "VariableReferenceValue") {
      return [];
    }
    if (value.root === "system") {
      this.addError(value.loc.start, "set system variable references are not compile-supported yet.");
      return [];
    }

    return [
      {
        type: "CommandInstruction",
        name: DSL_SET_REFERENCE_COMMAND_NAME,
        args: [
          this.namedArgument(
            "name",
            { type: "StringValue", value: statement.target.path, loc: statement.target.loc },
            statement.target.loc,
          ),
          this.namedArgument("from", { type: "StringValue", value: value.path, loc: value.loc }, value.loc),
        ],
        loc: statement.loc,
      },
    ];
  }

  private buildAddInstruction(statement: TzrAddStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: DSL_ADD_COMMAND_NAME,
      args: [
        this.namedArgument(
          "name",
          { type: "StringValue", value: statement.target.path, loc: statement.target.loc },
          statement.target.loc,
        ),
        this.namedArgument(
          "by",
          { type: "NumberValue", value: statement.value.value, loc: statement.value.loc },
          statement.value.loc,
        ),
      ],
      loc: statement.loc,
    };
  }

  private buildCallInstruction(statement: TzrCallStatement): CommandInstruction | undefined {
    if (this.pluginCommands === undefined) {
      this.addError(statement.loc.start, 'DSL v2 statement "CallStatement" is not compile-supported yet.');
      return undefined;
    }

    const args = this.compileCallArguments(statement.args);
    if (args === undefined) {
      return undefined;
    }

    return {
      type: "CommandInstruction",
      name: statement.name,
      args,
      loc: statement.loc,
    };
  }

  private buildWaitInstruction(statement: TzrWaitStatement): CommandInstruction | undefined {
    if (statement.duration === undefined) {
      this.addError(statement.loc.start, 'DSL v2 statement "WaitStatement" is not compile-supported yet.');
      return undefined;
    }
    if (!Number.isFinite(statement.duration.value)) {
      this.addError(statement.duration.loc.start, "wait duration must be a finite number.");
      return undefined;
    }
    if (statement.duration.value < 0) {
      this.addError(statement.duration.loc.start, "wait duration must not be negative.");
      return undefined;
    }

    return {
      type: "CommandInstruction",
      name: "wait",
      args: [this.positionalArgument(statement.duration, statement.duration.loc)],
      loc: statement.loc,
    };
  }

  private compileCallArguments(args: readonly TzrNamedArgument[]): readonly TzrArgument[] | undefined {
    let ok = true;
    const compiled: TzrArgument[] = [];

    for (const arg of args) {
      const value = this.compileCallArgumentValue(arg.value);
      if (value === undefined) {
        ok = false;
        continue;
      }
      compiled.push(this.namedArgument(arg.name, value, arg.loc));
    }

    return ok ? compiled : undefined;
  }

  private compileCallArgumentValue(value: TzrArgumentValue): TzrValue | undefined {
    switch (value.type) {
      case "StringValue":
      case "NumberValue":
      case "BooleanValue":
        return value;
      case "IdentifierValue":
        return {
          type: "IdentifierValue",
          name: value.value,
          loc: value.loc,
        };
      case "NullValue":
        this.addError(value.loc.start, "call null argument values are not compile-supported yet.");
        return undefined;
      case "VariableReferenceValue":
        this.addError(value.loc.start, "call variable reference argument values are not compile-supported yet.");
        return undefined;
    }
  }

  private buildBgInstruction(statement: TzrBgStatement): readonly CommandInstruction[] {
    return [
      {
        type: "CommandInstruction",
        name: "bg",
        args: [
          this.positionalArgument(
            this.stringValue(this.visualAssetRefValue(statement.assetRef), statement.assetRef.loc),
            statement.assetRef.loc,
          ),
          ...this.visualTransitionArguments(statement.transition),
        ],
        loc: statement.loc,
      },
    ];
  }

  private buildShowInstruction(statement: TzrShowStatement): readonly CommandInstruction[] {
    if (statement.placement.type === "VisualCoordinatePlacement") {
      this.addError(statement.placement.loc.start, "show coordinate placement is not compile-supported yet.");
      return [];
    }

    return [
      {
        type: "CommandInstruction",
        name: "show",
        args: [
          this.positionalArgument(
            this.stringValue(this.visualAssetRefValue(statement.assetRef), statement.assetRef.loc),
            statement.assetRef.loc,
          ),
          this.namedArgument(
            "position",
            this.stringValue(statement.placement.value, statement.placement.loc),
            statement.placement.loc,
          ),
          ...this.visualTransitionArguments(statement.transition),
        ],
        loc: statement.loc,
      },
    ];
  }

  private buildHideInstruction(statement: TzrHideStatement): readonly CommandInstruction[] {
    return [
      {
        type: "CommandInstruction",
        name: "hide",
        args: [
          this.positionalArgument(
            this.stringValue(this.visualAssetRefValue(statement.assetRef), statement.assetRef.loc),
            statement.assetRef.loc,
          ),
          ...this.visualTransitionArguments(statement.transition),
        ],
        loc: statement.loc,
      },
    ];
  }

  private buildClearVisualInstruction(statement: TzrClearVisualStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: statement.target === "bg" ? "clearBg" : "clearSprites",
      args: this.visualTransitionArguments(statement.transition),
      loc: statement.loc,
    };
  }

  private visualTransitionArguments(transition: TzrVisualTransition | undefined): readonly TzrArgument[] {
    if (transition === undefined) {
      return [];
    }

    return [
      this.namedArgument("transition", this.stringValue(transition.name, transition.loc), transition.loc),
      this.namedArgument(
        "duration",
        { type: "NumberValue", value: transition.duration, loc: transition.loc },
        transition.loc,
      ),
    ];
  }

  private visualAssetRefValue(assetRef: TzrVisualAssetRef): string {
    return assetRef.value;
  }

  private buildBgmInstruction(statement: TzrBgmStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: "startBgm",
      args: [
        this.positionalArgument(
          this.stringValue(this.audioAssetRefValue(statement.assetRef), statement.assetRef.loc),
          statement.assetRef.loc,
        ),
      ],
      loc: statement.loc,
    };
  }

  private buildStopBgmInstruction(statement: TzrStopBgmStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: "stopBgm",
      args: [],
      loc: statement.loc,
    };
  }

  private buildSeInstruction(statement: TzrSeStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: "se",
      args: [
        this.positionalArgument(
          this.stringValue(this.audioAssetRefValue(statement.assetRef), statement.assetRef.loc),
          statement.assetRef.loc,
        ),
      ],
      loc: statement.loc,
    };
  }

  private buildVoiceInstruction(statement: TzrVoiceStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: "voice",
      args: [
        this.positionalArgument(
          this.stringValue(this.audioAssetRefValue(statement.assetRef), statement.assetRef.loc),
          statement.assetRef.loc,
        ),
      ],
      loc: statement.loc,
    };
  }

  private audioAssetRefValue(assetRef: TzrAudioAssetRef): string {
    return assetRef.value;
  }

  private compileSetLiteralValue(value: TzrValueExpression): TzrValue | undefined {
    switch (value.type) {
      case "StringValue":
      case "NumberValue":
      case "BooleanValue":
      case "NullValue":
        return value;
      case "VariableReferenceValue":
        this.addError(value.loc.start, "set variable reference value must be compiled as a reference.");
        return undefined;
    }
  }

  private positionalArgument(value: TzrValue, loc: SourceRange): TzrArgument {
    return {
      type: "PositionalArgument",
      value,
      loc,
    };
  }

  private namedArgument(name: string, value: TzrValue, loc: SourceRange): TzrArgument {
    return {
      type: "NamedArgument",
      name,
      value,
      loc,
    };
  }

  private stringValue(value: string, loc: SourceRange): TzrValue {
    return {
      type: "StringValue",
      value,
      loc,
    };
  }

  private buildBodyChoiceInstruction(statement: TzrChoiceStatement): BodyChoiceInstruction {
    return {
      type: "BodyChoiceInstruction",
      question: statement.question,
      items: statement.items.map((item) => this.buildBodyChoiceInstructionItem(item)),
      loc: statement.loc,
    };
  }

  private buildBodyChoiceInstructionItem(item: TzrChoiceItem): BodyChoiceInstructionItem {
    return {
      label: item.label,
      ...(item.id === undefined ? {} : { id: item.id }),
      ...(item.condition === undefined ? {} : { condition: item.condition }),
      body: this.buildSceneBodyInstructions(item.body),
      loc: item.loc,
    };
  }

  private compilePlainTextBlock(
    statement: TzrNarrationStatement | TzrDialogueStatement,
  ): readonly TextLine[] | undefined {
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

  private compilePlainTextBlockItem(item: TzrTextBlockItem): TextLine | undefined {
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

  private compilePlainTextLine(line: TzrTextLine): TextLine | undefined {
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

  private buildMetadata(): TzrDocumentMetadata {
    const characters: Record<string, TzrCompiledCharacter> = {};
    const scenes: Record<string, TzrCompiledSceneMetadata> = {};

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

  private validateCompiledPluginCommands(instructions: readonly TzrInstruction[]): void {
    if (this.pluginCommands === undefined) {
      return;
    }

    for (const instruction of instructions) {
      switch (instruction.type) {
        case "CommandInstruction":
          this.validateCompiledPluginCommand(instruction);
          break;
        case "IfInstruction":
          this.validateCompiledPluginCommands(instruction.thenBranch);
          for (const branch of instruction.elifBranches) {
            this.validateCompiledPluginCommands(branch.body);
          }
          if (instruction.elseBranch !== undefined) {
            this.validateCompiledPluginCommands(instruction.elseBranch);
          }
          break;
        case "BodyChoiceInstruction":
          for (const item of instruction.items) {
            this.validateCompiledPluginCommands(item.body);
          }
          break;
        default:
          break;
      }
    }
  }

  private validateCompiledPluginCommand(instruction: CommandInstruction): void {
    if (
      isCoreCommandName(instruction.name) ||
      instruction.name === DSL_ADD_COMMAND_NAME ||
      instruction.name === DSL_SET_REFERENCE_COMMAND_NAME
    ) {
      return;
    }

    const command = this.pluginCommands?.get(instruction.name);
    if (command === undefined) {
      this.addError(instruction.loc.start, `Unknown plugin command "${instruction.name}".`);
      return;
    }

    for (const diagnostic of validatePluginCommandArguments(command, instruction.args, instruction.loc.start)) {
      this.addError(diagnostic.location, diagnostic.message);
    }
  }

  private addError(location: SourceLocation, message: string): void {
    this.errors.push(createDiagnostic(location, message, this.sourceLine(location)));
  }

  private documentStartLocation(): SourceLocation {
    return {
      filePath: this.document.filePath,
      line: 1,
      column: 1,
    };
  }

  private sourceLine(location: SourceLocation): string {
    const sourceLines = this.document.sourceLineMap?.[location.filePath] ?? this.document.sourceLines;
    return sourceLines[location.line - 1] ?? "";
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
