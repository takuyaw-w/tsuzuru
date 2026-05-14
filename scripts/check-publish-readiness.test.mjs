import { describe, expect, it } from "vitest";
import { collectExportTargets, validatePackedPackage } from "./lib/check-publish-readiness.mjs";

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
