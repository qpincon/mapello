import { cloneDeep } from "lodash-es";
import type { StateCommon, StateMacro, StateMicro } from "./types";
import { defaultState } from "./stateDefaults";

export const macroState: StateMacro = $state(cloneDeep(defaultState.stateMacro));
export const microState: StateMicro = $state(cloneDeep(defaultState.stateMicro));
export const commonState: StateCommon = $state(cloneDeep(defaultState.stateCommon));


interface AppState {
    /** === Common === */
    projection: d3.GeoProjection | null;
    projectionLarger: d3.GeoProjection | null;
    /** === Macro === */
    visibleArea: number;
    countryFilteredImages: Set<string>;
    path?: d3.GeoPath<any, any>;
    pathLarger?: d3.GeoPath<any, any>;
}


/** Contains all things related to the app, not contained in the persistent state (projections, etc) */
export const appState: AppState = $state({
    projection: null,
    projectionLarger: null,
    visibleArea: 1,
    countryFilteredImages: new Set<string>(),
    path: undefined,
    pathLarger: undefined,
});