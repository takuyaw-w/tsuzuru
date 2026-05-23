import { access, cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getTemplateDir } from "./template.js";

const PROJECT_NAME_PLACEHOLDER = "{{projectName}}";

const PROJECT_NAME_TEMPLATE_FILES = ["package.json", "README.md", "tsuzuru.config.ts"] as const;

export interface CreateProjectOptions {
  readonly projectName: string;
  readonly cwd?: string;
  readonly templateDir?: string;
  readonly templateName?: string;
}

export interface CreateProjectResult {
  readonly projectName: string;
  readonly targetDir: string;
  readonly relativeTargetDir: string;
}

export async function createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
  const validationError = validateProjectName(options.projectName);
  if (validationError !== null) {
    throw new Error(validationError);
  }

  const cwd = options.cwd ?? process.cwd();
  const projectName = options.projectName;
  const targetDir = join(cwd, projectName);

  if (await pathExists(targetDir)) {
    throw new Error(`Target directory already exists: ${projectName}`);
  }

  await cp(options.templateDir ?? (await getTemplateDir(options.templateName)), targetDir, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await replaceProjectNamePlaceholders(targetDir, projectName);

  return {
    projectName,
    targetDir,
    relativeTargetDir: projectName,
  };
}

export function validateProjectName(projectName: string | undefined): string | null {
  if (projectName === undefined || projectName.length === 0) {
    return "Project name is required.";
  }
  if (projectName === "." || projectName === "..") {
    return 'Project name cannot be "." or "..".';
  }
  if (projectName.includes("/") || projectName.includes("\\")) {
    return "Project name cannot include a path separator.";
  }
  if (projectName.length > 214) {
    return "Project name must be 214 characters or fewer.";
  }
  if (projectName !== projectName.toLowerCase()) {
    return "Project name must be lowercase.";
  }
  if (!/^[a-z0-9][a-z0-9._~-]*$/.test(projectName)) {
    return "Project name must be a valid npm package name.";
  }

  return null;
}

async function replaceProjectNamePlaceholders(targetDir: string, projectName: string): Promise<void> {
  await Promise.all(
    PROJECT_NAME_TEMPLATE_FILES.map(async (file) => {
      const path = join(targetDir, file);
      if (!(await pathExists(path))) {
        return;
      }

      const source = await readFile(path, "utf8");
      await writeFile(path, source.replaceAll(PROJECT_NAME_PLACEHOLDER, projectName));
    }),
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
