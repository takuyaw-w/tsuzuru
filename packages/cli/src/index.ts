#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runCheck } from "./check.js";

const HELP = `Usage:
  tsuzuru check
  tsuzuru --help
  tsuzuru -h

Commands:
  check    Load tsuzuru.config.ts from the current directory and validate the scenario project.

Options:
  -h, --help    Show this help.`;

export async function runCli(args: readonly string[]): Promise<number> {
  const [command, ...rest] = args;

  if (command === "--help" || command === "-h") {
    console.log(HELP);
    return 0;
  }

  if (command === "check" && rest.length === 0) {
    return runCheck();
  }

  console.error(HELP);
  return 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
