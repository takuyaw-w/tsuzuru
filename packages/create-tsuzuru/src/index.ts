#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createProject } from "./create-project.js";

type PackageManager = "npm" | "pnpm" | "yarn";

const USAGE = `Usage:
  create-tsuzuru <project-name>`;

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
  const [projectName, ...rest] = args;

  if (projectName === "--help" || projectName === "-h") {
    console.log(USAGE);
    return 0;
  }

  if (projectName === undefined || rest.length > 0) {
    console.error(USAGE);
    return 1;
  }

  try {
    const result = await createProject({ projectName });
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
