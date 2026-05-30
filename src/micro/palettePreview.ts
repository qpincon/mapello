/**
 * Builds a self-contained SVG string (with embedded <style> and <defs>) for a palette preview
 * thumbnail, by applying the palette's colours and patterns to the micro-preview.svg artwork.
 *
 * All selectors / pattern ids are prefixed with `scopeId` so that ~20 thumbnails can coexist
 * in the same document without id collisions and without touching the live #style-sheet-micro.
 */

import microPreviewRaw from "src/assets/img/micro-preview.svg?raw";
import { initLayersState } from "src/micro/drawing";
import { patternGenerator } from "src/svg/patternGenerator";
import type { MicroPaletteWithBorder, PatternDefinition } from "src/types";

const cache = new Map<string, string>();

export function buildPalettePreviewSvg(
    scopeId: string,
    palette: Partial<MicroPaletteWithBorder>,
): string {
    if (cache.has(scopeId)) return cache.get(scopeId)!;

    const layerDefs = initLayersState(palette);

    // --- Scoped CSS ----------------------------------------------------------
    // Mirrors only the fill/stroke/pattern/fills[] logic from generateCssFromState,
    // but scoped to our preview ids. No side effects on the live stylesheet.

    const microSel = `#${scopeId}-micro`;
    const bgSel = `#${scopeId}-bg, #${scopeId}-micro .background`;

    let css = `
        ${microSel} .line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
        ${microSel} .poly { stroke-linejoin: round; }
    `;

    for (const [layer, layerDef] of Object.entries(layerDefs)) {
        if (layer === "borderParams") continue;

        const isLineLayer =
            layer.includes("road") || layer.includes("path") || layer.includes("rail");

        const selector = layer === "background" ? bgSel : `${microSel} .${layer}`;

        let props = "";

        if (layerDef.stroke) {
            props += `stroke: ${layerDef.stroke};`;
            if (!isLineLayer) {
                props += `stroke-width: ${layerDef["stroke-width"] ?? "1px"};`;
            }
            if (layer.includes("path") && !layerDef["stroke-dasharray"]) {
                props += `stroke-dasharray: 5;`;
            } else if (layerDef["stroke-dasharray"]) {
                props += `stroke-dasharray: ${layerDef["stroke-dasharray"]};`;
            }
        }

        if (layerDef.pattern?.active) {
            const scopedPatternId = `${scopeId}-${layerDef.pattern.id}`;
            props += `fill: url(#${scopedPatternId});`;
        } else if (layerDef.fill) {
            props += `fill: ${layerDef.fill};`;
        }

        if (props) {
            css += `${selector} { ${props} }\n`;
        }

        // buildings-0 / -1 / -2 etc.
        if (layerDef.fills) {
            layerDef.fills.forEach((fill, i) => {
                css += `${microSel} .${layer}-${i} { fill: ${fill}; }\n`;
            });
        }
    }

    // --- SVG pattern defs ----------------------------------------------------
    // Build patterns in a detached <defs> node and serialise to innerHTML.

    let patternsHtml = "";
    if (typeof document !== "undefined") {
        const svgns = "http://www.w3.org/2000/svg";
        const tmpDefs = document.createElementNS(svgns, "defs") as SVGDefsElement;

        const patternList: PatternDefinition[] = [];
        for (const [layer, layerDef] of Object.entries(layerDefs)) {
            if (layer === "borderParams") continue;
            if (layerDef.pattern?.active && layerDef.fill) {
                patternList.push({
                    ...layerDef.pattern,
                    id: `${scopeId}-${layerDef.pattern.id}`,
                    backgroundColor: layerDef.fill,
                });
            }
        }

        if (patternList.length > 0) {
            patternGenerator.addOrUpdatePatternsForSVG(tmpDefs, patternList);
            patternsHtml = tmpDefs.innerHTML;
        }
    }

    // --- Rewrite the raw artwork SVG -----------------------------------------
    let svg = microPreviewRaw;

    // Strip clip-path and filter — they reference defs that don't exist in the
    // preview context and would clip / shadow the whole thumbnail incorrectly.
    svg = svg.replace(/\s*clip-path="[^"]*"/g, "");
    svg = svg.replace(/\s*filter="[^"]*"/g, "");

    // Scope ids so multiple previews on the same page don't share ids.
    svg = svg.replace(/id="tmywm"/, `id="${scopeId}-svg"`);
    svg = svg.replace(/id="micro-background"/, `id="${scopeId}-bg"`);
    svg = svg.replace(/id="micro"/, `id="${scopeId}-micro"`);
    svg = svg.replace(/id="frame"/, `id="${scopeId}-frame"`);

    // Inject <defs> + <style> immediately after the opening <svg …> tag.
    const svgTagEnd = svg.indexOf(">") + 1;
    const injection = `<defs>${patternsHtml}</defs><style>${css}</style>`;
    svg = svg.slice(0, svgTagEnd) + injection + svg.slice(svgTagEnd);

    cache.set(scopeId, svg);
    return svg;
}
