import type { ChoiceBlock, CommandStatement, JumpTarget, LabelDeclaration, SceneDeclaration, TzrDocument } from "./ast.js";
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
    this.validateTargets();

    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return { ok: true, document: this.document, errors: [] };
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
    for (const statement of this.document.body) {
      if (statement.type === "CommandStatement") {
        this.validateCommandTarget(statement);
      }
      if (statement.type === "ChoiceBlock") {
        this.validateChoiceTargets(statement);
      }
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
