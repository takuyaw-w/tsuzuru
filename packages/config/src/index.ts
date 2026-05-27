export interface TsuzuruConfig {
  readonly project?: TsuzuruProjectConfig;
  readonly scenario: TsuzuruScenarioConfig;
  readonly plugins?: readonly TsuzuruConfigPlugin[];
  readonly storage?: false | TsuzuruStorageConfig;
  readonly ui?: TsuzuruUiConfig;
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

export interface TsuzuruUiConfig {
  readonly theme?: TsuzuruUiThemeConfig;
}

export interface TsuzuruUiThemeConfig {
  readonly default?: string;
  readonly available?: readonly string[];
}

export interface TsuzuruStorageConfig {
  readonly kind?: "standard";
  readonly enabled?: boolean;
  readonly prefix?: string;
  readonly slots?: number | readonly TsuzuruStorageSlotConfig[];
  readonly preferences?: TsuzuruStoragePreferencesConfig;
  readonly readTracking?: TsuzuruStorageReadTrackingConfig;
  readonly saves?: false | "standard-runtime" | TsuzuruStorageSavesConfig;
}

export interface TsuzuruStorageSlotConfig {
  readonly id: string;
  readonly label: string;
}

export interface TsuzuruStoragePreferencesConfig {
  readonly key?: string;
  readonly defaults?: Partial<TsuzuruStoragePreferencesDefaults>;
  readonly textSpeedOptions?: readonly number[];
}

export interface TsuzuruStoragePreferencesDefaults {
  readonly textRevealEnabled: boolean;
  readonly textSpeedCharactersPerSecond: number;
  readonly textSoundEnabled: boolean;
  readonly textSoundVolume: number;
  readonly bgmVolume: number;
  readonly seVolume: number;
  readonly voiceVolume: number;
}

export interface TsuzuruStorageReadTrackingConfig {
  readonly key?: string;
}

export interface TsuzuruStorageSavesConfig {
  readonly kind: "standard-runtime";
  readonly key?: string;
}

export function defineTsuzuruConfig<const TConfig extends TsuzuruConfig>(config: TConfig): TConfig {
  return config;
}
