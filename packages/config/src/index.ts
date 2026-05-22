export interface TsuzuruConfig {
  readonly project?: TsuzuruProjectConfig;
  readonly scenario: TsuzuruScenarioConfig;
  readonly plugins?: readonly TsuzuruConfigPlugin[];
}

export interface TsuzuruProjectConfig {
  readonly id: string;
  readonly version: string;
}

export interface TsuzuruScenarioConfig {
  readonly entry: string;
  readonly files: readonly string[];
}

export interface TsuzuruConfigPlugin {
  readonly name: string;
}

export function defineTsuzuruConfig<const TConfig extends TsuzuruConfig>(config: TConfig): TConfig {
  return config;
}
