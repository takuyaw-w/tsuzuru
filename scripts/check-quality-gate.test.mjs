import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkQualityGate } from "./lib/check-quality-gate.mjs";

const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("checkQualityGate", () => {
  it("passes for a synchronized fixture repository", async () => {
    const root = await createFixtureRepo();

    expect(checkQualityGate(root)).toEqual({ ok: true, failures: [] });
  });

  it("fails when a root script references a missing workspace package", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts.test += " && pnpm --filter @fixture/missing test";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root package.json scripts reference missing workspace package "@fixture/missing".',
    );
  });

  it("fails when a public package is omitted from the root test script", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts.test = removeCommandForPackage(packageJson.scripts.test, "@fixture/addon", "test");
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "test" does not include "--filter @fixture/addon test".',
    );
  });

  it("fails when a public package is omitted from the root typecheck script", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts.typecheck = removeCommandForPackage(
        packageJson.scripts.typecheck,
        "@fixture/addon",
        "typecheck",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "typecheck" does not include "--filter @fixture/addon typecheck".',
    );
  });

  it("fails when a public package is omitted from pack:dry-run", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["pack:dry-run"] = removeCommandForPackage(
        packageJson.scripts["pack:dry-run"],
        "@fixture/addon",
        "pack --dry-run",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "pack:dry-run" does not include "--filter @fixture/addon pack --dry-run".',
    );
  });

  it("fails when an example is omitted from examples:check", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["examples:check"] = packageJson.scripts["examples:check"].replace(
        "pnpm --filter @fixture/example test",
        "pnpm --filter @fixture/example check:scenario",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "examples:check" does not include "--filter @fixture/example test".',
    );
  });

  it("fails when AGENTS.md package inventory drifts from package directories", async () => {
    const root = await createFixtureRepo();
    const source = await readFile(join(root, "AGENTS.md"), "utf8");
    await writeFile(join(root, "AGENTS.md"), source.replace("packages/addon\n", ""));

    expect(checkQualityGate(root).failures).toContain(
      "AGENTS.md package inventory is out of sync. Expected [packages/addon, packages/core], got [packages/core].",
    );
  });

  it("fails when README.md package inventory drifts from package directories", async () => {
    const root = await createFixtureRepo();
    const source = await readFile(join(root, "README.md"), "utf8");
    await writeFile(join(root, "README.md"), source.replace("  addon/\n", ""));

    expect(checkQualityGate(root).failures).toContain(
      "README.md package inventory is out of sync. Expected [packages/addon, packages/core], got [packages/core].",
    );
  });
});

async function createFixtureRepo() {
  const root = await mkdtemp(join(tmpdir(), "tsuzuru-quality-gate-"));
  tempRoots.push(root);

  await writeJson(join(root, "package.json"), {
    name: "fixture-root",
    private: true,
    scripts: {
      "examples:check": [
        "pnpm --filter @fixture/example check:scenario",
        "pnpm --filter @fixture/example test",
        "pnpm --filter @fixture/example typecheck",
        "pnpm --filter @fixture/example build",
      ].join(" && "),
      "pack:dry-run": [
        "pnpm --filter @fixture/addon pack --dry-run",
        "pnpm --filter @fixture/core pack --dry-run",
      ].join(" && "),
      test: ["pnpm --filter @fixture/addon test", "pnpm --filter @fixture/core test"].join(" && "),
      typecheck: [
        "pnpm --filter @fixture/addon typecheck",
        "pnpm --filter @fixture/core typecheck",
      ].join(" && "),
    },
  });

  await writePackageJson(root, "packages/core", { name: "@fixture/core" });
  await writePackageJson(root, "packages/addon", { name: "@fixture/addon" });
  await writePackageJson(root, "examples/example", { name: "@fixture/example", private: true });
  await writeAgents(root);
  await writeTreeInventoryDoc(root, "README.md");
  await writeTreeInventoryDoc(root, "docs/architecture.md");

  return root;
}

async function writePackageJson(root, relativeDir, packageJson) {
  await mkdir(join(root, relativeDir), { recursive: true });
  await writeJson(join(root, relativeDir, "package.json"), packageJson);
}

async function writeAgents(root) {
  await writeFile(
    join(root, "AGENTS.md"),
    `# Fixture Agents

Current packages:

\`\`\`txt
packages/core
packages/addon
\`\`\`

Current examples:

\`\`\`txt
examples/example
\`\`\`
`,
  );
}

async function writeTreeInventoryDoc(root, relativePath) {
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(
    join(root, relativePath),
    `# Fixture

\`\`\`txt
packages/
  core/
  addon/

examples/
  example/
\`\`\`
`,
  );
}

async function mutateRootPackageJson(root, mutate) {
  const packageJsonPath = join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  mutate(packageJson);
  await writeJson(packageJsonPath, packageJson);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function removeCommandForPackage(script, packageName, command) {
  return script
    .split(" && ")
    .filter((part) => part !== `pnpm --filter ${packageName} ${command}`)
    .join(" && ");
}
