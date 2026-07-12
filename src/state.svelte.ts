import { cloneDeep } from "lodash-es";
import type { MicroLayerId, StateCommon, StateMacro, StateMicro } from "./types";
import { defaultState } from "./stateDefaults";

export const macroState = $state<StateMacro>(cloneDeep(defaultState.stateMacro));
export const microState = $state<StateMicro>(cloneDeep(defaultState.stateMicro));
export const commonState = $state<StateCommon>(cloneDeep(defaultState.stateCommon));


interface AppState {
    /** === Common === */
    projection: d3.GeoProjection | null;
    projectionLarger: d3.GeoProjection | null;
    /** === Macro === */
    path?: d3.GeoPath<any, any>;
    pathLarger?: d3.GeoPath<any, any>;
    /** === Micro === */
    /** Active micro layers that produced zero rendered features in the last draw. */
    microEmptyLayers: MicroLayerId[];
}


/** Contains all things related to the app, not contained in the persistent state (projections, etc) */
export const appState = $state<AppState>({
    projection: null,
    projectionLarger: null,
    path: undefined,
    pathLarger: undefined,
    microEmptyLayers: [],
});