#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectName = "tsuzuru-smoke-app";
const keepTempDir = process.env.TSUZURU_SMOKE_KEEP === "1";
const createPackageManager = process.env.TSUZURU_SMOKE_CREATE_PM ?? "pnpm";

function resolveCommand(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function getCreateCommand(packageManager) {
  switch (packageManager) {
    case "pnpm":
      return {
        command: "pnpm",
        args: ["create", "tsuzuru", projectName],
      };
    case "npm":
      return {
        command: "npm",
        args: ["create", "tsuzuru", projectName],
      };
    default:
      throw new Error(
        `Unsupported TSUZURU_SMOKE_CREATE_PM value: ${packageManager}. Expected "pnpm" or "npm".`,
      );
  }
}

async function runStep(label, command, args, cwd) {
  console.log("");
  console.log(`> ${label}`);
  console.log(`$ ${[command, ...args].join(" ")}`);

  await new Promise((resolve, reject) => {
    const child = spawn(resolveCommand(command), args, {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const reason = signal === null ? `exit code ${code}` : `signal ${signal}`;
      reject(new Error(`${label} failed with ${reason}.`));
    });
  });
}

const tempRoot = await mkdtemp(join(tmpdir(), "tsuzuru-create-smoke-"));
const projectDir = join(tempRoot, projectName);

try {
  console.log(`Created smoke test temp directory: ${tempRoot}`);

  const createCommand = getCreateCommand(createPackageManager);
  await runStep(
    `create project with ${createPackageManager}`,
    createCommand.command,
    createCommand.args,
    tempRoot,
  );
  await runStep("install generated project dependencies", "pnpm", ["install"], projectDir);
  await runStep("check generated scenario", "pnpm", ["check:scenario"], projectDir);
  await runStep("build generated project", "pnpm", ["build"], projectDir);

  if (keepTempDir) {
    console.log("");
    console.log(`Smoke test passed. Temp directory kept because TSUZURU_SMOKE_KEEP=1: ${tempRoot}`);
  } else {
    await rm(tempRoot, { recursive: true, force: true });
    console.log("");
    console.log("Smoke test passed. Temp directory removed.");
  }
} catch (error) {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`Smoke test temp directory kept for inspection: ${tempRoot}`);
  process.exitCode = 1;
}
