import type { RuntimeEvent, RuntimeState } from "@tsuzuru/core";
import { describe, expect, it } from "vitest";
import { createRuntimeSaveData, createRuntimeSaveDataFromState, isRuntimeSaveData } from "../src/index.js";

const baseState: RuntimeState = {
  pointer: {
    filePath: "scenario/main.tzr",
    instructionIndex: 1,
  },
  variables: {},
  plugins: {},
  branchFrames: [],
  pendingChoice: null,
  pendingWait: null,
  isStopped: false,
  isWaitingForClick: false,
};

const event: RuntimeEvent = {
  type: "narration",
  lines: [{ text: "Saved line." }],
};

describe("runtime save helpers", () => {
  it("keeps existing snapshot-based save data creation", () => {
    const saveData = createRuntimeSaveData(
      {
        version: 2,
        ...baseState,
      },
      event,
    );

    expect(saveData).toMatchObject({
      version: 2,
      event,
      snapshot: {
        version: 2,
        pointer: baseState.pointer,
      },
    });
    expect(isRuntimeSaveData(saveData)).toBe(true);
  });

  it("creates RuntimeSaveData from RuntimeState", () => {
    const saveData = createRuntimeSaveDataFromState(baseState, event);

    expect(saveData).toMatchObject({
      version: 2,
      event,
      snapshot: {
        version: 2,
        pointer: baseState.pointer,
        variables: {},
      },
    });
    expect(isRuntimeSaveData(saveData)).toBe(true);
  });

  it("applies prepare functions in order before snapshot creation", () => {
    const saveData = createRuntimeSaveDataFromState(baseState, event, {
      prepares: [
        (state) => ({
          ...state,
          variables: { ...state.variables, order: "first" },
        }),
        (state) => ({
          ...state,
          variables: { ...state.variables, order: `${state.variables.order}:second` },
        }),
      ],
    });

    expect(saveData.snapshot.variables.order).toBe("first:second");
  });

  it("lets hosts clear one-shot-like plugin state while preserving durable state", () => {
    const saveData = createRuntimeSaveDataFromState(
      {
        ...baseState,
        plugins: {
          synthetic: {
            durable: "keep",
            events: ["clear-me"],
            nextSequence: 2,
          },
        },
      },
      event,
      {
        prepares: [
          (state) => {
            const synthetic = state.plugins.synthetic as {
              readonly durable: string;
              readonly nextSequence: number;
            };
            return {
              ...state,
              plugins: {
                ...state.plugins,
                synthetic: {
                  durable: synthetic.durable,
                  events: [],
                  nextSequence: synthetic.nextSequence,
                },
              },
            };
          },
        ],
      },
    );

    expect(saveData.snapshot.plugins.synthetic).toEqual({
      durable: "keep",
      events: [],
      nextSequence: 2,
    });
  });
});
