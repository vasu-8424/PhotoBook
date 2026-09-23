import type { BookDesign } from "@/types/design";
import { MAX_HISTORY_STATES } from "./constants";
import type { HistoryState } from "./types";

export function createHistory(initialDesign: BookDesign): HistoryState {
  return {
    past: [],
    present: initialDesign,
    future: [],
  };
}

export function pushHistory(
  state: HistoryState,
  newDesign: BookDesign,
  maxDepth: number = MAX_HISTORY_STATES,
): HistoryState {
  // If no change, return same state
  if (state.present === newDesign) {
    return state;
  }

  const newPast = [...state.past, state.present];
  if (newPast.length > maxDepth) {
    newPast.shift(); // Trim oldest
  }

  return {
    past: newPast,
    present: newDesign,
    future: [], // New mutation clears future redo stack
  };
}

export function undo(state: HistoryState): HistoryState {
  if (state.past.length === 0) {
    return state;
  }

  const previous = state.past[state.past.length - 1];
  const newPast = state.past.slice(0, state.past.length - 1);

  return {
    past: newPast,
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redo(state: HistoryState): HistoryState {
  if (state.future.length === 0) {
    return state;
  }

  const next = state.future[0];
  const newFuture = state.future.slice(1);

  return {
    past: [...state.past, state.present],
    present: next,
    future: newFuture,
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
