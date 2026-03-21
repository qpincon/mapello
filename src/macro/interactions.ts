import { scalePow } from "d3";
import { appState, macroState } from "src/state.svelte";

let altMin = 100;
let altMax = 10000;
const MAX_SIMPLIFICATION = 0.08;
// simplification threshold: maps altitude to visibleArea
let threshScale = scalePow().domain([altMax, altMin]).range([0, MAX_SIMPLIFICATION]).exponent(1.0);

export function zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    const src = event.sourceEvent;
    if (!src || (!src.deltaY && !src.deltaX)) return;
    if (src.type === "dblclick") return;
    if (!appState.projection) return;

    const delta = -src.deltaY * (src.deltaMode === 1 ? 0.05 : src.deltaMode ? 1 : 0.002);
    const zoomFactor = Math.pow(2, delta);

    const isSatellite = macroState.macroParams.General.projection === "satellite";
    const oldAltitude = macroState.inlinePropsMacro.altitude;
    let newAltitude = oldAltitude * (isSatellite ? 1 / zoomFactor : zoomFactor);
    newAltitude = Math.round(Math.max(altMin, Math.min(altMax, newAltitude)));

    // Zoom toward cursor: adjust center so the point under the cursor stays fixed
    const projection = appState.projection;
    if (projection.invert) {
        const container = (src.target as Element).closest("#map-container");
        if (container) {
            const rect = container.getBoundingClientRect();
            const cx = src.clientX - rect.left;
            const cy = src.clientY - rect.top;
            const cursorGeo = projection.invert([cx, cy]);
            if (cursorGeo && isFinite(cursorGeo[0]) && isFinite(cursorGeo[1])) {
                const altRatio = newAltitude / oldAltitude;
                if (isSatellite) {
                    // Satellite: lon/lat control the center (translateX/Y are ignored)
                    const lon = macroState.inlinePropsMacro.longitude;
                    const lat = macroState.inlinePropsMacro.latitude;
                    macroState.inlinePropsMacro.longitude = lon + ((cursorGeo[0] - lon) * (1 - altRatio));
                    macroState.inlinePropsMacro.latitude = lat + ((cursorGeo[1] - lat) * (1 - altRatio));
                } else {
                    // Standard: translateX/Y control the pixel offset
                    const w = container.clientWidth;
                    const h = container.clientHeight;
                    const centerX = w / 2 + macroState.inlinePropsMacro.translateX;
                    const centerY = h / 2 + macroState.inlinePropsMacro.translateY;
                    macroState.inlinePropsMacro.translateX -= (cx - centerX) * (altRatio - 1);
                    macroState.inlinePropsMacro.translateY -= (cy - centerY) * (altRatio - 1);
                }
            }
        }
    }

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

export function updateVisibleAreaScale(): void {
    const fov = macroState.macroParams.General.fieldOfView;
    if (macroState.macroParams.General.projection === "satellite") {
        const fovExtent = Math.tan((0.5 * fov * Math.PI) / 180);
        altMin = Math.round((1 / fovExtent) * 500);
        altMax = Math.round((1 / fovExtent) * 4000);
        // low altitude (zoomed in) → 0, high altitude (zoomed out) → MAX_SIMPLIFICATION
        threshScale = scalePow().domain([altMin, altMax]).range([0, MAX_SIMPLIFICATION]).exponent(1.0);
    } else {
        altMin = 90;
        altMax = 2000;
        // high altitude (zoomed in for standard) → 0, low altitude → MAX_SIMPLIFICATION
        threshScale = scalePow().domain([altMax, altMin]).range([0, MAX_SIMPLIFICATION]).exponent(1.0);
    }
}
export function changeAltitudeScale(autoAdjustAltitude = true): void {
    updateVisibleAreaScale();

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
