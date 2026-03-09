import { commonState, macroState, microState } from "src/state.svelte";
import type { GlobalState } from "src/types";
import { recordIfChanged } from "./history";

const LOCAL_STORAGE_KEY = "map-builder-state";
const SERVER_SYNC_DELAY_MS = 5000;

let _serverSyncCallback: (() => void) | null = null;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

export function registerServerSync(cb: () => void) {
    _serverSyncCallback = cb;
}

export function saveState() {
    const params: GlobalState = { stateCommon: commonState, stateMacro: macroState, stateMicro: microState };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(params));
    recordIfChanged();
    if (_serverSyncCallback) {
        if (_syncTimer) clearTimeout(_syncTimer);
        _syncTimer = setTimeout(_serverSyncCallback, SERVER_SYNC_DELAY_MS);
    }
}

export function getState(): GlobalState | null {
    const state = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!state) return null;
    return JSON.parse(state);
}
