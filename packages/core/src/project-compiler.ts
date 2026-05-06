import type { SourceLocation } from "./ast.js";
import { compileTzr, type TzrCompileOptions, type TzrCompileResult } from "./compiler.js";
import { createDiagnostic, type Diagnostic } from "./diagnostic.js";
import { parseTzr } from "./parser.js";
import type { TzrDocument, TzrTopLevelDeclaration } from "./scenario-ast.js";

export interface TzrProjectDocumentInput {
  readonly id: string;
  readonly source: string;
}

export interface TzrCompileProjectInput {
  readonly entryId: string;
  readonly documents: readonly TzrProjectDocumentInput[];
}

export type TzrCompileProjectResult = TzrCompileResult;

export function compileTzrProject(
  input: TzrCompileProjectInput,
  options: TzrCompileOptions = {},
): TzrCompileProjectResult {
  const compiler = new TzrProjectCompiler(input, options);
  return compiler.compile();
}

class TzrProjectCompiler {
  private readonly errors: Diagnostic[] = [];
  private readonly documents = new Map<string, TzrProjectDocumentInput>();
  private readonly sourceLineMap: Record<string, readonly string[]> = {};
  private readonly parsedDocuments: TzrDocument[] = [];
  private readonly visiting = new Set<string>();
  private readonly visited = new Set<string>();

  public constructor(
    private readonly input: TzrCompileProjectInput,
    private readonly options: TzrCompileOptions,
  ) {}

  public compile(): TzrCompileProjectResult {
    this.collectDocuments();
    if (this.errors.length === 0) {
      this.visitDocument(this.input.entryId, undefined, []);
    }
    if (this.errors.length > 0) {
      return { ok: false, errors: this.errors };
    }

    return compileTzr(this.buildAggregateDocument(), this.options);
  }

  private collectDocuments(): void {
    for (const document of this.input.documents) {
      if (this.documents.has(document.id)) {
        this.addDiagnostic(
          { filePath: document.id, line: 1, column: 1 },
          `Duplicate project document id "${document.id}".`,
        );
        continue;
      }
      this.documents.set(document.id, document);
      this.sourceLineMap[document.id] = sourceLines(document.source);
    }

    if (!this.documents.has(this.input.entryId)) {
      this.addDiagnostic(
        { filePath: this.input.entryId, line: 1, column: 1 },
        `Project entry document "${this.input.entryId}" was not provided.`,
      );
    }
  }

  private visitDocument(id: string, includeLocation: SourceLocation | undefined, stack: readonly string[]): void {
    if (this.visiting.has(id)) {
      const chain = [...stack, id].join(" -> ");
      this.addDiagnostic(
        includeLocation ?? { filePath: id, line: 1, column: 1 },
        `Circular include detected: ${chain}.`,
      );
      return;
    }
    if (this.visited.has(id)) {
      return;
    }

    const input = this.documents.get(id);
    if (input === undefined) {
      this.addDiagnostic(includeLocation ?? { filePath: id, line: 1, column: 1 }, `Missing include target "${id}".`);
      return;
    }

    const parsed = parseTzr(input.source, { filePath: id });
    if (!parsed.ok) {
      this.errors.push(...parsed.errors);
      return;
    }

    this.visiting.add(id);
    this.visited.add(id);
    this.parsedDocuments.push(parsed.document);

    for (const declaration of parsed.document.declarations) {
      if (declaration.type !== "IncludeDirective") {
        continue;
      }
      this.visitDocument(resolveIncludePath(id, declaration.path), declaration.loc.start, [...stack, id]);
    }

    this.visiting.delete(id);
  }

  private buildAggregateDocument(): TzrDocument {
    const declarations: TzrTopLevelDeclaration[] = [];

    for (const document of this.parsedDocuments) {
      declarations.push(...document.declarations.filter((declaration) => declaration.type !== "IncludeDirective"));
    }

    return {
      type: "TzrDocument",
      filePath: this.input.entryId,
      sourceLines: this.sourceLineMap[this.input.entryId] ?? [],
      sourceLineMap: this.sourceLineMap,
      declarations,
    };
  }

  private addDiagnostic(location: SourceLocation, message: string): void {
    this.errors.push(createDiagnostic(location, message, this.sourceLine(location)));
  }

  private sourceLine(location: SourceLocation): string {
    return this.sourceLineMap[location.filePath]?.[location.line - 1] ?? "";
  }
}

function resolveIncludePath(documentId: string, includePath: string): string {
  const directory = documentId.includes("/") ? documentId.slice(0, documentId.lastIndexOf("/")) : "";
  return normalizeProjectPath(directory.length === 0 ? includePath : `${directory}/${includePath}`);
}

function normalizeProjectPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length > 0 && segments.at(-1) !== "..") {
        segments.pop();
      } else {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

function sourceLines(source: string): readonly string[] {
  return source.replace(/\r\n?/g, "\n").split("\n");
}
