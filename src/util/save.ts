import { commonState, macroState, microState } from "src/state.svelte";
import type { GlobalState } from "src/types";

const LOCAL_STORAGE_KEY = "map-builder-state";
export function saveState() {
    const params = { commonState, macroState, microState };
    const serialized = JSON.stringify(params);
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
}

export function getState(): GlobalState | null {
    const state = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!state) return null;
    return JSON.parse(state);
}
