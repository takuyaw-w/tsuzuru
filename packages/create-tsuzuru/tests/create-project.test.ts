import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("uses the bundled basic template by default", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "my-game" });
    const packageJson = JSON.parse(await readFile(join(root, "my-game", "package.json"), "utf8")) as {
      readonly dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@tsuzuru/preact"]).toBeDefined();
    await expect(readFile(join(root, "my-game", "src", "main.tsx"), "utf8")).resolves.toContain("preact");
  });

  it("creates a project from the html template", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "html-game", templateName: "html" });
    const packageJson = JSON.parse(await readFile(join(root, "html-game", "package.json"), "utf8")) as {
      readonly name: string;
      readonly dependencies: Record<string, string>;
    };

    expect(packageJson.name).toBe("html-game");
    expect(packageJson.dependencies["@tsuzuru/html"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/preact"]).toBeUndefined();
    expect(packageJson.dependencies["@tsuzuru/standard-ui-preact"]).toBeUndefined();
    expect(packageJson.dependencies.preact).toBeUndefined();
    await expect(readFile(join(root, "html-game", "scenario", "main.tzr"), "utf8")).resolves.toContain(
      'title "Tsuzuru HTML Project"',
    );
    await expect(readFile(join(root, "html-game", "assets.ts"), "utf8")).resolves.toContain(
      "satisfies TsuzuruHtmlAssetsManifest",
    );
    await expect(readFile(join(root, "html-game", "src", "screens", "settings.html"), "utf8")).resolves.toContain(
      'data-tsuzuru-setting="textFontSize"',
    );
    await expect(readFile(join(root, "html-game", "tsuzuru.config.ts"), "utf8")).resolves.toContain(
      'files: ["scenario/**/*.tzr"]',
    );
    await expect(readFile(join(root, "html-game", "public", "assets", "assets.json"), "utf8")).rejects.toThrow();
    await expect(readFile(join(root, "html-game", "public", "scenario", "main.tzr"), "utf8")).rejects.toThrow();
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
      'title "Tsuzuru Preact Basic"',
    );
  });

  it("includes a check:scenario script", async () => {
    const root = await createTempRoot();

    await createProject({ cwd: root, projectName: "my-game" });
    const packageJson = JSON.parse(await readFile(join(root, "my-game", "package.json"), "utf8")) as {
      readonly scripts: Record<string, string>;
    };

    expect(packageJson.scripts["check:scenario"]).toBe("tsuzuru check");
  });

  it("does not include removed legacy DSL syntax in scenario template files", async () => {
    const templateDir = await getBasicTemplateDir();
    const files = [
      "scenario/main.tzr",
      "scenario/chapters/01-opening.tzr",
      "scenario/chapters/02-common.tzr",
      "scenario/chapters/03-ending.tzr",
    ];
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
});
