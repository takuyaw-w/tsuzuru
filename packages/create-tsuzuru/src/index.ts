#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createProject } from "./create-project.js";

type PackageManager = "npm" | "pnpm" | "yarn";

const USAGE = `Usage:
  create-tsuzuru <project-name> [--template basic|preact|html]

Options:
  --template <name>  Project template to use. Defaults to basic.`;

interface ParsedCliArgs {
  readonly projectName: string;
  readonly templateName?: string;
}

interface NextStepCommands {
  readonly install: string;
  readonly checkScenario: string;
  readonly dev: string;
}

function detectPackageManager(userAgent = process.env.npm_config_user_agent): PackageManager {
  if (userAgent?.startsWith("pnpm/")) return "pnpm";
  if (userAgent?.startsWith("npm/")) return "npm";
  if (userAgent?.startsWith("yarn/")) return "yarn";
  return "pnpm";
}

function getNextStepCommands(packageManager = detectPackageManager()): NextStepCommands {
  switch (packageManager) {
    case "npm":
      return {
        install: "npm install",
        checkScenario: "npm run check:scenario",
        dev: "npm run dev",
      };
    case "pnpm":
      return {
        install: "pnpm install",
        checkScenario: "pnpm check:scenario",
        dev: "pnpm dev",
      };
    case "yarn":
      return {
        install: "yarn install",
        checkScenario: "yarn check:scenario",
        dev: "yarn dev",
      };
  }
}

export async function runCli(args: readonly string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return 0;
  }

  const parsedArgs = parseCliArgs(args);
  if (typeof parsedArgs === "string") {
    console.error(parsedArgs);
    return 1;
  }

  try {
    const createOptions =
      parsedArgs.templateName === undefined
        ? { projectName: parsedArgs.projectName }
        : { projectName: parsedArgs.projectName, templateName: parsedArgs.templateName };
    const result = await createProject(createOptions);
    const nextSteps = getNextStepCommands();
    console.log(`Created Tsuzuru project in ${result.relativeTargetDir}.`);
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${result.relativeTargetDir}`);
    console.log(`  ${nextSteps.install}`);
    console.log(`  ${nextSteps.checkScenario}`);
    console.log(`  ${nextSteps.dev}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function parseCliArgs(args: readonly string[]): ParsedCliArgs | string {
  let projectName: string | undefined;
  let templateName: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--template") {
      if (templateName !== undefined) {
        return "Template option can only be specified once.";
      }
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return "Template name is required after --template.";
      }
      templateName = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--template=") === true) {
      if (templateName !== undefined) {
        return "Template option can only be specified once.";
      }
      const value = arg.slice("--template=".length);
      if (value.length === 0) {
        return "Template name is required after --template.";
      }
      templateName = value;
      continue;
    }

    if (arg?.startsWith("-") === true) {
      return `Unknown option: ${arg}`;
    }

    if (projectName !== undefined) {
      return USAGE;
    }
    projectName = arg;
  }

  if (projectName === undefined) {
    return USAGE;
  }

  return templateName === undefined ? { projectName } : { projectName, templateName };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
