import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectScenarioDocuments } from "../src/scenario-files.js";

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "tsuzuru-cli-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("collectScenarioDocuments", () => {
  it("expands scenario.files into sorted project-relative document ids", async () => {
    const root = await createTempProject();
    await mkdir(join(root, "scenario", "chapters"), { recursive: true });
    await writeFile(join(root, "scenario", "main.tzr"), "scene main:\n");
    await writeFile(join(root, "scenario", "chapters", "01-opening.tzr"), "scene opening:\n");
    await writeFile(join(root, "scenario", "notes.txt"), "ignored\n");

    const collected = await collectScenarioDocuments({
      configRoot: root,
      entryId: "scenario\\main.tzr",
      patterns: ["scenario/**/*"],
    });

    expect(collected.entryId).toBe("scenario/main.tzr");
    expect(collected.documents.map((document) => document.id)).toEqual([
      "scenario/chapters/01-opening.tzr",
      "scenario/main.tzr",
    ]);
    expect(collected.documents[1]?.source).toBe("scene main:\n");
  });

  it("fails when scenario.entry is not included by scenario.files", async () => {
    const root = await createTempProject();
    await mkdir(join(root, "scenario", "chapters"), { recursive: true });
    await writeFile(join(root, "scenario", "chapters", "01-opening.tzr"), "scene opening:\n");

    await expect(
      collectScenarioDocuments({
        configRoot: root,
        entryId: "scenario/main.tzr",
        patterns: ["scenario/**/*.tzr"],
      }),
    ).rejects.toThrow('scenario.entry "scenario/main.tzr" was not included by scenario.files');
  });
});
