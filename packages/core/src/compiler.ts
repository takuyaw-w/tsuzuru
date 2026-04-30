import type {
  ChoiceBlock,
  CommandStatement,
  IfBlock,
  JumpTarget,
  LabelDeclaration,
  SceneDeclaration,
  TzrDocument,
  TzrStatement,
  TzrValue,
} from "./ast.js";
import { isCoreCommandName, type CoreCommandName } from "./commands.js";
import { createDiagnostic, type Diagnostic } from "./diagnostic.js";

export type CompileResult =
  | { readonly ok: true; readonly document: TzrDocument; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export function compileTzr(document: TzrDocument): CompileResult {
  const compiler = new TzrCompiler(document);
  return compiler.compile();
}

class TzrCompiler {
  private readonly errors: Diagnostic[] = [];
  private readonly labels = new Map<string, LabelDeclaration>();
  private readonly scenes = new Map<string, SceneDeclaration>();

  public constructor(private readonly document: TzrDocument) {}

  public compile(): CompileResult {
    this.collectDeclarations();
    this.validateCommands();
    this.validateTargets();

    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return { ok: true, document: this.document, errors: [] };
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
      case "inc":
      case "dec":
      case "flag":
      case "unflag":
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
