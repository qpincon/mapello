import { commonState, macroState, microState } from "src/state.svelte";
import type { GlobalState } from "src/types";
import { recordIfChanged } from "./history";

const LOCAL_STORAGE_KEY = "map-builder-state";
export function saveState() {
    const params: GlobalState = { stateCommon: commonState, stateMacro: macroState, stateMicro: microState };
    console.log('saveState', params)
    const serialized = JSON.stringify(params);
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    recordIfChanged();
}

export function getState(): GlobalState | null {
    const state = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!state) return null;
    return JSON.parse(state);
}
