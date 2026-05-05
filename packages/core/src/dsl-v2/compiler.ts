import type { SourceLocation, SourceRange } from "../ast.js";
import { createDiagnostic, type Diagnostic } from "../diagnostic.js";
import type { DeclarationIndexEntry, SceneInstruction, TzrInstruction } from "../ir.js";
import type {
  TzrV2CharacterDeclaration,
  TzrV2ChoiceStatement,
  TzrV2Document,
  TzrV2IfStatement,
  TzrV2SceneDeclaration,
  TzrV2SceneStatement,
  TzrV2TitleDeclaration,
} from "./ast.js";

export interface TzrV2CompileOptions {}

export type TzrV2CompileResult =
  | { readonly ok: true; readonly document: CompiledTzrV2Document; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

export interface CompiledTzrV2Document {
  readonly type: "CompiledTzrV2Document";
  readonly filePath: string;
  readonly source: TzrV2Document;
  readonly metadata: TzrV2DocumentMetadata;
  readonly instructions: readonly TzrInstruction[];
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

    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return {
      ok: true,
      document: this.buildCompiledDocument(),
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
    this.validateSceneStatements(statement.thenBranch);
    for (const branch of statement.elifBranches) {
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

  private buildCompiledDocument(): CompiledTzrV2Document {
    const instructions = this.buildSceneInstructions();

    return {
      type: "CompiledTzrV2Document",
      filePath: this.document.filePath,
      source: this.document,
      metadata: this.buildMetadata(),
      instructions,
      scenes: buildSceneIndexes(instructions),
    };
  }

  private buildSceneInstructions(): readonly SceneInstruction[] {
    return Array.from(this.scenes.values(), (scene) => ({
      type: "SceneInstruction",
      id: scene.id,
      loc: scene.loc,
    }));
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
