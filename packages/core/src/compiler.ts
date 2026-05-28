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
  TzrStdCameraStatement,
  TzrStdEffectStatement,
  TzrStdHotspotStatement,
  TzrStdParticleStatement,
  TzrStopBgmStatement,
  TzrStopTextSoundStatement,
  TzrTextBlockItem,
  TzrTextLine,
  TzrTextSoundStatement,
  TzrTitleDeclaration,
  TzrValueExpression,
  TzrVisualAssetRef,
  TzrVisualTransition,
  TzrVoiceStatement,
  TzrWaitStatement,
} from "./scenario-ast.js";

const DSL_ADD_COMMAND_NAME = "__tsuzuru_add";
const DSL_SET_REFERENCE_COMMAND_NAME = "__tsuzuru_set_reference";
const STD_EFFECT_HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const STD_TRANSITION_DIRECTIONS = ["left", "right", "up", "down"] as const;
type StdVisualBackgroundTransitionEffect = Extract<
  TzrVisualTransition["name"],
  "fade" | "pageTurn" | "blurFade" | "slide" | "wipeLeft" | "wipeRight"
>;

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
        case "TextSoundStatement":
          instructions.push(this.buildTextSoundInstruction(statement));
          break;
        case "StopTextSoundStatement":
          instructions.push(this.buildStopTextSoundInstruction(statement));
          break;
        case "StdEffectStatement":
          instructions.push(...this.buildStdEffectInstruction(statement));
          break;
        case "StdCameraStatement":
          instructions.push(...this.buildStdCameraInstruction(statement));
          break;
        case "StdParticleStatement":
          instructions.push(...this.buildStdParticleInstruction(statement));
          break;
        case "StdHotspotStatement":
          instructions.push(...this.buildStdHotspotInstruction(statement));
          break;
        default:
          assertUnreachableSceneStatement(statement);
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
    const transitionArgs = this.backgroundTransitionArguments(statement.transition);
    if (transitionArgs === undefined) {
      return [];
    }

    return [
      {
        type: "CommandInstruction",
        name: "bg",
        args: [
          this.positionalArgument(
            this.stringValue(this.visualAssetRefValue(statement.assetRef), statement.assetRef.loc),
            statement.assetRef.loc,
          ),
          ...transitionArgs,
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

  private backgroundTransitionArguments(
    transition: TzrVisualTransition | undefined,
  ): readonly TzrArgument[] | undefined {
    if (transition === undefined) {
      return [];
    }
    if (!isBackgroundTransitionEffect(transition.name)) {
      this.addError(transition.nameLoc.start, `Unknown visual transition "${transition.name}".`);
      return undefined;
    }
    return this.buildBackgroundTransitionCommandArguments(
      transition.name,
      transition.nameLoc,
      transition.args,
      transition.loc,
    );
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

  private buildTextSoundInstruction(statement: TzrTextSoundStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: "textSound",
      args: [
        this.positionalArgument(
          this.stringValue(this.audioAssetRefValue(statement.assetRef), statement.assetRef.loc),
          statement.assetRef.loc,
        ),
      ],
      loc: statement.loc,
    };
  }

  private buildStopTextSoundInstruction(statement: TzrStopTextSoundStatement): CommandInstruction {
    return {
      type: "CommandInstruction",
      name: "stopTextSound",
      args: [],
      loc: statement.loc,
    };
  }

  private buildStdEffectInstruction(statement: TzrStdEffectStatement): readonly CommandInstruction[] {
    this.validateStdEffectSugar(statement);

    return [
      {
        type: "CommandInstruction",
        name: statement.name,
        args: statement.args,
        loc: statement.loc,
      },
    ];
  }

  private buildStdCameraInstruction(statement: TzrStdCameraStatement): readonly CommandInstruction[] {
    this.validateStdCameraSugar(statement);

    return [
      {
        type: "CommandInstruction",
        name: statement.name,
        args: statement.args,
        loc: statement.loc,
      },
    ];
  }

  private buildStdParticleInstruction(statement: TzrStdParticleStatement): readonly CommandInstruction[] {
    return [
      {
        type: "CommandInstruction",
        name: statement.name,
        args: statement.args,
        loc: statement.loc,
      },
    ];
  }

  private buildStdHotspotInstruction(statement: TzrStdHotspotStatement): readonly CommandInstruction[] {
    this.validateStdHotspotSugar(statement);

    return [
      {
        type: "CommandInstruction",
        name: statement.name,
        args: statement.args,
        loc: statement.loc,
      },
    ];
  }

  private validateStdEffectSugar(statement: TzrStdEffectStatement): void {
    if (statement.name !== "flash") {
      return;
    }

    const color = statement.args.find((arg) => arg.type === "NamedArgument" && arg.name === "color");
    if (color?.type !== "NamedArgument" || color.value.type !== "StringValue") {
      return;
    }

    if (!STD_EFFECT_HEX_COLOR_PATTERN.test(color.value.value)) {
      this.addError(color.value.loc.start, "flash color must be a HEX color literal.");
    }
  }

  private buildBackgroundTransitionCommandArguments(
    effect: StdVisualBackgroundTransitionEffect,
    effectLoc: SourceRange,
    args: readonly TzrNamedArgument[],
    loc: SourceRange,
  ): readonly TzrArgument[] | undefined {
    let ok = true;
    let durationMs = defaultBackgroundTransitionDuration(effect);
    let direction: (typeof STD_TRANSITION_DIRECTIONS)[number] | undefined;
    let color: string | undefined;
    const seen = new Set<string>();

    for (const arg of args) {
      if (seen.has(arg.name)) {
        this.addError(arg.loc.start, `Duplicate transition argument "${arg.name}".`);
        ok = false;
        continue;
      }
      seen.add(arg.name);

      switch (arg.name) {
        case "duration":
          if (arg.value.type !== "NumberValue" || !Number.isInteger(arg.value.value) || arg.value.value <= 0) {
            this.addError(arg.value.loc.start, "transition duration must be a positive integer.");
            ok = false;
            continue;
          }
          durationMs = arg.value.value;
          break;
        case "direction":
          if (arg.value.type !== "StringValue" || !isBackgroundTransitionDirection(effect, arg.value.value)) {
            this.addError(arg.value.loc.start, backgroundTransitionDirectionError(effect));
            ok = false;
            continue;
          }
          direction = arg.value.value;
          break;
        case "color":
          if (arg.value.type !== "StringValue") {
            this.addError(arg.value.loc.start, "transition color must be a string.");
            ok = false;
            continue;
          }
          color = arg.value.value;
          break;
        default:
          this.addError(arg.loc.start, `Unsupported transition argument "${arg.name}".`);
          ok = false;
          break;
      }
    }

    if (!ok) {
      return undefined;
    }

    const normalized: TzrArgument[] = [
      this.namedArgument("transition", this.stringValue(effect, effectLoc), effectLoc),
      this.namedArgument("duration", { type: "NumberValue", value: durationMs, loc }, loc),
    ];

    const normalizedDirection = usesBackgroundTransitionDirection(effect) ? (direction ?? "left") : direction;
    if (normalizedDirection !== undefined) {
      normalized.push(this.namedArgument("direction", this.stringValue(normalizedDirection, loc), loc));
    }

    const normalizedColor = color ?? defaultBackgroundTransitionColor(effect);
    if (normalizedColor !== undefined) {
      normalized.push(this.namedArgument("color", this.stringValue(normalizedColor, loc), loc));
    }

    return normalized;
  }

  private validateStdCameraSugar(statement: TzrStdCameraStatement): void {
    if (statement.name === "camera" && !hasAnyNamedArgument(statement.args, ["x", "y", "zoom"])) {
      this.addError(statement.loc.start, "camera statement requires at least one of x, y, or zoom.");
    }

    if (statement.name === "resetCamera") {
      return;
    }

    const zoom = findNamedArgument(statement.args, "zoom");
    if (zoom?.value.type === "NumberValue" && zoom.value.value <= 0) {
      this.addError(zoom.value.loc.start, "camera zoom must be greater than 0.");
    }
  }

  private validateStdHotspotSugar(statement: TzrStdHotspotStatement): void {
    if (statement.name !== "hotspot") {
      return;
    }

    const id = statement.args[0];
    if (id?.type !== "PositionalArgument" || id.value.type !== "StringValue" || id.value.value.length === 0) {
      this.addError(statement.loc.start, "hotspot id must not be empty.");
    }

    const target = findNamedArgument(statement.args, "target");
    if (target?.value.type !== "StringValue" || target.value.value.length === 0) {
      this.addError(target?.loc.start ?? statement.loc.start, "hotspot jump target must not be empty.");
    } else {
      this.validateJumpTarget(target.value.value, target.value.loc.start);
    }

    for (const name of ["x", "y", "width", "height"] as const) {
      const arg = findNamedArgument(statement.args, name);
      if (arg?.value.type !== "NumberValue") {
        continue;
      }
      if (!Number.isFinite(arg.value.value)) {
        this.addError(arg.value.loc.start, `hotspot ${name} must be a finite number.`);
      }
    }

    const x = findNamedArgument(statement.args, "x");
    if (x?.value.type === "NumberValue" && x.value.value < 0) {
      this.addError(x.value.loc.start, "hotspot x must be 0 or greater.");
    }
    const y = findNamedArgument(statement.args, "y");
    if (y?.value.type === "NumberValue" && y.value.value < 0) {
      this.addError(y.value.loc.start, "hotspot y must be 0 or greater.");
    }
    const width = findNamedArgument(statement.args, "width");
    if (width?.value.type === "NumberValue" && width.value.value <= 0) {
      this.addError(width.value.loc.start, "hotspot width must be greater than 0.");
    }
    const height = findNamedArgument(statement.args, "height");
    if (height?.value.type === "NumberValue" && height.value.value <= 0) {
      this.addError(height.value.loc.start, "hotspot height must be greater than 0.");
    }
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

function assertUnreachableSceneStatement(_statement: never): void {
  // This switch should stay exhaustive as supported scene statements evolve.
}

function findNamedArgument(
  args: readonly TzrArgument[],
  name: string,
): Extract<TzrArgument, { readonly type: "NamedArgument" }> | undefined {
  return args.find((arg): arg is Extract<TzrArgument, { readonly type: "NamedArgument" }> => {
    return arg.type === "NamedArgument" && arg.name === name;
  });
}

function hasAnyNamedArgument(args: readonly TzrArgument[], names: readonly string[]): boolean {
  return names.some((name) => findNamedArgument(args, name) !== undefined);
}

function defaultBackgroundTransitionColor(effect: StdVisualBackgroundTransitionEffect): string | undefined {
  switch (effect) {
    case "fade":
    case "blurFade":
    case "slide":
    case "wipeLeft":
    case "wipeRight":
      return "#000000";
    case "pageTurn":
      return "#ffffff";
  }
}

function defaultBackgroundTransitionDuration(effect: StdVisualBackgroundTransitionEffect): number {
  switch (effect) {
    case "fade":
      return 500;
    case "pageTurn":
      return 800;
    case "blurFade":
      return 700;
    case "slide":
      return 650;
    case "wipeLeft":
    case "wipeRight":
      return 450;
  }
}

function usesBackgroundTransitionDirection(effect: StdVisualBackgroundTransitionEffect): boolean {
  return effect === "pageTurn" || effect === "slide";
}

function isBackgroundTransitionEffect(value: string): value is StdVisualBackgroundTransitionEffect {
  return (
    value === "fade" ||
    value === "pageTurn" ||
    value === "blurFade" ||
    value === "slide" ||
    value === "wipeLeft" ||
    value === "wipeRight"
  );
}

function isBackgroundTransitionDirection(
  effect: StdVisualBackgroundTransitionEffect,
  value: string,
): value is (typeof STD_TRANSITION_DIRECTIONS)[number] {
  if (!STD_TRANSITION_DIRECTIONS.includes(value as (typeof STD_TRANSITION_DIRECTIONS)[number])) {
    return false;
  }
  if (effect === "wipeLeft" || effect === "wipeRight") {
    return false;
  }
  return effect !== "pageTurn" || value === "left" || value === "right";
}

function backgroundTransitionDirectionError(effect: StdVisualBackgroundTransitionEffect): string {
  if (effect === "pageTurn") {
    return 'pageTurn direction must be "left" or "right".';
  }
  if (effect === "wipeLeft" || effect === "wipeRight") {
    return `${effect} direction is not supported.`;
  }
  return 'transition direction must be "left", "right", "up", or "down".';
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
