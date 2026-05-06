import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function getBasicTemplateDir(): Promise<string> {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(currentDir, "../templates/basic"), join(currentDir, "../../templates/basic")];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not find bundled basic template.");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
