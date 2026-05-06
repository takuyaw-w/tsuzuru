import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type CheckOutput, runCheck } from "../src/check.js";

const tempRoots: string[] = [];

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "tsuzuru-cli-"));
  tempRoots.push(root);
  await mkdir(join(root, "scenario"), { recursive: true });
  await writeFile(
    join(root, "tsuzuru.config.ts"),
    `export default {
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  plugins: [],
};
`,
  );
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("runCheck", () => {
  it("passes for a valid scenario project", async () => {
    const root = await createTempProject();
    await writeFile(
      join(root, "scenario", "main.tzr"),
      `scene main:
  narration:
    Hello.
  end
`,
    );
    const output = createOutput();

    const exitCode = await runCheck({ cwd: root, output: output.api });

    expect(exitCode).toBe(0);
    expect(output.logs).toEqual(["Tsuzuru check passed.", "Documents: 1", "Entry: scenario/main.tzr"]);
    expect(output.errors).toEqual([]);
  });

  it("returns failure and prints diagnostics for compile errors", async () => {
    const root = await createTempProject();
    await writeFile(
      join(root, "scenario", "main.tzr"),
      `scene main:
  jump missing
`,
    );
    const output = createOutput();

    const exitCode = await runCheck({ cwd: root, output: output.api });

    expect(exitCode).toBe(1);
    expect(output.logs).toEqual([]);
    expect(output.errors).toContain("Tsuzuru check failed.");
    expect(output.errors.join("\n")).toContain('[error] scenario/main.tzr:2:3 Unknown scene "missing".');
  });
});

function createOutput(): { readonly api: CheckOutput; readonly logs: string[]; readonly errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];

  return {
    api: {
      log: (message) => logs.push(message),
      error: (message) => errors.push(message),
    },
    logs,
    errors,
  };
}
