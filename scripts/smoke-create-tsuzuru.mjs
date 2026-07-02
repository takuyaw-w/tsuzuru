#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const projectName = "tsuzuru-smoke-app";
const execFileAsync = promisify(execFile);
const localTsuzuruDependencyBlocks = ["dependencies", "devDependencies", "optionalDependencies"];

function resolveCommand(command) {
  return process.platform === "win32" ? `${command}.cmd` : command;
}

export function parseSmokeSource(args, envValue) {
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

export function getRegistryCreateCommand(packageManager) {
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
      throw new Error(`Unsupported TSUZURU_SMOKE_CREATE_PM value: ${packageManager}. Expected "pnpm" or "npm".`);
  }
}

export function getGeneratedProjectInstallArgs({ hasLockfile, smokeSource }) {
  if (hasLockfile && smokeSource === "registry") {
    return ["install", "--frozen-lockfile", "--prefer-offline"];
  }
  return ["install", "--prefer-offline"];
}

function assertContains(source, expected, filePath) {
  if (!source.includes(expected)) {
    throw new Error(`${filePath} must contain ${JSON.stringify(expected)}.`);
  }
}

function assertNotContains(source, unexpected, filePath) {
  if (source.includes(unexpected)) {
    throw new Error(`${filePath} must not contain ${JSON.stringify(unexpected)}.`);
  }
}

function assertMissingDependency(packageJson, packageName) {
  for (const dependencyBlock of localTsuzuruDependencyBlocks) {
    const dependencies = packageJson[dependencyBlock];
    if (dependencies?.[packageName] !== undefined) {
      throw new Error(`Generated package.json must not include ${packageName} in ${dependencyBlock}.`);
    }
  }
}

export function collectTsuzuruDependencyNames(packageJson) {
  const packageNames = new Set();

  for (const dependencyBlock of localTsuzuruDependencyBlocks) {
    const dependencies = packageJson[dependencyBlock];
    if (dependencies === undefined) {
      continue;
    }

    for (const packageName of Object.keys(dependencies)) {
      if (packageName.startsWith("@tsuzuru/")) {
        packageNames.add(packageName);
      }
    }
  }

  return [...packageNames].sort();
}

export async function verifyGeneratedProjectFixedTheme(projectDir) {
  const packageJsonPath = join(projectDir, "package.json");
  const appPath = join(projectDir, "src", "App.tsx");
  const localThemePath = join(projectDir, "src", "themes", "localTheme.ts");
  const configPath = join(projectDir, "tsuzuru.config.ts");

  const [packageJsonSource, appSource, localThemeSource, configSource] = await Promise.all([
    readFile(packageJsonPath, "utf8"),
    readFile(appPath, "utf8"),
    readFile(localThemePath, "utf8"),
    readFile(configPath, "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource);

  if (packageJson.dependencies?.["@tsuzuru/standard-ui-preact"] === undefined) {
    throw new Error("Generated package.json must include @tsuzuru/standard-ui-preact.");
  }
  for (const packageName of [
    "@tsuzuru/theme-standard",
    "@tsuzuru/theme-classic",
    "@tsuzuru/theme-dark-novel",
    "@tsuzuru/theme-minimal",
  ]) {
    assertMissingDependency(packageJson, packageName);
  }

  assertContains(appSource, "TsuzuruThemeProvider", "src/App.tsx");
  assertContains(appSource, 'import { localTheme } from "./themes/localTheme.js"', "src/App.tsx");
  assertContains(appSource, "<TsuzuruThemeProvider theme={localTheme}>", "src/App.tsx");
  for (const marker of ["ThemeSwitcher", "themeId", "const themes", "<select", "@tsuzuru/theme-standard"]) {
    assertNotContains(appSource, marker, "src/App.tsx");
  }

  assertContains(localThemeSource, "satisfies TsuzuruTheme", "src/themes/localTheme.ts");
  assertContains(localThemeSource, 'id: "local"', "src/themes/localTheme.ts");
  assertContains(localThemeSource, "messageWindow", "src/themes/localTheme.ts");
  assertContains(localThemeSource, "choiceLayer", "src/themes/localTheme.ts");

  assertContains(configSource, 'default: "local"', "tsuzuru.config.ts");
  assertNotContains(configSource, "available", "tsuzuru.config.ts");
}

async function packWorkspacePackage(packageName, destinationDir, cwd) {
  console.log("");
  console.log(`> pack local ${packageName}`);
  console.log(`$ pnpm --filter ${packageName} pack --json --pack-destination ${destinationDir}`);

  const entriesBeforePack = new Set(await readdir(destinationDir));
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

  if (stdout.trim().length === 0) {
    return findCreatedTarball(destinationDir, entriesBeforePack, packageName);
  }

  const parsed = JSON.parse(stdout);
  if (typeof parsed.filename !== "string") {
    throw new Error(`pack local ${packageName} did not return a tarball filename.`);
  }
  return parsed.filename;
}

async function findCreatedTarball(destinationDir, entriesBeforePack, packageName) {
  const createdTarballs = (await readdir(destinationDir))
    .filter((entry) => !entriesBeforePack.has(entry))
    .filter((entry) => entry.endsWith(".tgz"));

  if (createdTarballs.length !== 1) {
    throw new Error(
      `pack local ${packageName} did not return JSON and produced ${createdTarballs.length} new tarball(s).`,
    );
  }

  return join(destinationDir, createdTarballs[0]);
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

      dependencies[packageName] =
        `file:${await getWorkspacePackageTarball(packageName, tarballs, tarballDir, rootDir)}`;
    }
  }

  await packTransitiveTsuzuruDependencies(tarballs, tarballDir, rootDir);
  await rewritePackedTsuzuruDependencies(tarballs);

  if (tarballs.size > 0) {
    packageJson.pnpm = packageJson.pnpm ?? {};
    packageJson.pnpm.overrides = packageJson.pnpm.overrides ?? {};
    for (const [packageName, tarballPath] of tarballs) {
      packageJson.pnpm.overrides[packageName] = `file:${tarballPath}`;
    }
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function packTransitiveTsuzuruDependencies(tarballs, tarballDir, rootDir) {
  let foundNewDependency = true;

  while (foundNewDependency) {
    foundNewDependency = false;

    const tarballPaths = Array.from(tarballs.values());
    for (const tarballPath of tarballPaths) {
      const packageJson = await readPackedPackageJson(tarballPath);
      for (const packageName of collectTsuzuruDependencyNames(packageJson)) {
        if (tarballs.has(packageName)) {
          continue;
        }

        tarballs.set(packageName, await packWorkspacePackage(packageName, tarballDir, rootDir));
        foundNewDependency = true;
      }
    }
  }
}

async function readPackedPackageJson(tarballPath) {
  const extractDir = await mkdtemp(join(tmpdir(), "tsuzuru-local-tarball-read-"));

  try {
    await execFileAsync("tar", ["-xzf", tarballPath, "-C", extractDir], {
      maxBuffer: 1024 * 1024 * 10,
    });

    return JSON.parse(await readFile(join(extractDir, "package", "package.json"), "utf8"));
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

async function getWorkspacePackageTarball(packageName, tarballs, tarballDir, rootDir) {
  if (!tarballs.has(packageName)) {
    tarballs.set(packageName, await packWorkspacePackage(packageName, tarballDir, rootDir));
  }
  return tarballs.get(packageName);
}

async function rewritePackedTsuzuruDependencies(tarballs) {
  for (const tarballPath of tarballs.values()) {
    const extractDir = await mkdtemp(join(tmpdir(), "tsuzuru-local-tarball-"));

    try {
      await execFileAsync("tar", ["-xzf", tarballPath, "-C", extractDir], {
        maxBuffer: 1024 * 1024 * 10,
      });

      const packageJsonPath = join(extractDir, "package", "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
      let changed = false;

      for (const dependencyBlock of localTsuzuruDependencyBlocks) {
        const dependencies = packageJson[dependencyBlock];
        if (dependencies === undefined) {
          continue;
        }

        for (const packageName of Object.keys(dependencies)) {
          const dependencyTarballPath = tarballs.get(packageName);
          if (dependencyTarballPath === undefined) {
            continue;
          }
          dependencies[packageName] = `file:${dependencyTarballPath}`;
          changed = true;
        }
      }

      if (changed) {
        await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
        await execFileAsync("tar", ["-czf", tarballPath, "-C", extractDir, "package"], {
          maxBuffer: 1024 * 1024 * 10,
        });
      }
    } finally {
      await rm(extractDir, { recursive: true, force: true });
    }
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
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

async function main() {
  const keepTempDir = process.env.TSUZURU_SMOKE_KEEP === "1";
  const createPackageManager = process.env.TSUZURU_SMOKE_CREATE_PM ?? "pnpm";
  const smokeSource = parseSmokeSource(process.argv.slice(2), process.env.TSUZURU_SMOKE_SOURCE ?? "registry");
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
      await runStep(`create project with ${createPackageManager}`, createCommand.command, createCommand.args, tempRoot);
    }

    console.log("");
    console.log("> verify generated fixed local theme files");
    await verifyGeneratedProjectFixedTheme(projectDir);

    const hasLockfile = await pathExists(join(projectDir, "pnpm-lock.yaml"));
    await runStep(
      "install generated project dependencies",
      "pnpm",
      getGeneratedProjectInstallArgs({ hasLockfile, smokeSource }),
      projectDir,
    );
    await runStep("check generated scenario", "pnpm", ["check:scenario"], projectDir);
    await runStep("typecheck generated project", "pnpm", ["typecheck"], projectDir);
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
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await main();
}
