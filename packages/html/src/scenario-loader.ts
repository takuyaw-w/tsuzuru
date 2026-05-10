import {
  compileTzrProject,
  type Diagnostic,
  parseTzr,
  type RuntimeDocument,
  type TzrCompileOptions,
} from "@tsuzuru/core";

export type TsuzuruHtmlScenarioSource = TsuzuruHtmlCompiledDocumentSource | TsuzuruHtmlScenarioUrlSource;

export interface TsuzuruHtmlCompiledDocumentSource {
  readonly document: RuntimeDocument;
}

export interface TsuzuruHtmlScenarioUrlSource {
  readonly entryUrl: string | URL;
  readonly entryId?: string;
}

export interface TsuzuruHtmlScenarioLoadOptions {
  readonly fetch?: TsuzuruHtmlFetch;
  readonly baseUrl?: string | URL;
  readonly plugins?: TzrCompileOptions["plugins"];
  readonly pluginCommands?: TzrCompileOptions["pluginCommands"];
}

export type TsuzuruHtmlFetch = (input: string | URL) => Promise<TsuzuruHtmlFetchResponse>;

export interface TsuzuruHtmlFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly text: () => Promise<string>;
}

export class TsuzuruHtmlScenarioLoadError extends Error {
  public constructor(public readonly diagnostics: readonly Diagnostic[]) {
    super(formatScenarioDiagnostics(diagnostics));
    this.name = "TsuzuruHtmlScenarioLoadError";
  }
}

export interface TsuzuruHtmlLoadedScenarioDocument {
  readonly id: string;
  readonly url: string;
  readonly source: string;
}

export async function loadTsuzuruHtmlScenario(
  source: TsuzuruHtmlScenarioSource,
  options: TsuzuruHtmlScenarioLoadOptions = {},
): Promise<RuntimeDocument> {
  if ("document" in source) {
    return source.document;
  }

  const documents = await loadScenarioDocumentsFromUrl(source, options);
  const compiled = compileTzrProject(
    {
      entryId: normalizeProjectPath(
        source.entryId ?? documentIdFromUrl(toAbsoluteUrl(source.entryUrl, options.baseUrl)),
      ),
      documents: documents.map(({ id, source }) => ({ id, source })),
    },
    {
      ...(options.plugins === undefined ? {} : { plugins: options.plugins }),
      ...(options.pluginCommands === undefined ? {} : { pluginCommands: options.pluginCommands }),
    },
  );

  if (!compiled.ok) {
    throw new TsuzuruHtmlScenarioLoadError(compiled.errors);
  }

  return compiled.document;
}

export async function loadScenarioDocumentsFromUrl(
  source: TsuzuruHtmlScenarioUrlSource,
  options: TsuzuruHtmlScenarioLoadOptions = {},
): Promise<readonly TsuzuruHtmlLoadedScenarioDocument[]> {
  const entryUrl = toAbsoluteUrl(source.entryUrl, options.baseUrl);
  const entryId = source.entryId ?? documentIdFromUrl(entryUrl);
  const loader = new ScenarioUrlLoader(options.fetch ?? globalThis.fetch.bind(globalThis));

  return loader.load(entryId, entryUrl);
}

export function formatScenarioDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}: ${diagnostic.message}`)
    .join("\n");
}

class ScenarioUrlLoader {
  private readonly documents = new Map<string, TsuzuruHtmlLoadedScenarioDocument>();
  private readonly visiting = new Set<string>();

  public constructor(private readonly fetch: TsuzuruHtmlFetch) {}

  public async load(entryId: string, entryUrl: string): Promise<readonly TsuzuruHtmlLoadedScenarioDocument[]> {
    await this.loadDocument(normalizeProjectPath(entryId), entryUrl, []);
    return [...this.documents.values()].map(({ id, url, source }) => ({ id, url, source }));
  }

  private async loadDocument(documentId: string, url: string, stack: readonly string[]): Promise<void> {
    if (this.visiting.has(documentId)) {
      throw new TsuzuruHtmlScenarioLoadError([
        createScenarioDiagnostic(
          documentId,
          `Circular include detected while loading scenario URLs: ${[...stack, documentId].join(" includes ")}.`,
        ),
      ]);
    }
    if (this.documents.has(documentId)) {
      return;
    }

    this.visiting.add(documentId);
    const source = await this.fetchText(documentId, url);
    const parsed = parseTzr(source, { filePath: documentId });
    if (!parsed.ok) {
      throw new TsuzuruHtmlScenarioLoadError(parsed.errors);
    }

    this.documents.set(documentId, { id: documentId, url, source });

    for (const declaration of parsed.document.declarations) {
      if (declaration.type !== "IncludeDirective") {
        continue;
      }

      await this.loadDocument(
        resolveIncludeDocumentId(documentId, declaration.path),
        resolveIncludeUrl(url, declaration.path),
        [...stack, documentId],
      );
    }

    this.visiting.delete(documentId);
  }

  private async fetchText(documentId: string, url: string): Promise<string> {
    let response: TsuzuruHtmlFetchResponse;
    try {
      response = await this.fetch(url);
    } catch (cause) {
      throw new TsuzuruHtmlScenarioLoadError([
        createScenarioDiagnostic(
          documentId,
          `Failed to fetch scenario document "${url}": ${formatUnknownError(cause)}.`,
        ),
      ]);
    }

    if (!response.ok) {
      throw new TsuzuruHtmlScenarioLoadError([
        createScenarioDiagnostic(
          documentId,
          `Failed to fetch scenario document "${url}": ${response.status} ${response.statusText}.`,
        ),
      ]);
    }

    return response.text();
  }
}

function resolveIncludeDocumentId(documentId: string, includePath: string): string {
  const directory = documentId.includes("/") ? documentId.slice(0, documentId.lastIndexOf("/")) : "";
  return normalizeProjectPath(directory.length === 0 ? includePath : `${directory}/${includePath}`);
}

function resolveIncludeUrl(documentUrl: string, includePath: string): string {
  return new URL(includePath, documentUrl).href;
}

function toAbsoluteUrl(input: string | URL, baseUrl: string | URL | undefined): string {
  if (input instanceof URL) {
    return input.href;
  }

  return new URL(input, baseUrl ?? globalThis.location?.href ?? "http://localhost/").href;
}

function documentIdFromUrl(url: string): string {
  return normalizeProjectPath(decodeURIComponent(new URL(url).pathname));
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

function createScenarioDiagnostic(filePath: string, message: string): Diagnostic {
  return {
    filePath,
    line: 1,
    column: 1,
    message,
    sourceLine: "",
  };
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
