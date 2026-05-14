import { describe, expect, it } from "vitest";
import {
  getGeneratedProjectInstallArgs,
  getRegistryCreateCommand,
  parseSmokeSource,
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
