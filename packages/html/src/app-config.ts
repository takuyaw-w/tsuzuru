import type { TsuzuruHtmlFetch } from "./scenario-loader.js";

export interface TsuzuruHtmlDeclarativeAppConfig {
  readonly version: 1;
  readonly title: string;
  readonly scenario: {
    readonly entryUrl: string;
    readonly entryId?: string;
  };
  readonly assetsUrl?: string;
  readonly initialScreen: string;
  readonly storageKeyPrefix: string;
}

export interface TsuzuruHtmlDeclarativeAppConfigJson {
  readonly version?: unknown;
  readonly title?: unknown;
  readonly scenario?: unknown;
  readonly assetsUrl?: unknown;
  readonly initialScreen?: unknown;
  readonly storageKeyPrefix?: unknown;
}

export interface TsuzuruHtmlDeclarativeAppConfigLoadOptions {
  readonly fetch?: TsuzuruHtmlFetch;
  readonly baseUrl?: string | URL;
}

export class TsuzuruHtmlDeclarativeAppConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TsuzuruHtmlDeclarativeAppConfigError";
  }
}

export async function loadTsuzuruHtmlDeclarativeAppConfig(
  configUrl: string | URL,
  options: TsuzuruHtmlDeclarativeAppConfigLoadOptions = {},
): Promise<TsuzuruHtmlDeclarativeAppConfig> {
  const url = toAbsoluteUrl(configUrl, options.baseUrl);
  const fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  let response: Awaited<ReturnType<TsuzuruHtmlFetch>>;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new TsuzuruHtmlDeclarativeAppConfigError(`Failed to fetch app config "${url}": ${formatUnknownError(cause)}.`);
  }

  if (!response.ok) {
    throw new TsuzuruHtmlDeclarativeAppConfigError(
      `Failed to fetch app config "${url}": ${response.status} ${response.statusText}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch (cause) {
    throw new TsuzuruHtmlDeclarativeAppConfigError(`Failed to parse app config "${url}": ${formatUnknownError(cause)}.`);
  }

  return normalizeTsuzuruHtmlDeclarativeAppConfig(parsed);
}

export function normalizeTsuzuruHtmlDeclarativeAppConfig(value: unknown): TsuzuruHtmlDeclarativeAppConfig {
  if (!isObjectRecord(value)) {
    throw new TsuzuruHtmlDeclarativeAppConfigError("tsuzuru.app.json must be an object.");
  }
  if (value.version !== 1) {
    throw new TsuzuruHtmlDeclarativeAppConfigError(`Unsupported tsuzuru.app.json version: ${String(value.version)}.`);
  }
  if (!isObjectRecord(value.scenario)) {
    throw new TsuzuruHtmlDeclarativeAppConfigError("tsuzuru.app.json scenario must be an object.");
  }
  if (typeof value.scenario.entryUrl !== "string" || value.scenario.entryUrl.length === 0) {
    throw new TsuzuruHtmlDeclarativeAppConfigError("tsuzuru.app.json scenario.entryUrl must be a non-empty string.");
  }
  if (value.scenario.entryId !== undefined && typeof value.scenario.entryId !== "string") {
    throw new TsuzuruHtmlDeclarativeAppConfigError("tsuzuru.app.json scenario.entryId must be a string when provided.");
  }
  if (value.assetsUrl !== undefined && typeof value.assetsUrl !== "string") {
    throw new TsuzuruHtmlDeclarativeAppConfigError("tsuzuru.app.json assetsUrl must be a string when provided.");
  }

  return {
    version: 1,
    title: typeof value.title === "string" && value.title.length > 0 ? value.title : "Tsuzuru",
    scenario: {
      entryUrl: value.scenario.entryUrl,
      ...(value.scenario.entryId === undefined ? {} : { entryId: value.scenario.entryId }),
    },
    ...(value.assetsUrl === undefined ? {} : { assetsUrl: value.assetsUrl }),
    initialScreen:
      typeof value.initialScreen === "string" && value.initialScreen.length > 0 ? value.initialScreen : "title",
    storageKeyPrefix:
      typeof value.storageKeyPrefix === "string" && value.storageKeyPrefix.length > 0
        ? value.storageKeyPrefix
        : "tsuzuru:html-app",
  };
}

function toAbsoluteUrl(input: string | URL, baseUrl: string | URL | undefined): string {
  if (input instanceof URL) {
    return input.href;
  }
  return new URL(input, baseUrl ?? globalThis.location?.href ?? "http://localhost/").href;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
