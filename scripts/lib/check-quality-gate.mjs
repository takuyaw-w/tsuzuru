import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TYPESCRIPT_BUILD_GRAPH_PILOT_PACKAGES = [
  { dir: "config", name: "@tsuzuru/config" },
  { dir: "create-tsuzuru", name: "create-tsuzuru" },
  { dir: "plugin-std-visual", name: "@tsuzuru/plugin-std-visual" },
];

export function checkQualityGate(rootDir = process.cwd()) {
  const failures = [];
  const rootPackageJson = readJson(rootDir, "package.json");
  const packageEntries = readWorkspaceEntries(rootDir, "packages");
  const exampleEntries = readWorkspaceEntries(rootDir, "examples");
  const allPackageNames = [...packageEntries, ...exampleEntries].map((entry) => entry.name).sort();
  const publicPackageNames = packageEntries
    .filter((entry) => entry.packageJson.private !== true)
    .map((entry) => entry.name);
  const publicBuildablePackageNames = packageEntries
    .filter((entry) => entry.packageJson.private !== true && entry.packageJson.scripts?.build !== undefined)
    .map((entry) => entry.name);
  const publicTypecheckablePackageNames = packageEntries
    .filter((entry) => entry.packageJson.private !== true && entry.packageJson.scripts?.typecheck !== undefined)
    .map((entry) => entry.name);
  const exampleNames = exampleEntries.map((entry) => entry.name);
  const packageDirs = packageEntries.map((entry) => `packages/${entry.dir}`).sort();
  const exampleDirs = exampleEntries.map((entry) => `examples/${entry.dir}`).sort();
  const context = {
    allPackageNames,
    exampleDirs,
    exampleEntries,
    exampleNames,
    failures,
    packageDirs,
    packageEntries,
    publicBuildablePackageNames,
    publicPackageNames,
    publicTypecheckablePackageNames,
    rootDir,
    rootPackageJson,
  };

  assertNoMissingRootScriptFilters(context);
  assertScriptCovers(context, "test", publicPackageNames, "test");
  assertPublicBuildablePackagesHaveSelfBuild(context);
  assertPublicTypecheckablePackagesHaveSelfTypecheck(context);
  assertScriptCovers(context, "packages:build", publicBuildablePackageNames, "build:self");
  assertScriptCovers(context, "packages:typecheck:self", publicTypecheckablePackageNames, "typecheck:self");
  assertRootTypecheckScript(context);
  assertScriptCovers(context, "pack:dry-run", publicPackageNames, "pack --dry-run");
  assertReleaseReadinessScript(context);
  assertExamplesHaveSelfScripts(context);
  assertExamplesCheckCoversExamples(context);
  assertExamplesSelfCheckCoversExamples(context);
  assertDocumentedInventory(context, "AGENTS.md", parsePlainInventory);
  assertDocumentedInventory(context, "README.md", parseTreeInventory);
  assertDocumentedInventory(context, "docs/architecture.md", parseTreeInventory);
  assertTypeScriptBuildGraphPlan(context);
  assertTypeScriptBuildGraphPilots(context);

  return {
    failures,
    ok: failures.length === 0,
  };
}

function assertPublicBuildablePackagesHaveSelfBuild(context) {
  for (const packageEntry of context.packageEntries) {
    if (packageEntry.packageJson.private === true || packageEntry.packageJson.scripts?.build === undefined) {
      continue;
    }
    if (packageEntry.packageJson.scripts["build:self"] === undefined) {
      context.failures.push(`${packageEntry.name} is public and buildable but is missing script "build:self".`);
    }
  }
}

function assertPublicTypecheckablePackagesHaveSelfTypecheck(context) {
  for (const packageEntry of context.packageEntries) {
    if (packageEntry.packageJson.private === true || packageEntry.packageJson.scripts?.typecheck === undefined) {
      continue;
    }
    if (packageEntry.packageJson.scripts["typecheck:self"] === undefined) {
      context.failures.push(`${packageEntry.name} is public and typecheckable but is missing script "typecheck:self".`);
    }
  }
}

function assertRootTypecheckScript(context) {
  const script = context.rootPackageJson.scripts?.typecheck;
  if (script === undefined) {
    context.failures.push('root package.json is missing script "typecheck".');
    return;
  }

  let previousIndex = -1;
  for (const expected of ["pnpm packages:build", "pnpm packages:typecheck:self"]) {
    const index = script.indexOf(expected);
    if (index === -1) {
      context.failures.push(`root script "typecheck" does not include "${expected}".`);
      continue;
    }
    if (index < previousIndex) {
      context.failures.push(`root script "typecheck" must run "${expected}" after earlier typecheck steps.`);
    }
    previousIndex = index;
  }
}

function assertReleaseReadinessScript(context) {
  const script = context.rootPackageJson.scripts?.["release-readiness:check"];
  if (script === undefined) {
    context.failures.push('root package.json is missing script "release-readiness:check".');
    return;
  }

  let previousIndex = -1;
  for (const expected of [
    "pnpm packages:build",
    "pnpm examples:check:self",
    "pnpm run pack:dry-run",
    "pnpm publish-readiness:check",
    "pnpm run smoke:create-tsuzuru:local",
  ]) {
    const index = script.indexOf(expected);
    if (index === -1) {
      context.failures.push(`root script "release-readiness:check" does not include "${expected}".`);
      continue;
    }
    if (index < previousIndex) {
      context.failures.push(`root script "release-readiness:check" must run "${expected}" after earlier release checks.`);
    }
    previousIndex = index;
  }
}

function assertExamplesHaveSelfScripts(context) {
  for (const exampleEntry of context.exampleEntries) {
    const scripts = exampleEntry.packageJson.scripts ?? {};
    for (const scriptName of ["build:self", "check:scenario:self", "typecheck:self"]) {
      if (scripts[scriptName] === undefined) {
        context.failures.push(`${exampleEntry.name} is an example but is missing script "${scriptName}".`);
      }
    }
  }
}

function readWorkspaceEntries(rootDir, workspaceDir) {
  const absoluteWorkspaceDir = join(rootDir, workspaceDir);
  if (!existsSync(absoluteWorkspaceDir)) {
    return [];
  }

  return readdirSync(absoluteWorkspaceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const packageJsonPath = join(workspaceDir, entry.name, "package.json");
      if (!existsSync(join(rootDir, packageJsonPath))) {
        return undefined;
      }
      const packageJson = readJson(rootDir, packageJsonPath);
      return {
        dir: entry.name,
        name: packageJson.name,
        packageJson,
      };
    })
    .filter((entry) => entry !== undefined)
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

function readJson(rootDir, relativePath) {
  return JSON.parse(readFileSync(join(rootDir, relativePath), "utf8"));
}

function assertNoMissingRootScriptFilters(context) {
  const rootScriptFilters = new Set(
    Object.values(context.rootPackageJson.scripts ?? {}).flatMap((script) =>
      [...script.matchAll(/--filter\s+([^\s&]+)/g)].map((match) => match[1]),
    ),
  );
  for (const filterName of [...rootScriptFilters].sort()) {
    if (!context.allPackageNames.includes(filterName)) {
      context.failures.push(`root package.json scripts reference missing workspace package "${filterName}".`);
    }
  }
}

function assertScriptCovers(context, scriptName, packageNames, command) {
  const script = context.rootPackageJson.scripts?.[scriptName];
  if (script === undefined) {
    context.failures.push(`root package.json is missing script "${scriptName}".`);
    return;
  }

  for (const packageName of packageNames) {
    const expected = `--filter ${packageName} ${command}`;
    if (!script.includes(expected)) {
      context.failures.push(`root script "${scriptName}" does not include "${expected}".`);
    }
  }
}

function assertExamplesCheckCoversExamples(context) {
  const script = context.rootPackageJson.scripts?.["examples:check"];
  if (script === undefined) {
    context.failures.push('root package.json is missing script "examples:check".');
    return;
  }

  for (const exampleName of context.exampleNames) {
    for (const command of ["check:scenario", "test", "typecheck", "build"]) {
      if (!scriptIncludesFilterCommand(script, exampleName, command)) {
        context.failures.push(`root script "examples:check" does not include "--filter ${exampleName} ${command}".`);
      }
    }
  }
}

function assertExamplesSelfCheckCoversExamples(context) {
  const script = context.rootPackageJson.scripts?.["examples:check:self"];
  if (script === undefined) {
    context.failures.push('root package.json is missing script "examples:check:self".');
    return;
  }

  for (const exampleName of context.exampleNames) {
    if (scriptIncludesFilterCommand(script, exampleName, "check:scenario")) {
      context.failures.push(
        `root script "examples:check:self" must use "--filter ${exampleName} check:scenario:self" instead of "--filter ${exampleName} check:scenario".`,
      );
    }

    for (const command of ["check:scenario:self", "test", "typecheck:self", "build:self"]) {
      if (!scriptIncludesFilterCommand(script, exampleName, command)) {
        context.failures.push(`root script "examples:check:self" does not include "--filter ${exampleName} ${command}".`);
      }
    }
  }
}

function scriptIncludesFilterCommand(script, packageName, command) {
  return script
    .split("&&")
    .map((part) => part.trim())
    .includes(`pnpm --filter ${packageName} ${command}`);
}

function assertDocumentedInventory(context, relativePath, parseInventory) {
  const absolutePath = join(context.rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    context.failures.push(`${relativePath} is missing.`);
    return;
  }

  const source = readFileSync(absolutePath, "utf8");
  const inventory = parseInventory(context, source, relativePath);
  if (inventory === undefined) {
    return;
  }

  assertSameList(context, `${relativePath} package inventory`, inventory.packages, context.packageDirs);
  assertSameList(context, `${relativePath} example inventory`, inventory.examples, context.exampleDirs);
}

function assertTypeScriptBuildGraphPlan(context) {
  const relativePath = "docs/plans/typescript-build-graph.md";
  const absolutePath = join(context.rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    context.failures.push(`${relativePath} is missing.`);
    return;
  }

  const source = readFileSync(absolutePath, "utf8");
  for (const heading of [
    "## Source and Test Config Split",
    "## .tsbuildinfo Placement",
    "## Package and Example Graphs",
    "## Publish Layout Constraints",
    "## Decision for now",
    "## Migration steps",
  ]) {
    if (!source.includes(heading)) {
      context.failures.push(`${relativePath} is missing required heading "${heading}".`);
    }
  }
}

function assertTypeScriptBuildGraphPilots(context) {
  const pilotPackages = TYPESCRIPT_BUILD_GRAPH_PILOT_PACKAGES.filter((pilotPackage) =>
    context.packageEntries.some((packageEntry) => packageEntry.dir === pilotPackage.dir && packageEntry.name === pilotPackage.name),
  );
  if (pilotPackages.length === 0) {
    return;
  }

  assertTypeScriptBuildInfoIgnored(context);
  for (const pilotPackage of pilotPackages) {
    assertTypeScriptBuildGraphPilot(context, pilotPackage);
  }
}

function assertTypeScriptBuildInfoIgnored(context) {
  const gitignorePath = ".gitignore";
  const absoluteGitignorePath = join(context.rootDir, gitignorePath);
  if (!existsSync(absoluteGitignorePath)) {
    context.failures.push(`${gitignorePath} must ignore TypeScript build info cache directories.`);
    return;
  }

  const gitignore = readFileSync(absoluteGitignorePath, "utf8");
  if (!gitignore.includes(".tsbuildinfo")) {
    context.failures.push(`${gitignorePath} must ignore TypeScript build info cache directories.`);
  }
}

function assertTypeScriptBuildGraphPilot(context, pilotPackage) {
  const sourceTsconfigPath = `packages/${pilotPackage.dir}/tsconfig.json`;
  const absoluteSourceTsconfigPath = join(context.rootDir, sourceTsconfigPath);
  if (!existsSync(absoluteSourceTsconfigPath)) {
    context.failures.push(`${sourceTsconfigPath} is missing for the ${pilotPackage.name} source/test tsconfig pilot.`);
    return;
  }

  const sourceTsconfig = readJson(context.rootDir, sourceTsconfigPath);
  if ((sourceTsconfig.include ?? []).some((pattern) => pattern.includes("tests"))) {
    context.failures.push(
      `${sourceTsconfigPath} must not include tests; use packages/${pilotPackage.dir}/tsconfig.test.json.`,
    );
  }
  if (sourceTsconfig.compilerOptions?.composite !== true) {
    context.failures.push(
      `${sourceTsconfigPath} must set compilerOptions.composite to true for the ${pilotPackage.name} pilot.`,
    );
  }
  const tsBuildInfoFile = sourceTsconfig.compilerOptions?.tsBuildInfoFile;
  if (tsBuildInfoFile !== ".tsbuildinfo/tsconfig.tsbuildinfo") {
    context.failures.push(
      `${sourceTsconfigPath} must set compilerOptions.tsBuildInfoFile to ".tsbuildinfo/tsconfig.tsbuildinfo".`,
    );
  }
  if (typeof tsBuildInfoFile === "string" && (tsBuildInfoFile === "dist" || tsBuildInfoFile.startsWith("dist/"))) {
    context.failures.push(`${sourceTsconfigPath} must not put tsBuildInfoFile under dist.`);
  }

  const testTsconfigPath = `packages/${pilotPackage.dir}/tsconfig.test.json`;
  const absoluteTestTsconfigPath = join(context.rootDir, testTsconfigPath);
  if (!existsSync(absoluteTestTsconfigPath)) {
    context.failures.push(`${testTsconfigPath} is missing for the ${pilotPackage.name} source/test tsconfig pilot.`);
    return;
  }

  const testTsconfig = readJson(context.rootDir, testTsconfigPath);
  if (testTsconfig.compilerOptions?.noEmit !== true) {
    context.failures.push(`${testTsconfigPath} must set compilerOptions.noEmit to true.`);
  }
  if (!(testTsconfig.include ?? []).some((pattern) => pattern.includes("tests"))) {
    context.failures.push(`${testTsconfigPath} must include tests for the ${pilotPackage.name} pilot.`);
  }

  const packageJsonPath = `packages/${pilotPackage.dir}/package.json`;
  const absolutePackageJsonPath = join(context.rootDir, packageJsonPath);
  if (!existsSync(absolutePackageJsonPath)) {
    return;
  }

  const packageJson = readJson(context.rootDir, packageJsonPath);
  const typecheckSelf = packageJson.scripts?.["typecheck:self"];
  if (typeof typecheckSelf === "string" && !typecheckSelf.includes("tsconfig.test.json")) {
    context.failures.push(`${pilotPackage.name} script "typecheck:self" must use tsconfig.test.json.`);
  }
}

function parsePlainInventory(context, source, relativePath) {
  const packages = readTxtBlockAfter(source, "Current packages:");
  const examples = readTxtBlockAfter(source, "Current examples:");
  if (packages === undefined || examples === undefined) {
    context.failures.push(`${relativePath} is missing Current packages or Current examples txt block.`);
    return undefined;
  }

  return {
    examples: examples.filter((line) => line.startsWith("examples/")).sort(),
    packages: packages.filter((line) => line.startsWith("packages/")).sort(),
  };
}

function parseTreeInventory(context, source, relativePath) {
  const block = [...source.matchAll(/```txt\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .find(
      (value) =>
        value.split("\n").some((line) => line.trim() === "packages/") &&
        value.split("\n").some((line) => line.trim() === "examples/"),
    );
  if (block === undefined) {
    context.failures.push(`${relativePath} is missing a repository tree txt block with packages/ and examples/.`);
    return undefined;
  }

  const lines = block.split("\n");
  return {
    examples: readTreeSection(lines, "examples"),
    packages: readTreeSection(lines, "packages"),
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

function assertSameList(context, label, actual, expected) {
  const actualText = actual.join("\n");
  const expectedText = expected.join("\n");
  if (actualText !== expectedText) {
    context.failures.push(
      `${label} is out of sync. Expected [${expected.join(", ")}], got [${actual.join(", ")}].`,
    );
  }
}
