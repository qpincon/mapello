import { color, hsl } from "d3";
import { log } from 'src/util/log';
import { debounce, last } from "lodash-es";
import { generateCssFromState } from "src/micro/drawing";
import { patternGenerator } from "src/svg/patternGenerator";
import type { Color, MicroLayerId, MicroPalette, PatternDefinition } from "src/types";
import { findStyleSheet } from "src/util/dom";


// Returns true if we should redraw (layer deactivated for instance)
export function onMicroParamChange(
    layer: MicroLayerId,
    prop: string | string[],
    value: any,
    layerState: MicroPalette
): boolean {
    log('onMicroParamChange', layer, prop, value);
    if (prop.includes("pattern")) {
        updateSvgPatterns(document.getElementById('static-svg-map') as unknown as SVGSVGElement, layerState);
        replaceCssSheetContent(layerState);
        return false;
    }
    if (prop.includes("active")) {
        return true;
    }
    if (prop.includes('3dBuildings')) {
        replaceCssSheetContent(layerState);
        return true;
    }
    if (prop.includes('defaultBuildingHeight')) {
        // Requires full redraw of 3D buildings
        return true;
    }

    let ruleTxt = `#micro .${layer}`;
    if (layer === "background") ruleTxt = "#micro-background";
    // Change "building-0" for instance
    if (Array.isArray(prop) && prop[0] === "fills") ruleTxt = `#micro .${layer}-${last(prop)}`;

    const [, rule] = findStyleSheet(ruleTxt);
    if (!rule) return false;

    if (Array.isArray(prop) && prop[0] === "fills") {
        rule.style.setProperty("fill", value);
    } else {
        if (layerState[layer].pattern?.active) {
            updateSvgPatterns(document.getElementById('static-svg-map') as unknown as SVGSVGElement, layerState);
        } else {
            rule.style.setProperty(prop as string, value);
        }
    }
    replaceCssSheetContent(layerState);
    return false;
}


export const replaceCssSheetContent = debounce((layerState: MicroPalette) => {
    const styleSheet = document.getElementById('style-sheet-micro') as HTMLStyleElement;
    const microCss = generateCssFromState(layerState);
    if (microCss) styleSheet.innerHTML = microCss;
}, 500);


function lighten(c: string, quantity: number = 0.2): Color {
    return hsl(color(c)!)!.brighter(quantity).formatHex() as Color;
}


export function updateSvgPatterns(svgNode: SVGElement | null, layerState: MicroPalette): void {
    if (!svgNode) return;
    const patterns: PatternDefinition[] = Object.values(layerState).map((def) => {
        return {
            ...def.pattern,
            backgroundColor: def.fill
        }
    }).filter((pattern) =>
        pattern?.active === true && pattern.backgroundColor != null
    );

    /** Add lighter variations to patterns for hovering */
    for (const pattern of [...patterns]) {
        if (pattern.id?.includes('background')) continue;
        patterns.push({
            ...pattern,
            backgroundColor: lighten(pattern.backgroundColor!),
            id: `${pattern.id}-light`
        });
    }
    patternGenerator.addOrUpdatePatternsForSVG(svgNode.querySelector('defs') as unknown as SVGDefsElement, patterns);
}