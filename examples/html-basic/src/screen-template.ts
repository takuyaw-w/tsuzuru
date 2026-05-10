export type HtmlBasicScreenTemplateName = "title" | "backlog" | "settings" | "gallery" | "runtime-menu";

export interface HtmlBasicScreenTemplateLoader {
  readonly load: (name: HtmlBasicScreenTemplateName) => Promise<HTMLElement>;
}

export interface HtmlBasicScreenTemplateLoaderOptions {
  readonly fetch?: HtmlBasicTemplateFetch;
  readonly document?: Document;
  readonly parse?: HtmlBasicScreenTemplateParser;
  readonly baseUrl?: string;
}

export type HtmlBasicTemplateFetch = (input: string) => Promise<HtmlBasicTemplateFetchResponse>;

export interface HtmlBasicTemplateFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly text: () => Promise<string>;
}

export type HtmlBasicScreenTemplateParser = (
  html: string,
  name: HtmlBasicScreenTemplateName,
  document: Document,
) => HTMLElement;

export class HtmlBasicScreenTemplateError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "HtmlBasicScreenTemplateError";
  }
}

export function createHtmlBasicScreenTemplateLoader(
  options: HtmlBasicScreenTemplateLoaderOptions = {},
): HtmlBasicScreenTemplateLoader {
  const fetchTemplate = options.fetch ?? globalThis.fetch.bind(globalThis);
  const document = options.document ?? globalThis.document;
  const parse = options.parse ?? parseHtmlBasicScreenTemplate;
  const baseUrl = options.baseUrl ?? "/screens/";
  const cache = new Map<HtmlBasicScreenTemplateName, Promise<HTMLElement>>();

  return {
    load: async (name) => {
      let templatePromise = cache.get(name);
      if (templatePromise === undefined) {
        templatePromise = fetchAndParseTemplate(name, { fetch: fetchTemplate, document, parse, baseUrl });
        cache.set(name, templatePromise);
      }

      const template = await templatePromise;
      const clone = template.cloneNode(true);
      if (!isHtmlElement(clone)) {
        throw new HtmlBasicScreenTemplateError(`Template "${name}" did not clone to an HTMLElement.`);
      }
      return clone;
    },
  };
}

export function parseHtmlBasicScreenTemplate(
  html: string,
  name: HtmlBasicScreenTemplateName,
  document: Document,
): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const element = template.content.firstElementChild;
  if (!isHtmlElement(element)) {
    throw new HtmlBasicScreenTemplateError(`Template "${name}" must contain one root HTMLElement.`);
  }
  return element;
}

export function requireHtmlBasicTemplateElement(root: ParentNode, selector: string, templateName: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!isHtmlElement(element)) {
    throw new HtmlBasicScreenTemplateError(`Template "${templateName}" is missing required selector: ${selector}`);
  }
  return element;
}

async function fetchAndParseTemplate(
  name: HtmlBasicScreenTemplateName,
  options: {
    readonly fetch: HtmlBasicTemplateFetch;
    readonly document: Document;
    readonly parse: HtmlBasicScreenTemplateParser;
    readonly baseUrl: string;
  },
): Promise<HTMLElement> {
  const url = `${options.baseUrl}${name}.html`;
  let response: HtmlBasicTemplateFetchResponse;
  try {
    response = await options.fetch(url);
  } catch (cause) {
    throw new HtmlBasicScreenTemplateError(`Failed to fetch screen template "${url}": ${formatUnknownError(cause)}.`);
  }

  if (!response.ok) {
    throw new HtmlBasicScreenTemplateError(
      `Failed to fetch screen template "${url}": ${response.status} ${response.statusText}.`,
    );
  }

  return options.parse(await response.text(), name, options.document);
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isHtmlElement(value: unknown): value is HTMLElement {
  if (typeof HTMLElement === "undefined") {
    return typeof value === "object" && value !== null && "querySelector" in value;
  }
  return value instanceof HTMLElement;
}
