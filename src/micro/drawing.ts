import svgoConfig from '../svgoExport.config';
import { select, type Selection } from "d3-selection";
import { bboxContains, bboxIntersects, getRenderedFeatures, type RenderedFeature, type RenderedFeaturePoly } from "../util/geometryStitch";
import { cloneDeep, kebabCase, random, size } from "lodash-es";
import { color, hsl } from "d3-color";
import { DOM_PARSER, findStyleSheet, fontsToCss, fontsToCssEmbed, getUsedInlineFonts, updateStyleSheetOrGenerateCss } from "../util/dom";
import { patternGenerator } from "../svg/patternGenerator";
import { appendClip } from "../svg/svgDefs";
import { discriminateCssForExport, download, randomString, xhtmlifyHtml } from "../util/common";
import { addAttribution, addFrameShadow, additionnalCssExport, changeIdAndReferences, exportFontChoices, inlineFontVsPath, rgb2hex, type ExportOptions } from "../svg/export";
import intersectionObserverScript from 'src/svg/exportScripts/intersectionObserver.js?raw';
import elementAnnotationsScript from 'src/svg/exportScripts/elementAnnotations.js?raw';
import { createRoundedRectangleGeoJSON } from '../util/geometry';
import bboxPolygon from '@turf/bbox-polygon';
import booleanDisjoint from '@turf/boolean-disjoint';
import difference from '@turf/difference';
import { featureCollection } from '@turf/helpers';
import type { Feature, Geometry, Polygon } from 'geojson';
import type { MicroParams } from '../params';
import { MICRO_LAYERS, type Color, type ElementAnnotations, type MicroLayerId, type MicroPalette, type PatternDefinition, type ProvidedFont, type StateMicro, type SvgSelection } from '../types';
import type { Config } from 'svgo/browser';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { postClipSimple } from 'src/svg/svg';
import bbox from '@turf/bbox';
import { renderBuildingsToSvgImproved } from './3d';
import area from '@turf/area';
import center from '@turf/center';
import { transitionCssMicro } from 'src/svg/transition';
import { removeNotRenderedElements } from './remove-not-rendered-canvas';


// Interfaces for building grouping
export interface GroupedFeature extends RenderedFeaturePoly {
    parts: RenderedFeaturePoly[];
}

export interface GroupBuildingResult {
    normalFeatures: RenderedFeaturePoly[];
    groupedFeatures: GroupedFeature[];
}

// Helper function for centroid distance calculation
function centroidDistance(c1: [number, number], c2: [number, number]): number {
    return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2));
}

type D3PathFunction = (geometry: Geometry) => string | null;


export function orderFeaturesByLayer(features: RenderedFeature[]): void {
    features.sort((a, b) => {
        // @ts-expect-error
        const layerIdA = MICRO_LAYERS.indexOf(a.properties.mapLayerId!);
        // @ts-expect-error
        const layerIdB = MICRO_LAYERS.indexOf(b.properties.mapLayerId!);
        if (layerIdA < layerIdB) return -1;
        return 1;
    });
}
const BACKGROUND_LAYERS = ['landuse_pedestrian', 'landuse_pier'];

export async function drawPrettyMap(
    maplibreMap: MapLibreMap,
    svg: SvgSelection,
    d3PathFunction: D3PathFunction,
    layerDefinitions: MicroPalette,
    generalParams: MicroParams,
): Promise<void> {
    console.log('layerDefinitions=', layerDefinitions);
    select("#map-container").style("width", null).style('height', null);
    const mapLibreContainer = select('#maplibre-map');
    const layersToQuery = [
        ...MICRO_LAYERS.filter(layer => {
            return layerDefinitions[kebabCase(layer) as MicroLayerId]?.active !== false;
        }),
        ...BACKGROUND_LAYERS,
    ];
    updateSvgPatterns(svg.node() as SVGElement, layerDefinitions);
    const width = generalParams.General.width;
    const height = generalParams.General.height;

    svg.attr("width", `${width}`).attr("height", `${height}`);
    const use3d = layerDefinitions.buildings['3dBuildings'];
    const geometries = (await getRenderedFeatures(maplibreMap, { layers: layersToQuery }, use3d!))
        ?.filter(geom => {
            if (geom.properties['kind_detail'] === 'corridor') return false;
            const layer = geom.properties['layer'];
            /** Remove below ground buildings */
            if (layer != null && layer < 0) return false;
            return true;
        });
    // console.log('geometries=', geometries)
    // Process got interrupted, a new call to this function is coming soon
    if (geometries == null) return;
    const geometries2d = geometries.filter(geom =>
        geom.properties.mapLayerId !== "buildings" || !layerDefinitions.buildings['3dBuildings']
    ) as RenderedFeaturePoly[];
    orderFeaturesByLayer(geometries2d);

    // Separate water-cutout layers (punch holes in water instead of rendering on top)
    const cutoutFeatures = geometries2d.filter(g => BACKGROUND_LAYERS.includes(g.properties.mapLayerId!));
    const mainFeatures = geometries2d.filter(g => !BACKGROUND_LAYERS.includes(g.properties.mapLayerId!));

    // Subtract cutout geometries from water polygons
    if (cutoutFeatures.length > 0) {
        // Pre-compute bboxes for cutout features (cheap, avoids recomputing per water polygon)
        const cutoutBboxes = cutoutFeatures.map(c => bbox(c));

        for (let i = mainFeatures.length - 1; i >= 0; i--) {
            const f = mainFeatures[i];
            if (f.properties.mapLayerId !== 'water') continue;
            let waterBbox = bbox(f);

            for (let j = 0; j < cutoutFeatures.length; j++) {
                // Skip if bboxes don't intersect — no overlap possible
                if (!bboxIntersects(waterBbox, cutoutBboxes[j])) continue;
                // Skip if geometries are disjoint (bboxes overlap but polygons don't)
                if (booleanDisjoint(f as Feature<Polygon>, cutoutFeatures[j] as Feature<Polygon>)) continue;

                const diff = difference(featureCollection([f as Feature<Polygon>, cutoutFeatures[j] as Feature<Polygon>]));
                if (diff == null) {
                    mainFeatures.splice(i, 1);
                    break;
                }
                (f as Feature).geometry = diff.geometry;
                waterBbox = bbox(f); // Recompute after geometry changed
            }
        }
    }

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
        .attr('width', width)
        .attr('height', height)
        .attr('rx', outerFrameRx);

    svg.append('g')
        .attr('id', 'micro')
        .attr("clip-path", "url(#clipMapBorder)")
        .selectAll('path')
        .data(mainFeatures)
        .enter()
        .append("path")
        .attr("d", (d) => d3PathFunction(d.geometry))
        .attr("class", d => {
            const layerIdKebab = kebabCase(d.properties.mapLayerId) as MicroLayerId;
            const classes: string[] = [layerIdKebab];
            if (layerIdKebab.includes('path') || layerIdKebab.includes('road')) classes.push('line');
            else classes.push(d.geometry.type.includes("Line") ? 'line' : 'poly');
            const state = layerDefinitions[layerIdKebab];
            if (!state) classes.push('background');
            if (state?.fills) {
                classes.push(`${layerIdKebab}-${random(0, state.fills.length - 1)}`);
            }
            d.properties.class = classes.join(' ');
            return classes.join(' ');
        })
        .attr("stroke-width", d => d.properties.paint!['line-width'] ?? null)
        .attr("id", d => d.properties.uuid!);

    const buildings = geometries.filter(geom => geom.properties.mapLayerId === "buildings") as RenderedFeaturePoly[];
    // console.log('buildings features=', featureCollection(buildings));
    if (layerDefinitions.buildings['3dBuildings']) {

        const { normalFeatures, groupedFeatures } = groupBuildingFeatures(buildings);
        console.log('normalFeatures=', normalFeatures);
        console.log('groupedFeatures=', groupedFeatures);
        renderBuildingsToSvgImproved(
            [...normalFeatures, ...groupedFeatures],
            maplibreMap,
            svg,
            translateAmount,
            layerDefinitions['buildings'],
            false
        );
    }
    // Remove building paths hidden behind others
    const svgNode = svg.node() as SVGSVGElement;
    const buildingsGroup = svgNode.querySelector('#buildings');
    const buildingPaths = buildingsGroup
        ? [...buildingsGroup.querySelectorAll<SVGPathElement>('path')]
        : [...svgNode.querySelectorAll<SVGPathElement>('.buildings')];

    drawMicroFrame(svg, width, height, borderWidth, borderRadius, borderPadding, borderColor, false, outerFrameRx);
    mapLibreContainer.style('opacity', 0);
    setTimeout(() => {
        postClip(generalParams);
        if (buildingPaths.length > 0) removeNotRenderedElements(buildingPaths);
    }, 100);
}

export function resizeMaplibreMap(generalParams: MicroParams, mapLibreMap: MapLibreMap): void {
    const mapLibreContainer = select(mapLibreMap.getContainer());
    const width = generalParams.General.width;
    const height = generalParams.General.height;
    const borderWidth = generalParams.Border.borderWidth;
    const borderPadding = generalParams.Border.borderPadding;

    const finalWidth = Math.ceil(width - ((borderPadding + (borderWidth / 2)) * 2));
    const finalHeight = Math.ceil(height - ((borderPadding + (borderWidth / 2)) * 2));
    const finalPadding = borderPadding + (borderWidth / 2);

    const currentStyle = mapLibreContainer.node()?.style;
    // Compare paddingTop (longhand) instead of padding (shorthand) — browsers decompose
    // shorthand padding into longhand properties, so style.padding returns "" even after
    // being set, causing resize() to fire every time and creating an infinite loop.
    const styleChanged = currentStyle?.width !== `${finalWidth}px`
        || currentStyle?.height !== `${finalHeight}px`
        || currentStyle?.paddingTop !== `${finalPadding}px`;
    mapLibreContainer
        .style('width', `${finalWidth}px`)
        .style('height', `${finalHeight}px`)
        .style('padding', `${finalPadding}px`);
    if (styleChanged) {
        mapLibreMap.resize();
    } else {
        // Even if inline styles haven't changed (e.g. after switching macro→micro),
        // the canvas may be stale. Compare the canvas CSS size against the expected size.
        const canvas = mapLibreMap.getCanvas();
        const canvasRect = canvas.getBoundingClientRect();
        if (Math.round(canvasRect.width) !== finalWidth || Math.round(canvasRect.height) !== finalHeight) {
            mapLibreMap.resize();
        }
    }
}

function postClip(generalParams: MicroParams): void {
    const roundedRect = roundedRectFromParams(generalParams);

    const height = generalParams.General.height;
    // select('#micro').append("path").attr('d', polyToPath(roundedRect.geometry.coordinates[0], height));
    postClipSimple();
    const toRemove: Element[] = [];
    document.querySelectorAll('#micro path').forEach(el => {
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
    console.log('toRemove', toRemove);
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
    const innerFrameRadius = Math.max(0, outerFrameRx - borderPadding);

    return createRoundedRectangleGeoJSON(
        innerFrameWidth,
        innerFrameHeight,
        innerFrameRadius,
        (innerFrameWidth / 2) + borderPadding,
        (innerFrameHeight / 2) + borderPadding
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
        .attr('id', 'frame')
        .attr('width', innerFrameWidth)
        .attr('height', innerFrameHeight)
        .attr('rx', innerFrameRx)
        .attr('fill', 'none')
        .attr('stroke', borderColor)
        .attr('stroke-width', borderWidth);

    if (animated) frame.attr('pathLength', 1)
    appendClip(svg, innerFrameWidth, innerFrameHeight, innerFrameRx, innerFrameX, innerFrameY);

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

/**
 * Groups building features by separating parts (kind === "building_part") from non-parts,
 * then assigning each part to its containing non-part building.
 */
export function groupBuildingFeatures(features: RenderedFeaturePoly[]): GroupBuildingResult {

    console.time('grouping buildings');
    // Step 1: Separate features into parts and non-parts
    const parts: RenderedFeaturePoly[] = [];
    const nonParts: GroupedFeature[] = [];

    for (const feature of features) {
        if (feature.properties.kind_detail === "yes" || (feature.properties.kind_detail !== "no" && feature.properties.kind === "building_part")) {
            parts.push(feature);
        } else {
            // Initialize parts array on each non-part
            nonParts.push({
                ...feature,
                parts: []
            });
        }
    }

    // If no parts, return all as normal features
    if (parts.length === 0) {
        return {
            normalFeatures: nonParts,
            groupedFeatures: []
        };
    }

    // Step 2: Pre-compute geometry data for all features
    interface FeatureData {
        feature: RenderedFeaturePoly | GroupedFeature;
        bbox: [number, number, number, number];
        area: number;
        center: [number, number];
    }

    const partData: FeatureData[] = parts.map(f => ({
        feature: f,
        bbox: bbox(f) as [number, number, number, number],
        area: area(f),
        center: center(f).geometry.coordinates as [number, number]
    }));

    const nonPartData: FeatureData[] = nonParts.map(f => ({
        feature: f,
        bbox: bbox(f) as [number, number, number, number],
        area: area(f),
        center: center(f).geometry.coordinates as [number, number]
    }));

    // Step 3: Pre-filter candidates - for each part, find non-parts whose bbox fully contains it
    const partCandidates: Map<number, number[]> = new Map();
    for (let pIdx = 0; pIdx < partData.length; pIdx++) {
        const partBbox = partData[pIdx].bbox;
        const candidates: number[] = [];
        for (let npIdx = 0; npIdx < nonPartData.length; npIdx++) {
            if (bboxContains(nonPartData[npIdx].bbox, partBbox)) {
                candidates.push(npIdx);
            }
        }
        partCandidates.set(pIdx, candidates);
    }

    // Track orphan parts
    const orphanParts: { partIdx: number; data: FeatureData }[] = [];

    // Step 4: For each part, find which non-part it belongs to (using pre-filtered candidates)
    for (let pIdx = 0; pIdx < partData.length; pIdx++) {
        const pData = partData[pIdx];
        const part = pData.feature as RenderedFeaturePoly;
        const partBbox = pData.bbox;

        let bestMatch: GroupedFeature | null = null;
        let bestOverlap = 0;

        // Only iterate through pre-filtered candidates
        const candidates = partCandidates.get(pIdx) || [];
        if (candidates.length === 1) {
            bestMatch = nonPartData[candidates[0]].feature as GroupedFeature;
        }
        else {
            for (const npIdx of candidates) {
                const npData = nonPartData[npIdx];
                const nonPart = npData.feature as GroupedFeature;
                const nonPartBbox = npData.bbox;

                // Calculate bbox overlap percentage (cheap operation)
                const [pMinX, pMinY, pMaxX, pMaxY] = partBbox;
                const [npMinX, npMinY, npMaxX, npMaxY] = nonPartBbox;

                const intersectMinX = Math.max(pMinX, npMinX);
                const intersectMinY = Math.max(pMinY, npMinY);
                const intersectMaxX = Math.min(pMaxX, npMaxX);
                const intersectMaxY = Math.min(pMaxY, npMaxY);

                const bboxIntersectArea = (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
                const partBboxArea = (pMaxX - pMinX) * (pMaxY - pMinY);
                const bboxOverlapPercentage = bboxIntersectArea / partBboxArea;

                // Skip if bbox overlap is less than 70% - actual geometry overlap unlikely to be > 80%
                if (bboxOverlapPercentage < 0.7) continue;

                // Calculate geometry intersection
                // const intersection = intersect(featureCollection([part, nonPart]));
                // if (!intersection) continue;

                // // Calculate overlap percentage
                // const overlapArea = area(intersection);
                // const overlapPercentage = overlapArea / partArea;

                // If >80% overlap, consider it a match
                if (bboxOverlapPercentage > 0.8 && bboxOverlapPercentage > bestOverlap) {
                    bestMatch = nonPart;
                    bestOverlap = bboxOverlapPercentage;
                }
            }
        }
        if (bestMatch) {
            bestMatch.parts.push(part);
        } else {
            // Mark as orphan
            orphanParts.push({ partIdx: pIdx, data: pData });
        }
    }
    // Step 5: Assign orphan parts to the closest non-part by centroid distance
    for (const orphan of orphanParts) {
        const orphanCenter = orphan.data.center;
        let closestNonPart: GroupedFeature | null = null;
        let closestDistance = Infinity;

        for (const npData of nonPartData) {
            const dist = centroidDistance(orphanCenter, npData.center);
            if (dist < closestDistance) {
                closestDistance = dist;
                closestNonPart = npData.feature as GroupedFeature;
            }
        }

        if (closestNonPart) {
            closestNonPart.parts.push(orphan.data.feature as RenderedFeaturePoly);
        }
    }

    // Step 6: Return normal features (empty parts) and grouped features (non-empty parts)
    const normalFeatures: RenderedFeaturePoly[] = [];
    const groupedFeatures: GroupedFeature[] = [];

    for (const nonPart of nonParts) {
        if (nonPart.parts.length === 0) {
            normalFeatures.push(nonPart);
        } else {
            groupedFeatures.push(nonPart);
        }
    }
    console.timeEnd('grouping buildings');
    console.time('determining heights');
    computeBaseHeights(groupedFeatures);
    console.timeEnd('determining heights');
    return { normalFeatures, groupedFeatures };
}

/**
 * Computes base heights for parts within grouped features.
 * For each part, finds the tallest container (another part that fully contains it
 * but has a lower height), and sets the part's base_height to that container's height.
 */
export function computeBaseHeights(groupedFeatures: GroupedFeature[]): void {
    for (const groupedFeature of groupedFeatures) {
        const parts = groupedFeature.parts;

        const partBboxes = parts.map(p => bbox(p));

        for (let i = 0; i < parts.length; i++) {
            const currentPart = parts[i];

            // Skip if the part already has min_height property defined
            if (currentPart.properties.min_height !== undefined) continue;

            const currentHeight = currentPart.properties.height ?? 0;
            const currentBbox = partBboxes[i];
            // const currentArea = area(currentPart);

            let tallestContainerHeight = -1;

            // Look through ALL other parts in the same group
            for (let j = 0; j < parts.length; j++) {
                if (i === j) continue;

                const otherPart = parts[j];
                const otherHeight = otherPart.properties.height ?? 0;

                // Container's height must be LOWER than current part's height
                if (otherHeight >= currentHeight) continue;

                // Skip if this container is not taller than our current best
                if (otherHeight <= tallestContainerHeight) continue;

                const otherBbox = partBboxes[j];

                // Bbox containment check before expensive intersection
                // Check if current bbox is potentially contained in other bbox
                if (!bboxIntersects(currentBbox, otherBbox)) continue;

                // Quick check: other bbox should be able to contain current bbox
                const [cMinX, cMinY, cMaxX, cMaxY] = currentBbox;
                const [oMinX, oMinY, oMaxX, oMaxY] = otherBbox;

                // For containment, other should be larger or equal in all dimensions
                // We use a tolerance here since we're checking >95% containment
                const intersectMinX = Math.max(cMinX, oMinX);
                const intersectMinY = Math.max(cMinY, oMinY);
                const intersectMaxX = Math.min(cMaxX, oMaxX);
                const intersectMaxY = Math.min(cMaxY, oMaxY);

                if (intersectMaxX <= intersectMinX || intersectMaxY <= intersectMinY) continue;

                const bboxIntersectArea = (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
                const currentBboxArea = (cMaxX - cMinX) * (cMaxY - cMinY);
                const bboxContainmentPercentage = bboxIntersectArea / currentBboxArea;

                // Skip if bbox containment is less than 90% (actual containment unlikely to be >95%)
                if (bboxContainmentPercentage < 0.9) continue;

                // Check full containment using intersect (>95% overlap)
                // const intersection = intersect(featureCollection([currentPart, otherPart]));
                // if (!intersection) continue;

                // const overlapArea = area(intersection);
                // const containmentPercentage = overlapArea / currentArea;

                // Container must fully contain the current part (>95% overlap)
                // if (bboxContainmentPercentage > 0.95) {
                tallestContainerHeight = otherHeight;
                // }
            }

            // Set base_height to the container's height (if found)
            if (tallestContainerHeight > -1) {
                currentPart.properties.base_height = tallestContainerHeight;
            }
        }

        // Compute shouldRender for the root element
        const rootHeight = groupedFeature.properties.height;
        if (rootHeight == null || parts.length < 5) {
            groupedFeature.properties.shouldRender = true;
        } else {
            const meanPartHeight = parts.reduce((sum, p) => sum + (p.properties.height ?? rootHeight), 0) / parts.length;
            groupedFeature.properties.shouldRender = rootHeight < 30 || rootHeight < meanPartHeight;
        }
    }
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
    console.log('generateCssFromState');
    const [sheet, _] = findStyleSheet("#micro .line");
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
        stroke: ${state['roads']?.stroke ?? '#6D4C41'};
        fill: none;
        stroke-width: 2px;
    }
    #freehand-drawings .freehand {
        paint-order: stroke;
        fill: ${state['roads']?.stroke ?? '#6D4C41'};
    }

    #freehand-drawings g path {
        fill: inherit;
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
                css += updateStyleSheetOrGenerateCss(sheet, '#micro .background', ruleContent);
            } else {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}`, ruleContent);
                // css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}:hover`, ruleHoverContent);
            }
        }

        if (layerDef.fills) {
            layerDef.fills.forEach((fill, i) => {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}-${i}`, { 'fill': fill });
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}-${i}:hover`, { 'fill': lighten(fill) });
            });
            if (layerDef['3dBuildings']) {
                css += updateStyleSheetOrGenerateCss(sheet, `#buildings`, { 'stroke': layerDef.stroke! });
                layerDef.fills.forEach((fill, i) => {
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i}`, {
                        '--building-color': fill,
                        'fill': 'var(--building-color)'
                    });
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i} .roof`, {
                        'fill': 'color-mix(in srgb, var(--building-color), white 20%);'
                    });
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i}:hover .roof`, {
                        'fill': 'color-mix(in srgb, var(--building-color), white 40%);'
                    });
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i}:hover .wall`, {
                        'fill': 'color-mix(in srgb, var(--building-color), white 20%);'
                    });
                });
            }
        }
    }

    if (sheet) return null;
    return css;
}

function updateSvgPatterns(svgNode: SVGElement | null, layerState: MicroPalette): void {
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
    options: ExportOptions = {},
    downloadExport: boolean = true,
    elementAnnotations?: ElementAnnotations,
): Promise<string | void> {
    const {
        exportFonts = exportFontChoices.convertToPath,
        animate = false,
        useViewBox = false,
        frameShadow = false,
        minifyJs = false,
    } = options;
    const width = stateMicro.microParams.General.width;
    const height = stateMicro.microParams.General.height;
    const borderPadding = stateMicro.microParams.Border.borderPadding;
    const borderRadius = stateMicro.microParams.Border.borderRadius;
    const svgNode = svg.node()! as SVGSVGElement;
    svgNode.removeAttribute('style');

    // Remove selection overlay from export
    const selectionOverlay = svgNode.querySelector('#selection-overlay');
    if (selectionOverlay) selectionOverlay.remove();

    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));
    const { optimize } = await import('svgo/browser');

    const defs = svgNode.querySelector('defs')!.cloneNode(true);
    const annotationIds = new Set(Object.keys(elementAnnotations ?? {}));
    svgNode.querySelectorAll('#micro path').forEach(el => {
        const id = el.getAttribute('id');
        if (id && !annotationIds.has(id)) el.removeAttribute('id');
    });

    // Optimize whole SVG
    const finalSvg = optimize(svgNode.outerHTML, svgoConfig as Config).data;
    const optimizedSVG = DOM_PARSER.parseFromString(finalSvg, 'image/svg+xml');
    let pathIsBetter = false;

    if (exportFonts == exportFontChoices.smallest || exportFonts == exportFontChoices.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild as SVGElement, usedProvidedFonts, exportFonts);
    }
    else if (exportFonts == exportFontChoices.noExport) {
        pathIsBetter = true;
    }

    const hasAnnotations = elementAnnotations && Object.keys(elementAnnotations).length > 0;

    // Styling
    const mapId = randomString(5);
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const animateCss = animate ? transitionCssMicro : '';
    const finalCss = discriminateCssForExport(renderedCss + animateCss, mapId);

    const svgElement = optimizedSVG.firstChild as SVGElement;
    svgElement.setAttribute('id', mapId);
    svgElement.querySelector('defs')!.remove();
    svgElement.append(defs);
    svgElement.querySelectorAll('#micro > path, #buildings > g').forEach(el => {
        const id = el.getAttribute('id');
        if (id && !annotationIds.has(id)) el.removeAttribute('id');
    });
    changeIdAndReferences(svgElement, mapId);

    // Build animation and annotation code after changeIdAndReferences so IDs are resolved correctly
    const animationCode = animate
        ? intersectionObserverScript.replaceAll('__ON_ANIMATION_END__', '')
        : '';

    let annotationCode = '';
    if (hasAnnotations) {
        const resolvedAnnotations: Record<string, { tooltip?: string; popover?: string }> = {};
        for (const [id, ann] of Object.entries(elementAnnotations!)) {
            // #paths elements get their IDs prefixed by changeIdAndReferences; try both
            const resolvedId = optimizedSVG.getElementById(id) ? id : `${mapId}-${id}`;
            if (optimizedSVG.getElementById(resolvedId)) {
                resolvedAnnotations[resolvedId] = {
                    tooltip: ann.tooltip ? xhtmlifyHtml(ann.tooltip) : undefined,
                    popover: ann.popover ? xhtmlifyHtml(ann.popover) : undefined,
                };
            }
        }
        if (Object.keys(resolvedAnnotations).length > 0) {
            annotationCode = elementAnnotationsScript.replaceAll(
                '__ELEMENT_ANNOTATIONS__',
                JSON.stringify(resolvedAnnotations)
            );
        }
    }

    let fontCss = '';
    if (!pathIsBetter) {
        if (exportFonts === exportFontChoices.embedFontFace || exportFonts === exportFontChoices.smallest) {
            fontCss = fontsToCss(usedProvidedFonts);
        } else {
            fontCss = await fontsToCssEmbed(usedProvidedFonts);
        }
    }
    styleElem.innerHTML = finalCss + fontCss;
    svgElement.append(styleElem);
    svgElement.classList.remove('animate-transition');
    svgElement.classList.add('cartosvg');

    if (frameShadow) {
        const outerFrameRx = (borderRadius / 100) * Math.min(width - borderPadding, height - borderPadding);
        addFrameShadow(svgElement, mapId, {
            x: 0,
            y: 0,
            width,
            height,
            rx: outerFrameRx,
        });
    }

    if (animate || hasAnnotations) {
        let js = `(function() {
        const mapElement = document.currentScript.parentNode;
        ${animationCode}
        ${annotationCode}
    })()`;

        if (minifyJs !== false) {
            const terser = await import('terser');
            const minified = await terser.minify(js, {
                toplevel: true,
                mangle: { eval: true }
            });
            js = minified.code || js;
        }

        const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
        const scriptContent = document.createTextNode(js);
        scriptElem.appendChild(scriptContent);
        svgElement.append(scriptElem);
    }

    /** Add attribution */
    addAttribution(svgElement, width, height, 'micro');

    if (useViewBox) {
        svgElement.removeAttribute('height');
        svgElement.removeAttribute('width');
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    if (!downloadExport) return svgElement.outerHTML;
    download(svgElement.outerHTML, 'text/plain', 'cartosvg-export.svg');
}