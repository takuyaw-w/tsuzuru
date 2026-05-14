#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const rootPackageJson = readJson("package.json");
const packageEntries = readWorkspaceEntries("packages");
const exampleEntries = readWorkspaceEntries("examples");
const allPackageNames = [...packageEntries, ...exampleEntries].map((entry) => entry.name).sort();
const publicPackageNames = packageEntries
  .filter((entry) => entry.packageJson.private !== true)
  .map((entry) => entry.name);
const exampleNames = exampleEntries.map((entry) => entry.name);
const packageDirs = packageEntries.map((entry) => `packages/${entry.dir}`).sort();
const exampleDirs = exampleEntries.map((entry) => `examples/${entry.dir}`).sort();

const failures = [];

assertNoMissingRootScriptFilters();
assertScriptCovers("test", publicPackageNames, "test");
assertScriptCovers("typecheck", publicPackageNames, "typecheck");
assertScriptCovers("pack:dry-run", publicPackageNames, "pack --dry-run");
assertExamplesCheckCoversExamples();
assertDocumentedInventory("AGENTS.md", parsePlainInventory);
assertDocumentedInventory("README.md", parseTreeInventory);
assertDocumentedInventory("docs/architecture.md", parseTreeInventory);

if (failures.length > 0) {
  console.error("Quality gate inventory check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Quality gate inventory check passed.");
}

function readWorkspaceEntries(rootDir) {
  return readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const packageJsonPath = join(rootDir, entry.name, "package.json");
      if (!existsSync(packageJsonPath)) {
        return undefined;
      }
      const packageJson = readJson(packageJsonPath);
      return {
        dir: entry.name,
        name: packageJson.name,
        packageJson,
      };
    })
    .filter((entry) => entry !== undefined)
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertNoMissingRootScriptFilters() {
  const rootScriptFilters = new Set(
    Object.values(rootPackageJson.scripts ?? {}).flatMap((script) => [...script.matchAll(/--filter\s+([^\s&]+)/g)]).map(
      (match) => match[1],
    ),
  );
  for (const filterName of [...rootScriptFilters].sort()) {
    if (!allPackageNames.includes(filterName)) {
      failures.push(`root package.json scripts reference missing workspace package "${filterName}".`);
    }
  }
}

function assertScriptCovers(scriptName, packageNames, command) {
  const script = rootPackageJson.scripts?.[scriptName];
  if (script === undefined) {
    failures.push(`root package.json is missing script "${scriptName}".`);
    return;
  }

  for (const packageName of packageNames) {
    const expected = `--filter ${packageName} ${command}`;
    if (!script.includes(expected)) {
      failures.push(`root script "${scriptName}" does not include "${expected}".`);
    }
  }
}

function assertExamplesCheckCoversExamples() {
  const script = rootPackageJson.scripts?.["examples:check"];
  if (script === undefined) {
    failures.push('root package.json is missing script "examples:check".');
    return;
  }

  for (const exampleName of exampleNames) {
    for (const command of ["check:scenario", "test", "typecheck", "build"]) {
      const expected = `--filter ${exampleName} ${command}`;
      if (!script.includes(expected)) {
        failures.push(`root script "examples:check" does not include "${expected}".`);
      }
    }
  }
}

function assertDocumentedInventory(path, parseInventory) {
  const source = readFileSync(path, "utf8");
  const inventory = parseInventory(source, path);
  if (inventory === undefined) {
    return;
  }

  assertSameList(`${path} package inventory`, inventory.packages, packageDirs);
  assertSameList(`${path} example inventory`, inventory.examples, exampleDirs);
}

function parsePlainInventory(source, path) {
  const packages = readTxtBlockAfter(source, "Current packages:");
  const examples = readTxtBlockAfter(source, "Current examples:");
  if (packages === undefined || examples === undefined) {
    failures.push(`${path} is missing Current packages or Current examples txt block.`);
    return undefined;
  }

  return {
    packages: packages.filter((line) => line.startsWith("packages/")).sort(),
    examples: examples.filter((line) => line.startsWith("examples/")).sort(),
  };
}

function parseTreeInventory(source, path) {
  const block = [...source.matchAll(/```txt\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .find(
      (value) =>
        value.split("\n").some((line) => line.trim() === "packages/") &&
        value.split("\n").some((line) => line.trim() === "examples/"),
    );
  if (block === undefined) {
    failures.push(`${path} is missing a repository tree txt block with packages/ and examples/.`);
    return undefined;
  }

  const lines = block.split("\n");
  return {
    packages: readTreeSection(lines, "packages"),
    examples: readTreeSection(lines, "examples"),
  };
}

function readTxtBlockAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return undefined;
  }

  const afterMarker = source.slice(markerIndex + marker.length);
  const match = afterMarker.match(/```txt\n([\s\S]*?)```/);
  if (match === null) {
    return undefined;
  }

  return match[1].split("\n").map((line) => line.trim()).filter(Boolean);
}

function readTreeSection(lines, sectionName) {
  const sectionStart = lines.findIndex((line) => line.trim() === `${sectionName}/`);
  if (sectionStart === -1) {
    return [];
  }

  const values = [];
  for (const line of lines.slice(sectionStart + 1)) {
    if (line === line.trim() && /^[a-z][a-z-]*\/$/.test(line)) {
      break;
    }
    const match = line.match(/^  ([^/\s]+)\/$/);
    if (match !== null) {
      values.push(`${sectionName}/${match[1]}`);
    }
  }
  return values.sort();
}

function assertSameList(label, actual, expected) {
  const actualText = actual.join("\n");
  const expectedText = expected.join("\n");
  if (actualText !== expectedText) {
    failures.push(`${label} is out of sync. Expected [${expected.join(", ")}], got [${actual.join(", ")}].`);
  }
}
