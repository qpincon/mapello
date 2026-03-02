import type { MicroPaletteWithBorder } from "../types";

export const playful: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#aaa", borderWidth: 3, borderRadius: 7, borderPadding: 20,
    },
    background: {
        fill: "#F2F4CB", disabled: true, active: true,
        pattern: { hatch: '.', strokeWidth: 3, scale: 1.3 }
    },
    other: { fill: "#F2F4CB", stroke: "#2F3737", disabled: true, active: true },
    buildings: { fills: ["#C5283D", "#E9724C", "#FFC857"], stroke: "#2F3737", active: true, defaultBuildingHeight: 5 },
    water: {
        fill: "#a1e3ff", stroke: "#85c9e6", active: true,
        pattern: { hatch: '.', color: '#85c9e6', strokeWidth: 2.4, scale: 0.9 }
    },
    sand: { fill: "#f4eace", stroke: "#a8a8a8", active: true },
    grass: { fill: "#D0F1BF", stroke: "#2F3737", active: true },
    forest: { fill: "#64B96A", stroke: "#2F3737", active: true },
    roads: { stroke: "#2F3737", active: true },
    railways: { stroke: "#2a3737", active: true },
};

// --- Monochrome: hand-drawn black & white ink drawing ---
export const ink: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#2a2a2a", borderWidth: 2, borderRadius: 7, borderPadding: 15,
    },
    background: {
        fill: "#f7f4f0", disabled: true, active: true,
        // '/\' = stacked forward + backward diagonals = X crosshatch
        pattern: { hatch: '/\\', color: '#c8bfb0', strokeWidth: 0.4, scale: 1.0 }
    },
    other: { fill: "#f7f4f0", stroke: "#2a2a2a", disabled: true, active: true },
    buildings: { fills: ["#1a1a1a", "#3d3d3d", "#5f5f5f"], stroke: "#0d0d0d", active: true },
    water: {
        fill: "#dce9f0", stroke: "#a8c0d0", active: true,
        pattern: { hatch: 'v', color: '#a8c0d0', strokeWidth: 0.7, scale: 0.9 }
    },
    sand: {
        fill: "#ede8d8", stroke: "#b8ae90", active: true,
        pattern: { hatch: '.', color: '#b8ae90', strokeWidth: 2.2, scale: 1.5 }
    },
    grass: {
        fill: "#e8ede0", stroke: "#8a9878", active: true,
        pattern: { hatch: 'o', color: '#8a9878', strokeWidth: 0.5, scale: 1.0 }
    },
    forest: {
        fill: "#cfdfc8", stroke: "#4a6038", active: true,
        pattern: { hatch: 'o', color: '#4a6038', strokeWidth: 0.8, scale: 1.0 }
    },
    roads: { stroke: "#222222", active: true },
    railways: { stroke: "#333333", active: true },
    paths: { stroke: "#555555", active: true },
};


// --- Pastel: dreamy lavender & mint ---
export const lavender: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#b090d8", borderWidth: 2, borderRadius: 50, borderPadding: 20,
    },
    background: {
        fill: "#f8f5ff", disabled: true, active: true,
        pattern: { hatch: 'o', color: '#e0d5f5', strokeWidth: 0.4, scale: 1.0 }
    },
    other: { fill: "#f8f5ff", stroke: "#d8cff0", disabled: true, active: true },
    buildings: { fills: ["#c8a8e8", "#b890d8", "#a878c8"], stroke: "#9060b8", active: true, defaultBuildingHeight: 4 },
    water: {
        fill: "#b8d4f8", stroke: "#88a8e8", active: true,
        pattern: { hatch: 'v', color: '#88a8e8', strokeWidth: 0.6, scale: 0.9 }
    },
    sand: { fill: "#faf0d8", stroke: "#e0d0a0", active: true },
    grass: { fill: "#ccf0d8", stroke: "#88c8a0", active: true },
    forest: { fill: "#a0ddb0", stroke: "#50a868", active: true },
    roads: { stroke: "#c0a0e0", active: true },
    railways: { stroke: "#a888d0", active: true },
    paths: { stroke: "#d0b8f0", active: true },
};

// --- Professional: engineering blueprint ---
export const blueprint: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#19305e", borderWidth: 3, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#19305e", disabled: true, active: true,
        pattern: { hatch: '+', color: '#243a70', strokeWidth: 0.3, scale: 1.0 }
    },
    other: { fill: "#19305e", stroke: "#243878", disabled: true, active: true },
    buildings: { fills: ["#3a6bc4", "#2e5aad", "#244896"], stroke: "#6a9ee8", active: true, defaultBuildingHeight: 6 },
    water: {
        fill: "#0f1d3c", stroke: "#162a54", active: true,
        // stacked forward + backward diagonal = diagonal grid
        pattern: { hatch: '/\\', color: '#1e3a6a', strokeWidth: 0.4, scale: 1.0 }
    },
    sand: { fill: "#24334e", stroke: "#303f5e", active: true },
    grass: { fill: "#1a3048", stroke: "#243c5a", active: true },
    forest: { fill: "#152840", stroke: "#1e3450", active: true },
    roads: { stroke: "#7aaae0", active: true },
    railways: { stroke: "#5484c0", active: true },
    paths: { stroke: "#4070a8", active: true },
};

// --- Playful bright: tropical citrus ---
export const citrus: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#ff8c00", borderWidth: 3, borderRadius: 7, borderPadding: 20,
    },
    background: { fill: "#fff9e8", disabled: true, active: true },
    other: { fill: "#fff9e8", stroke: "#f0e090", disabled: true, active: true },
    buildings: { fills: ["#ff5733", "#ff8c00", "#ffc300"], stroke: "#cc3300", active: true, defaultBuildingHeight: 5 },
    water: {
        fill: "#00b4d8", stroke: "#0096c7", active: true,
        pattern: { hatch: '.', color: '#0096c7', strokeWidth: 2.4, scale: 1.0 }
    },
    sand: { fill: "#ffe5a0", stroke: "#f0c050", active: true },
    grass: { fill: "#7de07d", stroke: "#20b020", active: true },
    forest: {
        fill: "#20a840", stroke: "#108030", active: true,
        pattern: { hatch: 'o', color: '#108030', strokeWidth: 0.6, scale: 1.0 }
    },
    roads: { stroke: "#ff7733", active: true },
    railways: { stroke: "#cc2200", active: true },
    paths: { stroke: "#ff8c00", active: true },
};

// --- Raw concrete brutalism ---
export const brutalist: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#2e2820", borderWidth: 4, borderRadius: 7, borderPadding: 15,
    },
    background: {
        fill: "#c4bcb0", disabled: true, active: true,
        pattern: { hatch: 'b', color: '#a8a098', strokeWidth: 0.7, scale: 1.3 }
    },
    other: { fill: "#c4bcb0", stroke: "#2e2820", disabled: true, active: true },
    buildings: { fills: ["#48403a", "#686058", "#888078"], stroke: "#1e1810", active: true, defaultBuildingHeight: 7 },
    water: {
        fill: "#6888a8", stroke: "#486080", active: true,
        pattern: { hatch: '-', color: '#486080', strokeWidth: 0.8, scale: 1.1 }
    },
    sand: {
        fill: "#bca888", stroke: "#907850", active: true,
        pattern: { hatch: '/', color: '#907850', strokeWidth: 0.6, scale: 1.1 }
    },
    grass: { fill: "#7a9060", stroke: "#506840", active: true },
    forest: {
        fill: "#506840", stroke: "#304828", active: true,
        pattern: { hatch: '\\', color: '#304828', strokeWidth: 0.6, scale: 1.1 }
    },
    roads: { stroke: "#1e1810", active: true },
    railways: { stroke: "#100e08", active: true },
    paths: { stroke: "#504838", active: true },
};

// --- Cyberpunk neon on black ---
export const neon: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#ff006e", borderWidth: 2, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#06060f", disabled: true, active: true,
        pattern: { hatch: 'S', color: '#180830', strokeWidth: 0.6, scale: 1.8 }
    },
    other: { fill: "#06060f", stroke: "#180830", disabled: true, active: true },
    buildings: { fills: ["#ff006e", "#8338ec", "#3a86ff"], stroke: "#ff80bf", active: true, defaultBuildingHeight: 8 },
    water: {
        fill: "#00030f", stroke: "#0040d0", active: true,
        pattern: { hatch: '~', color: '#0060ff', strokeWidth: 0.9, scale: 1.0 }
    },
    sand: { fill: "#180a00", stroke: "#382000", active: true },
    grass: {
        fill: "#001a06", stroke: "#00d060", active: true,
        pattern: { hatch: '|', color: '#00a048', strokeWidth: 0.5, scale: 1.0 }
    },
    forest: {
        fill: "#000d03", stroke: "#00c050", active: true,
        pattern: { hatch: 'S', color: '#00a040', strokeWidth: 0.5, scale: 1.2 }
    },
    roads: { stroke: "#ff006e", active: true },
    railways: { stroke: "#8338ec", active: true },
    paths: { stroke: "#3a86ff", active: true },
};

// --- Mediterranean terracotta & sea ---
export const terracotta: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#a03010", borderWidth: 3, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#f5e8d0", disabled: true, active: true,
        pattern: { hatch: '\\', color: '#d8c8a0', strokeWidth: 0.5, scale: 1.2 }
    },
    other: { fill: "#f5e8d0", stroke: "#a03010", disabled: true, active: true },
    buildings: { fills: ["#c84b1a", "#a03510", "#e06030"], stroke: "#701808", active: true, defaultBuildingHeight: 5 },
    water: {
        fill: "#3a78a8", stroke: "#286090", active: true,
        pattern: { hatch: 's', color: '#286090', strokeWidth: 0.7, scale: 0.9 }
    },
    sand: {
        fill: "#e8d0a0", stroke: "#c0a860", active: true,
        pattern: { hatch: '.', color: '#c0a860', strokeWidth: 2.4, scale: 1.3 }
    },
    grass: { fill: "#88b060", stroke: "#507830", active: true },
    forest: {
        fill: "#508030", stroke: "#305010", active: true,
        pattern: { hatch: 't', color: '#305010', strokeWidth: 0.7, scale: 0.9 }
    },
    roads: { stroke: "#703818", active: true },
    railways: { stroke: "#502508", active: true },
    paths: { stroke: "#a06030", active: true },
};

// --- Bubblegum candy ---
export const candy: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#ff3090", borderWidth: 4, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#fff0f8", disabled: true, active: true,
        pattern: { hatch: 'c', color: '#ffd0ec', strokeWidth: 1.0, scale: 1.2 }
    },
    other: { fill: "#fff0f8", stroke: "#ff90c8", disabled: true, active: true },
    buildings: { fills: ["#ff70c0", "#70ffe0", "#ffee50"], stroke: "#cc2080", active: true, defaultBuildingHeight: 4 },
    water: {
        fill: "#70ccff", stroke: "#30a8ff", active: true,
        pattern: { hatch: 'O', color: '#30a8ff', strokeWidth: 0.7, scale: 1.0 }
    },
    sand: {
        fill: "#ffee80", stroke: "#e8cc30", active: true,
        pattern: { hatch: 'v', color: '#e8cc30', strokeWidth: 0.8, scale: 0.9 }
    },
    grass: { fill: "#a0ffb0", stroke: "#30e050", active: true },
    forest: {
        fill: "#40e080", stroke: "#10b840", active: true,
        pattern: { hatch: 'S', color: '#10b840', strokeWidth: 0.5, scale: 1.3 }
    },
    roads: { stroke: "#ff70c0", active: true },
    railways: { stroke: "#bb20a0", active: true },
    paths: { stroke: "#70ccff", active: true },
};

// --- Vintage aged parchment map ---
export const sepia: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#502808", borderWidth: 3, borderRadius: 10, borderPadding: 18,
    },
    background: {
        fill: "#f2ddb0", disabled: true, active: true,
        pattern: { hatch: '/', color: '#d8c090', strokeWidth: 0.4, scale: 1.2 }
    },
    other: { fill: "#f2ddb0", stroke: "#7a4810", disabled: true, active: true },
    buildings: { fills: ["#7a3810", "#5a2008", "#9a4818"], stroke: "#381008", active: true },
    water: {
        fill: "#a0b8cc", stroke: "#6890a8", active: true,
        pattern: { hatch: '-', color: '#6890a8', strokeWidth: 0.7, scale: 1.1 }
    },
    sand: {
        fill: "#d8c090", stroke: "#a89860", active: true,
        pattern: { hatch: '0', color: '#a89860', strokeWidth: 0.6, scale: 2.0 }
    },
    grass: {
        fill: "#98a868", stroke: "#687840", active: true,
        pattern: { hatch: '\\', color: '#687840', strokeWidth: 0.5, scale: 1.1 }
    },
    forest: {
        fill: "#587048", stroke: "#384828", active: true,
        pattern: { hatch: 't', color: '#384828', strokeWidth: 0.7, scale: 0.9 }
    },
    roads: { stroke: "#603810", active: true },
    railways: { stroke: "#401808", active: true },
    paths: { stroke: "#806030", active: true },
};


// --- Retro mid-century travel poster ---
export const poster: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#1a1a1a", borderWidth: 4, borderRadius: 7, borderPadding: 20,
    },
    background: {
        fill: "#f5f0e0", disabled: true, active: true,
        pattern: { hatch: 'b', color: '#e0d8c0', strokeWidth: 0.5, scale: 1.4 }
    },
    other: { fill: "#f5f0e0", stroke: "#1a1a1a", disabled: true, active: true },
    buildings: { fills: ["#e63946", "#1d3557", "#457b9d"], stroke: "#111111", active: true, defaultBuildingHeight: 6 },
    water: {
        fill: "#457b9d", stroke: "#1d3557", active: true,
        pattern: { hatch: '~', color: '#1d3557', strokeWidth: 0.9, scale: 1.0 }
    },
    sand: {
        fill: "#f4d06a", stroke: "#d0a820", active: true,
    },
    grass: { fill: "#a8d8b0", stroke: "#3a8848", active: true },
    forest: {
        fill: "#2d6a4f", stroke: "#1a3a28", active: true,
        pattern: { hatch: '/', color: '#1a3a28', strokeWidth: 0.6, scale: 1.1 }
    },
    roads: { stroke: "#e63946", active: true },
    railways: { stroke: "#1d3557", active: true },
    paths: { stroke: "#c07840", active: true },
};

// --- Ultra-minimal cartographic light (Positron-inspired) ---
export const positron: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#c8c8c8", borderWidth: 1, borderRadius: 7, borderPadding: 18,
    },
    background: { fill: "#f2f3f0", disabled: true, active: true },
    other: { fill: "#f2f3f0", stroke: "#e0e0da", disabled: true, active: true },
    buildings: { fills: ["#e8e8e2", "#ddddd6", "#d2d2ca"], stroke: "#c0c0b8", active: true },
    water: {
        fill: "#c2c8ca", stroke: "#a8b4b8", active: true,
        pattern: { hatch: '-', color: '#a8b4b8', strokeWidth: 0.4, scale: 1.1 }
    },
    sand: { fill: "#ede8de", stroke: "#d0c8b8", active: true },
    grass: {
        fill: "#e4e8e0", stroke: "#c8d0c0", active: true,
        pattern: { hatch: 'o', color: '#c0c8b8', strokeWidth: 0.4, scale: 1.0 }
    },
    forest: { fill: "#d8e0d4", stroke: "#b8c8b0", active: true },
    roads: { stroke: "#b0b0aa", active: true },
    railways: { stroke: "#989890", active: true },
    paths: { stroke: "#c0beb8", active: true },
};

// --- Scandinavian fjord, cold & clean ---
export const nordic: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#a8bcc8", borderWidth: 2, borderRadius: 10, borderPadding: 20,
    },
    background: { fill: "#f0f2f5", disabled: true, active: true },
    other: { fill: "#f0f2f5", stroke: "#d8dfe8", disabled: true, active: true },
    buildings: { fills: ["#5a7a90", "#486878", "#384e5c"], stroke: "#2e3e4c", active: true, defaultBuildingHeight: 5 },
    water: {
        fill: "#8ab0cc", stroke: "#6090b0", active: true,
        pattern: { hatch: '-', color: '#6090b0', strokeWidth: 0.6, scale: 1.1 }
    },
    sand: { fill: "#e8e0d0", stroke: "#c8bca8", active: true },
    grass: { fill: "#b8c8a8", stroke: "#8aa080", active: true },
    forest: {
        fill: "#608070", stroke: "#406050", active: true,
        pattern: { hatch: '/', color: '#406050', strokeWidth: 0.5, scale: 1.1 }
    },
    roads: { stroke: "#7a8fa0", active: true },
    railways: { stroke: "#586878", active: true },
    paths: { stroke: "#9aaab8", active: true },
};

// --- Arid desert, saharan dunes ---
export const desert: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#c08040", borderWidth: 3, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#e8d498", disabled: true, active: true,
        pattern: { hatch: '0', color: '#c8b070', strokeWidth: 0.6, scale: 2.1 }
    },
    other: { fill: "#e8d498", stroke: "#c0a860", disabled: true, active: true },
    buildings: { fills: ["#c06030", "#a84820", "#d07840"], stroke: "#803010", active: true, defaultBuildingHeight: 4 },
    water: {
        fill: "#3090a8", stroke: "#1c6c88", active: true,
    },
    sand: {
        fill: "#d4b060", stroke: "#b08838", active: true,
        pattern: { hatch: '.', color: '#b08838', strokeWidth: 2.5, scale: 1.4 }
    },
    grass: { fill: "#909840", stroke: "#707020", active: true },
    forest: {
        fill: "#607030", stroke: "#405020", active: true,
        pattern: { hatch: 't', color: '#405020', strokeWidth: 0.6, scale: 0.9 }
    },
    roads: { stroke: "#8a5820", active: true },
    railways: { stroke: "#604010", active: true },
    paths: { stroke: "#a07030", active: true },
};

// --- Japanese sakura season ---
export const cherry: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#d86098", borderWidth: 2, borderRadius: 50, borderPadding: 22,
    },
    background: {
        fill: "#fce8f0", disabled: true, active: true,
        pattern: { hatch: 'S', color: '#e487b6', strokeWidth: 0.5, scale: 1.6 }
    },
    other: { fill: "#fce8f0", stroke: "#f0c0d8", disabled: true, active: true },
    buildings: { fills: ["#2a2060", "#1e1848", "#362878"], stroke: "#100c38", active: true, defaultBuildingHeight: 5 },
    water: {
        fill: "#c0d0f4", stroke: "#90a8e8", active: true,
        pattern: { hatch: '~', color: '#90a8e8', strokeWidth: 0.7, scale: 1.0 }
    },
    sand: { fill: "#f8e4c0", stroke: "#e0c890", active: true },
    grass: { fill: "#d0f0d8", stroke: "#80c898", active: true },
    forest: {
        fill: "#80b890", stroke: "#408860", active: true,
        pattern: { hatch: 't', color: '#408860', strokeWidth: 0.6, scale: 0.9 }
    },
    roads: { stroke: "#2a2060", active: true },
    railways: { stroke: "#180c50", active: true },
    paths: { stroke: "#d86098", active: true },
};

// --- Ancient overgrown forgotten city ---
export const moss: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#3a6028", borderWidth: 3, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#0c1408", disabled: true, active: true,
        pattern: { hatch: 'b', color: '#182008', strokeWidth: 0.6, scale: 1.4 }
    },
    other: { fill: "#0c1408", stroke: "#182010", disabled: true, active: true },
    buildings: { fills: ["#1e3018", "#283a20", "#162808"], stroke: "#0a1806", active: true, defaultBuildingHeight: 5 },
    water: {
        fill: "#082c16", stroke: "#0c4020", active: true,
        pattern: { hatch: 's', color: '#106028', strokeWidth: 0.7, scale: 0.9 }
    },
    sand: { fill: "#1c1a08", stroke: "#2a2808", active: true },
    grass: {
        fill: "#243a18", stroke: "#385828", active: true,
        pattern: { hatch: '/', color: '#385828', strokeWidth: 0.5, scale: 1.1 }
    },
    forest: {
        fill: "#162808", stroke: "#284818", active: true,
        pattern: { hatch: 'o', color: '#386830', strokeWidth: 0.7, scale: 1.0 }
    },
    roads: { stroke: "#4a6c38", active: true },
    railways: { stroke: "#304820", active: true },
    paths: { stroke: "#5a8040", active: true },
};

// --- True black + near-white buildings, maximum contrast ---
export const obsidian: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#282828", borderWidth: 2, borderRadius: 7, borderPadding: 20,
    },
    background: { fill: "#080808", disabled: true, active: true },
    other: { fill: "#080808", stroke: "#181818", disabled: true, active: true },
    buildings: { fills: ["#f0f0ee", "#e2e2e0", "#d0d0ce"], stroke: "#b8b8b6", active: true, defaultBuildingHeight: 6 },
    water: {
        fill: "#0a0a18", stroke: "#14142a", active: true,
        pattern: { hatch: '~', color: '#1a1a40', strokeWidth: 0.8, scale: 1.0 }
    },
    sand: { fill: "#100e08", stroke: "#1c1a10", active: true },
    grass: { fill: "#0a0f08", stroke: "#141a10", active: true },
    forest: {
        fill: "#060c04", stroke: "#0f180a", active: true,
        pattern: { hatch: '/', color: '#182808', strokeWidth: 0.5, scale: 1.1 }
    },
    roads: { stroke: "#c8c8c8", active: true },
    railways: { stroke: "#909090", active: true },
    paths: { stroke: "#a0a0a0", active: true },
};

// --- Deep wine/burgundy + warm champagne buildings ---
export const merlot: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#6a1830", borderWidth: 3, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#2d0a18", disabled: true, active: true,
        pattern: { hatch: '\\', color: '#3d1428', strokeWidth: 0.5, scale: 1.2 }
    },
    other: { fill: "#2d0a18", stroke: "#3d1428", disabled: true, active: true },
    buildings: { fills: ["#e8d090", "#d4b870", "#f0e0a8"], stroke: "#a89050", active: true, defaultBuildingHeight: 6 },
    water: {
        fill: "#06030e", stroke: "#100820", active: true,
        pattern: { hatch: '-', color: '#180a28', strokeWidth: 0.6, scale: 1.1 }
    },
    sand: { fill: "#1c100a", stroke: "#2c1c10", active: true },
    grass: { fill: "#0e0a08", stroke: "#181008", active: true },
    forest: {
        fill: "#080608", stroke: "#141008", active: true,
        pattern: { hatch: 's', color: '#201010', strokeWidth: 0.6, scale: 0.9 }
    },
    roads: { stroke: "#c8a060", active: true },
    railways: { stroke: "#906830", active: true },
    paths: { stroke: "#d8b870", active: true },
};

// --- Deep jade teal + warm ivory buildings ---
export const jade: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#0e4840", borderWidth: 2, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#0c3530", disabled: true, active: true,
        pattern: { hatch: 'b', color: '#144540', strokeWidth: 0.6, scale: 1.4 }
    },
    other: { fill: "#0c3530", stroke: "#144540", disabled: true, active: true },
    buildings: { fills: ["#f5e8c8", "#e8d8a8", "#d8c888"], stroke: "#b0a060", active: true, defaultBuildingHeight: 5 },
    water: {
        fill: "#062820", stroke: "#0a3c2c", active: true,
        pattern: { hatch: 'o', color: '#0e4838', strokeWidth: 0.6, scale: 1.0 }
    },
    sand: { fill: "#1a1a0e", stroke: "#282818", active: true },
    grass: { fill: "#124038", stroke: "#1c5848", active: true },
    forest: {
        fill: "#0a2820", stroke: "#124030", active: true,
        pattern: { hatch: 'v', color: '#184838', strokeWidth: 0.7, scale: 0.9 }
    },
    roads: { stroke: "#70c0a8", active: true },
    railways: { stroke: "#409880", active: true },
    paths: { stroke: "#88d0b8", active: true },
};

// --- Pure white + vivid cobalt blue buildings ---
export const chalk: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#1a4fc4", borderWidth: 3, borderRadius: 7, borderPadding: 20,
    },
    background: { fill: "#ffffff", disabled: true, active: true },
    other: { fill: "#ffffff", stroke: "#f0f0f0", disabled: true, active: true },
    buildings: { fills: ["#1a4fc4", "#0d38a0", "#2660e0"], stroke: "#082080", active: true, defaultBuildingHeight: 6 },
    water: {
        fill: "#c8e4f8", stroke: "#90c0f0", active: true,
        pattern: { hatch: 'v', color: '#90c0f0', strokeWidth: 0.7, scale: 0.9 }
    },
    sand: { fill: "#f8f0d8", stroke: "#e0d8b0", active: true },
    grass: { fill: "#d8f0d8", stroke: "#a0d8a8", active: true },
    forest: {
        fill: "#a8d8b0", stroke: "#60b070", active: true,
        pattern: { hatch: '-', color: '#60b070', strokeWidth: 0.5, scale: 1.1 }
    },
    roads: { stroke: "#e84040", active: true },
    railways: { stroke: "#c02020", active: true },
    paths: { stroke: "#f06060", active: true },
};

// --- Deep violet + electric lime buildings ---
export const grape: Partial<MicroPaletteWithBorder> = {
    borderParams: {
        borderColor: "#5020a0", borderWidth: 2, borderRadius: 10, borderPadding: 20,
    },
    background: {
        fill: "#130a28", disabled: true, active: true,
        pattern: { hatch: 'o', color: '#201040', strokeWidth: 0.5, scale: 1.0 }
    },
    other: { fill: "#130a28", stroke: "#201040", disabled: true, active: true },
    buildings: { fills: ["#7ee030", "#5ec010", "#a0f050"], stroke: "#408010", active: true, defaultBuildingHeight: 7 },
    water: {
        fill: "#0a0618", stroke: "#12082c", active: true,
        pattern: { hatch: '+', color: '#200c40', strokeWidth: 0.4, scale: 0.9 }
    },
    sand: { fill: "#140e06", stroke: "#201808", active: true },
    grass: { fill: "#0c1808", stroke: "#182808", active: true },
    forest: {
        fill: "#080e04", stroke: "#102008", active: true,
        pattern: { hatch: 't', color: '#203818', strokeWidth: 0.6, scale: 0.9 }
    },
    roads: { stroke: "#c050f0", active: true },
    railways: { stroke: "#8030c0", active: true },
    paths: { stroke: "#a040e0", active: true },
};
