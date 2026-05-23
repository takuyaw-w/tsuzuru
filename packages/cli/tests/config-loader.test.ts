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
  storage: {
    enabled: true,
    prefix: "tsuzuru:config-loader",
    slots: 3,
    saves: "standard-runtime",
  },
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
    expect(loaded.config.storage).toEqual({
      enabled: true,
      prefix: "tsuzuru:config-loader",
      slots: 3,
      saves: "standard-runtime",
    });
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

  it("fails when storage config is invalid", async () => {
    const root = await createTempProject();
    await writeFile(
      join(root, "tsuzuru.config.ts"),
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  storage: {
    prefix: "",
    slots: 0,
    saves: "legacy",
  },
};
`,
    );

    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow("storage.prefix must be a non-empty string");
    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow(
      "storage.slots must be a positive integer when it is a number",
    );
    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow(
      'storage.saves must be false, "standard-runtime", or an object',
    );
  });

  it("fails when storage preference defaults would be normalized away", async () => {
    const root = await createTempProject();
    await writeFile(
      join(root, "tsuzuru.config.ts"),
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  storage: {
    preferences: {
      textSpeedOptions: [30, 60, 120],
      defaults: {
        textSpeedCharactersPerSecond: 90,
        bgmVolume: 100,
      },
    },
  },
};
`,
    );

    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow(
      "storage.preferences.defaults.textSpeedCharactersPerSecond must be one of textSpeedOptions",
    );
    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow(
      "storage.preferences.defaults.bgmVolume must be a number between 0 and 1",
    );
  });
});
