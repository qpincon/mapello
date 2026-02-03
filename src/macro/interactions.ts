import { scalePow } from "d3";
import { appState, macroState } from "src/state.svelte";

let altMin = 100;
let altMax = 10000;
// simplification threshold: maps altitude to visibleArea
let threshScale = scalePow().domain([altMin, altMax]).range([0, 0.1]).exponent(0.08);

export function zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    const src = event.sourceEvent;
    if (!src) return;
    if (src.type === "dblclick") return;
    if (!appState.projection) return;

    // Same normalization as App.svelte wheelDelta
    const delta = -src.deltaY * (src.deltaMode === 1 ? 0.05 : src.deltaMode ? 1 : 0.002);
    const zoomFactor = Math.pow(2, delta);

    const isSatellite = macroState.macroParams.General.projection === "satellite";
    // Satellite: higher altitude = zoomed out, so divide to zoom in
    // Standard: higher altitude = higher scale = zoomed in, so multiply
    let newAltitude = macroState.inlinePropsMacro.altitude * (isSatellite ? 1 / zoomFactor : zoomFactor);
    newAltitude = Math.round(Math.max(altMin, Math.min(altMax, newAltitude)));

    macroState.visibleArea = threshScale(newAltitude);
    macroState.macroParams.General.altitude = newAltitude;
    macroState.inlinePropsMacro.altitude = newAltitude;
}

const sensitivity = 75;
export function dragged(event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>): void {
    macroState.inlinePropsMacro.translateX += event.dx;
    macroState.inlinePropsMacro.translateY += event.dy;
    const isSatellite = macroState.macroParams.General.projection === "satellite";
    if (isSatellite && (event.sourceEvent.metaKey || event.sourceEvent.ctrlKey)) {
        const MAX_TILT = 35;
        macroState.inlinePropsMacro.tilt = Math.min(MAX_TILT, Math.max(0, macroState.inlinePropsMacro.tilt - event.dy / 10));
        macroState.inlinePropsMacro.rotation -= event.dx / 10;
    } else if (appState.projection?.rotate) {
        const rotate = appState.projection.rotate();
        let rotRad = (macroState.inlinePropsMacro.rotation / 180) * Math.PI;
        if (!isSatellite) rotRad = 0;
        const [xPartX, xPartY] = [Math.cos(rotRad), Math.sin(rotRad)];
        const [yPartX, yPartY] = [-Math.sin(rotRad), Math.cos(rotRad)];
        const k = sensitivity / appState.projection.scale();
        const adjustedDx = (event.dx * xPartX + event.dy * yPartX) * k;
        const adjustedDy = (event.dy * yPartY + event.dx * xPartY) * k;
        macroState.inlinePropsMacro.longitude = -rotate[0] - adjustedDx;
        macroState.inlinePropsMacro.latitude = -rotate[1] + adjustedDy;
    }
}

export function changeAltitudeScale(autoAdjustAltitude = true): void {
    const projName = macroState.macroParams.General.projection;
    const fov = macroState.macroParams.General.fieldOfView;

    if (projName === "satellite" && fov) {
        const fovExtent = Math.tan((0.5 * fov * Math.PI) / 180);
        altMin = Math.round((1 / fovExtent) * 500);
        altMax = Math.round((1 / fovExtent) * 4000);
        // low altitude (zoomed in) → 0, high altitude (zoomed out) → 0.1
        threshScale = scalePow().domain([altMin, altMax]).range([0, 0.1]).exponent(0.08);
    } else {
        altMin = 90;
        altMax = 2000;
        // high altitude (zoomed in for standard) → 0, low altitude → 0.1
        threshScale = scalePow().domain([altMax, altMin]).range([0, 0.1]).exponent(0.08);
    }

    const altitude = macroState.inlinePropsMacro.altitude || macroState.macroParams.General.altitude;
    macroState.visibleArea = threshScale(altitude);

    if (!autoAdjustAltitude) return;
    let altChanged = false;
    if (altitude < altMin) {
        macroState.inlinePropsMacro.altitude = altMin;
        altChanged = true;
    }
    if (altitude > altMax) {
        macroState.inlinePropsMacro.altitude = altMax;
        altChanged = true;
    }
    if (altChanged) {
        macroState.macroParams.General.altitude = macroState.inlinePropsMacro.altitude;
    }
}
