import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkPublishReadiness, collectExportTargets, validatePackedPackage } from "./lib/check-publish-readiness.mjs";

const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const packageEntry = {
  dir: "example",
  name: "@fixture/example",
  packageJson: {
    name: "@fixture/example",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./browser": {
        types: "./dist/browser.d.ts",
        import: "./dist/browser.js",
      },
    },
    files: ["dist"],
  },
  relativeDir: "packages/example",
};

describe("validatePackedPackage", () => {
  it("passes when required package metadata and exported files are present", () => {
    expect(
      validatePackedPackage(packageEntry, [
        "package/package.json",
        "package/README.md",
        "package/LICENSE",
        "package/dist/index.d.ts",
        "package/dist/index.js",
        "package/dist/browser.d.ts",
        "package/dist/browser.js",
      ]),
    ).toEqual([]);
  });

  it("fails when README.md is missing", () => {
    expect(validatePackedPackage(packageEntry, validEntriesWithout("package/README.md"))).toContain(
      "@fixture/example tarball is missing README.md.",
    );
  });

  it("fails when LICENSE and LICENSE.md are missing", () => {
    expect(validatePackedPackage(packageEntry, validEntriesWithout("package/LICENSE"))).toContain(
      "@fixture/example tarball is missing LICENSE or LICENSE.md.",
    );
  });

  it("fails when package.json types target is missing", () => {
    expect(validatePackedPackage(packageEntry, validEntriesWithout("package/dist/index.d.ts"))).toContain(
      "@fixture/example tarball is missing dist/index.d.ts.",
    );
  });

  it("fails when an export target is missing", () => {
    expect(validatePackedPackage(packageEntry, validEntriesWithout("package/dist/browser.js"))).toContain(
      "@fixture/example tarball is missing dist/browser.js.",
    );
  });

  it("fails when files is an empty array", () => {
    expect(validatePackedPackage({ ...packageEntry, packageJson: { ...packageEntry.packageJson, files: [] } }, validEntries())).toContain(
      "@fixture/example package.json files must not be empty.",
    );
  });

  it("fails when legacy-only paths are included", () => {
    expect(validatePackedPackage(packageEntry, [...validEntries(), "package/dist/legacy-parser.js"])).toContain(
      '@fixture/example tarball includes legacy or removed path "dist/legacy-parser.js".',
    );
  });

  it("fails when TypeScript build info is included", () => {
    expect(validatePackedPackage(packageEntry, [...validEntries(), "package/.tsbuildinfo/tsconfig.tsbuildinfo"])).toContain(
      '@fixture/example tarball includes TypeScript build info path ".tsbuildinfo/tsconfig.tsbuildinfo".',
    );
    expect(validatePackedPackage(packageEntry, [...validEntries(), "package/dist/tsconfig.tsbuildinfo"])).toContain(
      '@fixture/example tarball includes TypeScript build info path "dist/tsconfig.tsbuildinfo".',
    );
  });
});

describe("collectExportTargets", () => {
  it("collects nested string export targets", () => {
    expect(
      collectExportTargets({
        ".": {
          development: {
            import: "./dist/dev.js",
          },
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      }),
    ).toEqual(["./dist/dev.js", "./dist/index.d.ts", "./dist/index.js"]);
  });
});

describe("checkPublishReadiness", () => {
  it("explains that package builds are required when pnpm pack fails", async () => {
    const root = await createFixtureRepo();

    const result = await checkPublishReadiness(root, {
      packPackage: async () => {
        throw new Error("missing dist/index.js");
      },
    });

    expect(result.failures).toEqual([
      '@fixture/example pack failed: missing dist/index.js. Run "pnpm packages:build" before "pnpm publish-readiness:check" on a clean checkout.',
    ]);
  });
});

function validEntries() {
  return [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/dist/index.d.ts",
    "package/dist/index.js",
    "package/dist/browser.d.ts",
    "package/dist/browser.js",
  ];
}

function validEntriesWithout(path) {
  return validEntries().filter((entry) => entry !== path);
}

async function createFixtureRepo() {
  const root = await mkdtemp(join(tmpdir(), "tsuzuru-publish-readiness-"));
  tempRoots.push(root);

  await mkdir(join(root, "packages", "example"), { recursive: true });
  await writeFile(
    join(root, "packages", "example", "package.json"),
    `${JSON.stringify({ name: "@fixture/example", type: "module" }, null, 2)}\n`,
  );

  return root;
}
