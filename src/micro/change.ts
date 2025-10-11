import { color, hsl } from "d3";
import { debounce, last, set } from "lodash-es";
import { generateCssFromState } from "src/micro/drawing";
import { HatchPatternGenerator } from "src/svg/patternGenerator";
import type { Color, MicroLayerId, MicroPalette, PatternDefinition } from "src/types";
import { findStyleSheet } from "src/util/dom";

const patternGenerator = new HatchPatternGenerator();
const CSS_PROPS = ['stroke', 'stroke-width', 'fill', 'stroke-dasharray', 'stroke-linejoin', 'stroke-linecap'];

// Returns true if we should redraw (layer deactivated for instance)
export function onMicroParamChange(
    layer: MicroLayerId,
    prop: string | string[],
    value: any,
    layerState: MicroPalette
): boolean {
    if (prop.includes("pattern")) {
        updateSvgPatterns(document.getElementById('static-svg-map') as unknown as SVGSVGElement, layerState);
        replaceCssSheetContent(layerState);
        return false;
    }
    if (prop.includes("active")) {
        return true;
    }

    let ruleTxt = `#micro .${layer}`;
    if (layer === "background") ruleTxt = "#micro-background";
    // Change "building-0" for instance
    if (Array.isArray(prop) && prop[0] === "fills") ruleTxt = `#micro .${layer}-${last(prop)}`;

    const [sheet, rule] = findStyleSheet(ruleTxt);
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

// Called when CSS is updated with inline style editor. Returns true if we actually updated layer definition
export function syncLayerStateWithCss(
    eventType: any,
    cssProp: string,
    value: string | null,
    layerState: MicroPalette
): boolean {
    console.log(eventType, cssProp, value, layerState);
    // Prevent removing value
    if (value === null) return false;
    if (eventType === "inline") return false;

    const cssSelector = eventType.selectorText;
    if (!cssSelector.includes('#micro')) return false;

    const layer = cssSelector.match(/#micro \.(.*)/)?.[1] ?? 'background';
    let path: (string | number)[] = [layer, cssProp];
    let isFills = false;

    if (layer.includes('-') && cssProp === "fill") {
        isFills = true;
        const parts = layer.split('-');
        path = [parts[0], 'fills', parseInt(parts[1])];
    }

    if (!isFills && !CSS_PROPS.includes(last(path) as string)) return false;
    set(layerState, path, value);
    if (cssProp === "fill") {
        updateSvgPatterns(document.getElementById('static-svg-map') as unknown as SVGSVGElement, layerState);
    }
    replaceCssSheetContent(layerState);
    return true;
}

export const replaceCssSheetContent = debounce((layerState: MicroPalette) => {
    const styleSheet = document.getElementById('common-style-sheet-elem-micro') as HTMLStyleElement;
    const microCss = generateCssFromState(layerState);
    if (microCss) styleSheet.innerHTML = microCss;
}, 500);


function lighten(c: string, quantity: number = 0.2): Color {
    return hsl(color(c)!)!.brighter(quantity).formatHex() as Color;
}

function darken(c: string, quantity: number = 0.4): Color {
    return hsl(color(c)!)!.darker(quantity).formatHex() as Color;
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