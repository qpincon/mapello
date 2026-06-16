/** Shared color math utilities used across style picker components */

/** Convert HSV (h: 0-360, s: 0-100, v: 0-100) → 6-char uppercase hex without # */
export function hsvToHex(h: number, s: number, v: number): string {
    s /= 100; v /= 100;
    const hi = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const rows: [number, number, number][] = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
    return rows[hi].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Convert hex string (with or without #) → HSV */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
    const h = hex.replace("#", "");
    if (h.length < 6) return { h: 0, s: 0, v: 100 };
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hh = 0;
    if (d > 0) {
        if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) hh = ((b - r) / d + 2) / 6;
        else hh = ((r - g) / d + 4) / 6;
    }
    return { h: Math.round(hh * 360), s: Math.round((max === 0 ? 0 : d / max) * 100), v: Math.round(max * 100) };
}

/** Parse any CSS color string → { hex: 6-char uppercase without #, alpha: 0-100 } */
export function parseColorValue(v: string): { hex: string; alpha: number } {
    if (!v || v === "none") return { hex: "", alpha: 100 };
    const rgba = v.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
    if (rgba)
        return { hex: channelsToHex(rgba[1], rgba[2], rgba[3]), alpha: Math.round(parseFloat(rgba[4]) * 100) };
    if (v.startsWith("#") && v.length === 9)
        return { hex: v.slice(1, 7).toUpperCase(), alpha: Math.round((parseInt(v.slice(7), 16) / 255) * 100) };
    if (v.startsWith("#") && v.length >= 7)
        return { hex: v.slice(1, 7).toUpperCase(), alpha: 100 };
    return { hex: "", alpha: 100 };
}

/** Build a CSS color output from 6-char hex (without #) and alpha 0-100 */
export function buildColorOutput(hex: string, alpha: number): string {
    if (!hex) return "none";
    if (alpha >= 100) return "#" + hex;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${(alpha / 100).toFixed(2)})`;
}

/** Convert an rgb()/rgba() CSS string → #RRGGBB. Returns "" if not parseable. */
export function rgbToHex(rgb: string): string {
    const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return m ? "#" + channelsToHex(m[1], m[2], m[3]) : "";
}

function channelsToHex(r: string, g: string, b: string): string {
    return [r, g, b].map(n => parseInt(n).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Resolve any CSS color string to "#rrggbb" or "rgba(...)" form via a cached
 * canvas context. Handles named colours ("red" → "#ff0000"), rgb(), rgba(), hex.
 * Returns the original string unchanged if resolution fails.
 */
let _colorCtx: CanvasRenderingContext2D | null | undefined;
export function resolveColorToHex(v: string): string {
    if (!v || v === "none") return v;
    if (v.startsWith("#") || v.startsWith("rgb")) return v;
    if (_colorCtx === undefined) _colorCtx = document.createElement("canvas").getContext("2d");
    if (!_colorCtx) return v;
    try {
        _colorCtx.fillStyle = "#000";
        _colorCtx.fillStyle = v;
        return _colorCtx.fillStyle; // "#rrggbb" or "rgba(r,g,b,a)" — never a name
    } catch { return v; }
}

/** Compute a viewport-safe top/left for a fixed popover near a button. */
export function popoverPosition(
    btn: HTMLElement,
    popW: number,
    popH: number,
): { top: number; left: number } {
    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0)
        return { top: Math.max(4, window.innerHeight / 2 - popH / 2), left: Math.max(4, window.innerWidth / 2 - popW / 2) };
    let top = rect.bottom + 6;
    if (top + popH > window.innerHeight) top = rect.top - popH - 6;
    let left = rect.left;
    if (left + popW > window.innerWidth) left = rect.right - popW;
    return { top: Math.max(4, top), left: Math.max(4, left) };
}
