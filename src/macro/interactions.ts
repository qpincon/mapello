import { scaleLinear, scalePow } from "d3";
import { appState, macroState } from "src/state.svelte";
import { updateAltitudeRange } from "src/util/projections";


let altScale = scaleLinear().domain([1, 0]).range([100, 10000]);
// scale for simplification according to zoom
let threshScale = scalePow().domain([0, 1]).range([0.1, 0]).exponent(0.08);
export function zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): number | undefined {
    if (!event.sourceEvent) return;
    if (event.sourceEvent.type === "dblclick") return;
    if (!appState.projection) return;
    // @ts-expect-error
    event.transform.k = Math.max(Math.min(event.transform.k, 1), 0.00001);
    let newAltitude = Math.round(altScale(event.transform.k));
    // Ensure that zooming at max of scale actlually decreases altitude
    if (event.transform.k === 1) {
        if (macroState.macroParams.General.projection === "satellite") newAltitude = macroState.inlinePropsMacro.altitude - 30;
        else newAltitude = macroState.inlinePropsMacro.altitude + 30;
        newAltitude = Math.max(newAltitude, 30);
    }
    macroState.visibleArea = threshScale(event.transform.k);
    macroState.macroParams.General.altitude = newAltitude;
    macroState.inlinePropsMacro.altitude = newAltitude;
}

const sensitivity = 75;
export function dragged(event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>): void {
    macroState.inlinePropsMacro.translateX += event.dx;
    macroState.inlinePropsMacro.translateY += event.dy;
    const isSatellite = macroState.macroParams.General.projection === "satellite";
    if (isSatellite && event.sourceEvent.shiftKey) {
        macroState.inlinePropsMacro.tilt += event.dy / 10;
    } else if (isSatellite && (event.sourceEvent.metaKey || event.sourceEvent.ctrlKey)) {
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
    let invertAlt = false;
    if (projName === "satellite") {
        const newAltScale = updateAltitudeRange(fov);
        if (newAltScale) altScale = newAltScale;
        invertAlt = true;
    } else {
        altScale = scaleLinear().domain([0, 1]).range([90, 2000]);
    }
    const altitude = macroState.inlinePropsMacro.altitude || macroState.macroParams.General.altitude;
    const originalScale = altScale.invert(altitude);
    macroState.visibleArea = threshScale(originalScale);
    if (!autoAdjustAltitude) return;
    let altChanged = false;
    const firstScaleVal = altScale(invertAlt ? 1 : 0);
    const secondScaleVal = altScale(invertAlt ? 0 : 1);
    if (altitude < firstScaleVal) {
        macroState.inlinePropsMacro.altitude = firstScaleVal;
        altChanged = true;
    }
    if (altitude > secondScaleVal) {
        macroState.inlinePropsMacro.altitude = secondScaleVal;
        altChanged = true;
    }
    if (altChanged) {
        macroState.macroParams.General.altitude = macroState.inlinePropsMacro.altitude;
    }
}