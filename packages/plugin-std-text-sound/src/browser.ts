import {
  noteToFrequencyHz,
  resolveStdTextSoundDurationMs,
  type StdTextSoundMixProfile,
  type StdTextSoundNoiseLayer,
  type StdTextSoundNoiseProfile,
  type StdTextSoundProfile,
  type StdTextSoundToneLayer,
  type StdTextSoundToneProfile,
} from "./index.js";

const DEFAULT_VOLUME = 1;
const DEFAULT_MIN_INTERVAL_MS = 45;

export interface StdTextSoundPlayer {
  readonly play: (profile: StdTextSoundProfile, options?: StdTextSoundPlayOptions) => void;
  readonly destroy: () => void;
}

export interface StdTextSoundPlayOptions {
  readonly volume?: number;
  readonly minIntervalMs?: number;
}

export interface StdTextSoundPlayerOptions {
  readonly audioContext?: AudioContext;
  readonly onError?: (error: unknown) => void;
  readonly defaultVolume?: number;
  readonly defaultMinIntervalMs?: number;
}

interface InternalPlayContext {
  readonly audioContext: AudioContext;
  readonly startTime: number;
  readonly durationSeconds: number;
  readonly volume: number;
}

type PlayableLayer = StdTextSoundToneLayer | StdTextSoundNoiseLayer;
type ProfileWithVolume = StdTextSoundProfile | PlayableLayer;

export function createStdTextSoundPlayer(options: StdTextSoundPlayerOptions = {}): StdTextSoundPlayer {
  let audioContext = options.audioContext;
  let ownsAudioContext = false;
  let lastPlayedAt = 0;

  function getAudioContext(): AudioContext | null {
    if (audioContext !== undefined) {
      return audioContext;
    }
    if (typeof AudioContext === "undefined") {
      reportError(new Error("AudioContext is unavailable."));
      return null;
    }

    try {
      audioContext = new AudioContext();
      ownsAudioContext = true;
      return audioContext;
    } catch (error) {
      reportError(error);
      return null;
    }
  }

  function reportError(error: unknown): void {
    options.onError?.(error);
    if (options.onError === undefined) {
      console.warn("std text sound playback failed.", error);
    }
  }

  async function resumeAudioContext(context: AudioContext): Promise<boolean> {
    if (context.state !== "suspended") {
      return true;
    }

    try {
      await context.resume();
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  }

  return {
    play(profile, playOptions = {}) {
      const now = performance.now();
      const minIntervalMs = playOptions.minIntervalMs ?? options.defaultMinIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
      if (now - lastPlayedAt < minIntervalMs) {
        return;
      }

      const context = getAudioContext();
      if (context === null) {
        return;
      }

      lastPlayedAt = now;
      void resumeAudioContext(context).then((canPlay) => {
        if (!canPlay) {
          return;
        }

        try {
          playProfile(profile, {
            audioContext: context,
            startTime: context.currentTime,
            durationSeconds: resolveStdTextSoundDurationMs(profile.duration) / 1000,
            volume: clampUnitVolume(playOptions.volume ?? options.defaultVolume ?? DEFAULT_VOLUME),
          });
        } catch (error) {
          reportError(error);
        }
      });
    },
    destroy() {
      if (ownsAudioContext && audioContext !== undefined && audioContext.state !== "closed") {
        void audioContext.close().catch(reportError);
      }
      audioContext = undefined;
      ownsAudioContext = false;
    },
  };
}

function playProfile(profile: StdTextSoundProfile, context: InternalPlayContext): void {
  switch (profile.type) {
    case "tone":
      playTone(profile, {
        ...context,
        volume: context.volume * profileVolume(profile),
      });
      return;
    case "noise":
      playNoise(profile, {
        ...context,
        volume: context.volume * profileVolume(profile),
      });
      return;
    case "mix":
      playMix(profile, context);
      return;
  }
}

function playMix(profile: StdTextSoundMixProfile, context: InternalPlayContext): void {
  const mixVolume = context.volume * profileVolume(profile);
  for (const layer of profile.layers) {
    playLayer(layer, {
      ...context,
      volume: mixVolume * profileVolume(layer),
    });
  }
}

function playLayer(layer: PlayableLayer, context: InternalPlayContext): void {
  if (layer.type === "tone") {
    playTone(layer, context);
    return;
  }
  playNoise(layer, context);
}

function playTone(profile: StdTextSoundToneProfile | StdTextSoundToneLayer, context: InternalPlayContext): void {
  const oscillator = context.audioContext.createOscillator();
  const gain = createEnvelopeGain(context);

  oscillator.type = profile.waveform ?? "triangle";
  oscillator.frequency.setValueAtTime(noteToFrequencyHz(profile.note), context.startTime);
  oscillator.connect(gain);
  oscillator.start(context.startTime);
  oscillator.stop(context.startTime + context.durationSeconds);
}

function playNoise(profile: StdTextSoundNoiseProfile | StdTextSoundNoiseLayer, context: InternalPlayContext): void {
  const buffer = createNoiseBuffer(context.audioContext, context.durationSeconds, profile.color ?? "white");
  const source = context.audioContext.createBufferSource();
  const gain = createEnvelopeGain(context);

  source.buffer = buffer;
  source.connect(gain);
  source.start(context.startTime);
  source.stop(context.startTime + context.durationSeconds);
}

function createEnvelopeGain(context: InternalPlayContext): GainNode {
  const gain = context.audioContext.createGain();
  const safeVolume = clampUnitVolume(context.volume);
  gain.gain.setValueAtTime(0, context.startTime);
  gain.gain.linearRampToValueAtTime(safeVolume, context.startTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.startTime + context.durationSeconds);
  gain.connect(context.audioContext.destination);
  return gain;
}

function createNoiseBuffer(
  audioContext: AudioContext,
  durationSeconds: number,
  color: NonNullable<StdTextSoundNoiseProfile["color"]>,
): AudioBuffer {
  const frameCount = Math.max(1, Math.ceil(audioContext.sampleRate * durationSeconds));
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  if (color === "pink") {
    fillPinkNoise(data);
    return buffer;
  }

  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function fillPinkNoise(data: Float32Array): void {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
}

function profileVolume(profile: ProfileWithVolume): number {
  return clampUnitVolume(profile.volume ?? 1);
}

function clampUnitVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(value, 1));
}
