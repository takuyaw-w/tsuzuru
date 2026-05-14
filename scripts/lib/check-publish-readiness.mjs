import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const LEGACY_TARBALL_PATH_PATTERNS = [
  /(^|\/)legacy(\/|[-_.])/i,
  /parseTzrV2/i,
  /compileTzrV2/i,
  /(^|\/)examples\/basic(\/|$)/,
  /(^|\/)examples\/preact-std-visual(\/|$)/,
  /(^|\/)examples\/preact-std-audio(\/|$)/,
];

export async function checkPublishReadiness(rootDir = process.cwd(), options = {}) {
  const packPackage = options.packPackage ?? packPackageWithPnpm;
  const packageEntries = readPublicPackageEntries(rootDir);
  const failures = [];
  const checkedPackages = [];
  let tempDir;

  try {
    tempDir = await mkdtemp(join(tmpdir(), "tsuzuru-publish-readiness-"));

    for (const packageEntry of packageEntries) {
      let packed;
      try {
        packed = await packPackage(rootDir, packageEntry, tempDir);
      } catch (error) {
        failures.push(formatPackFailure(packageEntry.name, error));
        continue;
      }
      checkedPackages.push(packageEntry.name);
      failures.push(...validatePackedPackage(packageEntry, packed.entries));
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (tempDir !== undefined) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  return {
    checkedPackages,
    failures,
    ok: failures.length === 0,
  };
}

export function validatePackedPackage(packageEntry, entries) {
  const failures = [];
  const entrySet = new Set(entries.map(normalizeTarballPath));
  const packageName = packageEntry.name;

  requireTarballEntry(failures, packageName, entrySet, "package.json");
  requireTarballEntry(failures, packageName, entrySet, "README.md");
  if (!entrySet.has("LICENSE") && !entrySet.has("LICENSE.md")) {
    failures.push(`${packageName} tarball is missing LICENSE or LICENSE.md.`);
  }

  if (typeof packageEntry.packageJson.types === "string") {
    requireTarballEntry(failures, packageName, entrySet, packageEntry.packageJson.types);
  }

  for (const target of collectExportTargets(packageEntry.packageJson.exports)) {
    requireTarballEntry(failures, packageName, entrySet, target);
  }

  if (Array.isArray(packageEntry.packageJson.files) && packageEntry.packageJson.files.length === 0) {
    failures.push(`${packageName} package.json files must not be empty.`);
  }

  for (const entry of entrySet) {
    if (LEGACY_TARBALL_PATH_PATTERNS.some((pattern) => pattern.test(entry))) {
      failures.push(`${packageName} tarball includes legacy or removed path "${entry}".`);
    }
  }

  return failures;
}

export function collectExportTargets(exportsField) {
  const targets = new Set();
  collectExportTargetsInto(exportsField, targets);
  return [...targets].sort();
}

export function readPublicPackageEntries(rootDir = process.cwd()) {
  const packagesDir = join(rootDir, "packages");
  if (!existsSync(packagesDir)) {
    return [];
  }

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const relativePackageJsonPath = join("packages", entry.name, "package.json");
      const packageJsonPath = join(rootDir, relativePackageJsonPath);
      if (!existsSync(packageJsonPath)) {
        return undefined;
      }
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (packageJson.private === true) {
        return undefined;
      }
      return {
        dir: entry.name,
        name: packageJson.name,
        packageJson,
        relativeDir: join("packages", entry.name),
      };
    })
    .filter((entry) => entry !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function packPackageWithPnpm(rootDir, packageEntry, tempDir) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "pnpm",
      ["--filter", packageEntry.name, "pack", "--json", "--pack-destination", tempDir],
      {
        cwd: rootDir,
        maxBuffer: 1024 * 1024 * 10,
      },
    ));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }

  const packResult = parsePackJson(stdout, packageEntry.name);
  return {
    entries: packResult.files.map((file) => file.path),
    tarballPath: packResult.filename,
  };
}

function formatPackFailure(packageName, error) {
  const message = error instanceof Error ? error.message : String(error);
  return `${packageName} pack failed: ${message}. Run "pnpm packages:build" before "pnpm publish-readiness:check" on a clean checkout.`;
}

function parsePackJson(stdout, packageName) {
  try {
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed.files)) {
      throw new Error("missing files array");
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${packageName} pack did not return expected JSON: ${message}`);
  }
}

function collectExportTargetsInto(value, targets) {
  if (typeof value === "string") {
    if (value.startsWith(".")) {
      targets.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectExportTargetsInto(item, targets);
    }
    return;
  }

  if (isObjectRecord(value)) {
    for (const child of Object.values(value)) {
      collectExportTargetsInto(child, targets);
    }
  }
}

function requireTarballEntry(failures, packageName, entrySet, path) {
  const normalized = normalizePackageJsonPath(path);
  if (!entrySet.has(normalized)) {
    failures.push(`${packageName} tarball is missing ${normalized}.`);
  }
}

function normalizePackageJsonPath(path) {
  return path.replace(/^\.\//, "");
}

function normalizeTarballPath(path) {
  return path.replace(/^package\//, "").replace(/^\.\//, "");
}

function isObjectRecord(value) {
  return typeof value === "object" && value !== null;
}
