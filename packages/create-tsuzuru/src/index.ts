#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createProject } from "./create-project.js";

const USAGE = `Usage:
  create-tsuzuru <project-name>`;

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
    console.log(`Created Tsuzuru project in ${result.relativeTargetDir}.`);
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${result.relativeTargetDir}`);
    console.log("  pnpm install");
    console.log("  pnpm check:scenario");
    console.log("  pnpm dev");
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
