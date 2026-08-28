import { color } from "d3-color";
import type { GlowParams } from "../params";
import { macroState } from "../state.svelte";
import { defaultGlowParams } from "../stateDefaults";
import type { CssDict, MacroPalette } from "../types";
import { exportStyleSheet, findStyleSheet, updateStyleSheetOrGenerateCss } from "../util/dom";

/**
 * One-click macro map styles. Mirrors src/micro/microPalettes.ts: each named export is a
 * palette, the export name is its id, and export order is display order.
 */

// --- Classic warm atlas — reproduces the app's own defaults ---
export const atlas: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 3,
        graticuleColor: "#777777",
        graticuleWidth: 0.5,
        seaColor: "#dde2eeff",
    },
    border: { borderRadius: 1.5, borderWidth: 1, borderColor: "#b8b8b8" },
    land: { strokeWidth: 1, strokeColor: "#a0a0a07d", strokeDash: 0, fillColor: "#ffffff" },
    glow: { ...defaultGlowParams },
    country: { fill: "#f3efec", stroke: "#bfbfbf", "stroke-width": "1px" },
    countryHovered: { fill: "#f9f2eb" },
    adm: { fill: "#ffffffd0", stroke: "#c4b8a3ff", "stroke-width": "1px" },
    admHovered: { fill: "#ecd6b6ff", stroke: "#d29d52ff", "stroke-width": "2px" },
};

// --- CARTO-Positron-inspired: flat, minimal, no glow ---
export const positron: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 5,
        graticuleColor: "#707d82",
        graticuleWidth: 0.5,
        seaColor: "#ccd4d8ff",
    },
    border: { borderRadius: 1.5, borderWidth: 1, borderColor: "#c9c9c2" },
    land: { strokeWidth: 0.6, strokeColor: "#d3d3ccff", strokeDash: 0, fillColor: "#f2f3f0ff" },
    glow: null,
    country: { fill: "#f2f3f0ff", stroke: "#c9c9c2ff", "stroke-width": "0.6px" },
    countryHovered: { fill: "#e4e6e0ff" },
    adm: { fill: "#f7f8f5ff", stroke: "#d3d3ccff", "stroke-width": "0.6px" },
    admHovered: { fill: "#e4e6e0ff", stroke: "#b8b8b0ff", "stroke-width": "1px" },
};

// --- Antique engraved atlas: sepia, outer-glow-only coastal halo ---
export const parchment: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 5,
        graticuleColor: "#9c8156",
        graticuleWidth: 0.4,
        seaColor: "#c9b795ff",
    },
    border: { borderRadius: 2, borderWidth: 2, borderColor: "#7a5a34" },
    land: { strokeWidth: 1.2, strokeColor: "#9c8156ff", strokeDash: 0, fillColor: "#f2e6cbff" },
    glow: {
        innerStrength: 0,
        innerBlur: 0,
        innerColor: "#6b4a28ff",
        outerBlur: 4.5,
        outerStrength: 0.35,
        outerColor: "#6b4a28ff",
    },
    country: { fill: "#ece0c2ff", stroke: "#ab8f61ff", "stroke-width": "1px" },
    countryHovered: { fill: "#f3e9cdff" },
    adm: { fill: "#f5ecd6ff", stroke: "#ab8f61ff", "stroke-width": "1px" },
    admHovered: { fill: "#e8d5a8ff", stroke: "#8a6a3eff", "stroke-width": "2px" },
};

// --- Near-black navy, cyan coastline ---
export const midnight: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 4,
        graticuleColor: "#3f6483",
        graticuleWidth: 0.5,
        seaColor: "#070d17ff",
    },
    border: { borderRadius: 1.5, borderWidth: 1, borderColor: "#2c455c" },
    land: { strokeWidth: 1, strokeColor: "#2c455cff", strokeDash: 0, fillColor: "#101c29ff" },
    glow: {
        innerStrength: 0.15,
        innerBlur: 2.2,
        innerColor: "#4a90a8ff",
        outerBlur: 2.5,
        outerStrength: 0.1,
        outerColor: "#2c5f75ff",
    },
    country: { fill: "#14212eff", stroke: "#3c5a75ff", "stroke-width": "1px" },
    countryHovered: { fill: "#1c2f3fff" },
    adm: { fill: "#182838ff", stroke: "#3c5a75ff", "stroke-width": "1px" },
    admHovered: { fill: "#274a63ff", stroke: "#5fa8d0ff", "stroke-width": "2px" },
};

// --- National-Geographic-style expedition atlas: tan land, muted teal sea, brown borders ---
export const expedition: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 5,
        graticuleColor: "#9c8a68",
        graticuleWidth: 0.3,
        seaColor: "#a8c9d4ff",
    },
    border: { borderRadius: 1, borderWidth: 1.5, borderColor: "#5c4a30" },
    land: { strokeWidth: 1, strokeColor: "#8a7550ff", strokeDash: 0, fillColor: "#e8ddc0ff" },
    glow: {
        innerStrength: 0.14,
        innerBlur: 2.4,
        innerColor: "#d9b878ff",
        outerBlur: 2.6,
        outerStrength: 0.4,
        outerColor: "#8a7550ff",
    },
    country: { fill: "#f0e6ccff", stroke: "#6b5738ff", "stroke-width": "1px" },
    countryHovered: { fill: "#e6d8b0ff" },
    adm: { fill: "#f5eeddff", stroke: "#8a7550ff", "stroke-width": "1px" },
    admHovered: { fill: "#ddc994ff", stroke: "#5c4a30ff", "stroke-width": "1.5px" },
};

// --- Classic textbook physical/political map: blue sea, green land, square frame, no glow ---
export const meridian: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 10,
        graticuleColor: "#7fa8c9",
        graticuleWidth: 0.3,
        seaColor: "#a9cce3ff",
    },
    border: { borderRadius: 0, borderWidth: 1.5, borderColor: "#333333" },
    land: { strokeWidth: 0.8, strokeColor: "#5a7a52ff", strokeDash: 0, fillColor: "#c8e6c0ff" },
    glow: null,
    country: { fill: "#eaf3e0ff", stroke: "#4d4d4dff", "stroke-width": "0.8px" },
    countryHovered: { fill: "#dcefe0ff" },
    adm: { fill: "#f2f7ecff", stroke: "#7a9a72ff", "stroke-width": "0.8px" },
    admHovered: { fill: "#d3e8c8ff", stroke: "#4d4d4dff", "stroke-width": "1.5px" },
};

// --- Monochrome newsprint / print atlas: grayscale, square frame, no glow ---
export const newsprint: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 6,
        graticuleColor: "#c4c4c4",
        graticuleWidth: 0.3,
        seaColor: "#e8e8e8ff",
    },
    border: { borderRadius: 0, borderWidth: 1, borderColor: "#1a1a1a" },
    land: { strokeWidth: 1, strokeColor: "#555555ff", strokeDash: 0, fillColor: "#ffffffff" },
    glow: null,
    country: { fill: "#f5f5f5ff", stroke: "#333333ff", "stroke-width": "1px" },
    countryHovered: { fill: "#e0e0e0ff" },
    adm: { fill: "#fafafaff", stroke: "#777777ff", "stroke-width": "0.8px" },
    admHovered: { fill: "#d0d0d0ff", stroke: "#222222ff", "stroke-width": "1.5px" },
};

/**
 * Applies a macro palette to state: sea/graticule, border, land contour, glow on every layer
 * that currently has one, and the default .country/.adm CSS rules. Leaves everything else in
 * baseCss (fonts, .text, #paths, per-element inline styles) untouched.
 */
export function applyMacroPalette(palette: MacroPalette): void {
    Object.assign(macroState.macroParams.Background, palette.background);
    Object.assign(macroState.macroParams.Border, palette.border);
    Object.assign(macroState.contourParams, palette.land);

    if (palette.glow) {
        for (const layer of Object.keys(macroState.zonesGlow)) {
            macroState.zonesGlow[layer] = { ...palette.glow };
        }
        macroState.zonesGlow.land = { ...palette.glow };
    } else {
        for (const layer of Object.keys(macroState.zonesGlow)) {
            delete macroState.zonesGlow[layer];
        }
    }

    const [sheet] = findStyleSheet("#outline");
    updateStyleSheetOrGenerateCss(sheet, ".country", palette.country);
    updateStyleSheetOrGenerateCss(sheet, ".country.hovered", palette.countryHovered);
    updateStyleSheetOrGenerateCss(sheet, ".adm", palette.adm);
    updateStyleSheetOrGenerateCss(sheet, ".adm.hovered", palette.admHovered);
    macroState.baseCss = exportStyleSheet("#outline") ?? macroState.baseCss;
}

const hex8 = (c: string | undefined | null): string | null => (c ? (color(c)?.formatHex8() ?? null) : null);

function cssDictMatches(actual: CssDict, expected: CssDict): boolean {
    return Object.entries(expected).every(([prop, value]) => {
        const actualValue = actual[prop];
        if (prop.includes("color") || prop === "fill" || prop === "stroke") {
            return hex8(actualValue) === hex8(value);
        }
        return actualValue === value;
    });
}

/** Pulls the `.country { ... }` rule body out of baseCss (not `.country.hovered`). */
function extractRuleProps(css: string, selector: string): CssDict {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    const props: CssDict = {};
    if (!match) return props;
    for (const decl of match[1].split(";")) {
        const [prop, ...rest] = decl.split(":");
        if (!prop || !rest.length) continue;
        props[prop.trim()] = rest.join(":").trim();
    }
    return props;
}

const glowMatches = (actual: GlowParams | undefined, expected: GlowParams | null): boolean => {
    if (!expected) return !actual;
    if (!actual) return false;
    return (
        actual.innerStrength === expected.innerStrength &&
        actual.innerBlur === expected.innerBlur &&
        hex8(actual.innerColor) === hex8(expected.innerColor) &&
        actual.outerStrength === expected.outerStrength &&
        actual.outerBlur === expected.outerBlur &&
        hex8(actual.outerColor) === hex8(expected.outerColor)
    );
};

/** Returns the id of the palette matching current macro state, or "" ("Custom") if none does. */
export function findMatchingPaletteId(palettes: Record<string, MacroPalette>): string {
    const country = extractRuleProps(macroState.baseCss, ".country");
    return (
        Object.keys(palettes).find((id) => {
            const p = palettes[id];
            const bg = macroState.macroParams.Background;
            const border = macroState.macroParams.Border;
            const land = macroState.contourParams;
            return (
                bg.showGraticule === p.background.showGraticule &&
                bg.graticuleStep === p.background.graticuleStep &&
                hex8(bg.graticuleColor) === hex8(p.background.graticuleColor) &&
                bg.graticuleWidth === p.background.graticuleWidth &&
                hex8(bg.seaColor) === hex8(p.background.seaColor) &&
                hex8(border.borderColor) === hex8(p.border.borderColor) &&
                border.borderWidth === p.border.borderWidth &&
                border.borderRadius === p.border.borderRadius &&
                land.strokeWidth === p.land.strokeWidth &&
                hex8(land.strokeColor) === hex8(p.land.strokeColor) &&
                land.strokeDash === p.land.strokeDash &&
                hex8(land.fillColor) === hex8(p.land.fillColor) &&
                glowMatches(macroState.zonesGlow.land, p.glow) &&
                cssDictMatches(country, p.country)
            );
        }) ?? ""
    );
}
