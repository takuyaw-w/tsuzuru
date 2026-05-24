import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadOptionalTsuzuruConfig,
  loadTsuzuruConfig,
  resolveTsuzuruConfigPath,
  TsuzuruConfigLoadError,
  validateTsuzuruConfig,
} from "../src/node.js";

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "tsuzuru-config-"));
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
    expect(loaded.configPath).toBe(join(root, "tsuzuru.config.ts"));
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

  it("loads an explicit config file", async () => {
    const root = await createTempProject();
    await writeFile(
      join(root, "custom.config.ts"),
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
};
`,
    );

    const loaded = await loadTsuzuruConfig({ cwd: root, configFile: "custom.config.ts" });

    expect(loaded.configPath).toBe(join(root, "custom.config.ts"));
    expect(loaded.config.scenario.entry).toBe("scenario/main.tzr");
  });

  it("loads an absolute config file", async () => {
    const root = await createTempProject();
    const configPath = join(root, "config", "custom.config.ts");
    await mkdir(join(root, "config"), { recursive: true });
    await writeFile(
      configPath,
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
};
`,
    );

    const loaded = await loadTsuzuruConfig({ cwd: root, configFile: configPath });

    expect(loaded.configPath).toBe(configPath);
    expect(loaded.configRoot).toBe(root);
  });

  it("resolves the default config path", async () => {
    const root = await createTempProject();

    expect(resolveTsuzuruConfigPath({ cwd: root })).toBe(join(root, "tsuzuru.config.ts"));
  });

  it("resolves absolute config paths without joining them to cwd", async () => {
    const root = await createTempProject();
    const configPath = resolve(root, "config", "custom.config.ts");

    expect(resolveTsuzuruConfigPath({ cwd: root, configFile: configPath })).toBe(configPath);
  });

  it("fails when tsuzuru.config.ts is missing", async () => {
    const root = await createTempProject();

    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toBeInstanceOf(TsuzuruConfigLoadError);
    await expect(loadTsuzuruConfig({ cwd: root })).rejects.toThrow("Could not find tsuzuru.config.ts");
  });

  it("returns null from optional loading when tsuzuru.config.ts is missing", async () => {
    const root = await createTempProject();

    await expect(loadOptionalTsuzuruConfig({ cwd: root })).resolves.toBeNull();
  });

  it("does not treat invalid config as optional missing config", async () => {
    const root = await createTempProject();
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

    await expect(loadOptionalTsuzuruConfig({ cwd: root })).rejects.toThrow("scenario.entry must be a non-empty string");
  });

  it("does not treat inaccessible config paths as missing", async () => {
    const root = await createTempProject();
    const configDir = join(root, "private");
    await mkdir(configDir);
    await chmod(configDir, 0o000);

    try {
      await expect(
        loadOptionalTsuzuruConfig({ cwd: root, configFile: "private/tsuzuru.config.ts" }),
      ).rejects.toBeInstanceOf(TsuzuruConfigLoadError);
      await expect(loadTsuzuruConfig({ cwd: root, configFile: "private/tsuzuru.config.ts" })).rejects.toThrow(
        "Failed to access",
      );
    } finally {
      await chmod(configDir, 0o700);
    }
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

  it("validates plugin definitions", () => {
    expect(() =>
      validateTsuzuruConfig({
        scenario: {
          entry: "scenario/main.tzr",
          files: ["scenario/**/*.tzr"],
        },
        plugins: [{ name: "" }],
      }),
    ).toThrow("plugins[0] must be an object with a non-empty name string");
  });
});
