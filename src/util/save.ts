import { commonState, macroState, microState } from "src/state.svelte";
import type { GlobalState } from "src/types";
import { recordIfChanged } from "./history";

const LOCAL_STORAGE_KEY = "map-builder-state";

let _serverSyncCallback: (() => void) | null = null;
export function registerServerSync(cb: () => void) {
    _serverSyncCallback = cb;
}

export function saveState() {
    const params: GlobalState = { stateCommon: commonState, stateMacro: macroState, stateMicro: microState };
    const serialized = JSON.stringify(params);
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    recordIfChanged();
    _serverSyncCallback?.();
}

export function getState(): GlobalState | null {
    const state = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!state) return null;
    return JSON.parse(state);
}
