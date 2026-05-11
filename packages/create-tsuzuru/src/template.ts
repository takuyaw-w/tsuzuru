import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_TEMPLATE_NAME = "basic";
export const SUPPORTED_TEMPLATE_NAMES = ["basic", "preact"] as const;

export type TemplateName = (typeof SUPPORTED_TEMPLATE_NAMES)[number];

export async function getBasicTemplateDir(): Promise<string> {
  return getTemplateDir(DEFAULT_TEMPLATE_NAME);
}

export async function getTemplateDir(templateName: string = DEFAULT_TEMPLATE_NAME): Promise<string> {
  const templateDirName = resolveTemplateDirName(templateName);
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(currentDir, "../templates", templateDirName),
    join(currentDir, "../../templates", templateDirName),
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find bundled ${templateName} template.`);
}

function resolveTemplateDirName(templateName: string): "basic" {
  switch (templateName) {
    case "basic":
    case "preact":
      return "basic";
    default:
      throw new Error(
        `Unknown template: ${templateName}. Supported templates: ${SUPPORTED_TEMPLATE_NAMES.join(", ")}.`,
      );
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
