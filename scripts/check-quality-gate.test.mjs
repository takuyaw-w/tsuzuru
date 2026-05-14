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

  it("fails when a public package is omitted from packages:typecheck:self", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["packages:typecheck:self"] = removeCommandForPackage(
        packageJson.scripts["packages:typecheck:self"],
        "@fixture/addon",
        "typecheck:self",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "packages:typecheck:self" does not include "--filter @fixture/addon typecheck:self".',
    );
  });

  it("fails when root typecheck does not use the self typecheck flow", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts.typecheck = "pnpm --filter @fixture/addon typecheck && pnpm --filter @fixture/core typecheck";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "typecheck" does not include "pnpm packages:typecheck:self".',
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

  it("fails when a public buildable package is omitted from packages:build", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["packages:build"] = removeCommandForPackage(
        packageJson.scripts["packages:build"],
        "@fixture/addon",
        "build:self",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "packages:build" does not include "--filter @fixture/addon build:self".',
    );
  });

  it("fails when a public buildable package is missing build:self", async () => {
    const root = await createFixtureRepo();
    await mutatePackageJson(root, "packages/addon", (packageJson) => {
      delete packageJson.scripts["build:self"];
    });

    expect(checkQualityGate(root).failures).toContain(
      '@fixture/addon is public and buildable but is missing script "build:self".',
    );
  });

  it("fails when a public typecheckable package is missing typecheck:self", async () => {
    const root = await createFixtureRepo();
    await mutatePackageJson(root, "packages/addon", (packageJson) => {
      delete packageJson.scripts["typecheck:self"];
    });

    expect(checkQualityGate(root).failures).toContain(
      '@fixture/addon is public and typecheckable but is missing script "typecheck:self".',
    );
  });

  it("fails when release-readiness:check does not use the local create-tsuzuru smoke", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["release-readiness:check"] = packageJson.scripts["release-readiness:check"].replace(
        "pnpm run smoke:create-tsuzuru:local",
        "pnpm run smoke:create-tsuzuru",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "release-readiness:check" does not include "pnpm run smoke:create-tsuzuru:local".',
    );
  });

  it("fails when release-readiness:check uses the heavy examples check", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["release-readiness:check"] = packageJson.scripts["release-readiness:check"].replace(
        "pnpm examples:check:self",
        "pnpm examples:check",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "release-readiness:check" does not include "pnpm examples:check:self".',
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

  it("fails when an example is omitted from examples:check:self", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["examples:check:self"] = packageJson.scripts["examples:check:self"].replace(
        "pnpm --filter @fixture/example typecheck:self",
        "pnpm --filter @fixture/example check:scenario",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "examples:check:self" does not include "--filter @fixture/example typecheck:self".',
    );
  });

  it("fails when an example is missing self check scripts", async () => {
    const root = await createFixtureRepo();
    await mutatePackageJson(root, "examples/example", (packageJson) => {
      delete packageJson.scripts["build:self"];
    });

    expect(checkQualityGate(root).failures).toContain(
      '@fixture/example is an example but is missing script "build:self".',
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
      "examples:check:self": [
        "pnpm --filter @fixture/example check:scenario",
        "pnpm --filter @fixture/example test",
        "pnpm --filter @fixture/example typecheck:self",
        "pnpm --filter @fixture/example build:self",
      ].join(" && "),
      "pack:dry-run": [
        "pnpm --filter @fixture/addon pack --dry-run",
        "pnpm --filter @fixture/core pack --dry-run",
      ].join(" && "),
      "packages:build": [
        "pnpm --filter @fixture/addon build:self",
        "pnpm --filter @fixture/core build:self",
      ].join(" && "),
      "packages:typecheck:self": [
        "pnpm --filter @fixture/addon typecheck:self",
        "pnpm --filter @fixture/core typecheck:self",
      ].join(" && "),
      "release-readiness:check": [
        "pnpm packages:build",
        "pnpm examples:check:self",
        "pnpm run pack:dry-run",
        "pnpm publish-readiness:check",
        "pnpm run smoke:create-tsuzuru:local",
      ].join(" && "),
      test: ["pnpm --filter @fixture/addon test", "pnpm --filter @fixture/core test"].join(" && "),
      typecheck: "pnpm packages:build && pnpm packages:typecheck:self",
    },
  });

  await writePackageJson(root, "packages/core", {
    name: "@fixture/core",
    scripts: {
      build: "pnpm run build:self",
      "build:self": "tsc",
      typecheck: "pnpm run typecheck:self",
      "typecheck:self": "tsc --noEmit",
    },
  });
  await writePackageJson(root, "packages/addon", {
    name: "@fixture/addon",
    scripts: {
      build: "pnpm run build:self",
      "build:self": "tsc",
      typecheck: "pnpm run typecheck:self",
      "typecheck:self": "tsc --noEmit",
    },
  });
  await writePackageJson(root, "examples/example", {
    name: "@fixture/example",
    private: true,
    scripts: {
      build: "pnpm run build:deps && pnpm run build:self",
      "build:self": "vite build",
      typecheck: "pnpm run build:deps && pnpm run typecheck:self",
      "typecheck:self": "tsc -p tsconfig.json --noEmit",
    },
  });
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
  await mutatePackageJson(root, ".", mutate);
}

async function mutatePackageJson(root, relativeDir, mutate) {
  const packageJsonPath = join(root, relativeDir, "package.json");
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
