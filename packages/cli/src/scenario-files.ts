import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TzrProjectDocumentInput } from "@tsuzuru/core";
import { glob } from "tinyglobby";
import { TsuzuruCliError } from "./errors.js";

export interface CollectScenarioDocumentsInput {
  readonly configRoot: string;
  readonly entryId: string;
  readonly patterns: readonly string[];
}

export interface CollectedScenarioDocuments {
  readonly entryId: string;
  readonly documents: readonly TzrProjectDocumentInput[];
}

export async function collectScenarioDocuments(
  input: CollectScenarioDocumentsInput,
): Promise<CollectedScenarioDocuments> {
  const entryId = normalizeProjectPath(input.entryId);
  const matchedPaths = await glob(input.patterns, {
    cwd: input.configRoot,
    onlyFiles: true,
    absolute: false,
  });
  const documentIds = [
    ...new Set(matchedPaths.map(normalizeProjectPath).filter((path) => path.endsWith(".tzr"))),
  ].sort();

  if (documentIds.length === 0) {
    throw new TsuzuruCliError("scenario.files did not match any .tzr files.");
  }

  if (!documentIds.includes(entryId)) {
    throw new TsuzuruCliError(`scenario.entry "${entryId}" was not included by scenario.files.`);
  }

  const documents = await Promise.all(
    documentIds.map(async (id) => ({
      id,
      source: await readFile(resolve(input.configRoot, id), "utf8"),
    })),
  );

  return {
    entryId,
    documents,
  };
}

export function normalizeProjectPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length > 0 && segments.at(-1) !== "..") {
        segments.pop();
      } else {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}
