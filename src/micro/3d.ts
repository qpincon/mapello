import { random } from 'lodash-es';
import { MercatorCoordinate, type Map as MapLibreMap } from 'maplibre-gl';
import type { MicroLayerDefinition, SvgSelection } from 'src/types';
import type { RenderedFeaturePoly } from 'src/util/geometryStitch';
import type { GroupedFeature } from './drawing';

/** Small numeric helper */
const EPS = 1e-9;

/**
 * Fallback default building height in meters.
 * Used when palette doesn't specify defaultBuildingHeight.
 */
const MIN_BUILDING_HEIGHT = 5;

/**
 * Apply a 4x4 projection matrix to a MercatorCoordinate, returning clip-space components.
 */
function applyMatrixToMerc(
    matrix: number[],
    merc: MercatorCoordinate
): { cx: number; cy: number; cz: number; cw: number } {
    const x = merc.x;
    const y = merc.y;
    const z = merc.z;
    const w = 1.0;

    // Column-major (WebGL)
    const cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
    const cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
    const cz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
    const cw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;

    return { cx, cy, cz, cw };
}

/**
 * Convert clip-space coordinates to NDC (perspective divide).
 */
function clipToNDC({ cx, cy, cz, cw }: { cx: number; cy: number; cz: number; cw: number }) {
    if (Math.abs(cw) < EPS) return { x: cx, y: cy, z: cz, w: cw };
    return { x: cx / cw, y: cy / cw, z: cz / cw, w: cw / cw };
}

/**
 * Convert NDC to screen pixels given map canvas size.
 */
function ndcToScreen(ndc: { x: number; y: number }, width: number, height: number, offset: number = 0) {
    const screenX = (ndc.x + 1) / 2 * width + offset;
    const screenY = (1 - ndc.y) / 2 * height + offset;
    return { x: screenX, y: screenY };
}

/**
 * Project a lng/lat/height into screen and NDC coordinates.
 */
export function projectWithHeightUsingMainMatrix(
    map: MapLibreMap,
    mainMatrix: number[],
    lng: number,
    lat: number,
    heightMeters: number,
    offset: number = 0
) {
    const merc = MercatorCoordinate.fromLngLat([lng, lat], heightMeters);
    const clip = applyMatrixToMerc(mainMatrix, merc);
    const ndc = clipToNDC(clip);
    const canvas = map.getCanvas();
    const screen = ndcToScreen(ndc, canvas.clientWidth, canvas.clientHeight, offset);

    return {
        screen,
        ndc,
        depth: ndc.z,
        cw: clip.cw,
    };
}

/**
 * Compute 2D cross product (z-component of 3D cross product with z=0).
 */
function cross2D(ax: number, ay: number, bx: number, by: number): number {
    return ax * by - ay * bx;
}

/**
 * Check if a vertex is well inside the NDC frustum.
 * Uses conservative bounds (0.8) to avoid edge cases with projection artifacts.
 */
function isInsideNDC(ndc: { x: number; y: number }): boolean {
    return Math.abs(ndc.x) <= 0.8 && Math.abs(ndc.y) <= 0.8;
}

/**
 * Decide whether a wall face is visible using NDC-space winding order.
 * Uses 2D cross product to determine if vertices are in clockwise order (front-facing).
 */
function isWallVisibleNDC(
    ndc0: { x: number; y: number },
    ndc1: { x: number; y: number },
    ndc2: { x: number; y: number }
): boolean {
    // Vectors from ndc0 to ndc1 and ndc0 to ndc2
    const v1x = ndc1.x - ndc0.x;
    const v1y = ndc1.y - ndc0.y;
    const v2x = ndc2.x - ndc0.x;
    const v2y = ndc2.y - ndc0.y;

    // 2D cross product determines winding order
    // Use threshold to only cull walls that are clearly back-facing
    const cross = cross2D(v1x, v1y, v2x, v2y);
    const CULL_THRESHOLD = -0.0001;
    return cross < CULL_THRESHOLD;
}

/**
 * Calculate average depth from an array of depth values.
 */
function averageDepth(depths: number[]): number {
    const validDepths = depths.filter(d => Number.isFinite(d));
    return validDepths.length ? validDepths.reduce((s, v) => s + v, 0) / validDepths.length : 0;
}

/**
 * Create SVG path for a polygon with holes.
 * First ring is outer boundary, subsequent rings are holes.
 */
function createPolygonPathWithHoles(
    projectedRings: ReturnType<typeof projectWithHeightUsingMainMatrix>[][]
): string {
    return projectedRings
        .filter(ring => ring.length > 0)
        .map(ring => {
            const coords = ring.map(p => `${p.screen.x.toFixed(2)},${p.screen.y.toFixed(2)}`);
            return `M ${coords.join(' L ')} Z`;
        })
        .join(' ');
}

/**
 * Render a single building feature with hole support and hybrid NDC culling.
 */
function renderExtrudedBuildingImproved(
    feature: RenderedFeaturePoly,
    map: MapLibreMap,
    mainMatrix: number[],
    defaultHeight: number = MIN_BUILDING_HEIGHT,
    offset: number = 0
): { elements: Array<{ el: SVGElement; depth: number }>; className: string; minVertexDepth: number } | null {
    if (!feature || feature.geometry.type !== 'Polygon') {
        return null;
    }

    const allRings = feature.geometry.coordinates;
    if (!allRings || allRings.length === 0 || !allRings[0] || allRings[0].length < 3) {
        return null;
    }
    const heightMeters = feature.properties.height ?? defaultHeight;
    if (!heightMeters || heightMeters < 0.1) return null;

    let baseHeight = feature.properties.base_height ?? 0;
    if (feature.properties.min_height && feature.properties.kind_detail === "yes") baseHeight = feature.properties.min_height;

    const className = (feature.properties?.class as string) || 'building';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const elements: Array<{ el: SVGElement; depth: number }> = [];

    // Project all rings (outer + holes) for bottom and top
    const projectedBottomRings = allRings.map(ring =>
        ring.map(([lng, lat]) =>
            projectWithHeightUsingMainMatrix(map, mainMatrix, lng, lat, baseHeight, offset)
        )
    );

    const projectedTopRings = allRings.map(ring =>
        ring.map(([lng, lat]) =>
            projectWithHeightUsingMainMatrix(map, mainMatrix, lng, lat, heightMeters, offset)
        )
    );

    // Compute minimum depth across all projected vertices for building-level sorting
    const minVertexDepth = Math.min(...projectedBottomRings.flat().map(p => p.depth));

    // Create walls for each ring
    for (let ringIdx = 0; ringIdx < allRings.length; ringIdx++) {
        const projectedBottom = projectedBottomRings[ringIdx];
        const projectedTop = projectedTopRings[ringIdx];

        const n = projectedBottom.length;

        // Determine ring winding in NDC via signed area (shoelace formula)
        let ndcSignedArea = 0;
        for (let j = 0; j < n; j++) {
            const nj = (j + 1) % n;
            ndcSignedArea += projectedBottom[j].ndc.x * projectedBottom[nj].ndc.y;
            ndcSignedArea -= projectedBottom[nj].ndc.x * projectedBottom[j].ndc.y;
        }
        const isCCW = ndcSignedArea > 0;
        const isHole = ringIdx > 0;
        // Outer walls face outward; hole walls face inward (toward courtyard).
        // isWallVisibleNDC assumes CW winding, so invert when isHole XOR isCCW.
        const invertVisibility = isHole !== isCCW;

        for (let i = 0; i < n; i++) {
            const ni = (i + 1) % n;

            const b0p = projectedBottom[i];
            const b1p = projectedBottom[ni];
            const t0p = projectedTop[i];
            const t1p = projectedTop[ni];

            // Check if all vertices are inside the NDC frustum
            const allInsideNDC = isInsideNDC(b0p.ndc) && isInsideNDC(b1p.ndc) &&
                isInsideNDC(t0p.ndc) && isInsideNDC(t1p.ndc);

            if (allInsideNDC) {
                let visible = isWallVisibleNDC(b0p.ndc, b1p.ndc, t0p.ndc);
                if (invertVisibility) visible = !visible;
                if (!visible) continue;
            }
            // If any vertex is outside NDC bounds, skip culling and render the wall

            // Build quad path
            const pathD = `M ${b0p.screen.x.toFixed(2)},${b0p.screen.y.toFixed(2)} L ${b1p.screen.x.toFixed(2)},${b1p.screen.y.toFixed(2)} L ${t1p.screen.x.toFixed(2)},${t1p.screen.y.toFixed(2)} L ${t0p.screen.x.toFixed(2)},${t0p.screen.y.toFixed(2)} Z`;

            const pathEl = document.createElementNS(SVG_NS, 'path');
            pathEl.setAttribute('class', 'wall');
            pathEl.setAttribute('d', pathD);

            const depth = averageDepth([b0p.depth, b1p.depth, t0p.depth, t1p.depth]);
            elements.push({ el: pathEl, depth });
        }
    }

    // Create roof with holes
    const roofPathD = createPolygonPathWithHoles(projectedTopRings);

    if (roofPathD) {
        const roofEl = document.createElementNS(SVG_NS, 'path');
        roofEl.setAttribute('class', 'roof');
        roofEl.setAttribute('d', roofPathD);

        const roofDepth = averageDepth(projectedTopRings.flat().map(p => p.depth));
        elements.push({ el: roofEl, depth: roofDepth });
    }

    return { elements, className, minVertexDepth };
}

/**
 * Render buildings with grouping, hole support, and depth sorting by closest element.
 * Accepts both normal features (RenderedFeaturePoly) and grouped features (GroupedFeature).
 */
export function renderBuildingsToSvgImproved(
    features: (RenderedFeaturePoly | GroupedFeature)[],
    map: MapLibreMap,
    svg: SvgSelection,
    translateAmount: number,
    layerState: MicroLayerDefinition,
    animated: boolean = false,
) {
    const svgContainer = svg.append('g')
        .attr('id', 'buildings')
        .attr("clip-path", "url(#clipMapBorder)")
        .node()!;

    const mainMatrix = map.transform.getProjectionDataForCustomLayer(false).mainMatrix as number[];

    // Structure to hold all elements from all buildings with their depths
    type ElementWithDepth = {
        el: SVGElement;
        depth: number;
        className: string;
        buildingId: number | string;
        partId: number;
    };

    const allElements: ElementWithDepth[] = [];
    let nextPartId = 0;

    const complexBuildings = new Set<number | string>();

    // Track minimum vertex depth per building for correct sorting
    const buildingMinVertexDepths = new Map<number | string, number>();

    // Process each top-level feature
    for (const feature of features) {
        const groupedFeature = feature as GroupedFeature;
        try {
            const buildingId = feature.properties.uuid ?? `building-${allElements.length}`;
            /** Don't render containing feature if its a group */
            if (!groupedFeature.parts || (Array.isArray(groupedFeature.parts) && groupedFeature.parts.length === 0) || groupedFeature.properties.shouldRender) {

                // Process main feature
                const mainResult = renderExtrudedBuildingImproved(
                    feature,
                    map,
                    mainMatrix,
                    layerState.defaultBuildingHeight ?? MIN_BUILDING_HEIGHT,
                    translateAmount
                );

                if (mainResult) {
                    const currentMin = buildingMinVertexDepths.get(buildingId) ?? Infinity;
                    buildingMinVertexDepths.set(buildingId, Math.min(currentMin, mainResult.minVertexDepth));

                    const partId = nextPartId++;
                    for (const item of mainResult.elements) {
                        allElements.push({
                            el: item.el,
                            depth: item.depth,
                            className: mainResult.className,
                            buildingId,
                            partId,
                        });
                    }
                }
            }

            // Process all parts (if any) - parts are directly on GroupedFeature, not in properties

            if (groupedFeature.parts && Array.isArray(groupedFeature.parts)) {
                if (groupedFeature.parts.length > 10 &&
                    groupedFeature.parts.some(p => p.properties.base_height != null)) {
                    complexBuildings.add(buildingId);
                }
                for (const part of groupedFeature.parts) {
                    const partResult = renderExtrudedBuildingImproved(
                        part,
                        map,
                        mainMatrix,
                        layerState.defaultBuildingHeight ?? MIN_BUILDING_HEIGHT,
                        translateAmount
                    );

                    if (partResult) {
                        const currentMin = buildingMinVertexDepths.get(buildingId) ?? Infinity;
                        buildingMinVertexDepths.set(buildingId, Math.min(currentMin, partResult.minVertexDepth));

                        const partId = nextPartId++;
                        for (const item of partResult.elements) {
                            allElements.push({
                                el: item.el,
                                depth: item.depth,
                                className: partResult.className,
                                buildingId,
                                partId,
                            });
                        }
                    }
                }
            }

        } catch (err) {
            console.warn('Skipping building feature:', err);
        }
    }

    // Group elements by building ID
    const buildingGroups = new Map<number | string, ElementWithDepth[]>();

    for (const item of allElements) {
        if (!buildingGroups.has(item.buildingId)) {
            buildingGroups.set(item.buildingId, []);
        }
        buildingGroups.get(item.buildingId)!.push(item);
    }

    // Sort each building's elements by depth (for proper rendering within the building)
    for (const [buildingId, elements] of buildingGroups.entries()) {
        if (complexBuildings.has(buildingId)) {
            // Complex multi-part buildings: pure depth sort preserves stacking order
            elements.sort((a, b) => b.depth - a.depth);
        } else {
            // Simple buildings: walls first, then roofs (roofs paint over walls)
            elements.sort((a, b) => {
                const aIsRoof = a.el.classList.contains('roof') ? 1 : 0;
                const bIsRoof = b.el.classList.contains('roof') ? 1 : 0;
                if (aIsRoof !== bIsRoof) return aIsRoof - bIsRoof;
                return b.depth - a.depth;
            });
        }
    }

    // Sort building IDs by their minimum vertex depth (descending - farthest buildings first)
    const sortedBuildingIds = Array.from(buildingGroups.keys()).sort(
        (a, b) => buildingMinVertexDepths.get(b)! - buildingMinVertexDepths.get(a)!
    );

    // Create groups and append elements in building-sorted order
    const SVG_NS = 'http://www.w3.org/2000/svg';

    for (const buildingId of sortedBuildingIds) {
        const elements = buildingGroups.get(buildingId)!;

        // Create group for this building
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', `buildings-${random(0, layerState.fills!.length - 1)}`);
        g.setAttribute('id', buildingId as string);
        // g.setAttribute('mindepth', String(buildingMinVertexDepths.get(buildingId)));

        // Append all elements of this building to the group
        for (const item of elements) {
            // if (animated) {
            if (animated && item.el.classList.contains('roof')) {
                item.el.setAttribute('pathLength', '1');
            }
            g.appendChild(item.el);
        }

        svgContainer.appendChild(g);
    }
}
