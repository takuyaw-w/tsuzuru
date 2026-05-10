export interface HtmlBasicSettings {
  readonly textFontSize: number;
  readonly messageWindowOpacity: number;
  readonly audioNoticesVisible: boolean;
}

export interface HtmlBasicSettingsStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
}

export const HTML_BASIC_SETTINGS_STORAGE_KEY = "tsuzuru:example-html-basic:settings";

export const DEFAULT_HTML_BASIC_SETTINGS: HtmlBasicSettings = {
  textFontSize: 1.08,
  messageWindowOpacity: 0.78,
  audioNoticesVisible: true,
};

export function loadHtmlBasicSettings(
  storage: HtmlBasicSettingsStorage | undefined = globalThis.localStorage,
): HtmlBasicSettings {
  if (storage === undefined) {
    return DEFAULT_HTML_BASIC_SETTINGS;
  }

  const rawValue = storage.getItem(HTML_BASIC_SETTINGS_STORAGE_KEY);
  if (rawValue === null) {
    return DEFAULT_HTML_BASIC_SETTINGS;
  }

  try {
    return normalizeHtmlBasicSettings(JSON.parse(rawValue));
  } catch {
    return DEFAULT_HTML_BASIC_SETTINGS;
  }
}

export function saveHtmlBasicSettings(
  settings: HtmlBasicSettings,
  storage: HtmlBasicSettingsStorage | undefined = globalThis.localStorage,
): HtmlBasicSettings {
  const normalized = normalizeHtmlBasicSettings(settings);
  storage?.setItem(HTML_BASIC_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function toHtmlBasicSettingsStyle(settings: HtmlBasicSettings): Readonly<Record<string, string>> {
  const normalized = normalizeHtmlBasicSettings(settings);
  return {
    "--html-basic-message-font-size": `${normalized.textFontSize}rem`,
    "--html-basic-message-window-opacity": String(normalized.messageWindowOpacity),
  };
}

function normalizeHtmlBasicSettings(value: unknown): HtmlBasicSettings {
  if (!isObjectRecord(value)) {
    return DEFAULT_HTML_BASIC_SETTINGS;
  }

  return {
    textFontSize: clampNumber(value.textFontSize, 0.95, 1.35, DEFAULT_HTML_BASIC_SETTINGS.textFontSize),
    messageWindowOpacity: clampNumber(
      value.messageWindowOpacity,
      0.55,
      0.95,
      DEFAULT_HTML_BASIC_SETTINGS.messageWindowOpacity,
    ),
    audioNoticesVisible:
      typeof value.audioNoticesVisible === "boolean"
        ? value.audioNoticesVisible
        : DEFAULT_HTML_BASIC_SETTINGS.audioNoticesVisible,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
