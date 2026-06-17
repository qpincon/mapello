/**
 * Paper/material texture presets for the export modal.
 *
 * Each preset is a fully procedural SVG filter (feTurbulence-based) applied
 * to a cover rect, ported from the ol-ivier/raWowqp CodePen. No raster images
 * are used — a few hundred bytes of markup per preset.
 *
 * Naming convention for placeholders:
 *   {ID}  → replaced with `${mapId}-tex` by addTexture()
 *   {W}   → map width  (number)
 *   {H}   → map height (number)
 */

export type TextureBlend = 'multiply' | 'screen' | 'normal';

export interface TexturePreset {
    /** kebab-case key used in ExportOptions */
    key: string;
    /** Human-readable label shown in the select */
    label: string;
    /** CSS background-color of the original CodePen — carried as fallback / reference */
    baseColor: string;
    /** blend-mode applied in overlay mode (default 'multiply') */
    blend?: TextureBlend;
    /**
     * True when the texture is dark-toned and works best on dark maps.
     * Shown as a hint in the UI.
     */
    dark?: boolean;
    /**
     * Inner markup of <defs> (filters, patterns).
     * {ID} is substituted with a unique namespaced prefix.
     */
    defs?: string;
    /**
     * SVG elements to render (rects referencing the defs above).
     * {ID}, {W}, {H} are substituted by addTexture().
     */
    elements: string;
}

export const TEXTURES: TexturePreset[] = [
    {
        key: 'grain',
        label: 'Grain',
        baseColor: '#fafafa',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="n"/>
<feDiffuseLighting in="n" lighting-color="#fff" surfaceScale="1.2">
<feDistantLight azimuth="45" elevation="60"/>
</feDiffuseLighting>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#fafafa" filter="url(#{ID}-f)"/>`,
    },
    {
        key: 'canson',
        label: 'Canson',
        baseColor: '#f6f3eb',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="n"/>
<feDiffuseLighting in="n" lighting-color="#fff" surfaceScale="2">
<feDistantLight azimuth="60" elevation="50"/>
</feDiffuseLighting>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#faf8f4" filter="url(#{ID}-f)"/>`,
    },
    {
        key: 'lin',
        label: 'Linen',
        baseColor: '#f4f0e6',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.05 0.95" numOctaves="2" result="h"/>
<feTurbulence type="fractalNoise" baseFrequency="0.95 0.05" numOctaves="2" result="v"/>
<feBlend mode="multiply" in="h" in2="v" result="b"/>
<feDiffuseLighting in="b" lighting-color="#fff" surfaceScale="1">
<feDistantLight azimuth="45" elevation="65"/>
</feDiffuseLighting>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#f9f6f0" filter="url(#{ID}-f)" opacity="0.9"/>`,
    },
    {
        key: 'carton',
        label: 'Cardboard',
        baseColor: '#c5b9a5',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.25" numOctaves="3" result="n"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.1 1 1 1 0 -1.6" result="spots"/>
<feBlend mode="multiply" in="SourceGraphic" in2="spots"/>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#cebfa9" filter="url(#{ID}-f)"/>`,
    },
    {
        key: 'buvard',
        label: 'Blotting Paper',
        baseColor: '#e8ccd1',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="4" result="n"/>
<feDiffuseLighting in="n" lighting-color="#ffe6ea" surfaceScale="0.8">
<feDistantLight azimuth="200" elevation="65"/>
</feDiffuseLighting>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#edd5da" filter="url(#{ID}-f)" opacity="0.8"/>`,
    },
    {
        key: 'cuir',
        label: 'Leather',
        baseColor: '#bfa37a',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="5" result="n"/>
<feComponentTransfer in="n" result="w">
<feFuncR type="table" tableValues="0 1 0 1 0"/>
<feFuncG type="table" tableValues="0 1 0 1 0"/>
<feFuncB type="table" tableValues="0 1 0 1 0"/>
</feComponentTransfer>
<feColorMatrix type="matrix" values="0 0 0 0 0.3 0 0 0 0 0.2 0 0 0 0 0.1 -1 -1 -1 1.5 -0.1" result="v"/>
<feBlend mode="multiply" in="SourceGraphic" in2="v"/>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#caaf87" filter="url(#{ID}-f)" opacity="0.65"/>`,
    },
    {
        key: 'chanvre',
        label: 'Hemp',
        baseColor: '#d2caa9',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" result="noise"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.25 0 0 0 0 0.28 0 0 0 0 0.15 1 1 1 0 -1.5" result="fibers"/>
<feBlend mode="multiply" in="SourceGraphic" in2="fibers"/>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#dad2b4" filter="url(#{ID}-f)"/>`,
    },
    {
        key: 'papier-toile',
        label: 'Woven Paper',
        baseColor: '#c6cbcb',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="noise"/>
<feGaussianBlur in="noise" stdDeviation="0.15" result="softNoise"/>
<feDiffuseLighting in="softNoise" surfaceScale="0.7" lighting-color="white" result="light">
<feDistantLight azimuth="135" elevation="50"/>
</feDiffuseLighting>
</filter>
<pattern id="{ID}-warp" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-7)">
<rect width="1" height="4" fill="#ffffff" fill-opacity="0.045"/>
<rect x="2" width="1" height="4" fill="#000000" fill-opacity="0.025"/>
</pattern>
<pattern id="{ID}-weft" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(83)">
<rect width="1" height="4" fill="#ffffff" fill-opacity="0.03"/>
<rect x="2" width="1" height="4" fill="#000000" fill-opacity="0.015"/>
</pattern>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#c6cbcb"/>
<rect x="0" y="0" width="{W}" height="{H}" fill="url(#{ID}-warp)"/>
<rect x="0" y="0" width="{W}" height="{H}" fill="url(#{ID}-weft)"/>
<rect x="0" y="0" width="{W}" height="{H}" filter="url(#{ID}-f)" opacity="0.25"/>`,
    },
    {
        key: 'papier-artisanal',
        label: 'Handmade Paper',
        baseColor: '#e5e5e3',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" result="noise"/>
<feDiffuseLighting in="noise" lighting-color="#fff" surfaceScale="1.5" result="light">
<feDistantLight azimuth="45" elevation="60"/>
</feDiffuseLighting>
<feBlend mode="multiply" in="SourceGraphic" in2="light" result="blend1"/>
<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" result="spots"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 18 -16" result="dark-spots"/>
<feBlend mode="multiply" in="blend1" in2="dark-spots"/>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#e5e5e3" filter="url(#{ID}-f)"/>`,
    },
    {
        key: 'canevas',
        label: 'Canvas',
        baseColor: '#eae5d9',
        defs: `<filter id="{ID}-f">
<feTurbulence type="fractalNoise" baseFrequency="0.1 0.9" numOctaves="2" result="h"/>
<feTurbulence type="fractalNoise" baseFrequency="0.9 0.1" numOctaves="2" result="v"/>
<feBlend mode="overlay" in="h" in2="v" result="b"/>
<feDiffuseLighting in="b" lighting-color="#fff" surfaceScale="2.2">
<feDistantLight azimuth="45" elevation="50"/>
</feDiffuseLighting>
</filter>`,
        elements: `<rect x="0" y="0" width="{W}" height="{H}" fill="#f2ede0" filter="url(#{ID}-f)"/>`,
    },
];
