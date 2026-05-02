import type { RuntimeState } from "./runtime-types.js";

export function openScreen(state: RuntimeState, screenId: string): RuntimeState {
  return {
    ...state,
    screen: {
      active: { id: screenId },
      waitingForClose: state.screen.waitingForClose,
    },
  };
}

export function closeScreen(state: RuntimeState): RuntimeState {
  if (state.screen.active === null && !state.screen.waitingForClose) {
    return state;
  }

  return {
    ...state,
    screen: {
      active: null,
      waitingForClose: false,
    },
  };
}
