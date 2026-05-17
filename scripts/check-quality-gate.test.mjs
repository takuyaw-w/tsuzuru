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

  it("fails when release-version.sh omits root package.json", async () => {
    const root = await createFixtureRepo();
    await removeReleaseVersionTarget(root, "package.json");

    expect(checkQualityGate(root).failures).toContain(
      "scripts/release-version.sh target list must include root package.json.",
    );
  });

  it("fails when release-version.sh omits a public package", async () => {
    const root = await createFixtureRepo();
    await removeReleaseVersionTarget(root, "packages/addon/package.json");

    expect(checkQualityGate(root).failures).toContain(
      "scripts/release-version.sh target list must include public package packages/addon/package.json.",
    );
  });

  it("fails when release-version.sh omits an example package", async () => {
    const root = await createFixtureRepo();
    await removeReleaseVersionTarget(root, "examples/example/package.json");

    expect(checkQualityGate(root).failures).toContain(
      "scripts/release-version.sh target list must include example package examples/example/package.json.",
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
        "pnpm --filter @fixture/example check:scenario:self",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "examples:check:self" does not include "--filter @fixture/example typecheck:self".',
    );
  });

  it("fails when examples:check:self uses the standalone scenario check", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["examples:check:self"] = packageJson.scripts["examples:check:self"].replace(
        "pnpm --filter @fixture/example check:scenario:self",
        "pnpm --filter @fixture/example check:scenario",
      );
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "examples:check:self" must use "--filter @fixture/example check:scenario:self" instead of "--filter @fixture/example check:scenario".',
    );
  });

  it("fails when an example is missing self check scripts", async () => {
    const root = await createFixtureRepo();
    await mutatePackageJson(root, "examples/example", (packageJson) => {
      delete packageJson.scripts["check:scenario:self"];
    });

    expect(checkQualityGate(root).failures).toContain(
      '@fixture/example is an example but is missing script "check:scenario:self".',
    );
  });

  it("fails when an example is missing a browser UI smoke script", async () => {
    const root = await createFixtureRepo();
    await mutatePackageJson(root, "examples/example", (packageJson) => {
      delete packageJson.scripts["test:ui"];
    });

    expect(checkQualityGate(root).failures).toContain(
      '@fixture/example is an example but is missing script "test:ui".',
    );
  });

  it("fails when an example is omitted from examples:e2e", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["examples:e2e"] = "";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "examples:e2e" does not include "--filter @fixture/example test:ui".',
    );
  });

  it("fails when browser example E2E smoke tests are mixed into release readiness", async () => {
    const root = await createFixtureRepo();
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["release-readiness:check"] =
        "pnpm packages:build && pnpm examples:check:self && pnpm examples:e2e && pnpm run pack:dry-run && pnpm publish-readiness:check && pnpm run smoke:create-tsuzuru:local";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "release-readiness:check" must not run browser example E2E smoke tests.',
    );
  });

  it("fails when the optional examples E2E workflow is missing", async () => {
    const root = await createFixtureRepo();
    await rm(join(root, ".github/workflows/examples-e2e.yml"));

    expect(checkQualityGate(root).failures).toContain(".github/workflows/examples-e2e.yml is missing.");
  });

  it("fails when the examples E2E workflow is not manually runnable", async () => {
    const root = await createFixtureRepo();
    const source = await readFile(join(root, ".github/workflows/examples-e2e.yml"), "utf8");
    await writeFile(join(root, ".github/workflows/examples-e2e.yml"), source.replace("  workflow_dispatch:\n", ""));

    expect(checkQualityGate(root).failures).toContain(
      '.github/workflows/examples-e2e.yml does not include "workflow_dispatch:".',
    );
  });

  it("fails when the examples E2E workflow omits the examples:e2e script", async () => {
    const root = await createFixtureRepo();
    const source = await readFile(join(root, ".github/workflows/examples-e2e.yml"), "utf8");
    await writeFile(join(root, ".github/workflows/examples-e2e.yml"), source.replace("pnpm examples:e2e", "pnpm test"));

    expect(checkQualityGate(root).failures).toContain(
      '.github/workflows/examples-e2e.yml does not include "pnpm examples:e2e".',
    );
  });

  it("fails when the examples E2E workflow becomes a push gate", async () => {
    const root = await createFixtureRepo();
    const source = await readFile(join(root, ".github/workflows/examples-e2e.yml"), "utf8");
    await writeFile(join(root, ".github/workflows/examples-e2e.yml"), source.replace("  workflow_dispatch:", "  push:\n  workflow_dispatch:"));

    expect(checkQualityGate(root).failures).toContain(
      ".github/workflows/examples-e2e.yml must remain optional and must not run on push or pull_request.",
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

  it("fails when the TypeScript build graph plan is missing", async () => {
    const root = await createFixtureRepo();
    await rm(join(root, "docs/plans/typescript-build-graph.md"));

    expect(checkQualityGate(root).failures).toContain("docs/plans/typescript-build-graph.md is missing.");
  });

  it("fails when the TypeScript build graph plan is missing required sections", async () => {
    const root = await createFixtureRepo();
    await writeFile(join(root, "docs/plans/typescript-build-graph.md"), "# TypeScript Build Graph Plan\n");

    expect(checkQualityGate(root).failures).toContain(
      'docs/plans/typescript-build-graph.md is missing required heading "## Decision for now".',
    );
  });

  it("fails when the config source tsconfig includes tests", async () => {
    const root = await createFixtureRepo();
    await writeConfigPilotFiles(root);
    await writeJson(join(root, "packages/config/tsconfig.json"), {
      extends: "../../tsconfig.base.json",
      include: ["src/**/*.ts", "tests/**/*.ts"],
    });

    expect(checkQualityGate(root).failures).toContain(
      "packages/config/tsconfig.json must not include tests; use packages/config/tsconfig.test.json.",
    );
  });

  it("fails when the config test tsconfig is missing", async () => {
    const root = await createFixtureRepo();
    await writeConfigPilotFiles(root);
    await rm(join(root, "packages/config/tsconfig.test.json"));

    expect(checkQualityGate(root).failures).toContain(
      "packages/config/tsconfig.test.json is missing for the @tsuzuru/config source/test tsconfig pilot.",
    );
  });

  it("fails when the config source tsconfig is missing composite", async () => {
    const root = await createFixtureRepo();
    await writeConfigPilotFiles(root);
    await mutateJson(join(root, "packages/config/tsconfig.json"), (tsconfig) => {
      delete tsconfig.compilerOptions.composite;
    });

    expect(checkQualityGate(root).failures).toContain(
      "packages/config/tsconfig.json must set compilerOptions.composite to true for the @tsuzuru/config pilot.",
    );
  });

  it("fails when the config tsBuildInfoFile is missing or wrong", async () => {
    const root = await createFixtureRepo();
    await writeConfigPilotFiles(root);
    await mutateJson(join(root, "packages/config/tsconfig.json"), (tsconfig) => {
      tsconfig.compilerOptions.tsBuildInfoFile = "dist/tsconfig.tsbuildinfo";
    });

    expect(checkQualityGate(root).failures).toContain(
      'packages/config/tsconfig.json must set compilerOptions.tsBuildInfoFile to ".tsbuildinfo/tsconfig.tsbuildinfo".',
    );
    expect(checkQualityGate(root).failures).toContain("packages/config/tsconfig.json must not put tsBuildInfoFile under dist.");
  });

  it("fails when TypeScript build info is not ignored", async () => {
    const root = await createFixtureRepo();
    await writeConfigPilotFiles(root);
    await writeFile(join(root, ".gitignore"), "");

    expect(checkQualityGate(root).failures).toContain(".gitignore must ignore TypeScript build info cache directories.");
  });

  it("fails when the config typecheck:self does not use the test tsconfig", async () => {
    const root = await createFixtureRepo();
    await writeConfigPilotFiles(root);
    await writeJson(join(root, "packages/config/package.json"), {
      name: "@tsuzuru/config",
      scripts: {
        "typecheck:self": "tsc -p tsconfig.json --noEmit",
      },
    });

    expect(checkQualityGate(root).failures).toContain(
      '@tsuzuru/config script "typecheck:self" must use tsconfig.test.json.',
    );
  });

  it("fails when another pilot package source tsconfig includes tests", async () => {
    const root = await createFixtureRepo();
    await writeTypeScriptBuildGraphPilotFiles(root, "create-tsuzuru", "create-tsuzuru");
    await mutateJson(join(root, "packages/create-tsuzuru/tsconfig.json"), (tsconfig) => {
      tsconfig.include = ["src/**/*.ts", "tests/**/*.ts"];
    });

    expect(checkQualityGate(root).failures).toContain(
      "packages/create-tsuzuru/tsconfig.json must not include tests; use packages/create-tsuzuru/tsconfig.test.json.",
    );
  });

  it("fails when the core pilot test tsconfig can emit", async () => {
    const root = await createFixtureRepo();
    await writeTypeScriptBuildGraphPilotFiles(root, "core", "@tsuzuru/core");
    await mutateJson(join(root, "packages/core/tsconfig.test.json"), (tsconfig) => {
      tsconfig.compilerOptions.noEmit = false;
    });

    expect(checkQualityGate(root).failures).toContain("packages/core/tsconfig.test.json must set compilerOptions.noEmit to true.");
  });

  it("fails when a dependency-edge pilot does not use the test tsconfig", async () => {
    const root = await createFixtureRepo();
    await writeTypeScriptBuildGraphPilotFiles(root, "plugin-std-visual", "@tsuzuru/plugin-std-visual");
    await mutatePackageJson(root, "packages/plugin-std-visual", (packageJson) => {
      packageJson.scripts["typecheck:self"] = "tsc -p tsconfig.json --noEmit";
    });

    expect(checkQualityGate(root).failures).toContain(
      '@tsuzuru/plugin-std-visual script "typecheck:self" must use tsconfig.test.json.',
    );
  });

  it("fails when the preact source-only pilot typecheck can emit", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutatePackageJson(root, "packages/preact", (packageJson) => {
      packageJson.scripts["typecheck:self"] = "tsc -p tsconfig.json";
    });

    expect(checkQualityGate(root).failures).toContain(
      '@tsuzuru/preact script "typecheck:self" must use --noEmit for the source-only pilot.',
    );
  });

  it("fails when the vue source-only pilot typecheck can emit", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutatePackageJson(root, "packages/vue", (packageJson) => {
      packageJson.scripts["typecheck:self"] = "tsc -p tsconfig.json";
    });

    expect(checkQualityGate(root).failures).toContain(
      '@tsuzuru/vue script "typecheck:self" must use --noEmit for the source-only pilot.',
    );
  });

  it("fails when the standard UI Preact source-only pilot typecheck can emit", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutatePackageJson(root, "packages/standard-ui-preact", (packageJson) => {
      packageJson.scripts["typecheck:self"] = "tsc -p tsconfig.json";
    });

    expect(checkQualityGate(root).failures).toContain(
      '@tsuzuru/standard-ui-preact script "typecheck:self" must use --noEmit for the source-only pilot.',
    );
  });

  it("fails when the standard UI Preact style export is missing", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutatePackageJson(root, "packages/standard-ui-preact", (packageJson) => {
      delete packageJson.exports["./style.css"];
    });

    expect(checkQualityGate(root).failures).toContain(
      '@tsuzuru/standard-ui-preact package.json must export "./style.css" as "./dist/style.css".',
    );
  });

  it("fails when the standard UI Preact style file is missing from files", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutatePackageJson(root, "packages/standard-ui-preact", (packageJson) => {
      packageJson.files = packageJson.files.filter((entry) => entry !== "dist/style.css");
    });

    expect(checkQualityGate(root).failures).toContain(
      '@tsuzuru/standard-ui-preact package.json files must include "dist/style.css".',
    );
  });

  it("passes for package-to-core project reference experiments", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);

    expect(checkQualityGate(root)).toEqual({ ok: true, failures: [] });
  });

  it("fails when a package-to-core reference experiment omits a source reference", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateJson(join(root, "packages/plugin-std-audio/tsconfig.json"), (tsconfig) => {
      tsconfig.references = [];
    });

    expect(checkQualityGate(root).failures).toContain(
      'packages/plugin-std-audio/tsconfig.json must reference "../core" for the package project reference pilot.',
    );
  });

  it("fails when the preact reference experiment omits the core source reference", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateJson(join(root, "packages/preact/tsconfig.json"), (tsconfig) => {
      tsconfig.references = [];
    });

    expect(checkQualityGate(root).failures).toContain(
      'packages/preact/tsconfig.json must reference "../core" for the package project reference pilot.',
    );
  });

  it("fails when the vue reference experiment omits the core source reference", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateJson(join(root, "packages/vue/tsconfig.json"), (tsconfig) => {
      tsconfig.references = [];
    });

    expect(checkQualityGate(root).failures).toContain(
      'packages/vue/tsconfig.json must reference "../core" for the package project reference pilot.',
    );
  });

  it("fails when the standard UI Preact reference experiment omits the core source reference", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateJson(join(root, "packages/standard-ui-preact/tsconfig.json"), (tsconfig) => {
      tsconfig.references = [];
    });

    expect(checkQualityGate(root).failures).toContain(
      'packages/standard-ui-preact/tsconfig.json must reference "../core" for the package project reference pilot.',
    );
  });

  it("fails when the cli reference experiment omits the config source reference", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateJson(join(root, "packages/cli/tsconfig.json"), (tsconfig) => {
      tsconfig.references = [{ path: "../core" }];
    });

    expect(checkQualityGate(root).failures).toContain(
      'packages/cli/tsconfig.json must reference "../config" for the package project reference pilot.',
    );
  });

  it("fails when a package-to-core reference experiment is missing from the experimental graph", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateJson(join(root, "tsconfig.packages.experimental.json"), (tsconfig) => {
      tsconfig.references = tsconfig.references.filter((reference) => reference.path !== "./packages/plugin-std-audio");
    });

    expect(checkQualityGate(root).failures).toContain(
      'tsconfig.packages.experimental.json must reference "./packages/plugin-std-audio".',
    );
  });

  it("fails when a referenced package target is missing from the experimental graph", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateJson(join(root, "tsconfig.packages.experimental.json"), (tsconfig) => {
      tsconfig.references = tsconfig.references.filter((reference) => reference.path !== "./packages/config");
    });

    expect(checkQualityGate(root).failures).toContain(
      'tsconfig.packages.experimental.json must reference "./packages/config".',
    );
  });

  it("fails when the experimental package graph is wired into a root quality gate", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts.typecheck =
        "pnpm packages:build && pnpm exec tsc -b tsconfig.packages.experimental.json --dry && pnpm packages:typecheck:self";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "typecheck" must not wire tsconfig.packages.experimental.json into a formal quality gate.',
    );
  });

  it("fails when packages:graph:check is missing", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      delete packageJson.scripts["packages:graph:check"];
    });

    expect(checkQualityGate(root).failures).toContain('root package.json is missing script "packages:graph:check".');
  });

  it("fails when packages:graph:check does not use tsc build mode", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["packages:graph:check"] = "pnpm exec tsc -p tsconfig.packages.experimental.json --dry --verbose";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "packages:graph:check" does not include "pnpm exec tsc -b".',
    );
  });

  it("fails when packages:graph:check omits dry or verbose validation", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["packages:graph:check"] = "pnpm exec tsc -b tsconfig.packages.experimental.json";
    });

    expect(checkQualityGate(root).failures).toContain('root script "packages:graph:check" does not include "--dry".');
    expect(checkQualityGate(root).failures).toContain('root script "packages:graph:check" does not include "--verbose".');
  });

  it("fails when packages:graph:check mixes in artifact build work", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["packages:graph:check"] =
        "pnpm packages:build && pnpm exec tsc -b tsconfig.packages.experimental.json --dry --verbose";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "packages:graph:check" must not include "packages:build".',
    );
  });

  it("fails when packages:graph:check is mixed into typecheck", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts.typecheck =
        "pnpm packages:build && pnpm packages:graph:check && pnpm packages:typecheck:self";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "typecheck" must not call packages:graph:check or the experimental package graph.',
    );
  });

  it("fails when packages:graph:check is mixed into release readiness", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["release-readiness:check"] =
        "pnpm packages:build && pnpm packages:graph:check && pnpm examples:check:self && pnpm run pack:dry-run && pnpm publish-readiness:check && pnpm run smoke:create-tsuzuru:local";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "release-readiness:check" must not call packages:graph:check or the experimental package graph.',
    );
  });

  it("fails when release-readiness:check no longer starts with packages:build", async () => {
    const root = await createFixtureRepo();
    await writePackageCoreReferenceExperimentFiles(root);
    await mutateRootPackageJson(root, (packageJson) => {
      packageJson.scripts["release-readiness:check"] =
        "pnpm examples:check:self && pnpm packages:build && pnpm run pack:dry-run && pnpm publish-readiness:check && pnpm run smoke:create-tsuzuru:local";
    });

    expect(checkQualityGate(root).failures).toContain(
      'root script "release-readiness:check" must start with "pnpm packages:build".',
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
        "pnpm --filter @fixture/example check:scenario:self",
        "pnpm --filter @fixture/example test",
        "pnpm --filter @fixture/example typecheck:self",
        "pnpm --filter @fixture/example build:self",
      ].join(" && "),
      "examples:e2e": "pnpm --filter @fixture/example test:ui",
      "pack:dry-run": [
        "pnpm --filter @fixture/addon pack --dry-run",
        "pnpm --filter @fixture/core pack --dry-run",
      ].join(" && "),
      "packages:build": [
        "pnpm --filter @fixture/addon build:self",
        "pnpm --filter @fixture/core build:self",
      ].join(" && "),
      "packages:graph:check": "pnpm exec tsc -b tsconfig.packages.experimental.json --dry --verbose",
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
      "check:scenario": "tsuzuru check",
      "check:scenario:self": "node ../../packages/cli/dist/src/index.js check",
      "test:ui": "playwright test -c playwright.config.ts",
      typecheck: "pnpm run build:deps && pnpm run typecheck:self",
      "typecheck:self": "tsc -p tsconfig.json --noEmit",
    },
  });
  await writeAgents(root);
  await writeExamplesE2eWorkflow(root);
  await writeReleaseVersionScript(root, [
    "package.json",
    "packages/addon/package.json",
    "packages/core/package.json",
    "examples/example/package.json",
  ]);
  await writeTreeInventoryDoc(root, "README.md");
  await writeTreeInventoryDoc(root, "docs/architecture.md");
  await writeTypeScriptBuildGraphPlan(root);
  await writeJson(join(root, "tsconfig.packages.experimental.json"), {
    files: [],
    references: [],
  });

  return root;
}

async function writePackageJson(root, relativeDir, packageJson) {
  await mkdir(join(root, relativeDir), { recursive: true });
  await writeJson(join(root, relativeDir, "package.json"), packageJson);
}

async function writeExamplesE2eWorkflow(root) {
  await mkdir(join(root, ".github/workflows"), { recursive: true });
  await writeFile(
    join(root, ".github/workflows/examples-e2e.yml"),
    `name: Examples E2E

on:
  workflow_dispatch:
  schedule:
    - cron: "0 18 * * *"

permissions:
  contents: read

jobs:
  examples-e2e:
    name: Examples E2E Optional
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24

      - name: Enable pnpm
        run: |
          corepack enable
          corepack prepare pnpm@11.0.0 --activate
          pnpm --version

      - name: Get pnpm store path
        id: pnpm-store
        shell: bash
        run: echo "path=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"

      - name: Cache pnpm store
        uses: actions/cache@v5
        with:
          path: \${{ steps.pnpm-store.outputs.path }}
          key: \${{ runner.os }}-pnpm-store-\${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: |
            \${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Build packages
        run: pnpm packages:build

      - name: Run examples E2E
        run: pnpm examples:e2e
`,
  );
}

async function writeReleaseVersionScript(root, files) {
  await mkdir(join(root, "scripts"), { recursive: true });
  await writeFile(
    join(root, "scripts/release-version.sh"),
    `#!/usr/bin/env bash
node <<NODE
const files = [
${files.map((file) => `  "${file}",`).join("\n")}
];
NODE
`,
  );
}

async function removeReleaseVersionTarget(root, file) {
  const relativePath = join(root, "scripts/release-version.sh");
  const source = await readFile(relativePath, "utf8");
  await writeFile(relativePath, source.replace(`  "${file}",\n`, ""));
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

async function writeTypeScriptBuildGraphPlan(root) {
  await mkdir(join(root, "docs/plans"), { recursive: true });
  await writeFile(
    join(root, "docs/plans/typescript-build-graph.md"),
    `# TypeScript Build Graph Plan

## Source and Test Config Split

## .tsbuildinfo Placement

## Package and Example Graphs

## Publish Layout Constraints

## Decision for now

## Migration steps
`,
  );
}

async function writeConfigPilotFiles(root) {
  await writeTypeScriptBuildGraphPilotFiles(root, "config", "@tsuzuru/config");
}

async function writeTypeScriptBuildGraphPilotFiles(root, packageDir, packageName) {
  await writeFile(join(root, ".gitignore"), "**/.tsbuildinfo/\n*.tsbuildinfo\n");
  await mkdir(join(root, "packages", packageDir), { recursive: true });
  await writeJson(join(root, "packages", packageDir, "package.json"), {
    name: packageName,
    scripts: {
      "typecheck:self": "tsc -p tsconfig.test.json",
    },
  });
  await writeJson(join(root, "packages", packageDir, "tsconfig.json"), {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
      composite: true,
      tsBuildInfoFile: ".tsbuildinfo/tsconfig.tsbuildinfo",
    },
    include: ["src/**/*.ts"],
  });
  await writeJson(join(root, "packages", packageDir, "tsconfig.test.json"), {
    extends: "./tsconfig.json",
    compilerOptions: {
      noEmit: true,
    },
    include: ["src/**/*.ts", "tests/**/*.ts"],
  });
}

async function writePackageCoreReferenceExperimentFiles(root) {
  await writeTypeScriptBuildGraphPilotFiles(root, "core", "@tsuzuru/core");
  await writeTypeScriptBuildGraphPilotFiles(root, "config", "@tsuzuru/config");
  await writeTypeScriptBuildGraphPilotFiles(root, "cli", "@tsuzuru/cli");
  await mutateJson(join(root, "packages/cli/tsconfig.json"), (tsconfig) => {
    tsconfig.references = [{ path: "../config" }, { path: "../core" }];
  });
  const pluginPilots = [
    { dir: "plugin-std-visual", name: "@tsuzuru/plugin-std-visual" },
    { dir: "plugin-std-audio", name: "@tsuzuru/plugin-std-audio" },
  ];
  for (const pluginPilot of pluginPilots) {
    await writeTypeScriptBuildGraphPilotFiles(root, pluginPilot.dir, pluginPilot.name);
    await mutateJson(join(root, `packages/${pluginPilot.dir}/tsconfig.json`), (tsconfig) => {
      tsconfig.references = [{ path: "../core" }];
    });
  }
  await writePreactReferenceExperimentFiles(root);
  await writeVueReferenceExperimentFiles(root);
  await writeStandardUiPreactReferenceExperimentFiles(root);
  await writeJson(join(root, "tsconfig.packages.experimental.json"), {
    files: [],
    references: [
      { path: "./packages/core" },
      { path: "./packages/config" },
      { path: "./packages/plugin-std-visual" },
      { path: "./packages/plugin-std-audio" },
      { path: "./packages/cli" },
      { path: "./packages/preact" },
      { path: "./packages/vue" },
      { path: "./packages/standard-ui-preact" },
    ],
  });
  await mutateRootPackageJson(root, (packageJson) => {
    for (const scriptName of Object.keys(packageJson.scripts)) {
      packageJson.scripts[scriptName] = packageJson.scripts[scriptName].replaceAll("@fixture/core", "@tsuzuru/core");
    }
    packageJson.scripts["pack:dry-run"] += " && pnpm --filter @tsuzuru/config pack --dry-run";
    packageJson.scripts["pack:dry-run"] += " && pnpm --filter @tsuzuru/cli pack --dry-run";
    packageJson.scripts["pack:dry-run"] += " && pnpm --filter @tsuzuru/preact pack --dry-run";
    packageJson.scripts["pack:dry-run"] += " && pnpm --filter @tsuzuru/vue pack --dry-run";
    packageJson.scripts["pack:dry-run"] += " && pnpm --filter @tsuzuru/standard-ui-preact pack --dry-run";
    packageJson.scripts.test += " && pnpm --filter @tsuzuru/config test";
    packageJson.scripts.test += " && pnpm --filter @tsuzuru/cli test";
    packageJson.scripts.test += " && pnpm --filter @tsuzuru/preact test";
    packageJson.scripts.test += " && pnpm --filter @tsuzuru/vue test";
    packageJson.scripts.test += " && pnpm --filter @tsuzuru/standard-ui-preact test";
    for (const pluginPilot of pluginPilots) {
      packageJson.scripts["pack:dry-run"] += ` && pnpm --filter ${pluginPilot.name} pack --dry-run`;
      packageJson.scripts.test += ` && pnpm --filter ${pluginPilot.name} test`;
    }
  });
  await writeAgentsWithReferencePilots(root);
  await writeTreeInventoryDocWithReferencePilots(root, "README.md");
  await writeTreeInventoryDocWithReferencePilots(root, "docs/architecture.md");
  await writeReleaseVersionScript(root, [
    "package.json",
    "packages/addon/package.json",
    "packages/core/package.json",
    "packages/config/package.json",
    "packages/cli/package.json",
    "packages/plugin-std-visual/package.json",
    "packages/plugin-std-audio/package.json",
    "packages/preact/package.json",
    "packages/vue/package.json",
    "packages/standard-ui-preact/package.json",
    "examples/example/package.json",
  ]);
}

async function writePreactReferenceExperimentFiles(root) {
  await writeFile(join(root, ".gitignore"), "**/.tsbuildinfo/\n*.tsbuildinfo\n");
  await mkdir(join(root, "packages/preact"), { recursive: true });
  await writeJson(join(root, "packages/preact/package.json"), {
    name: "@tsuzuru/preact",
    scripts: {
      "typecheck:self": "tsc -p tsconfig.json --noEmit",
    },
  });
  await writeJson(join(root, "packages/preact/tsconfig.json"), {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
      rootDir: "src",
      outDir: "dist",
      composite: true,
      tsBuildInfoFile: ".tsbuildinfo/tsconfig.tsbuildinfo",
      jsx: "react-jsx",
      jsxImportSource: "preact",
      lib: ["ES2022", "DOM"],
    },
    references: [{ path: "../core" }],
    include: ["src/**/*.ts", "src/**/*.tsx"],
  });
}

async function writeStandardUiPreactReferenceExperimentFiles(root) {
  await writeFile(join(root, ".gitignore"), "**/.tsbuildinfo/\n*.tsbuildinfo\n");
  await mkdir(join(root, "packages/standard-ui-preact"), { recursive: true });
  await writeJson(join(root, "packages/standard-ui-preact/package.json"), {
    name: "@tsuzuru/standard-ui-preact",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./style.css": "./dist/style.css",
    },
    files: ["dist/index.*", "dist/style.css"],
    scripts: {
      "typecheck:self": "tsc -p tsconfig.json --noEmit",
    },
  });
  await writeJson(join(root, "packages/standard-ui-preact/tsconfig.json"), {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
      rootDir: "src",
      outDir: "dist",
      composite: true,
      tsBuildInfoFile: ".tsbuildinfo/tsconfig.tsbuildinfo",
      jsx: "react-jsx",
      jsxImportSource: "preact",
      lib: ["ES2022", "DOM"],
    },
    references: [{ path: "../core" }],
    include: ["src/**/*.ts", "src/**/*.tsx"],
  });
}

async function writeVueReferenceExperimentFiles(root) {
  await writeFile(join(root, ".gitignore"), "**/.tsbuildinfo/\n*.tsbuildinfo\n");
  await mkdir(join(root, "packages/vue"), { recursive: true });
  await writeJson(join(root, "packages/vue/package.json"), {
    name: "@tsuzuru/vue",
    scripts: {
      "typecheck:self": "tsc -p tsconfig.json --noEmit",
    },
  });
  await writeJson(join(root, "packages/vue/tsconfig.json"), {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
      rootDir: "src",
      outDir: "dist",
      composite: true,
      tsBuildInfoFile: ".tsbuildinfo/tsconfig.tsbuildinfo",
      lib: ["ES2022", "DOM"],
    },
    references: [{ path: "../core" }],
    include: ["src/**/*.ts"],
  });
}

async function writeAgentsWithReferencePilots(root) {
  await writeFile(
    join(root, "AGENTS.md"),
    `# Fixture Agents

Current packages:

\`\`\`txt
packages/addon
packages/cli
packages/config
packages/core
packages/preact
packages/plugin-std-audio
packages/plugin-std-visual
packages/standard-ui-preact
packages/vue
\`\`\`

Current examples:

\`\`\`txt
examples/example
\`\`\`
`,
  );
}

async function writeTreeInventoryDocWithReferencePilots(root, relativePath) {
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(
    join(root, relativePath),
    `# Fixture

\`\`\`txt
packages/
  addon/
  cli/
  config/
  core/
  preact/
  plugin-std-audio/
  plugin-std-visual/
  standard-ui-preact/
  vue/

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
  await mutateJson(packageJsonPath, mutate);
}

async function mutateJson(path, mutate) {
  const packageJson = JSON.parse(await readFile(path, "utf8"));
  mutate(packageJson);
  await writeJson(path, packageJson);
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
