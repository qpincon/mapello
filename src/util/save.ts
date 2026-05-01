import { commonState, macroState, microState } from "src/state.svelte";
import type { GlobalState } from "src/types";
import { recordIfChanged } from "./history";

const LOCAL_STORAGE_KEY = "map-builder-state";
const SERVER_SYNC_DELAY_MS = 5000;

type ServerSyncContext = {
    getProjectId: () => number | null;
    getProjectJson: () => string;
    onError: (message: string) => void;
};

let _syncContext: ServerSyncContext | null = null;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

export function registerServerSync(context: ServerSyncContext) {
    _syncContext = context;
}

/**
 * Save a project to the server. Returns an error message string on failure, or null on success.
 */
export async function saveProjectToServer(projectId: number, projectJson: string): Promise<string | null> {
    try {
        const res = await fetch(`/api/projects/${projectId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_json: projectJson }),
        });
        if (!res.ok) {
            try {
                const data = await res.json();
                return data?.message || "Could not save project";
            } catch {
                return "Could not save project";
            }
        }
        return null;
    } catch {
        return "Could not save project";
    }
}

function syncToServer() {
    if (!_syncContext) return;
    const projectId = _syncContext.getProjectId();
    if (!projectId) return;
    saveProjectToServer(projectId, _syncContext.getProjectJson()).then((errorMsg) => {
        _syncContext?.onError(errorMsg ?? "");
    });
}

export function saveState() {
    const params: GlobalState = { stateCommon: commonState, stateMacro: macroState, stateMicro: microState };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(params));
    recordIfChanged();
    if (_syncContext) {
        if (_syncTimer) clearTimeout(_syncTimer);
        _syncTimer = setTimeout(syncToServer, SERVER_SYNC_DELAY_MS);
    }
}

export function getState(): GlobalState | null {
    const state = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!state) return null;
    return JSON.parse(state);
}
