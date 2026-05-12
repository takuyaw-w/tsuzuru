import {
  type CommandInstruction,
  compileTzr,
  createInitialRuntimeState,
  parseTzr,
  type RuntimeDocument,
  stepRuntime,
  type TzrArgument,
  validatePluginCommandArguments,
} from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import {
  createStdTextSoundCommandHandlers,
  createStdTextSoundPlugin,
  getStdTextSoundState,
  noteToFrequencyHz,
  resolveStdTextSoundDurationMs,
  resolveStdTextSoundProfile,
  type StdTextSoundConfig,
  type StdTextSoundProfile,
  shouldPlayStdTextSoundCharacter,
  stdTextSoundPluginCommands,
} from "../src/index.js";

const loc = {
  start: { filePath: "scenario/std-text-sound.tzr", line: 1, column: 1 },
  end: { filePath: "scenario/std-text-sound.tzr", line: 1, column: 1 },
};

describe("createStdTextSoundPlugin", () => {
  it("initializes runtimeState.plugins.stdTextSound", () => {
    const plugin = createStdTextSoundPlugin();
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [plugin],
    });

    expect(plugin.commands).toBe(stdTextSoundPluginCommands);
    expect(state.plugins.stdTextSound).toEqual({
      overrideProfileId: null,
    });
  });

  it("returns initialized stdTextSound state", () => {
    const state = createInitialRuntimeState(createDocument(), {
      plugins: [createStdTextSoundPlugin()],
    });

    expect(getStdTextSoundState(state)).toEqual({
      overrideProfileId: null,
    });
  });

  it("throws when stdTextSound state is not initialized", () => {
    const state = createInitialRuntimeState(createDocument());

    expect(() => getStdTextSoundState(state)).toThrow(
      "runtimeState.plugins.stdTextSound is not initialized. Register createStdTextSoundPlugin().",
    );
  });
});

describe("std-text-sound commands", () => {
  it("keeps advanced override command metadata available for DSL integrations", () => {
    expect(Object.keys(stdTextSoundPluginCommands)).toEqual(["textSound", "stopTextSound"]);
    expect(stdTextSoundPluginCommands.textSound).toEqual({
      name: "textSound",
      args: { kind: "positional", arguments: [{ type: "string", nonEmpty: true }] },
    });
    expect(stdTextSoundPluginCommands.stopTextSound).toEqual({
      name: "stopTextSound",
      args: { kind: "none" },
    });
  });

  it("sets the override profile id", () => {
    const result = runStdTextSoundCommands(command("textSound", [positionalString("mio")]));

    expect(getStdTextSoundState(result.state)).toEqual({
      overrideProfileId: "mio",
    });
  });

  it("reassigns and overwrites the override profile id", () => {
    const result = runStdTextSoundCommands(
      command("textSound", [positionalString("mio")]),
      command("textSound", [positionalString("narration")]),
    );

    expect(getStdTextSoundState(result.state)).toEqual({
      overrideProfileId: "narration",
    });
  });

  it("clears the override profile id", () => {
    const result = runStdTextSoundCommands(
      command("textSound", [positionalString("mio")]),
      command("stopTextSound", []),
    );

    expect(getStdTextSoundState(result.state)).toEqual({
      overrideProfileId: null,
    });
  });

  it("keeps stopTextSound as a no-op when no override is active", () => {
    const result = runStdTextSoundCommands(command("stopTextSound", []));

    expect(getStdTextSoundState(result.state)).toEqual({
      overrideProfileId: null,
    });
  });

  it("validates empty profile ids and unsupported extra args through command metadata", () => {
    expect(
      validatePluginCommandArguments(stdTextSoundPluginCommands.textSound, [positionalString("")], loc.start).map(
        (diagnostic) => diagnostic.message,
      ),
    ).toContain('Plugin command "textSound" positional argument 1 must not be empty.');

    expect(
      validatePluginCommandArguments(
        stdTextSoundPluginCommands.textSound,
        [positionalString("mio"), positionalString("extra")],
        loc.start,
      ).map((diagnostic) => diagnostic.message),
    ).toContain('Plugin command "textSound" expects at most 1 positional argument but received 2.');

    expect(
      validatePluginCommandArguments(
        stdTextSoundPluginCommands.stopTextSound,
        [positionalString("mio")],
        loc.start,
      ).map((diagnostic) => diagnostic.message),
    ).toContain('Plugin command "stopTextSound" expects at most 0 positional arguments but received 1.');
  });

  it("throws on invalid runtime arguments after compile-time validation removal", () => {
    expect(() => runStdTextSoundCommands(command("textSound", [positionalString("")]))).toThrow(
      "Invalid @textSound runtime arguments. Expected validated std text sound command arguments.",
    );
    expect(() => runStdTextSoundCommands(command("stopTextSound", [positionalString("mio")]))).toThrow(
      "Invalid @stopTextSound runtime arguments. Expected validated std text sound command arguments.",
    );
  });

  it("runs compiled textSound and stopTextSound through runtime plugin handlers", () => {
    const parsed = parseTzr(
      `scene start:
  textSound mio
  stopTextSound
`,
      { filePath: "scenario/std-text-sound.tzr" },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected parser success");
    }

    const compiled = compileTzr(parsed.document, {
      plugins: [createStdTextSoundPlugin()],
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error("expected compiler success");
    }

    let state = createInitialRuntimeState(compiled.document, {
      plugins: [createStdTextSoundPlugin()],
    });
    state = stepRuntime(compiled.document, state).state;

    const textSound = stepRuntime(compiled.document, state, {
      commandHandlers: createStdTextSoundCommandHandlers(),
    });
    expect(textSound.event).toEqual({ type: "pluginCommand", name: "textSound" });
    expect(getStdTextSoundState(textSound.state)).toEqual({ overrideProfileId: "mio" });

    const stopTextSound = stepRuntime(compiled.document, textSound.state, {
      commandHandlers: createStdTextSoundCommandHandlers(),
    });
    expect(stopTextSound.event).toEqual({ type: "pluginCommand", name: "stopTextSound" });
    expect(getStdTextSoundState(stopTextSound.state)).toEqual({ overrideProfileId: null });
  });
});

describe("profile helpers", () => {
  it("maps duration names to milliseconds", () => {
    expect(resolveStdTextSoundDurationMs("short")).toBe(24);
    expect(resolveStdTextSoundDurationMs(undefined)).toBe(32);
    expect(resolveStdTextSoundDurationMs("normal")).toBe(32);
    expect(resolveStdTextSoundDurationMs("long")).toBe(48);
  });

  it("converts note names to frequencies using A4 = 440Hz", () => {
    expect(noteToFrequencyHz("A4")).toBeCloseTo(440, 6);
    expect(noteToFrequencyHz("C4")).toBeCloseTo(261.625565, 6);
    expect(noteToFrequencyHz("C5")).toBeCloseTo(523.251131, 6);
    expect(noteToFrequencyHz("E5")).toBeCloseTo(659.255114, 6);
  });

  it("skips whitespace, punctuation, and brackets", () => {
    for (const character of [
      "",
      " ",
      "\n",
      "。",
      "、",
      ".",
      ",",
      "!",
      "?",
      "！",
      "？",
      "…",
      "「",
      "」",
      "『",
      "』",
      "（",
      "）",
      "(",
      ")",
    ]) {
      expect(shouldPlayStdTextSoundCharacter(character)).toBe(false);
    }
  });

  it("allows hiragana, katakana, kanji, and alphanumeric characters", () => {
    for (const character of ["あ", "ア", "漢", "A", "z", "0", "9"]) {
      expect(shouldPlayStdTextSoundCharacter(character)).toBe(true);
    }
  });

  it("accepts tone, noise, and mix profile shapes", () => {
    const tone = {
      type: "tone",
      note: "C5",
      waveform: "triangle",
      duration: "short",
      volume: 0.5,
    } satisfies StdTextSoundProfile;
    const noise = {
      type: "noise",
      color: "pink",
      duration: "normal",
      volume: 0.18,
    } satisfies StdTextSoundProfile;
    const mix = {
      type: "mix",
      duration: "short",
      volume: 0.55,
      layers: [
        { type: "tone", note: "E5", waveform: "triangle", volume: 0.7 },
        { type: "noise", color: "white", volume: 0.12 },
      ],
    } satisfies StdTextSoundProfile;

    expect(tone.type).toBe("tone");
    expect(noise.type).toBe("noise");
    expect(mix.layers).toHaveLength(2);
  });
});

describe("resolveStdTextSoundProfile", () => {
  const config: StdTextSoundConfig = {
    profiles: {
      narration: { type: "noise", color: "white", duration: "short", volume: 0.18 },
      dialogue: { type: "tone", note: "C5", duration: "normal" },
      mio: {
        type: "mix",
        duration: "short",
        layers: [
          { type: "tone", note: "E5", waveform: "triangle", volume: 0.7 },
          { type: "noise", color: "white", volume: 0.12 },
        ],
      },
      override: { type: "tone", note: "A5" },
    },
    defaults: {
      narration: "narration",
      dialogue: "dialogue",
      characters: {
        mio: "mio",
      },
    },
  };

  it("prefers runtime override profile ids", () => {
    expect(
      resolveStdTextSoundProfile(config, { overrideProfileId: "override" }, { kind: "dialogue", speakerId: "mio" }),
    ).toEqual(config.profiles.override);
  });

  it("prefers character defaults for dialogue", () => {
    expect(
      resolveStdTextSoundProfile(config, { overrideProfileId: null }, { kind: "dialogue", speakerId: "mio" }),
    ).toEqual(config.profiles.mio);
  });

  it("uses dialogue defaults when no character default exists", () => {
    expect(
      resolveStdTextSoundProfile(config, { overrideProfileId: null }, { kind: "dialogue", speakerId: "aoi" }),
    ).toEqual(config.profiles.dialogue);
  });

  it("uses narration defaults for narration", () => {
    expect(resolveStdTextSoundProfile(config, { overrideProfileId: null }, { kind: "narration" })).toEqual(
      config.profiles.narration,
    );
  });

  it("returns null for missing profile ids", () => {
    expect(
      resolveStdTextSoundProfile(
        { profiles: {}, defaults: { narration: "missing" } },
        { overrideProfileId: null },
        { kind: "narration" },
      ),
    ).toBeNull();
    expect(resolveStdTextSoundProfile(config, { overrideProfileId: "missing" }, { kind: "narration" })).toBeNull();
  });
});

function createDocument(instructions: readonly CommandInstruction[] = []): RuntimeDocument {
  return {
    filePath: "scenario/std-text-sound.tzr",
    instructions,
    scenes: {},
  };
}

function command(name: string, args: readonly TzrArgument[]): CommandInstruction {
  return {
    type: "CommandInstruction",
    name,
    args,
    loc,
  };
}

function positionalString(value: string): TzrArgument {
  return {
    type: "PositionalArgument",
    value: { type: "StringValue", value, loc },
    loc,
  };
}

function runStdTextSoundCommands(...instructions: readonly CommandInstruction[]) {
  const document = createDocument(instructions);
  let state = createInitialRuntimeState(document, {
    plugins: [createStdTextSoundPlugin()],
  });

  for (const _instruction of instructions) {
    const result = stepRuntime(document, state, {
      commandHandlers: createStdTextSoundCommandHandlers(),
    });
    state = result.state;
  }

  return { state };
}
