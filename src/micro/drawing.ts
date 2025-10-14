import svgoConfig from '../svgoExport.config';
import { select, type Selection } from "d3-selection";
import { getRenderedFeatures, type RenderedFeature } from "../util/geometryStitch";
import { cloneDeep, debounce, kebabCase, last, random, set, size } from "lodash-es";
import { color, hsl } from "d3-color";
import { DOM_PARSER, findStyleSheet, fontsToCss, getUsedInlineFonts, updateStyleSheetOrGenerateCss } from "../util/dom";
import { HatchPatternGenerator } from "../svg/patternGenerator";
import { appendClip } from "../svg/svgDefs";
import { discriminateCssForExport, download } from "../util/common";
import { additionnalCssExport, changeIdAndReferences, exportFontChoices, getIntersectionObservingPart, inlineFontVsPath, rgb2hex, type ExportOptions } from "../svg/export";
import { createRoundedRectangleGeoJSON } from '../util/geometry';
import bboxPolygon from '@turf/bbox-polygon';
import booleanDisjoint from '@turf/boolean-disjoint';
import type { Feature, Geometry, Polygon } from 'geojson';
import type { MicroGeneralParams, MicroParams } from '../params';
import { MICRO_LAYERS, type Color, type MicroLayerId, type MicroPalette, type PatternDefinition, type ProvidedFont, type StateMicro, type SvgSelection } from '../types';
import type { Config } from 'svgo/browser';
import type { Map } from 'maplibre-gl';


type D3PathFunction = (geometry: Geometry) => string | null;


const patternGenerator = new HatchPatternGenerator();

export function orderFeaturesByLayer(features: RenderedFeature[]): void {
    features.sort((a, b) => {
        // @ts-expect-error
        const layerIdA = MICRO_LAYERS.indexOf(a.properties.mapLayerId!);
        // @ts-expect-error
        const layerIdB = MICRO_LAYERS.indexOf(b.properties.mapLayerId!);
        const renderHeightA = a.properties['render_height'];
        const renderHeightB = b.properties['render_height'];
        if (renderHeightA != null && renderHeightB != null) return renderHeightA < renderHeightB ? -1 : 1;
        if (layerIdA < layerIdB) return -1;
        return 1;
    });
}

// const pathStrokeWidth = scaleLinear([15, 22], [0.5, 4]).clamp(true);
// const roadPrimaryStrokeWidth = scaleLinear([14, 18], [5, 14]).clamp(true);
// const roadSecondaryStrokeWidth = scaleLinear([14, 18], [4, 12]).clamp(true);
// const roadTertiaryStrokeWidth = scaleLinear([14, 18], [3, 10]).clamp(true);
// const roadMinorStrokeWidth = scaleLinear([14, 18], [2, 6]).clamp(true);
// const scaleLowZoom = scaleLinear([4, 14], [0.5, 2.5]).clamp(true);

// export function getRoadStrokeWidth(roadFeature: GeometryFeature, maplibreMap: MaplibreMap): number | null {
//     if (roadFeature.properties.sourceLayer !== "transportation") return null;
//     const zoom = maplibreMap.getZoom();
//     if (zoom <= 14) return scaleLowZoom(zoom);
//     const computedId = roadFeature.properties.computedId;
//     if (computedId.includes('path')) return pathStrokeWidth(zoom);
//     if (computedId.includes('primary') || computedId.includes('motorway') || computedId.includes('trunk')) return roadPrimaryStrokeWidth(zoom);
//     if (computedId.includes('secondary')) return roadSecondaryStrokeWidth(zoom);
//     if (computedId.includes('tertiary')) return roadTertiaryStrokeWidth(zoom);
//     return roadMinorStrokeWidth(zoom);
// }

export async function drawPrettyMap(
    maplibreMap: Map,
    svg: SvgSelection,
    d3PathFunction: D3PathFunction,
    layerDefinitions: MicroPalette,
    generalParams: MicroParams,
    isLocked: boolean
): Promise<void> {
    console.log('layerDefinitions=', layerDefinitions);
    select("#map-container").style("width", null).style('height', null);
    const mapLibreContainer = select('#maplibre-map');
    const layersToQuery = MICRO_LAYERS.filter(layer => {
        return layerDefinitions[kebabCase(layer) as MicroLayerId]?.active !== false;
    });
    updateSvgPatterns(svg.node() as SVGElement, layerDefinitions);
    const width = generalParams.General.width;
    const height = generalParams.General.height;

    if (generalParams.General.useViewBox) {
        svg.attr("viewBox", `0 0 ${width} ${height}`);
    } else {
        svg.attr("width", `${width}`).attr("height", `${height}`);
    }
    const geometries = await getRenderedFeatures(maplibreMap, { layers: layersToQuery });
    console.log('geometries=', geometries)
    // Process got interrupted, a new call to this function is coming soon
    if (geometries === null) return;
    orderFeaturesByLayer(geometries);
    // console.log('geometries', geometries);

    const borderWidth = generalParams.Border.borderWidth;
    const borderPadding = generalParams.Border.borderPadding;
    const borderRadius = generalParams.Border.borderRadius;
    const borderColor = generalParams.Border.borderColor;
    resizeMaplibreMap(generalParams, maplibreMap);
    const translateAmount = borderPadding + (borderWidth / 2);

    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;
    const outerFrameRx = (borderRadius / 100) * Math.min(outerFrameWidth, outerFrameHeight);
    // Background layer
    svg.append('rect')
        .attr('id', 'micro-background')
        .attr('x', 0)
        .attr('y', 0)
        .attr('pathLength', 1)
        .attr('width', width)
        .attr('height', height)
        .attr('rx', outerFrameRx);

    svg.append('g')
        .attr('id', 'micro')
        .attr('transform', `translate(${translateAmount}, ${translateAmount})`)
        .attr("clip-path", "url(#clipMapBorder)")
        .selectAll('path')
        .data(geometries)
        .enter()
        .append("path")
        .attr('pathLength', 1)
        .attr("d", (d) => d3PathFunction(d.geometry))
        .attr("class", d => {
            const layerIdKebab = kebabCase(d.properties.mapLayerId) as MicroLayerId;
            const classes: string[] = [layerIdKebab];
            if (layerIdKebab.includes('path') || layerIdKebab.includes('road')) classes.push('line');
            else classes.push(d.geometry.type.includes("Line") ? 'line' : 'poly');
            const state = layerDefinitions[layerIdKebab];
            if (!state) classes.push('other');
            if (state?.fills) {
                classes.push(`${layerIdKebab}-${random(0, state.fills.length - 1)}`);
            }
            return classes.join(' ');
        })
        .attr("stroke-width", d => d.properties.paint!['line-width'] ?? null)
        .attr("id", d => d.properties.uuid!);

    drawMicroFrame(svg, width, height, borderWidth, borderRadius, borderPadding, borderColor, generalParams.General.animate, outerFrameRx);
    svg.style("pointer-events", isLocked ? "auto" : "none");
    svg.classed("animate-transition", true).classed("animate", generalParams.General.animate);
    mapLibreContainer.style('opacity', 0);
    // Post-clipping - can't get it to work with d3 postclip and custom stream
    setTimeout(() => postClip(generalParams), 100);
}

export function resizeMaplibreMap(generalParams: MicroParams, mapLibreMap: Map): void {
    const mapLibreContainer = select(mapLibreMap.getContainer());
    const width = generalParams.General.width;
    const height = generalParams.General.height;
    const borderWidth = generalParams.Border.borderWidth;
    const borderPadding = generalParams.Border.borderPadding;

    const finalWidth = Math.ceil(width - ((borderPadding + (borderWidth / 2)) * 2));
    const finalHeight = Math.ceil(height - ((borderPadding + (borderWidth / 2)) * 2));
    const finalPadding = borderPadding + (borderWidth / 2);

    const currentStyle = mapLibreContainer.node()?.style;
    let styleChanged = currentStyle?.width !== `${finalWidth}px`
        || currentStyle?.height !== `${finalHeight}px`
        || currentStyle?.padding !== `${finalPadding}px`
    mapLibreContainer
        .style('width', `${finalWidth}px`)
        .style('height', `${finalHeight}px`)
        .style('padding', `${finalPadding}px`);
    if (styleChanged) mapLibreMap.resize();
}

function postClip(generalParams: MicroParams): void {
    const roundedRect = roundedRectFromParams(generalParams);

    const height = generalParams.General.height;
    // select('#micro').append("path").attr('d', polyToPath(roundedRect.geometry.coordinates[0], height));
    const toRemove: Element[] = [];
    document.querySelectorAll('#static-svg-map g path').forEach(el => {
        const bbox = (el as SVGGraphicsElement).getBBox();
        const bboxRect: [number, number, number, number] = [
            bbox.x,
            height - bbox.y,
            bbox.x + bbox.width,
            height - bbox.y - bbox.height
        ];
        const bboxPoly = bboxPolygon(bboxRect);
        if (booleanDisjoint(roundedRect, bboxPoly)) {
            toRemove.push(el);
        }
    });
    // console.log('toRemove', toRemove);
    toRemove.forEach(el => el.remove());
}

function roundedRectFromParams(microParams: MicroParams): Feature<Polygon> {
    const width = microParams.General.width;
    const height = microParams.General.height;
    const borderPadding = microParams.Border.borderPadding;
    const borderRadius = microParams.Border.borderRadius;
    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;
    const outerFrameRx = (borderRadius / 100) * Math.min(outerFrameWidth, outerFrameHeight);
    const innerFrameWidth = outerFrameWidth - borderPadding;
    const innerFrameHeight = outerFrameHeight - borderPadding;
    const innerFrameRadius = outerFrameRx - borderPadding;

    // innerFrameWidth, innerFrameHeight, innerFrameRx, -borderWidth / 2, -borderWidth / 2
    // const innerFrameRadius = (borderRadius / 100) * (Math.min(innerFrameWidth, innerFrameHeight) - (borderPadding));
    return createRoundedRectangleGeoJSON(
        innerFrameWidth,
        innerFrameHeight,
        innerFrameRadius,
        (innerFrameWidth / 2),
        (innerFrameHeight / 2) + borderPadding * 2
    );
}

function polyToPath(coords: number[][], height: number): string {
    let d = '';
    for (let i = 0; i < coords.length; i++) {
        const p = coords[i];
        if (i === 0) d += `M${p[0]},${height - p[1]}`;
        else d += `L${p[0]},${height - p[1]}`;
    }
    return d;
}

export function drawMicroFrame(
    svg: SvgSelection,
    width: number,
    height: number,
    borderWidth: number,
    borderRadius: number,
    borderPadding: number,
    borderColor: string,
    animated: boolean,
    outerFrameRx: number
): Selection<SVGRectElement, any, SVGSVGElement, any> {
    // Calculate positions and dimensions
    // For the outer frame (border padding)
    const outerFrameHalfWidth = borderPadding / 2;
    const outerFrameX = outerFrameHalfWidth;
    const outerFrameY = outerFrameHalfWidth;
    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;

    // For the inner frame (border width)
    const innerFrameX = outerFrameX + outerFrameHalfWidth;
    const innerFrameY = outerFrameY + outerFrameHalfWidth;
    const innerFrameWidth = outerFrameWidth - borderPadding;
    const innerFrameHeight = outerFrameHeight - borderPadding;
    const innerFrameRx = outerFrameRx - borderPadding;

    // Draw the inner frame (border width)
    const frame = svg.append('rect')
        .attr('x', innerFrameX)
        .attr('y', innerFrameY)
        .attr('pathLength', 1)
        .attr('id', 'frame')
        .attr('width', innerFrameWidth)
        .attr('height', innerFrameHeight)
        .attr('rx', innerFrameRx)
        .attr('fill', 'none')
        .attr('stroke', borderColor)
        .attr('stroke-width', borderWidth);

    appendClip(svg, innerFrameWidth, innerFrameHeight, innerFrameRx, -borderWidth / 2, -borderWidth / 2);

    if (animated) {
        frame.on("animationend", (e) => {
            setTimeout(() => {
                svg.classed('animate', false);
                svg.selectAll('path[pathLength]').attr('pathLength', null);
                setTimeout(() => {
                    svg.selectAll('g[image-class]').classed('hidden-after', true);
                    svg.classed('animate-transition', false);
                }, 1500);
            }, 200);
        });
    }
    return frame;
}

export function initLayersState(providedPalette: Partial<MicroPalette>): MicroPalette {
    const palette = cloneDeep(providedPalette) as Partial<MicroPalette>;
    // if (!palette['forest']) palette['forest'] = { ...palette['wood'], active: false };
    // if (!palette['roads_other']) palette['roads_other'] = { ...palette['roads_minor'], active: false };
    if (!palette['railways']) palette['railways'] = { ...palette['roads'], active: false };
    if (!palette['paths']) palette['paths'] = { ...palette['roads'], active: false };

    Object.entries(palette).forEach(([layer, state]) => {
        if (layer === "borderParams") return;
        if (state.menuOpened == null) state.menuOpened = false;
        let pattern = state.pattern;
        if (!pattern && state.fill) {
            state.pattern = pattern = { hatch: '.', active: false };
        } else if (pattern) {
            pattern.active = true;
        }
        if (!pattern) return;
        if (pattern.menuOpened == null) pattern.menuOpened = pattern.active;
        if (!pattern.id) pattern.id = `pattern-${layer}`;
        if (!pattern.color) pattern.color = darken(state.fill!);
        if (!pattern.strokeWidth) pattern.strokeWidth = 3;
        if (!pattern.scale) pattern.scale = 1.3;
    });

    // if (!palette['building1']) {
    //     const strokeRef = palette['building0'].stroke;
    //     const fillRef = hsl(color(palette['building0'].fill));
    //     console.log(fillRef);
    //     const lighter1 = fillRef.brighter(0.2).formatHex();
    //     const lighter2 = fillRef.brighter(0.4).formatHex();
    //     palette['building1'] = { stroke: strokeRef, fill: lighter1 };
    //     palette['building2'] = { stroke: strokeRef, fill: lighter2 };
    // }
    return palette as MicroPalette;
}

function lighten(c: string, quantity: number = 0.2): Color {
    return hsl(color(c)!)!.brighter(quantity).formatHex() as Color;
}

function darken(c: string, quantity: number = 0.4): Color {
    return hsl(color(c)!)!.darker(quantity).formatHex() as Color;
}

export function generateCssFromState(state: MicroPalette): string | null {
    const [sheet, _] = findStyleSheet("#micro .line");
    // "other" default color definitions will be overridden by mode specific '>' selector
    let css = `
    #micro .line { 
        fill: none; 
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    #micro .poly { 
        stroke-linejoin: round;
    }
    #paths > path {
        stroke: ${state['roads'] ? state['roads'].stroke : '#6D4C41'};
        fill: none;
        stroke-width: 2px;
    }
    `;

    for (const [layer, layerDef] of Object.entries(state)) {
        if (layer === "borderParams") continue;
        let ruleContent: Record<string, string | number> = {};
        let ruleHoverContent: Record<string, string | number> = {};

        if (layerDef.stroke) {
            ruleContent['stroke'] = layerDef.stroke;
            if (!layer.includes('road') && !layer.includes('path') && !layer.includes('rail')) {
                ruleContent['stroke-width'] = layerDef['stroke-width'] ?? '1px';
            }
            if (layer.includes('path') && !layerDef['stroke-dasharray']) {
                ruleContent['stroke-dasharray'] = 5;
            }
            const dashArray = layerDef['stroke-dasharray'];
            if (dashArray) ruleContent['stroke-dasharray'] = dashArray;
            const lighter = lighten(layerDef.stroke);
            ruleHoverContent['stroke'] = lighter;
        }

        if (layerDef.pattern?.active) {
            ruleContent['fill'] = `url(#${layerDef.pattern.id})`;
            ruleHoverContent['fill'] = `url(#${layerDef.pattern.id}-light)`;
        }
        else if (layerDef.fill) {
            ruleContent['fill'] = layerDef.fill;
            const lighter = lighten(layerDef.fill);
            ruleHoverContent['fill'] = lighter;
        }

        if (size(ruleContent) > 0) {
            if (layer === "background") {
                css += updateStyleSheetOrGenerateCss(sheet, '#micro-background', ruleContent);
            } else {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}`, ruleContent);
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}:hover`, ruleHoverContent);
            }
        }

        if (layerDef.fills) {
            layerDef.fills.forEach((fill, i) => {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}-${i}`, { 'fill': fill });
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}-${i}:hover`, { 'fill': lighten(fill) });
            });
        }
    }

    if (sheet) return null;
    return css;
}

// Returns true if we should redraw (layer deactivated for instance)
export function onMicroParamChange(
    layer: MicroLayerId,
    prop: string | string[],
    value: unknown,
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
        rule.style.setProperty("fill", value as string);
    } else {
        if (layerState[layer].pattern?.active) {
            updateSvgPatterns(document.getElementById('static-svg-map') as unknown as SVGSVGElement, layerState);
        } else {
            rule.style.setProperty(prop as string, value as string);
        }
    }
    replaceCssSheetContent(layerState);
    return false;
}


export const replaceCssSheetContent = debounce((layerState: MicroPalette) => {
    const styleSheet = document.getElementById('common-style-sheet-elem-micro') as HTMLStyleElement;
    const microCss = generateCssFromState(layerState);
    if (microCss) styleSheet.innerHTML = microCss;
}, 500);

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


export async function exportMicro(
    svg: SvgSelection,
    stateMicro: StateMicro,
    providedFonts: ProvidedFont[],
    commonCss: string,
    { exportFonts = exportFontChoices.convertToPath }: ExportOptions = {}
): Promise<void> {
    const width = stateMicro.microParams.General.width;
    const height = stateMicro.microParams.General.height;
    const borderPadding = stateMicro.microParams.Border.borderPadding;
    const svgNode = svg.node()! as SVGSVGElement;
    svgNode.removeAttribute('style');
    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));
    const SVGO = await import('svgo/browser');

    const defs = svgNode.querySelector('defs')!.cloneNode(true);
    svgNode.querySelectorAll('#micro path').forEach(el => el.removeAttribute('id'));

    // Optimize whole SVG
    const finalSvg = SVGO.optimize(svgNode.outerHTML, svgoConfig as Config).data;
    const optimizedSVG = DOM_PARSER.parseFromString(finalSvg, 'image/svg+xml');
    let pathIsBetter = false;

    if (exportFonts == exportFontChoices.smallest || exportFonts == exportFontChoices.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild as SVGElement, providedFonts, exportFonts);
    }
    else if (exportFonts == exportFontChoices.noExport) {
        pathIsBetter = true;
    }

    const js = stateMicro.microParams.General.animate ? getIntersectionObservingPart(false) : null;

    // Styling
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const { mapId, finalCss } = discriminateCssForExport(renderedCss);

    const svgElement = optimizedSVG.firstChild as SVGElement;
    svgElement.setAttribute('id', mapId);
    svgElement.querySelector('defs')!.remove();
    svgElement.append(defs);
    changeIdAndReferences(svgElement, mapId);

    styleElem.innerHTML = pathIsBetter ? finalCss : finalCss + fontsToCss(usedProvidedFonts);
    svgElement.append(styleElem);
    svgElement.classList.remove('animate-transition');
    svgElement.classList.add('cartosvg');

    if (js) {
        const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
        const scriptContent = document.createTextNode(js);
        scriptElem.appendChild(scriptContent);
        svgElement.append(scriptElem);
    }

    /** Add attribution */
    // const roundedRectPoints = explode(roundedRectFromParams(generalParams));
    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const attributionColor = stateMicro.microLayerDefinitions["roads"]["stroke"] ?? "#aaa";
    const createAnchor = (text: string, href: string, x: number, y: number) => {
        // const nearest = nearestPoint([x, height - y], roundedRectPoints);
        // const attrPos = nearest.geometry.coordinates;
        // attrPos[1] = height - attrPos[1];

        const a = document.createElementNS('http://www.w3.org/2000/svg', 'a');
        a.setAttribute('xlink:href', href);
        a.setAttribute('target', '_blank');
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute("x", x.toString());
        t.setAttribute("y", y.toString());
        t.setAttribute("text-anchor", "end");
        t.setAttribute("fill", attributionColor);
        t.setAttribute("font-size", "8");
        t.setAttribute("style", "font-family: 'trebuchet ms',sans-serif;");
        // t.setAttribute("style", "mix-blend-mode: difference; font-family: 'trebuchet ms',sans-serif;");
        t.textContent = text;
        a.append(t);
        svgElement.append(a);
    };

    // const xOffset = borderPadding + borderRadius;
    // createAnchor('data © OpenStreetMap', 'https://www.openstreetmap.org/copyright', width - borderPadding - 10, height - borderPadding - 20);
    // createAnchor('CartoSVG', 'https://cartosvg.com', width - borderPadding - 10, height - borderPadding - 10);
    createAnchor('data © OpenStreetMap', 'https://www.openstreetmap.org/copyright', width - borderPadding * 2, height - borderPadding - 16);
    createAnchor('CartoSVG', 'https://cartosvg.com', width - borderPadding * 2, height - borderPadding - 8);

    download(svgElement.outerHTML, 'text/plain', 'cartosvg-export.svg');
}