import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTsuzuruConfig } from "../src/config-loader.js";

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "tsuzuru-cli-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("loadTsuzuruConfig", () => {
  it("loads a valid TypeScript config default export", async () => {
    const root = await createTempProject();
    await writeFile(
      join(root, "tsuzuru.config.ts"),
      `const config = {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  project: {
    id: "tsuzuru.example.config-loader",
    version: "1",
  },
  plugins: [{ name: "testPlugin" }],
} as const;

export default config;
`,
    );

    const loaded = await loadTsuzuruConfig({ cwd: root });

    expect(loaded.configRoot).toBe(root);
    expect(loaded.config.project).toEqual({
      id: "tsuzuru.example.config-loader",
      version: "1",
    });
    expect(loaded.config.scenario.entry).toBe("scenario/main.tzr");
    expect(loaded.config.scenario.files).toEqual(["scenario/**/*.tzr"]);
    expect(loaded.config.plugins).toEqual([{ name: "testPlugin" }]);
  });

  it("fails when tsuzuru.config.ts is missing", async () => {
    const root = await createTempProject();

    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow("Could not find tsuzuru.config.ts");
  });

  it("fails when scenario.entry is invalid", async () => {
    const root = await createTempProject();
    await mkdir(join(root, "scenario"));
    await writeFile(
      join(root, "tsuzuru.config.ts"),
      `export default {
  scenario: {
    entry: "",
    files: ["scenario/**/*.tzr"],
  },
};
`,
    );

    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow("scenario.entry must be a non-empty string");
  });

  it("fails when project identity is invalid", async () => {
    const root = await createTempProject();
    await writeFile(
      join(root, "tsuzuru.config.ts"),
      `export default {
  project: {
    id: "",
    version: "",
  },
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
};
`,
    );

    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow("project.id must be a non-empty string");
  });
});
