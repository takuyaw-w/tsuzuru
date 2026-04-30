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
import type { CompiledTzrDocument, DeclarationIndexEntry, TzrInstruction } from "./ir.js";

export type CompileResult =
  | { readonly ok: true; readonly document: CompiledTzrDocument; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export function compileTzr(document: TzrDocument): CompileResult {
  const compiler = new TzrCompiler(document);
  return compiler.compile();
}

class TzrCompiler {
  private readonly errors: Diagnostic[] = [];
  private readonly labels = new Map<string, LabelDeclaration>();
  private readonly scenes = new Map<string, SceneDeclaration>();

  public constructor(private readonly document: TzrDocument) { }

  public compile(): CompileResult {
    this.collectDeclarations();
    this.validateCommands();
    this.validateTargets();

    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return { ok: true, document: this.buildCompiledDocument(), errors: [] };
  }

  private collectDeclarations(): void {
    this.collectDeclarationsIn(this.document.body);
  }

  private collectDeclarationsIn(statements: readonly TzrStatement[]): void {
    for (const statement of statements) {
      if (statement.type === "SceneDeclaration") {
        this.collectScene(statement);
      }
      if (statement.type === "LabelDeclaration") {
        this.collectLabel(statement);
      }
      if (statement.type === "IfBlock") {
        this.collectIfDeclarations(statement);
      }
    }
  }

  private collectIfDeclarations(ifBlock: IfBlock): void {
    this.collectDeclarationsIn(ifBlock.thenBranch);
    if (ifBlock.elseBranch !== undefined) {
      this.collectDeclarationsIn(ifBlock.elseBranch);
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

  private validateCommands(): void {
    this.validateCommandsIn(this.document.body);
  }

  private validateCommandsIn(statements: readonly TzrStatement[]): void {
    for (const statement of statements) {
      if (statement.type === "CommandStatement") {
        this.validateCoreCommandArguments(statement);
      }
      if (statement.type === "IfBlock") {
        this.validateIfCommands(statement);
      }
    }
  }

  private validateIfCommands(ifBlock: IfBlock): void {
    this.validateCommandsIn(ifBlock.thenBranch);
    if (ifBlock.elseBranch !== undefined) {
      this.validateCommandsIn(ifBlock.elseBranch);
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

  private validateCoreCommandArguments(command: CommandStatement): void {
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

  private validateSinglePositionalArgument(
    command: CommandStatement,
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

  private validateNoArguments(command: CommandStatement, name: CoreCommandName): void {
    if (command.args.length > 0) {
      this.addError(command.loc.start, `@${name} expects no arguments.`);
    }
  }

  private validateSetArguments(command: CommandStatement): void {
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

  private validateIncrementArguments(command: CommandStatement, name: "inc" | "dec"): void {
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
    command: CommandStatement,
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

  private sourceLine(line: number): string {
    return this.document.sourceLines[line - 1] ?? "";
  }

  private buildCompiledDocument(): CompiledTzrDocument {
    const instructions = buildInstructions(this.document.body);
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
}

interface DeclarationIndexes {
  readonly labels: Readonly<Record<string, DeclarationIndexEntry>>;
  readonly scenes: Readonly<Record<string, DeclarationIndexEntry>>;
}

function buildInstructions(statements: readonly TzrStatement[]): readonly TzrInstruction[] {
  const instructions: TzrInstruction[] = [];

  function visit(nodes: readonly TzrStatement[]): void {
    for (const statement of nodes) {
      instructions.push(statement);
      if (statement.type === "IfBlock") {
        visit(statement.thenBranch);
        if (statement.elseBranch !== undefined) {
          visit(statement.elseBranch);
        }
      }
    }
  }

  visit(statements);
  return instructions;
}

function buildDeclarationIndexes(instructions: readonly TzrInstruction[]): DeclarationIndexes {
  const labels: Record<string, DeclarationIndexEntry> = {};
  const scenes: Record<string, DeclarationIndexEntry> = {};

  for (const [statementIndex, statement] of instructions.entries()) {
    if (statement.type === "LabelDeclaration") {
      labels[statement.id] = {
        id: statement.id,
        statementIndex,
        loc: statement.loc,
      };
    }

    if (statement.type === "SceneDeclaration") {
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
