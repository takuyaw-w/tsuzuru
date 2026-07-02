import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectTsuzuruDependencyNames,
  getGeneratedProjectInstallArgs,
  getRegistryCreateCommand,
  parseSmokeSource,
  verifyGeneratedProjectFixedTheme,
} from "./smoke-create-tsuzuru.mjs";

describe("parseSmokeSource", () => {
  it("prefers the --local flag over the environment value", () => {
    expect(parseSmokeSource(["--local"], "registry")).toBe("local");
  });

  it("prefers the --registry flag over the environment value", () => {
    expect(parseSmokeSource(["--registry"], "local")).toBe("registry");
  });

  it("accepts explicit environment values", () => {
    expect(parseSmokeSource([], "local")).toBe("local");
    expect(parseSmokeSource([], "registry")).toBe("registry");
  });

  it("rejects unsupported source values", () => {
    expect(() => parseSmokeSource([], "offline")).toThrow(
      'Unsupported TSUZURU_SMOKE_SOURCE value: offline. Expected "local" or "registry".',
    );
  });
});

describe("getRegistryCreateCommand", () => {
  it("uses pnpm create for the pnpm registry smoke", () => {
    expect(getRegistryCreateCommand("pnpm")).toEqual({
      args: ["create", "tsuzuru", "tsuzuru-smoke-app"],
      command: "pnpm",
    });
  });

  it("uses npm create for the npm registry smoke", () => {
    expect(getRegistryCreateCommand("npm")).toEqual({
      args: ["create", "tsuzuru", "tsuzuru-smoke-app"],
      command: "npm",
    });
  });
});

describe("getGeneratedProjectInstallArgs", () => {
  it("uses prefer-offline when the generated project has no lockfile", () => {
    expect(getGeneratedProjectInstallArgs({ hasLockfile: false, smokeSource: "local" })).toEqual([
      "install",
      "--prefer-offline",
    ]);
  });

  it("does not use frozen-lockfile for local smoke because package.json is rewritten to local tarballs", () => {
    expect(getGeneratedProjectInstallArgs({ hasLockfile: true, smokeSource: "local" })).toEqual([
      "install",
      "--prefer-offline",
    ]);
  });

  it("uses frozen-lockfile for registry smoke when a template lockfile is present", () => {
    expect(getGeneratedProjectInstallArgs({ hasLockfile: true, smokeSource: "registry" })).toEqual([
      "install",
      "--frozen-lockfile",
      "--prefer-offline",
    ]);
  });
});

describe("collectTsuzuruDependencyNames", () => {
  it("collects direct and transitive local Tsuzuru dependency blocks", () => {
    expect(
      collectTsuzuruDependencyNames({
        dependencies: {
          "@tsuzuru/core": "^1.0.0",
          preact: "^10.0.0",
        },
        devDependencies: {
          "@tsuzuru/vite-plugin": "^1.0.0",
        },
        optionalDependencies: {
          "@tsuzuru/plugin-std-hotspot": "^1.0.0",
        },
      }),
    ).toEqual(["@tsuzuru/core", "@tsuzuru/plugin-std-hotspot", "@tsuzuru/vite-plugin"]);
  });
});

describe("verifyGeneratedProjectFixedTheme", () => {
  async function createGeneratedProjectFixture(overrides = {}) {
    const root = await mkdtemp(join(tmpdir(), "tsuzuru-smoke-fixture-"));
    const projectDir = join(root, "app");
    await mkdir(join(projectDir, "src", "themes"), { recursive: true });

    await writeFile(
      join(projectDir, "package.json"),
      `${JSON.stringify(
        overrides.packageJson ?? {
          dependencies: {
            "@tsuzuru/standard-ui-preact": "file:/tmp/standard-ui-preact.tgz",
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(projectDir, "src", "App.tsx"),
      overrides.appSource ??
        [
          'import { TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";',
          'import { localTheme } from "./themes/localTheme.js";',
          "export function App() {",
          "  return <TsuzuruThemeProvider theme={localTheme}>content</TsuzuruThemeProvider>;",
          "}",
          "",
        ].join("\n"),
    );
    await writeFile(
      join(projectDir, "src", "themes", "localTheme.ts"),
      overrides.localThemeSource ??
        [
          'import type { TsuzuruTheme } from "@tsuzuru/standard-ui-preact";',
          "export const localTheme = {",
          '  id: "local",',
          "  tokens: { messageWindow: {}, choiceLayer: {} },",
          "} satisfies TsuzuruTheme;",
          "",
        ].join("\n"),
    );
    await writeFile(
      join(projectDir, "tsuzuru.config.ts"),
      overrides.configSource ?? ["export default {", '  ui: { theme: { default: "local" } },', "};", ""].join("\n"),
    );

    return { projectDir, root };
  }

  it("accepts a generated project with a fixed local theme", async () => {
    const { projectDir, root } = await createGeneratedProjectFixture();

    try {
      await expect(verifyGeneratedProjectFixedTheme(projectDir)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects generated runtime theme switching UI", async () => {
    const { projectDir, root } = await createGeneratedProjectFixture({
      appSource: [
        'import { TsuzuruThemeProvider } from "@tsuzuru/standard-ui-preact";',
        'import { localTheme } from "./themes/localTheme.js";',
        "function ThemeSwitcher() { return <select />; }",
        "export function App() {",
        "  return <TsuzuruThemeProvider theme={localTheme}><ThemeSwitcher /></TsuzuruThemeProvider>;",
        "}",
        "",
      ].join("\n"),
    });

    try {
      await expect(verifyGeneratedProjectFixedTheme(projectDir)).rejects.toThrow(
        'src/App.tsx must not contain "ThemeSwitcher".',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
