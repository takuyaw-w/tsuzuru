import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { tsuzuru } from "../src/index.js";

const tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "tsuzuru-vite-plugin-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("tsuzuru", () => {
  it("loads a .tzr file as an ESM module that exports a compiled document", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  end\n");
    const result = await loadScenarioModule(tsuzuru(), root, scenarioPath);

    expect(result.watchFiles).toContain(scenarioPath);
    expect(result.document).toMatchObject({
      type: "CompiledTzrDocument",
      filePath: "scenario/main.tzr",
      scenes: {
        start: { id: "start" },
      },
    });
  });

  it("supports the explicit ?tsuzuru query", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  end\n");
    const result = await loadScenarioModule(tsuzuru(), root, `${scenarioPath}?tsuzuru`);

    expect(result.document.type).toBe("CompiledTzrDocument");
  });

  it("leaves Vite raw and url queries alone", async () => {
    const plugin = tsuzuru();
    const load = getLoadHook(plugin);

    await expect(load.call(createPluginContext() as never, "/tmp/main.tzr?raw")).resolves.toBeNull();
    await expect(load.call(createPluginContext() as never, "/tmp/main.tzr?url")).resolves.toBeNull();
  });

  it("follows include directives and watches included files", async () => {
    const root = await createTempRoot();
    const mainPath = await writeScenario(
      root,
      "scenario/main.tzr",
      'include "./chapters/opening.tzr"\nscene start:\n  jump opening\n',
    );
    const includedPath = await writeScenario(root, "scenario/chapters/opening.tzr", "scene opening:\n  end\n");
    const result = await loadScenarioModule(tsuzuru(), root, mainPath);

    expect(result.watchFiles).toEqual(expect.arrayContaining([mainPath, includedPath]));
    expect(result.document.scenes).toMatchObject({
      start: { id: "start" },
      opening: { id: "opening" },
    });
  });

  it("watches included files and config files together", async () => {
    const root = await createTempRoot();
    const mainPath = await writeScenario(
      root,
      "scenario/main.tzr",
      'include "./chapters/opening.tzr"\nscene start:\n  jump opening\n',
    );
    const includedPath = await writeScenario(root, "scenario/chapters/opening.tzr", "scene opening:\n  end\n");
    const configPath = await writeConfig(
      root,
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
};
`,
    );

    const result = await loadScenarioModule(tsuzuru(), root, mainPath);

    expect(result.watchFiles).toEqual(expect.arrayContaining([mainPath, includedPath, configPath]));
  });

  it("passes compile plugin definitions to project compilation", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  call test.unlock()\n  end\n");
    const result = await loadScenarioModule(
      tsuzuru({
        plugins: [
          {
            name: "test",
            commands: {
              "test.unlock": { name: "test.unlock" },
            },
          },
        ],
      }),
      root,
      scenarioPath,
    );

    expect(result.document.type).toBe("CompiledTzrDocument");
  });

  it("uses compile plugin definitions from tsuzuru.config.ts by default", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  call test.unlock()\n  end\n");
    const configPath = await writeConfig(
      root,
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  plugins: [
    {
      name: "test",
      commands: {
        "test.unlock": { name: "test.unlock" },
      },
    },
  ],
};
`,
    );

    const result = await loadScenarioModule(tsuzuru(), root, scenarioPath);

    expect(result.document.type).toBe("CompiledTzrDocument");
    expect(result.watchFiles).toContain(configPath);
  });

  it("watches the default config path when tsuzuru.config.ts is missing", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  end\n");
    const result = await loadScenarioModule(tsuzuru(), root, scenarioPath);

    expect(result.watchFiles).toContain(join(root, "tsuzuru.config.ts"));
  });

  it("lets explicit compile plugin definitions override tsuzuru.config.ts", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  call test.unlock()\n  end\n");
    await writeConfig(
      root,
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  plugins: [
    {
      name: "test",
      commands: {
        "test.unlock": { name: "test.unlock" },
      },
    },
  ],
};
`,
    );

    await expect(loadScenarioModule(tsuzuru({ plugins: [] }), root, scenarioPath)).rejects.toMatchObject({
      message: expect.stringContaining('CallStatement" is not compile-supported yet'),
    });
  });

  it("does not load config files when explicit compile plugin definitions are provided", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  end\n");
    await writeConfig(root, "export default {\n");

    const result = await loadScenarioModule(tsuzuru({ plugins: [] }), root, scenarioPath);

    expect(result.document.type).toBe("CompiledTzrDocument");
    expect(result.watchFiles).not.toContain(join(root, "tsuzuru.config.ts"));
  });

  it("can disable config file loading", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  call test.unlock()\n  end\n");
    await writeConfig(
      root,
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  plugins: [
    {
      name: "test",
      commands: {
        "test.unlock": { name: "test.unlock" },
      },
    },
  ],
};
`,
    );

    await expect(loadScenarioModule(tsuzuru({ configFile: false }), root, scenarioPath)).rejects.toMatchObject({
      message: expect.stringContaining('CallStatement" is not compile-supported yet'),
    });
  });

  it("loads an explicit config file", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  call test.unlock()\n  end\n");
    const configPath = await writeConfig(
      root,
      `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  plugins: [
    {
      name: "test",
      commands: {
        "test.unlock": { name: "test.unlock" },
      },
    },
  ],
};
`,
      "custom.tsuzuru.config.ts",
    );

    const result = await loadScenarioModule(tsuzuru({ configFile: "custom.tsuzuru.config.ts" }), root, scenarioPath);

    expect(result.document.type).toBe("CompiledTzrDocument");
    expect(result.watchFiles).toContain(configPath);
  });

  it("reports invalid config files as Vite errors", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  end\n");
    await writeConfig(
      root,
      `export default {
  scenario: {
    entry: "",
    files: ["scenario/**/*.tzr"],
  },
};
`,
    );

    const result = await loadScenarioModuleError(tsuzuru(), root, scenarioPath);

    expect(result.error).toEqual(
      expect.objectContaining({ message: expect.stringContaining("Failed to load tsuzuru config") }),
    );
    expect(result.watchFiles).toContain(join(root, "tsuzuru.config.ts"));
  });

  it("reports config syntax errors as Vite errors", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  end\n");
    await writeConfig(root, "export default {\n");

    const result = await loadScenarioModuleError(tsuzuru(), root, scenarioPath);

    expect(result.error).toEqual(
      expect.objectContaining({ message: expect.stringContaining("Failed to load tsuzuru config") }),
    );
    expect(result.watchFiles).toContain(join(root, "tsuzuru.config.ts"));
  });

  it("reports unsupported plugin calls when no compile plugin is provided", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  call test.unlock()\n  end\n");

    await expect(loadScenarioModule(tsuzuru(), root, scenarioPath)).rejects.toMatchObject({
      message: expect.stringContaining('CallStatement" is not compile-supported yet'),
      loc: {
        file: scenarioPath,
        line: 2,
        column: 3,
      },
    });
  });

  it("reports parse diagnostics as Vite errors", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start\n  end\n");

    await expect(loadScenarioModule(tsuzuru(), root, scenarioPath)).rejects.toMatchObject({
      message: expect.stringContaining("[error] scenario/main.tzr:1:1"),
      loc: {
        file: scenarioPath,
        line: 1,
        column: 1,
      },
    });
  });

  it("reports compile diagnostics as Vite errors", async () => {
    const root = await createTempRoot();
    const scenarioPath = await writeScenario(root, "scenario/main.tzr", "scene start:\n  jump missing\n");

    await expect(loadScenarioModule(tsuzuru(), root, scenarioPath)).rejects.toMatchObject({
      message: expect.stringContaining('Unknown scene "missing".'),
      loc: {
        file: scenarioPath,
        line: 2,
        column: 3,
      },
    });
  });
});

async function writeScenario(root: string, relativePath: string, source: string): Promise<string> {
  const filename = resolve(root, relativePath);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, source, "utf8");
  return filename;
}

async function writeConfig(root: string, source: string, relativePath = "tsuzuru.config.ts"): Promise<string> {
  const filename = resolve(root, relativePath);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, source, "utf8");
  return filename;
}

async function loadScenarioModule(plugin: Plugin, root: string, id: string) {
  callConfigResolved(plugin, root);
  const context = createPluginContext();
  const loaded = await getLoadHook(plugin).call(context as never, id);
  if (loaded === null || loaded === undefined) {
    throw new Error("Expected plugin to load the scenario.");
  }
  const code = typeof loaded === "string" ? loaded : loaded.code;
  const modulePath = join(root, "compiled-scenario.mjs");
  await writeFile(modulePath, code, "utf8");
  const imported = (await import(`${pathToFileURL(modulePath).href}?${Date.now()}`)) as {
    readonly default: { readonly type: string; readonly scenes: Record<string, unknown> };
  };

  return {
    document: imported.default,
    watchFiles: context.watchFiles,
  };
}

async function loadScenarioModuleError(plugin: Plugin, root: string, id: string) {
  callConfigResolved(plugin, root);
  const context = createPluginContext();
  try {
    await getLoadHook(plugin).call(context as never, id);
  } catch (error) {
    return {
      error,
      watchFiles: context.watchFiles,
    };
  }
  throw new Error("Expected plugin to report an error.");
}

function getLoadHook(plugin: Plugin) {
  if (typeof plugin.load !== "function") {
    throw new Error("Expected a load hook.");
  }
  return plugin.load;
}

function callConfigResolved(plugin: Plugin, root: string): void {
  const hook = plugin.configResolved;
  if (hook === undefined) {
    return;
  }
  if (typeof hook === "function") {
    hook.call(createPluginContext() as never, { root } as never);
    return;
  }
  hook.handler.call(createPluginContext() as never, { root } as never);
}

function createPluginContext() {
  return {
    watchFiles: [] as string[],
    addWatchFile(file: string) {
      this.watchFiles.push(file);
    },
    error(error: unknown): never {
      throw error;
    },
  };
}
