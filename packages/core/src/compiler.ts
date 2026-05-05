import type {
  ChoiceBlock,
  CommandStatement,
  IfBlock,
  JumpTarget,
  LabelDeclaration,
  NamedArgument,
  SceneDeclaration,
  TzrDocument,
  TzrStatement,
  TzrValue,
} from "./ast.js";
import { isCoreCommandName, type CoreCommandName } from "./commands.js";
import { createDiagnostic, type Diagnostic } from "./diagnostic.js";
import type { CommandInstruction, CompiledTzrDocument, DeclarationIndexEntry, TzrInstruction } from "./ir.js";
import { expandMacro, type MacroMap } from "./macro.js";

export type CompileResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export interface CompileOptions {
  readonly macros?: MacroMap;
  readonly pluginCommands?: PluginCommandMap;
}

export interface PluginCommandDefinition {
  readonly name: string;
  readonly args?: PluginCommandArgumentSchema;
}

export type PluginCommandMap = Readonly<Record<string, PluginCommandDefinition>>;

export type PluginCommandValueType = "string" | "number" | "boolean" | "identifier";

export interface PluginCommandArgumentDefinition {
  readonly type: PluginCommandValueType | readonly PluginCommandValueType[];
  readonly optional?: boolean;
  readonly nonEmpty?: boolean;
  readonly values?: readonly string[];
}

export interface PluginCommandPositionalArgumentDefinition extends PluginCommandArgumentDefinition {
  readonly name?: string;
}

export interface PluginCommandNamedArgumentDefinition extends PluginCommandArgumentDefinition {
  readonly name: string;
}

export type PluginCommandArgumentSchema =
  | {
      readonly kind: "none";
    }
  | {
      readonly kind: "positional";
      readonly arguments: readonly PluginCommandPositionalArgumentDefinition[];
    }
  | {
      readonly kind: "mixed";
      readonly positional: readonly PluginCommandPositionalArgumentDefinition[];
      readonly named: readonly PluginCommandNamedArgumentDefinition[];
    }
  | {
      readonly kind: "named";
      readonly arguments: readonly PluginCommandNamedArgumentDefinition[];
    };

export function definePluginCommand(
  name: string,
  args?: PluginCommandArgumentSchema,
): PluginCommandDefinition {
  return args === undefined ? { name } : { name, args };
}

export function compileTzr(document: TzrDocument, options: CompileOptions = {}): CompileResult {
  const compiler = new TzrCompiler(document, options);
  return compiler.compile();
}

class TzrCompiler {
  private readonly errors: Diagnostic[] = [];
  private readonly labels = new Map<string, LabelDeclaration>();
  private readonly scenes = new Map<string, SceneDeclaration>();
  private readonly invalidPluginCommandNames = new Set<string>();

  public constructor(
    private readonly document: TzrDocument,
    private readonly options: CompileOptions,
  ) {}

  public compile(): CompileResult {
    this.validatePluginCommandRegistry();
    this.collectDeclarations();
    this.validateDeclarationPlacement();
    this.validateTargets();

    const compiled = this.buildCompiledDocument();
    this.validateCompiledInstructions(compiled.instructions);

    return this.errors.length > 0 ? { ok: false, errors: this.errors } : { ok: true, document: compiled, errors: [] };
  }

  private validatePluginCommandRegistry(): void {
    const pluginCommands = this.options.pluginCommands;
    if (pluginCommands === undefined) {
      return;
    }

    for (const [key, definition] of Object.entries(pluginCommands)) {
      if (definition.name !== key) {
        this.addError(
          this.documentStartLocation(),
          `Plugin command registry key "${key}" does not match definition name "${definition.name}".`,
        );
        this.invalidPluginCommandNames.add(key);
        continue;
      }

      this.validatePluginCommandSchemaDefinition(definition);
    }
  }

  private validatePluginCommandSchemaDefinition(definition: PluginCommandDefinition): void {
    const schema = definition.args;
    if (schema === undefined) {
      return;
    }

    switch (schema.kind) {
      case "none":
        return;
      case "named":
        this.validatePluginNamedSchemaDefinition(definition.name, schema.arguments);
        return;
      case "positional":
        this.validatePluginPositionalSchemaDefinition(definition.name, schema.arguments);
        return;
      case "mixed":
        this.validatePluginPositionalSchemaDefinition(definition.name, schema.positional);
        this.validatePluginNamedSchemaDefinition(definition.name, schema.named);
        return;
    }
  }

  private validatePluginNamedSchemaDefinition(
    commandName: string,
    definitions: readonly PluginCommandNamedArgumentDefinition[],
  ): void {
    const seen = new Set<string>();

    for (const definition of definitions) {
      if (seen.has(definition.name)) {
        this.invalidPluginCommandNames.add(commandName);
        this.addError(
          this.documentStartLocation(),
          `Plugin command "@${commandName}" has duplicate argument definition "${definition.name}".`,
        );
        continue;
      }

      seen.add(definition.name);
    }
  }

  private validatePluginPositionalSchemaDefinition(
    commandName: string,
    definitions: readonly PluginCommandPositionalArgumentDefinition[],
  ): void {
    let hasOptionalArgument = false;

    for (const definition of definitions) {
      if (definition.optional === true) {
        hasOptionalArgument = true;
        continue;
      }

      if (hasOptionalArgument) {
        this.invalidPluginCommandNames.add(commandName);
        this.addError(
          this.documentStartLocation(),
          `Plugin command "@${commandName}" has required positional argument after optional argument.`,
        );
        return;
      }
    }
  }

  private collectDeclarations(): void {
    for (const statement of this.document.body) {
      if (statement.type === "SceneDeclaration") {
        this.collectScene(statement);
      }
      if (statement.type === "LabelDeclaration") {
        this.collectLabel(statement);
      }
    }
  }

  private collectScene(scene: SceneDeclaration): void {
    const existing = this.scenes.get(scene.id);
    if (existing !== undefined) {
      this.addError(scene.loc.start, `Duplicate scene "${scene.id}".`);
      return;
    }
    this.scenes.set(scene.id, scene);
  }

  private collectLabel(label: LabelDeclaration): void {
    const existing = this.labels.get(label.id);
    if (existing !== undefined) {
      this.addError(label.loc.start, `Duplicate label "#${label.id}".`);
      return;
    }
    this.labels.set(label.id, label);
  }

  private validateTargets(): void {
    this.validateTargetsIn(this.document.body);
  }

  private validateDeclarationPlacement(): void {
    for (const statement of this.document.body) {
      if (statement.type === "IfBlock") {
        this.validateIfDeclarationPlacement(statement);
      }
    }
  }

  private validateIfDeclarationPlacement(ifBlock: IfBlock): void {
    this.validateBranchDeclarationPlacement(ifBlock.thenBranch);
    if (ifBlock.elseBranch !== undefined) {
      this.validateBranchDeclarationPlacement(ifBlock.elseBranch);
    }
  }

  private validateBranchDeclarationPlacement(statements: readonly TzrStatement[]): void {
    for (const statement of statements) {
      if (statement.type === "SceneDeclaration") {
        this.addError(statement.loc.start, "#scene declarations must be top-level.");
      }
      if (statement.type === "LabelDeclaration") {
        this.addError(statement.loc.start, "#label declarations must be top-level.");
      }
      if (statement.type === "IfBlock") {
        this.validateIfDeclarationPlacement(statement);
      }
    }
  }

  private validateTargetsIn(statements: readonly TzrStatement[]): void {
    for (const statement of statements) {
      if (statement.type === "CommandStatement") {
        this.validateCommandTarget(statement);
      }
      if (statement.type === "ChoiceBlock") {
        this.validateChoiceTargets(statement);
      }
      if (statement.type === "IfBlock") {
        this.validateIfTargets(statement);
      }
    }
  }

  private validateIfTargets(ifBlock: IfBlock): void {
    this.validateTargetsIn(ifBlock.thenBranch);
    if (ifBlock.elseBranch !== undefined) {
      this.validateTargetsIn(ifBlock.elseBranch);
    }
  }

  private validateCommandTarget(command: CommandStatement): void {
    if (command.name !== "jump" || command.jumpTarget === undefined) {
      return;
    }

    this.validateTarget(command.jumpTarget);
  }

  private validateChoiceTargets(choice: ChoiceBlock): void {
    for (const item of choice.items) {
      this.validateTarget(item.target);
    }
  }

  private validateCompiledInstructions(instructions: readonly TzrInstruction[]): void {
    for (const instruction of instructions) {
      if (instruction.type === "CommandInstruction") {
        this.validateCommandRegistration(instruction);
        this.validateCoreCommandArguments(instruction);
        this.validatePluginCommandArguments(instruction);
      }
      if (instruction.type === "IfInstruction") {
        this.validateCompiledInstructions(instruction.thenBranch);
        if (instruction.elseBranch !== undefined) {
          this.validateCompiledInstructions(instruction.elseBranch);
        }
      }
    }
  }

  private validateCommandRegistration(command: CommandInstruction): void {
    if (isCoreCommandName(command.name)) {
      return;
    }

    if (!this.hasRegisteredPluginCommand(command.name)) {
      this.addError(command.loc.start, `Unknown command "@${command.name}".`);
    }
  }

  private hasRegisteredPluginCommand(name: string): boolean {
    const pluginCommand = this.options.pluginCommands?.[name];
    return pluginCommand !== undefined && pluginCommand.name === name && !this.invalidPluginCommandNames.has(name);
  }

  private validateCoreCommandArguments(command: CommandInstruction): void {
    if (!isCoreCommandName(command.name)) {
      return;
    }

    const name = command.name;
    switch (name) {
      case "jump":
        this.validateSinglePositionalArgument(command, name, "StringValue", "string");
        return;
      case "wait":
        this.validateSinglePositionalArgument(command, name, "NumberValue", "number");
        return;
      case "waitClick":
      case "page":
      case "stop":
        this.validateNoArguments(command, name);
        return;
      case "set":
        this.validateSetArguments(command);
        return;
      case "inc":
      case "dec":
        this.validateIncrementArguments(command, name);
        return;
      case "flag":
      case "unflag":
        this.validateSinglePositionalArgument(command, name, "StringValue", "string");
        return;
    }
  }

  private validatePluginCommandArguments(command: CommandInstruction): void {
    if (isCoreCommandName(command.name)) {
      return;
    }

    const definition = this.options.pluginCommands?.[command.name];
    if (
      definition === undefined ||
      definition.name !== command.name ||
      this.invalidPluginCommandNames.has(command.name) ||
      definition.args === undefined
    ) {
      return;
    }

    switch (definition.args.kind) {
      case "none":
        this.validatePluginNoArguments(command);
        return;
      case "positional":
        this.validatePluginPositionalArguments(command, definition.args.arguments);
        return;
      case "named":
        this.validatePluginNamedArguments(command, definition.args.arguments);
        return;
      case "mixed":
        this.validatePluginMixedArguments(command, definition.args.positional, definition.args.named);
        return;
    }
  }

  private validatePluginNoArguments(command: CommandInstruction): void {
    if (command.args.length > 0) {
      this.addError(command.loc.start, `@${command.name} expects no arguments.`);
    }
  }

  private validatePluginPositionalArguments(
    command: CommandInstruction,
    definitions: readonly PluginCommandPositionalArgumentDefinition[],
  ): void {
    for (const argument of command.args) {
      if (argument.type !== "PositionalArgument") {
        this.addError(argument.loc.start, `@${command.name} expects only positional arguments.`);
      }
    }

    for (const [index, definition] of definitions.entries()) {
      const argument = command.args[index];
      if (argument === undefined) {
        if (definition.optional !== true) {
          this.addError(command.loc.start, `@${command.name} requires positional argument ${index + 1}.`);
        }
        continue;
      }

      if (argument.type !== "PositionalArgument") {
        continue;
      }

      this.validatePluginValueType(command.name, argument.value, definition, `positional argument ${index + 1}`);
    }

    if (command.args.length > definitions.length) {
      for (const argument of command.args.slice(definitions.length)) {
        this.addError(argument.loc.start, `@${command.name} does not allow extra positional arguments.`);
      }
    }
  }

  private validatePluginNamedArguments(
    command: CommandInstruction,
    definitions: readonly PluginCommandNamedArgumentDefinition[],
  ): void {
    const definitionByName = new Map(definitions.map((definition) => [definition.name, definition]));
    const seen = new Set<string>();

    for (const argument of command.args) {
      if (argument.type !== "NamedArgument") {
        this.addError(argument.loc.start, `@${command.name} expects only named arguments.`);
        continue;
      }

      const definition = definitionByName.get(argument.name);
      if (definition === undefined) {
        this.addError(argument.loc.start, `@${command.name} does not allow argument "${argument.name}".`);
        continue;
      }

      if (seen.has(argument.name)) {
        this.addError(argument.loc.start, `@${command.name} has duplicate argument "${argument.name}".`);
        continue;
      }

      seen.add(argument.name);
      this.validatePluginValueType(command.name, argument.value, definition, `argument "${argument.name}"`);
    }

    for (const definition of definitions) {
      if (definition.optional !== true && !seen.has(definition.name)) {
        this.addError(command.loc.start, `@${command.name} requires a named "${definition.name}" argument.`);
      }
    }
  }

  private validatePluginMixedArguments(
    command: CommandInstruction,
    positionalDefinitions: readonly PluginCommandPositionalArgumentDefinition[],
    namedDefinitions: readonly PluginCommandNamedArgumentDefinition[],
  ): void {
    const positionalArguments = command.args.filter((argument) => argument.type === "PositionalArgument");
    const namedArguments = command.args.filter((argument) => argument.type === "NamedArgument");

    for (const [index, definition] of positionalDefinitions.entries()) {
      const argument = positionalArguments[index];
      if (argument === undefined) {
        if (definition.optional !== true) {
          this.addError(command.loc.start, `@${command.name} requires positional argument ${index + 1}.`);
        }
        continue;
      }

      this.validatePluginValueType(command.name, argument.value, definition, `positional argument ${index + 1}`);
    }

    if (positionalArguments.length > positionalDefinitions.length) {
      for (const argument of positionalArguments.slice(positionalDefinitions.length)) {
        this.addError(argument.loc.start, `@${command.name} does not allow extra positional arguments.`);
      }
    }

    const definitionByName = new Map(namedDefinitions.map((definition) => [definition.name, definition]));
    const seen = new Set<string>();

    for (const argument of namedArguments) {
      const definition = definitionByName.get(argument.name);
      if (definition === undefined) {
        this.addError(argument.loc.start, `@${command.name} does not allow argument "${argument.name}".`);
        continue;
      }

      if (seen.has(argument.name)) {
        this.addError(argument.loc.start, `@${command.name} has duplicate argument "${argument.name}".`);
        continue;
      }

      seen.add(argument.name);
      this.validatePluginValueType(command.name, argument.value, definition, `argument "${argument.name}"`);
    }

    for (const definition of namedDefinitions) {
      if (definition.optional !== true && !seen.has(definition.name)) {
        this.addError(command.loc.start, `@${command.name} requires a named "${definition.name}" argument.`);
      }
    }
  }

  private validatePluginValueType(
    commandName: string,
    value: TzrValue,
    expected: PluginCommandValueType | readonly PluginCommandValueType[] | PluginCommandArgumentDefinition,
    argumentLabel: string,
  ): void {
    const expectedTypes = isPluginCommandArgumentDefinition(expected) ? expected.type : expected;
    const allowedTypes = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    if (!allowedTypes.includes(toPluginValueType(value))) {
      this.addError(value.loc.start, `@${commandName} ${argumentLabel} must be ${formatPluginValueTypes(allowedTypes)}.`);
      return;
    }

    if (!isPluginCommandArgumentDefinition(expected) || value.type !== "StringValue") {
      return;
    }

    if (expected.nonEmpty === true && value.value.length === 0) {
      this.addError(value.loc.start, `@${commandName} ${argumentLabel} must be a non-empty string.`);
      return;
    }

    if (expected.values !== undefined && !expected.values.includes(value.value)) {
      this.addError(value.loc.start, `@${commandName} ${argumentLabel} must be one of ${formatStringValues(expected.values)}.`);
    }
  }

  private validateSinglePositionalArgument(
    command: CommandInstruction,
    name: CoreCommandName,
    expectedType: TzrValue["type"],
    expectedLabel: "number" | "string",
  ): void {
    if (command.args.length !== 1) {
      this.addError(command.loc.start, `@${name} expects exactly 1 positional ${expectedLabel} argument.`);
      return;
    }

    const argument = command.args[0];
    if (argument === undefined || argument.type !== "PositionalArgument") {
      this.addError(command.loc.start, `@${name} expects exactly 1 positional ${expectedLabel} argument.`);
      return;
    }

    if (argument.value.type !== expectedType) {
      this.addError(argument.value.loc.start, `@${name} expects a ${expectedLabel} argument.`);
    }
  }

  private validateNoArguments(command: CommandInstruction, name: CoreCommandName): void {
    if (command.args.length > 0) {
      this.addError(command.loc.start, `@${name} expects no arguments.`);
    }
  }

  private validateSetArguments(command: CommandInstruction): void {
    const named = this.validateNamedOnlyArguments(command, "set", ["name", "value"]);
    const name = named.get("name");
    const value = named.get("value");

    if (name === undefined) {
      this.addError(command.loc.start, '@set requires a named "name" argument.');
    } else {
      this.validateNamedValueType("set", name, ["StringValue"], "string");
    }

    if (value === undefined) {
      this.addError(command.loc.start, '@set requires a named "value" argument.');
    } else {
      this.validateNamedValueType("set", value, ["StringValue", "NumberValue", "BooleanValue"], "string, number, or boolean");
    }
  }

  private validateIncrementArguments(command: CommandInstruction, name: "inc" | "dec"): void {
    const named = this.validateNamedOnlyArguments(command, name, ["name", "by"]);
    const variableName = named.get("name");
    const by = named.get("by");

    if (variableName === undefined) {
      this.addError(command.loc.start, `@${name} requires a named "name" argument.`);
    } else {
      this.validateNamedValueType(name, variableName, ["StringValue"], "string");
    }

    if (by === undefined) {
      this.addError(command.loc.start, `@${name} requires a named "by" argument.`);
    } else {
      this.validateNamedValueType(name, by, ["NumberValue"], "number");
    }
  }

  private validateNamedOnlyArguments(
    command: CommandInstruction,
    name: CoreCommandName,
    allowedNames: readonly string[],
  ): ReadonlyMap<string, NamedArgument> {
    const allowed = new Set(allowedNames);
    const named = new Map<string, NamedArgument>();

    for (const argument of command.args) {
      if (argument.type !== "NamedArgument") {
        this.addError(argument.loc.start, `@${name} expects only named arguments: ${allowedNames.join(", ")}.`);
        continue;
      }

      if (!allowed.has(argument.name)) {
        this.addError(argument.loc.start, `@${name} does not allow argument "${argument.name}".`);
        continue;
      }

      if (named.has(argument.name)) {
        this.addError(argument.loc.start, `@${name} has duplicate argument "${argument.name}".`);
        continue;
      }

      named.set(argument.name, argument);
    }

    return named;
  }

  private validateNamedValueType(
    commandName: CoreCommandName,
    argument: NamedArgument,
    allowedTypes: readonly TzrValue["type"][],
    expectedLabel: string,
  ): void {
    if (!allowedTypes.includes(argument.value.type)) {
      this.addError(argument.value.loc.start, `@${commandName} argument "${argument.name}" must be ${expectedLabel}.`);
    }
  }

  private validateTarget(target: JumpTarget): void {
    if (target.raw.length === 0) {
      this.addError(target.loc.start, "Jump target must not be empty.");
      return;
    }

    if (countHashes(target.raw) > 1) {
      this.addError(target.loc.start, 'Jump target must contain at most one "#".');
      return;
    }

    if (target.raw.includes("#") && (target.label === undefined || target.label.length === 0)) {
      this.addError(target.loc.start, "Jump target must include a label after #.");
      return;
    }

    if (target.file !== undefined) {
      return;
    }

    if (target.label === undefined || target.label.length === 0) {
      this.addError(target.loc.start, "Jump target must include a label.");
      return;
    }

    if (!this.labels.has(target.label)) {
      this.addError(target.loc.start, `Unknown label "#${target.label}".`);
    }
  }

  private addError(location: { readonly filePath: string; readonly line: number; readonly column: number }, message: string): void {
    this.errors.push(createDiagnostic(location, message, this.sourceLine(location.line)));
  }

  private documentStartLocation(): { readonly filePath: string; readonly line: number; readonly column: number } {
    return {
      filePath: this.document.filePath,
      line: 1,
      column: 1,
    };
  }

  private sourceLine(line: number): string {
    return this.document.sourceLines[line - 1] ?? "";
  }

  private buildCompiledDocument(): CompiledTzrDocument {
    const instructions = this.buildInstructions(this.document.body);
    const indexes = buildDeclarationIndexes(instructions);
    return {
      type: "CompiledTzrDocument",
      filePath: this.document.filePath,
      body: this.document.body,
      instructions,
      labels: indexes.labels,
      scenes: indexes.scenes,
    };
  }

  private buildInstructions(statements: readonly TzrStatement[]): readonly TzrInstruction[] {
    return statements.flatMap((statement) => this.toInstructions(statement));
  }

  private toInstructions(statement: TzrStatement): readonly TzrInstruction[] {
    const instruction = toInstruction(statement, (statements) => this.buildInstructions(statements));

    if (instruction.type !== "MacroInstruction") {
      return [instruction];
    }

    const macro = this.options.macros?.[instruction.name];
    if (macro === undefined) {
      this.addError(instruction.loc.start, `Unknown macro "$${instruction.name}".`);
      return [];
    }

    const expanded = expandMacro(macro, instruction, { filePath: this.document.filePath });
    return this.validateMacroExpansion(instruction, expanded);
  }

  private validateMacroExpansion(
    macro: TzrInstruction & { readonly type: "MacroInstruction" },
    instructions: readonly TzrInstruction[],
  ): readonly TzrInstruction[] {
    const accepted: TzrInstruction[] = [];

    for (const instruction of instructions) {
      if (isForbiddenMacroInstruction(instruction)) {
        this.addError(macro.loc.start, `Macro "$${macro.name}" returned forbidden instruction "${instruction.type}".`);
        continue;
      }

      if (instruction.type === "CommandInstruction" && instruction.name === "jump") {
        this.addError(macro.loc.start, `Macro "$${macro.name}" must not return @jump commands.`);
        continue;
      }

      accepted.push(instruction);
    }

    return accepted;
  }
}

interface DeclarationIndexes {
  readonly labels: Readonly<Record<string, DeclarationIndexEntry>>;
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
}

function toInstruction(
  statement: TzrStatement,
  buildNestedInstructions: (statements: readonly TzrStatement[]) => readonly TzrInstruction[],
): TzrInstruction {
  switch (statement.type) {
    case "SceneDeclaration":
      return {
        type: "SceneInstruction",
        id: statement.id,
        loc: statement.loc,
      };
    case "LabelDeclaration":
      return {
        type: "LabelInstruction",
        id: statement.id,
        loc: statement.loc,
      };
    case "NarrationBlock":
      return {
        type: "NarrationInstruction",
        lines: statement.lines,
        loc: statement.loc,
      };
    case "SpeakerBlock":
      return {
        type: "DialogueInstruction",
        speaker: statement.speaker,
        lines: statement.lines,
        loc: statement.loc,
      };
    case "CommandStatement":
      return {
        type: "CommandInstruction",
        name: statement.name,
        args: statement.args,
        ...(statement.jumpTarget === undefined ? {} : { jumpTarget: statement.jumpTarget }),
        loc: statement.loc,
      };
    case "MacroStatement":
      return {
        type: "MacroInstruction",
        name: statement.name,
        args: statement.args,
        loc: statement.loc,
      };
    case "ChoiceBlock":
      return {
        type: "ChoiceInstruction",
        question: statement.question,
        items: statement.items,
        loc: statement.loc,
      };
    case "IfBlock":
      return {
        type: "IfInstruction",
        condition: statement.condition,
        conditionExpression: statement.conditionExpression,
        thenBranch: buildNestedInstructions(statement.thenBranch),
        ...(statement.elseBranch === undefined ? {} : { elseBranch: buildNestedInstructions(statement.elseBranch) }),
        loc: statement.loc,
      };
  }
}

function isForbiddenMacroInstruction(instruction: TzrInstruction): boolean {
  return (
    instruction.type === "SceneInstruction" ||
    instruction.type === "LabelInstruction" ||
    instruction.type === "SceneJumpInstruction" ||
    instruction.type === "IfInstruction" ||
    instruction.type === "V2IfInstruction" ||
    instruction.type === "ChoiceInstruction" ||
    instruction.type === "BodyChoiceInstruction" ||
    instruction.type === "MacroInstruction"
  );
}

function buildDeclarationIndexes(instructions: readonly TzrInstruction[]): DeclarationIndexes {
  const labels: Record<string, DeclarationIndexEntry> = {};
  const scenes: Record<string, DeclarationIndexEntry> = {};

  for (const [statementIndex, statement] of instructions.entries()) {
    if (statement.type === "LabelInstruction") {
      labels[statement.id] = {
        id: statement.id,
        statementIndex,
        loc: statement.loc,
      };
    }

    if (statement.type === "SceneInstruction") {
      scenes[statement.id] = {
        id: statement.id,
        statementIndex,
        loc: statement.loc,
      };
    }
  }

  return { labels, scenes };
}

function countHashes(value: string): number {
  let count = 0;
  for (const char of value) {
    if (char === "#") {
      count += 1;
    }
  }
  return count;
}

function toPluginValueType(value: TzrValue): PluginCommandValueType {
  switch (value.type) {
    case "StringValue":
      return "string";
    case "NumberValue":
      return "number";
    case "BooleanValue":
      return "boolean";
    case "IdentifierValue":
      return "identifier";
  }
}

function isPluginCommandArgumentDefinition(value: unknown): value is PluginCommandArgumentDefinition {
  return typeof value === "object" && value !== null && "type" in value;
}

function formatPluginValueTypes(types: readonly PluginCommandValueType[]): string {
  if (types.length === 1) {
    return types[0] ?? "value";
  }

  if (types.length === 2) {
    return `${types[0] ?? "value"} or ${types[1] ?? "value"}`;
  }

  const last = types.at(-1) ?? "value";
  return `${types.slice(0, -1).join(", ")}, or ${last}`;
}

function formatStringValues(values: readonly string[]): string {
  if (values.length === 0) {
    return "no values";
  }

  if (values.length === 1) {
    return `"${values[0] ?? ""}"`;
  }

  if (values.length === 2) {
    return `"${values[0] ?? ""}" or "${values[1] ?? ""}"`;
  }

  const last = values.at(-1) ?? "";
  return `${values.slice(0, -1).map((value) => `"${value}"`).join(", ")}, or "${last}"`;
}
