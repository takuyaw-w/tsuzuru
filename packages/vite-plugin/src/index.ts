import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { compileTzrProject, type Diagnostic, parseTzr, type TzrProjectDocumentInput } from "@tsuzuru/core";
import type { Plugin } from "vite";

export interface TsuzuruVitePluginOptions {
  readonly include?: string | readonly string[];
  readonly exclude?: string | readonly string[];
}

interface TzrRequest {
  readonly filename: string;
  readonly query: string;
}

interface CollectedScenarioProject {
  readonly entryId: string;
  readonly documents: readonly TzrProjectDocumentInput[];
  readonly watchFiles: readonly string[];
  readonly fileByDocumentId: ReadonlyMap<string, string>;
}

interface ViteDiagnosticError extends Error {
  id?: string;
  loc?: {
    readonly file?: string;
    readonly line: number;
    readonly column: number;
  };
  frame?: string;
}

export function tsuzuru(options: TsuzuruVitePluginOptions = {}): Plugin {
  let root = process.cwd();

  return {
    name: "tsuzuru",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    async load(id) {
      const request = parseTzrRequest(id);
      if (request === null || !shouldHandleRequest(request, options)) {
        return null;
      }

      const project = await collectScenarioProject(request.filename, root);
      for (const file of project.watchFiles) {
        this.addWatchFile(file);
      }

      const result = compileTzrProject({
        entryId: project.entryId,
        documents: project.documents,
      });
      if (!result.ok) {
        this.error(createViteDiagnosticError(result.errors, project.fileByDocumentId));
      }

      return {
        code: `const scenario = ${JSON.stringify(result.document)};\nexport default scenario;\n`,
        map: null,
      };
    },
  };
}

function parseTzrRequest(id: string): TzrRequest | null {
  const queryIndex = id.indexOf("?");
  const filename = queryIndex === -1 ? id : id.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : id.slice(queryIndex + 1);

  if (!filename.endsWith(".tzr")) {
    return null;
  }

  if (query !== "" && query !== "tsuzuru") {
    return null;
  }

  return {
    filename: normalizeFilePath(filename),
    query,
  };
}

function shouldHandleRequest(request: TzrRequest, options: TsuzuruVitePluginOptions): boolean {
  if (request.query !== "" && request.query !== "tsuzuru") {
    return false;
  }
  if (matchesPatterns(request.filename, options.exclude)) {
    return false;
  }
  if (options.include === undefined) {
    return true;
  }
  return matchesPatterns(request.filename, options.include);
}

async function collectScenarioProject(entryFilename: string, root: string): Promise<CollectedScenarioProject> {
  const documents: TzrProjectDocumentInput[] = [];
  const watchFiles = new Set<string>();
  const visitedDocumentIds = new Set<string>();
  const fileByDocumentId = new Map<string, string>();

  async function visit(filename: string): Promise<void> {
    const absoluteFilename = resolve(filename);
    const documentId = documentIdForFile(absoluteFilename, root);
    watchFiles.add(absoluteFilename);
    fileByDocumentId.set(documentId, absoluteFilename);

    if (visitedDocumentIds.has(documentId)) {
      return;
    }
    visitedDocumentIds.add(documentId);

    let source: string;
    try {
      source = await readFile(absoluteFilename, "utf8");
    } catch (error) {
      if (documentId === entryId) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read Tsuzuru scenario "${absoluteFilename}": ${message}`);
      }
      return;
    }

    documents.push({ id: documentId, source });

    const parsed = parseTzr(source, { filePath: documentId });
    if (!parsed.ok) {
      return;
    }

    for (const declaration of parsed.document.declarations) {
      if (declaration.type !== "IncludeDirective") {
        continue;
      }
      await visit(resolve(dirname(absoluteFilename), declaration.path));
    }
  }

  const entryId = documentIdForFile(resolve(entryFilename), root);
  await visit(entryFilename);

  return {
    entryId,
    documents,
    watchFiles: [...watchFiles],
    fileByDocumentId,
  };
}

function createViteDiagnosticError(
  diagnostics: readonly Diagnostic[],
  fileByDocumentId: ReadonlyMap<string, string>,
): ViteDiagnosticError {
  const first = diagnostics[0];
  const message = diagnostics.map(formatDiagnostic).join("\n");
  const error = new Error(message) as ViteDiagnosticError;

  if (first !== undefined) {
    const file = fileByDocumentId.get(first.filePath) ?? first.filePath;
    error.id = file;
    error.loc = { file, line: first.line, column: first.column };
    if (first.sourceLine.length > 0) {
      error.frame = `${first.sourceLine}\n${" ".repeat(Math.max(0, first.column - 1))}^`;
    }
  }

  return error;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  return `[error] ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`;
}

function documentIdForFile(filename: string, root: string): string {
  const relativePath = normalizeFilePath(relative(root, filename));
  if (relativePath !== "" && !relativePath.startsWith("../") && !isAbsolute(relativePath)) {
    return normalizeProjectPath(relativePath);
  }
  return normalizeProjectPath(filename);
}

function matchesPatterns(filename: string, patterns: string | readonly string[] | undefined): boolean {
  if (patterns === undefined) {
    return false;
  }
  const normalized = normalizeFilePath(filename);
  const patternList = typeof patterns === "string" ? [patterns] : patterns;
  return patternList.some((pattern) => matchesPattern(normalized, pattern));
}

function matchesPattern(filename: string, pattern: string): boolean {
  const normalizedPattern = normalizeFilePath(pattern);
  if (!normalizedPattern.includes("*")) {
    return filename === normalizedPattern || filename.endsWith(`/${normalizedPattern}`);
  }

  const expression = globPatternToRegExpSource(normalizedPattern);
  const prefix = isAbsolute(normalizedPattern) || /^[A-Za-z]:\//.test(normalizedPattern) ? "^" : "(^|/)";
  return new RegExp(`${prefix}${expression}$`).test(filename);
}

function globPatternToRegExpSource(pattern: string): string {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }
    source += escapeRegExp(char);
  }
  return source;
}

function escapeRegExp(value: string | undefined): string {
  return value?.replace(/[\\^$+?.()|[\]{}]/g, "\\$&") ?? "";
}

function normalizeFilePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function normalizeProjectPath(path: string): string {
  const segments: string[] = [];
  for (const segment of normalizeFilePath(path).split("/")) {
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
