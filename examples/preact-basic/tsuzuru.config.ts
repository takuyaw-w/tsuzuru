import { defineTsuzuruConfig } from "@tsuzuru/config";
import { createStdAudioPlugin } from "@tsuzuru/plugin-std-audio";
import { createStdCameraPlugin } from "@tsuzuru/plugin-std-camera";
import { createStdEffectPlugin } from "@tsuzuru/plugin-std-effect";
import { createStdParticlePlugin } from "@tsuzuru/plugin-std-particle";
import { createStdSystemPlugin } from "@tsuzuru/plugin-std-system";
import { createStdTextSoundPlugin } from "@tsuzuru/plugin-std-text-sound";
import { createStdVisualPlugin } from "@tsuzuru/plugin-std-visual";

export const projectIdentity = {
  id: "tsuzuru.example.preact-basic",
  version: "1",
} as const;

export default defineTsuzuruConfig({
  project: projectIdentity,
  scenario: {
    entry: "scenario/main.tzr",
    files: ["scenario/**/*.tzr"],
  },
  storage: {
    enabled: true,
    prefix: "tsuzuru:example-preact-basic",
    slots: 3,
    preferences: {
      defaults: {
        textRevealEnabled: true,
        textSpeedCharactersPerSecond: 60,
        textSoundEnabled: true,
        textSoundVolume: 0.55,
        bgmVolume: 0.6,
        seVolume: 0.8,
        voiceVolume: 0.9,
      },
      textSpeedOptions: [30, 60, 120],
    },
    saves: "standard-runtime",
  },
  plugins: [
    createStdVisualPlugin(),
    createStdAudioPlugin(),
    createStdTextSoundPlugin(),
    createStdEffectPlugin(),
    createStdCameraPlugin(),
    createStdParticlePlugin(),
    createStdSystemPlugin(),
  ],
});
