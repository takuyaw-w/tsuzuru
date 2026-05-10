import type { Diagnostic } from "@tsuzuru/core";
import type { TsuzuruHtmlFetch } from "./scenario-loader.js";

export interface TsuzuruHtmlAssetEntry {
  readonly src: string;
  readonly alt?: string;
}

export interface TsuzuruHtmlAssets {
  readonly version: 1;
  readonly visual: {
    readonly backgrounds: Readonly<Record<string, TsuzuruHtmlAssetEntry>>;
    readonly sprites: Readonly<Record<string, TsuzuruHtmlAssetEntry>>;
  };
  readonly audio: {
    readonly bgm: Readonly<Record<string, TsuzuruHtmlAssetEntry>>;
    readonly se: Readonly<Record<string, TsuzuruHtmlAssetEntry>>;
    readonly voice: Readonly<Record<string, TsuzuruHtmlAssetEntry>>;
  };
}

export interface TsuzuruHtmlAssetsManifest {
  readonly version: number;
  readonly baseUrl?: string;
  readonly visual?: {
    readonly backgrounds?: Readonly<Record<string, TsuzuruHtmlAssetManifestEntry>>;
    readonly sprites?: Readonly<Record<string, TsuzuruHtmlAssetManifestEntry>>;
  };
  readonly audio?: {
    readonly bgm?: Readonly<Record<string, TsuzuruHtmlAssetManifestEntry>>;
    readonly se?: Readonly<Record<string, TsuzuruHtmlAssetManifestEntry>>;
    readonly voice?: Readonly<Record<string, TsuzuruHtmlAssetManifestEntry>>;
  };
}

export interface TsuzuruHtmlAssetManifestEntry {
  readonly src: string;
  readonly alt?: string;
}

export interface TsuzuruHtmlAssetsLoadOptions {
  readonly fetch?: TsuzuruHtmlFetch;
  readonly baseUrl?: string | URL;
}

export class TsuzuruHtmlAssetsLoadError extends Error {
  public constructor(public readonly diagnostics: readonly Diagnostic[]) {
    super(formatAssetsDiagnostics(diagnostics));
    this.name = "TsuzuruHtmlAssetsLoadError";
  }
}

export async function loadTsuzuruHtmlAssets(
  assetsUrl: string | URL,
  options: TsuzuruHtmlAssetsLoadOptions = {},
): Promise<TsuzuruHtmlAssets> {
  const manifestUrl = toAbsoluteUrl(assetsUrl, options.baseUrl);
  const fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  let response: Awaited<ReturnType<TsuzuruHtmlFetch>>;
  try {
    response = await fetch(manifestUrl);
  } catch (cause) {
    throw new TsuzuruHtmlAssetsLoadError([
      createAssetsDiagnostic(`Failed to fetch assets manifest "${manifestUrl}": ${formatUnknownError(cause)}.`),
    ]);
  }

  if (!response.ok) {
    throw new TsuzuruHtmlAssetsLoadError([
      createAssetsDiagnostic(
        `Failed to fetch assets manifest "${manifestUrl}": ${response.status} ${response.statusText}.`,
      ),
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch (cause) {
    throw new TsuzuruHtmlAssetsLoadError([
      createAssetsDiagnostic(`Failed to parse assets manifest "${manifestUrl}": ${formatUnknownError(cause)}.`),
    ]);
  }

  return normalizeTsuzuruHtmlAssetsManifest(parsed, manifestUrl);
}

export function normalizeTsuzuruHtmlAssetsManifest(value: unknown, manifestUrl: string | URL): TsuzuruHtmlAssets {
  if (!isObjectRecord(value)) {
    throw new TsuzuruHtmlAssetsLoadError([createAssetsDiagnostic("assets.json must be an object.")]);
  }
  if (value.version !== 1) {
    throw new TsuzuruHtmlAssetsLoadError([
      createAssetsDiagnostic(`Unsupported assets.json version: ${String(value.version)}.`),
    ]);
  }

  const baseUrl = new URL(
    typeof value.baseUrl === "string" ? value.baseUrl : "./",
    typeof manifestUrl === "string" ? manifestUrl : manifestUrl.href,
  ).href;

  return {
    version: 1,
    visual: {
      backgrounds: normalizeAssetEntries(readSection(value.visual, "backgrounds"), baseUrl, "visual.backgrounds"),
      sprites: normalizeAssetEntries(readSection(value.visual, "sprites"), baseUrl, "visual.sprites"),
    },
    audio: {
      bgm: normalizeAssetEntries(readSection(value.audio, "bgm"), baseUrl, "audio.bgm"),
      se: normalizeAssetEntries(readSection(value.audio, "se"), baseUrl, "audio.se"),
      voice: normalizeAssetEntries(readSection(value.audio, "voice"), baseUrl, "audio.voice"),
    },
  };
}

export function formatAssetsDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}: ${diagnostic.message}`)
    .join("\n");
}

function readSection(parent: unknown, key: string): unknown {
  if (!isObjectRecord(parent)) {
    return undefined;
  }
  return parent[key];
}

function normalizeAssetEntries(
  value: unknown,
  baseUrl: string,
  path: string,
): Readonly<Record<string, TsuzuruHtmlAssetEntry>> {
  if (value === undefined) {
    return {};
  }
  if (!isObjectRecord(value)) {
    throw new TsuzuruHtmlAssetsLoadError([createAssetsDiagnostic(`${path} must be an object when provided.`)]);
  }

  const entries: Record<string, TsuzuruHtmlAssetEntry> = {};
  for (const [assetId, entry] of Object.entries(value)) {
    if (!isObjectRecord(entry) || typeof entry.src !== "string" || entry.src.length === 0) {
      throw new TsuzuruHtmlAssetsLoadError([
        createAssetsDiagnostic(`${path}.${assetId}.src must be a non-empty string.`),
      ]);
    }
    entries[assetId] = {
      src: new URL(entry.src, baseUrl).href,
      ...(typeof entry.alt === "string" ? { alt: entry.alt } : {}),
    };
  }
  return entries;
}

function toAbsoluteUrl(input: string | URL, baseUrl: string | URL | undefined): string {
  if (input instanceof URL) {
    return input.href;
  }

  return new URL(input, baseUrl ?? globalThis.location?.href ?? "http://localhost/").href;
}

function createAssetsDiagnostic(message: string): Diagnostic {
  return {
    filePath: "assets.json",
    line: 1,
    column: 1,
    message,
    sourceLine: "",
  };
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
