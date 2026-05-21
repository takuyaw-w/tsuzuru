import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { assets } from "../assets.js";
import { scenarioProject } from "../src/scenario.js";

const messageSpeakers = new Set(["narration", "tone", "noize", "mix"]);
const maxMessageBlockLineCount = 3;
const maxMessageLineDisplayWidth = 72;

describe("preact-basic scenario", () => {
  it("compiles the scenario project", () => {
    expect(scenarioProject.ok).toBe(true);
  });

  it("keeps message blocks within three short text lines", async () => {
    const scenarioRoot = join(import.meta.dirname, "..", "scenario");
    const scenarioFiles = await collectScenarioFiles(scenarioRoot);

    for (const filePath of scenarioFiles) {
      const source = await readFile(filePath, "utf8");
      const blocks = collectMessageBlocks(source);
      for (const block of blocks) {
        if (block.lines.length > maxMessageBlockLineCount) {
          throw new Error(
            `${relative(scenarioRoot, filePath)}:${block.lineNumber} ${block.speaker} has ${block.lines.length} text lines`,
          );
        }

        for (const line of block.lines) {
          const displayWidth = getApproxDisplayWidth(line.text);
          if (displayWidth > maxMessageLineDisplayWidth) {
            throw new Error(
              `${relative(scenarioRoot, filePath)}:${line.lineNumber} ${block.speaker} line is too long: width=${displayWidth}, text=${line.text}`,
            );
          }
        }
      }
    }
  });

  it("includes the std-system unlock demo scene", async () => {
    const scenario = await readFile(join(import.meta.dirname, "..", "scenario", "chapters", "03-ending.tzr"), "utf8");

    expect(scenario).toContain("scene system_unlock_demo:");
    expect(scenario).toContain("call system.unlockCg(id=textSoundLab)");
    expect(scenario).toContain("call system.unlockAchievement(id=firstTextSoundLab)");
    expect(scenario).toContain("call system.unlockEnding(id=textSoundLabComplete)");
    expect(scenario).not.toContain("unlock ending");
  });

  it("includes the std-particle demo scenes", async () => {
    const scenario = await readFile(join(import.meta.dirname, "..", "scenario", "chapters", "02-common.tzr"), "utf8");

    expect(scenario).toContain('choice "particle demo を試す？"');
    expect(scenario).toContain("particle rain intensity=normal");
    expect(scenario).toContain("particle snow intensity=light");
    expect(scenario).toContain("particle sakura intensity=normal");
    expect(scenario).toContain("particle dust intensity=light");
    expect(scenario).toContain("stopParticle");
  });

  it("maps transition demo backgrounds to 16:9 SVG assets", async () => {
    const expectedBackgrounds = ["classroom", "library", "station", "rooftop", "hallway"] as const;
    const backgroundRoot = join(import.meta.dirname, "..", "public", "assets", "backgrounds");
    const scenario = await readFile(join(import.meta.dirname, "..", "scenario", "chapters", "02-common.tzr"), "utf8");

    for (const assetId of expectedBackgrounds) {
      const background = assets.visual.backgrounds[assetId];
      expect(background.src).toBe(`/assets/backgrounds/${assetId}.svg`);
      expect(scenario).toMatch(new RegExp(`bg ${assetId}(?: with|\\n)`));

      const svg = await readFile(join(backgroundRoot, `${assetId}.svg`), "utf8");
      expect(svg).toContain('viewBox="0 0 1280 720"');
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("href=");
    }
  });

  it("depends on the std-system plugin package", async () => {
    const packageJson = JSON.parse(await readFile(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };

    expect(packageJson.dependencies["@tsuzuru/plugin-std-system"]).toBeDefined();
    expect(packageJson.dependencies["@tsuzuru/plugin-std-particle"]).toBeDefined();
  });
});

interface MessageBlock {
  readonly speaker: string;
  readonly lineNumber: number;
  readonly lines: readonly MessageLine[];
}

interface MessageLine {
  readonly lineNumber: number;
  readonly text: string;
}

async function collectScenarioFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectScenarioFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".tzr") ? [entryPath] : [];
    }),
  );
  return files.flat().sort();
}

function collectMessageBlocks(source: string): readonly MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const header = /^(\s*)([A-Za-z_][\w-]*|narration):\s*$/.exec(lines[index]);
    if (header === null || !messageSpeakers.has(header[2])) {
      continue;
    }

    const headerIndent = header[1].length;
    const textLines: MessageLine[] = [];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const line = lines[nextIndex];
      if (line.trim() === "") {
        continue;
      }

      const indent = line.length - line.trimStart().length;
      if (indent <= headerIndent) {
        break;
      }

      const text = line.trim();
      if (!isCommandLine(text)) {
        textLines.push({ lineNumber: nextIndex + 1, text });
      }
    }

    blocks.push({
      speaker: header[2],
      lineNumber: index + 1,
      lines: textLines,
    });
  }

  return blocks;
}

function getApproxDisplayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += /[ -~]/.test(char) ? 1 : 2;
  }
  return width;
}

function isCommandLine(line: string): boolean {
  return (
    /^".*":\s*$/.test(line) ||
    /^(?:add|bg|bgm|blur|call|camera|choice|clear|end|flash|hide|if|jump|particle|pulse|reset|se|set|shake|show|stopBgm|stopParticle|transition|voice|wait)\b/.test(
      line,
    )
  );
}
