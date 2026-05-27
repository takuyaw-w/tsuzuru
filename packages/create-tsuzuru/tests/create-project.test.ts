import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProject, validateProjectName } from "../src/create-project.js";
import { getBasicTemplateDir, getTemplateDir } from "../src/template.js";

const tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "create-tsuzuru-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("createProject", () => {
  it("creates a project for a valid project name", async () => {
    const root = await createTempRoot();

    const result = await createProject({ cwd: root, projectName: "my-game" });

    expect(result.relativeTargetDir).toBe("my-game");
    await expect(readFile(join(root, "my-game", "package.json"), "utf8")).resolves.toContain('"name": "my-game"');
  });

  it("uses the bundled creator starter template by default", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "my-game" });
    const packageJson = JSON.parse(await readFile(join(root, "my-game", "package.json"), "utf8")) as {
      readonly dependencies: Record<string, string>;
      readonly devDependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@tsuzuru/standard-ui-preact"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/standard-game-storage"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/preact"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/plugin-std-effect"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/theme-standard"]).toBeUndefined();
    expect(packageJson.dependencies["@tsuzuru/theme-classic"]).toBeUndefined();
    expect(packageJson.dependencies["@tsuzuru/theme-dark-novel"]).toBeUndefined();
    expect(packageJson.dependencies["@tsuzuru/theme-minimal"]).toBeUndefined();
    expect(packageJson.devDependencies["@preact/preset-vite"]).toBeDefined();
    expect(packageJson.devDependencies["@tsuzuru/vite-plugin"]).toBeDefined();
    await expect(readFile(join(root, "my-game", "src", "main.tsx"), "utf8")).resolves.toContain("preact");
  });

  it("keeps an explicit templateDir higher priority than templateName", async () => {
    const root = await createTempRoot();
    const templateDir = join(root, "template");
    await mkdir(templateDir);
    await writeFile(join(templateDir, "package.json"), '{ "name": "{{projectName}}" }\n');
    await writeFile(join(templateDir, "marker.txt"), "custom template\n");

    await createProject({ cwd: root, projectName: "custom-game", templateDir, templateName: "html" });

    await expect(readFile(join(root, "custom-game", "marker.txt"), "utf8")).resolves.toBe("custom template\n");
  });

  it("replaces the package.json project name placeholder", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "starter" });
    const packageJson = JSON.parse(await readFile(join(root, "starter", "package.json"), "utf8")) as {
      readonly name: string;
    };

    expect(packageJson.name).toBe("starter");
  });

  it("fails when the target directory already exists", async () => {
    const root = await createTempRoot();
    await mkdir(join(root, "my-game"));

    await expect(createProject({ cwd: root, projectName: "my-game" })).rejects.toThrow(
      "Target directory already exists",
    );
  });

  it("rejects a missing project name", () => {
    expect(validateProjectName(undefined)).toBe("Project name is required.");
    expect(validateProjectName("")).toBe("Project name is required.");
  });

  it("includes tsuzuru.config.ts and scenario/main.tzr", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "my-game" });

    await expect(readFile(join(root, "my-game", "tsuzuru.config.ts"), "utf8")).resolves.toContain(
      "defineTsuzuruConfig",
    );
    await expect(readFile(join(root, "my-game", "scenario", "main.tzr"), "utf8")).resolves.toContain(
      'title "はじめてのTsuzuru"',
    );
  });

  it("generates a creator-facing app shell", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "my-game" });
    const appSource = await readFile(join(root, "my-game", "src", "App.tsx"), "utf8");
    const gameRootSource = await readFile(join(root, "my-game", "src", "ui", "GameRoot.tsx"), "utf8");
    const assetsSource = await readFile(join(root, "my-game", "src", "assets.ts"), "utf8");
    const localThemeSource = await readFile(join(root, "my-game", "src", "themes", "localTheme.ts"), "utf8");
    const readmeSource = await readFile(join(root, "my-game", "README.md"), "utf8");
    const tsuzuruConfigSource = await readFile(join(root, "my-game", "tsuzuru.config.ts"), "utf8");
    const viteConfigSource = await readFile(join(root, "my-game", "vite.config.ts"), "utf8");

    await expect(access(join(root, "my-game", "src", "scenario.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "game.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "game-storage.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "game-storage-api.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "save-compatibility.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "preferences.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "read-tracking.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "save-storage.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "save-migrations.ts"))).rejects.toThrow();
    await expect(access(join(root, "my-game", "src", "storage-keys.ts"))).rejects.toThrow();
    expect(appSource).toContain('import scenario from "../scenario/main.tzr"');
    expect(appSource).toContain('import { assets } from "./assets.js"');
    expect(appSource).toContain("TsuzuruThemeProvider");
    expect(appSource).toContain('import { localTheme } from "./themes/localTheme.js"');
    expect(appSource).toContain("<TsuzuruThemeProvider theme={localTheme}>");
    expect(appSource).toContain("<TitleScreen");
    expect(appSource).toContain("<GameRoot scenario={scenario} assets={assets} />");
    expect(appSource).not.toContain("ThemeSwitcher");
    expect(appSource).not.toContain("themeId");
    expect(appSource).not.toContain("const themes");
    expect(appSource).not.toContain("<select");
    expect(appSource).not.toContain("useRuntime");
    expect(appSource).not.toContain("parseTzr");
    expect(appSource).not.toContain("compileTzrProject");
    expect(appSource).not.toContain("@tsuzuru/standard-game-storage");
    expect(appSource).not.toContain("@tsuzuru/theme-standard");
    expect(gameRootSource).toContain("TsuzuruGame");
    expect(gameRootSource).toContain("scenario={scenario}");
    expect(gameRootSource).toContain("assets={assets}");
    expect(gameRootSource).not.toContain("@tsuzuru/standard-game-storage");
    expect(assetsSource).toContain("classroom");
    expect(assetsSource).toContain("mio_smile");
    expect(localThemeSource).toContain("satisfies TsuzuruTheme");
    expect(localThemeSource).toContain('id: "local"');
    expect(localThemeSource).toContain("messageWindow");
    expect(localThemeSource).toContain("choiceLayer");
    expect(readmeSource).not.toContain("scenario.ts");
    expect(readmeSource).not.toContain("parseTzr");
    expect(readmeSource).not.toContain("compileTzr");
    expect(readmeSource).not.toContain("{{projectName}}");
    expect(readmeSource).toContain("# my-game");
    expect(readmeSource).toContain("tsuzuru.config.ts");
    expect(readmeSource).toContain("src/themes/localTheme.ts");
    expect(readmeSource).toContain("theme switching UI");
    expect(tsuzuruConfigSource).toContain('id: "my-game"');
    expect(tsuzuruConfigSource).toContain("project: projectIdentity");
    expect(tsuzuruConfigSource).toContain("storage: {");
    expect(tsuzuruConfigSource).toContain("slots: 3");
    expect(tsuzuruConfigSource).toContain('saves: "standard-runtime"');
    expect(tsuzuruConfigSource).toContain('default: "local"');
    expect(tsuzuruConfigSource).not.toContain("available");
    expect(tsuzuruConfigSource).toContain("createStdVisualPlugin()");
    expect(tsuzuruConfigSource).toContain("createStdAudioPlugin()");
    expect(tsuzuruConfigSource).toContain("createStdEffectPlugin()");
    expect(tsuzuruConfigSource).not.toContain("{{projectName}}");
    expect(viteConfigSource).toContain("@preact/preset-vite");
    expect(viteConfigSource).toContain("@tsuzuru/vite-plugin");
    expect(viteConfigSource).toContain("tsuzuru()");
    expect(viteConfigSource).not.toContain("@tsuzuru/plugin-std-visual");
    expect(viteConfigSource).not.toContain("@tsuzuru/plugin-std-audio");
    expect(viteConfigSource).not.toContain("@tsuzuru/plugin-std-effect");
    expect(viteConfigSource).not.toContain("createStdVisualPlugin()");
    expect(viteConfigSource).not.toContain("createStdAudioPlugin()");
    expect(viteConfigSource).not.toContain("createStdEffectPlugin()");
    expect(viteConfigSource).not.toContain("tsuzuru({");
  });

  it("includes starter README and placeholder assets", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "my-game" });

    await expect(readFile(join(root, "my-game", "README.md"), "utf8")).resolves.toContain("scenario/main.tzr");
    await expect(
      readFile(join(root, "my-game", "public", "assets", "images", "classroom.svg"), "utf8"),
    ).resolves.toContain("Sunset classroom background");
    await expect(
      readFile(join(root, "my-game", "public", "assets", "images", "mio_smile.svg"), "utf8"),
    ).resolves.toContain("Mio smiling character placeholder");
  });

  it("includes a check:scenario script", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "my-game" });
    const packageJson = JSON.parse(await readFile(join(root, "my-game", "package.json"), "utf8")) as {
      readonly scripts: Record<string, string>;
    };

    expect(packageJson.scripts["check:scenario"]).toBe("tsuzuru check");
    expect(packageJson.scripts.typecheck).toBe("tsc -p tsconfig.json --noEmit");
  });

  it("does not include removed legacy DSL syntax in scenario template files", async () => {
    const templateDir = await getBasicTemplateDir();
    const files = ["scenario/main.tzr"];
    const sources = await Promise.all(files.map((file) => readFile(join(templateDir, file), "utf8")));
    const source = sources.join("\n");

    expect(source).not.toContain("#include(");
    expect(source).not.toContain("label ");
    expect(source).not.toContain("->");
    expect(source).not.toContain("@jump");
  });

  it("resolves basic and preact to the existing basic template", async () => {
    await expect(getTemplateDir("preact")).resolves.toBe(await getBasicTemplateDir());
  });

  it("rejects unknown template names", async () => {
    await expect(
      createProject({ cwd: await createTempRoot(), projectName: "my-game", templateName: "unknown" }),
    ).rejects.toThrow("Unknown template: unknown");
  });

  it("rejects the removed html template name", async () => {
    await expect(
      createProject({ cwd: await createTempRoot(), projectName: "my-game", templateName: "html" }),
    ).rejects.toThrow("Unknown template: html");
  });
});
