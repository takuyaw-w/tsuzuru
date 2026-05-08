import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/index.js";

const tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "create-tsuzuru-cli-"));
  tempRoots.push(root);
  return root;
}

function setUserAgent(userAgent: string | undefined): () => void {
  const previousUserAgent = process.env.npm_config_user_agent;
  if (userAgent === undefined) {
    delete process.env.npm_config_user_agent;
  } else {
    process.env.npm_config_user_agent = userAgent;
  }

  return () => {
    if (previousUserAgent === undefined) {
      delete process.env.npm_config_user_agent;
    } else {
      process.env.npm_config_user_agent = previousUserAgent;
    }
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("runCli", () => {
  it.each([
    {
      name: "npm",
      userAgent: "npm/11.0.0 node/v25.0.0 linux x64 workspaces/false",
      expectedNextSteps: ["npm install", "npm run check:scenario", "npm run dev"],
    },
    {
      name: "pnpm",
      userAgent: "pnpm/11.0.0 npm/? node/v25.0.0 linux x64",
      expectedNextSteps: ["pnpm install", "pnpm check:scenario", "pnpm dev"],
    },
    {
      name: "yarn",
      userAgent: "yarn/1.22.22 npm/? node/v25.0.0 linux x64",
      expectedNextSteps: ["yarn install", "yarn check:scenario", "yarn dev"],
    },
    {
      name: "unknown",
      userAgent: "bun/1.3.0 npm/? node/v25.0.0 linux x64",
      expectedNextSteps: ["pnpm install", "pnpm check:scenario", "pnpm dev"],
    },
  ])("prints $name next steps", async ({ userAgent, expectedNextSteps }) => {
    const root = await createTempRoot();
    const previousCwd = process.cwd();
    const restoreUserAgent = setUserAgent(userAgent);
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });

    try {
      process.chdir(root);

      const exitCode = await runCli(["mypage"]);

      expect(exitCode).toBe(0);
      expect(logs).toEqual([
        "Created Tsuzuru project in mypage.",
        "",
        "Next steps:",
        "  cd mypage",
        ...expectedNextSteps.map((step) => `  ${step}`),
      ]);
    } finally {
      process.chdir(previousCwd);
      restoreUserAgent();
    }
  });
});
