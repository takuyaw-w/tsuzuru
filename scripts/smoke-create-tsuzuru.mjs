#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const projectName = "tsuzuru-smoke-app";
const keepTempDir = process.env.TSUZURU_SMOKE_KEEP === "1";
const createPackageManager = process.env.TSUZURU_SMOKE_CREATE_PM ?? "pnpm";
const smokeSource = parseSmokeSource(process.argv.slice(2), process.env.TSUZURU_SMOKE_SOURCE ?? "registry");
const execFileAsync = promisify(execFile);

function resolveCommand(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

function parseSmokeSource(args, envValue) {
  if (args.includes("--local")) {
    return "local";
  }
  if (args.includes("--registry")) {
    return "registry";
  }
  if (envValue === "local" || envValue === "registry") {
    return envValue;
  }
  throw new Error(`Unsupported TSUZURU_SMOKE_SOURCE value: ${envValue}. Expected "local" or "registry".`);
}

function getRegistryCreateCommand(packageManager) {
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

async function packWorkspacePackage(packageName, destinationDir, cwd) {
  console.log("");
  console.log(`> pack local ${packageName}`);
  console.log(`$ pnpm --filter ${packageName} pack --json --pack-destination ${destinationDir}`);

  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      resolveCommand("pnpm"),
      ["--filter", packageName, "pack", "--json", "--pack-destination", destinationDir],
      {
        cwd,
        maxBuffer: 1024 * 1024 * 10,
      },
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`pack local ${packageName} failed: ${message}`);
  }

  const parsed = JSON.parse(stdout);
  if (typeof parsed.filename !== "string") {
    throw new Error(`pack local ${packageName} did not return a tarball filename.`);
  }
  return parsed.filename;
}

async function rewriteGeneratedTsuzuruDependencies(projectDir, tarballDir, rootDir) {
  const packageJsonPath = join(projectDir, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const tarballs = new Map();

  for (const dependencyBlock of ["dependencies", "devDependencies"]) {
    const dependencies = packageJson[dependencyBlock];
    if (dependencies === undefined) {
      continue;
    }

    for (const packageName of Object.keys(dependencies)) {
      if (!packageName.startsWith("@tsuzuru/")) {
        continue;
      }

      if (!tarballs.has(packageName)) {
        tarballs.set(packageName, await packWorkspacePackage(packageName, tarballDir, rootDir));
      }
      dependencies[packageName] = `file:${tarballs.get(packageName)}`;
    }
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
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
const tarballDir = join(tempRoot, "tarballs");

try {
  console.log(`Created smoke test temp directory: ${tempRoot}`);

  if (smokeSource === "local") {
    await mkdir(tarballDir, { recursive: true });
    const createTsuzuruTarball = await packWorkspacePackage("create-tsuzuru", tarballDir, process.cwd());
    await runStep(
      "create project with local create-tsuzuru tarball",
      "pnpm",
      ["dlx", createTsuzuruTarball, projectName],
      tempRoot,
    );
    await rewriteGeneratedTsuzuruDependencies(projectDir, tarballDir, process.cwd());
  } else {
    const createCommand = getRegistryCreateCommand(createPackageManager);
    await runStep(
      `create project with ${createPackageManager}`,
      createCommand.command,
      createCommand.args,
      tempRoot,
    );
  }

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
