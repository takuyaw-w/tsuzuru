import { loadTsuzuruConfig, TsuzuruConfigLoadError } from "@tsuzuru/config/node";
import { compileTzrProject, type Diagnostic } from "@tsuzuru/core";
import { TsuzuruCliError } from "./errors.js";
import { collectScenarioDocuments } from "./scenario-files.js";

export interface CheckOutput {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
}

export interface RunCheckOptions {
  readonly cwd?: string;
  readonly output?: CheckOutput;
}

export async function runCheck(options: RunCheckOptions = {}): Promise<number> {
  const output = options.output ?? console;

  try {
    const loadedConfig = await loadTsuzuruConfig(options.cwd === undefined ? {} : { cwd: options.cwd });
    const scenario = await collectScenarioDocuments({
      configRoot: loadedConfig.configRoot,
      entryId: loadedConfig.config.scenario.entry,
      patterns: loadedConfig.config.scenario.files,
    });
    const result = compileTzrProject(
      {
        entryId: scenario.entryId,
        documents: scenario.documents,
      },
      {
        plugins: loadedConfig.config.plugins ?? [],
      },
    );

    if (!result.ok) {
      for (const diagnostic of result.errors) {
        output.error(formatDiagnostic(diagnostic));
      }
      output.error("Tsuzuru check failed.");
      return 1;
    }

    output.log("Tsuzuru check passed.");
    output.log(`Documents: ${scenario.documents.length}`);
    output.log(`Entry: ${scenario.entryId}`);
    return 0;
  } catch (error) {
    output.error(formatError(error));
    output.error("Tsuzuru check failed.");
    return 1;
  }
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `[error] ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`;
}

function formatError(error: unknown): string {
  if (error instanceof TsuzuruCliError || error instanceof TsuzuruConfigLoadError) {
    return `[error] ${error.message}`;
  }
  if (error instanceof Error) {
    return `[error] ${error.message}`;
  }
  return "[error] Unknown error.";
}
