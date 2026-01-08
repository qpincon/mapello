import { random } from 'lodash-es';
import { MercatorCoordinate, type Map as MapLibreMap } from 'maplibre-gl';
import type { MicroLayerDefinition, SvgSelection } from 'src/types';
import type { RenderedFeaturePoly } from 'src/util/geometryStitch';

/** Small numeric helper */
const EPS = 1e-9;
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
function ndcToScreen(ndc: { x: number; y: number }, width: number, height: number) {
    const screenX = (ndc.x + 1) / 2 * width;
    const screenY = (1 - ndc.y) / 2 * height;
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
    heightMeters: number
) {
    const merc = MercatorCoordinate.fromLngLat([lng, lat], heightMeters);
    const clip = applyMatrixToMerc(mainMatrix, merc);
    const ndc = clipToNDC(clip);
    const canvas = map.getCanvas();
    const screen = ndcToScreen(ndc, canvas.width, canvas.height);

    return {
        screen,
        ndc,
        depth: ndc.z,
    };
}

/**
 * Compute 3D cross product (a × b).
 */
function cross3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    };
}

/**
 * Subtract 3D vectors.
 */
function sub3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Decide whether a wall face is visible using NDC-space winding order.
 * Uses backface culling: if the cross product Z component is negative,
 * the face is front-facing (visible).
 */
function isWallVisibleNDC(
    ndc0: { x: number; y: number; z: number },
    ndc1: { x: number; y: number; z: number },
    ndc2: { x: number; y: number; z: number }
): boolean {
    const v1 = sub3(ndc1, ndc0);
    const v2 = sub3(ndc2, ndc0);
    const n = cross3(v1, v2);
    return n.z < 0;
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
 * Render a single building feature with hole support and NDC-based culling.
 */
function renderExtrudedBuildingImproved(
    feature: RenderedFeaturePoly,
    map: MapLibreMap,
    mainMatrix: number[]
): { elements: Array<{ el: SVGElement; depth: number }>; className: string } | null {
    if (!feature || feature.geometry.type !== 'Polygon') {
        return null;
    }

    const allRings = feature.geometry.coordinates;
    if (!allRings || allRings.length === 0 || !allRings[0] || allRings[0].length < 3) {
        return null;
    }

    const heightMeters = feature.properties.height ?? MIN_BUILDING_HEIGHT;
    if (!heightMeters || heightMeters < 0.1) return null;

    const baseHeight = feature.properties.base_height ?? feature.properties.min_height ?? 0;

    const className = (feature.properties?.class as string) || 'building';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const elements: Array<{ el: SVGElement; depth: number }> = [];

    // Project all rings (outer + holes) for bottom and top
    const projectedBottomRings = allRings.map(ring =>
        ring.map(([lng, lat]) =>
            projectWithHeightUsingMainMatrix(map, mainMatrix, lng, lat, baseHeight)
        )
    );

    const projectedTopRings = allRings.map(ring =>
        ring.map(([lng, lat]) =>
            projectWithHeightUsingMainMatrix(map, mainMatrix, lng, lat, heightMeters)
        )
    );

    // Create walls for each ring
    for (let ringIdx = 0; ringIdx < allRings.length; ringIdx++) {
        const projectedBottom = projectedBottomRings[ringIdx];
        const projectedTop = projectedTopRings[ringIdx];

        const n = projectedBottom.length;
        for (let i = 0; i < n; i++) {
            const ni = (i + 1) % n;

            const b0p = projectedBottom[i];
            const b1p = projectedBottom[ni];
            const t0p = projectedTop[i];
            const t1p = projectedTop[ni];

            // Use NDC-space for robust backface culling
            const visible = isWallVisibleNDC(
                { x: b0p.ndc.x, y: b0p.ndc.y, z: b0p.ndc.z },
                { x: b1p.ndc.x, y: b1p.ndc.y, z: b1p.ndc.z },
                { x: t0p.ndc.x, y: t0p.ndc.y, z: t0p.ndc.z }
            );
            if (!visible) continue;

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

    return { elements, className };
}

/**
 * Render buildings with grouping, hole support, and depth sorting by closest element.
 */
export function renderBuildingsToSvgImproved(
    features: RenderedFeaturePoly[],
    map: MapLibreMap,
    svg: SvgSelection,
    translateAmount: number,
    layerState: MicroLayerDefinition,
) {
    const svgContainer = svg.append('g')
        .attr('id', 'buildings')
        .attr("clip-path", "url(#clipMapBorder)")
        .attr('transform', `translate(${translateAmount}, ${translateAmount})`)
        .node()!;

    const mainMatrix = map.transform.getProjectionDataForCustomLayer(false).mainMatrix as number[];

    // Structure to hold all elements from all buildings with their depths
    type ElementWithDepth = {
        el: SVGElement;
        depth: number;
        className: string;
        buildingId: number | string;
    };

    const allElements: ElementWithDepth[] = [];

    // Process each top-level feature
    for (const feature of features) {
        try {
            const buildingId = feature.properties.uuid ?? `building-${allElements.length}`;

            // Process main feature
            const mainResult = renderExtrudedBuildingImproved(
                feature,
                map,
                mainMatrix
            );

            if (mainResult) {
                for (const item of mainResult.elements) {
                    allElements.push({
                        el: item.el,
                        depth: item.depth,
                        className: mainResult.className,
                        buildingId,
                    });
                }
            }

            // Process all parts (if any)
            if (feature.properties.parts && Array.isArray(feature.properties.parts)) {
                for (const part of feature.properties.parts) {
                    const partResult = renderExtrudedBuildingImproved(
                        part as RenderedFeaturePoly,
                        map,
                        mainMatrix
                    );

                    if (partResult) {
                        for (const item of partResult.elements) {
                            allElements.push({
                                el: item.el,
                                depth: item.depth,
                                className: partResult.className,
                                buildingId,
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
    for (const elements of buildingGroups.values()) {
        elements.sort((a, b) => b.depth - a.depth);
    }

    // Compute minimum depth (closest element) for each building
    const buildingDepths = new Map<number | string, number>();
    for (const [buildingId, elements] of buildingGroups.entries()) {
        const minDepth = Math.min(...elements.map(e => e.depth));
        buildingDepths.set(buildingId, minDepth);
    }

    // Sort building IDs by their closest element depth (descending - farthest buildings first)
    const sortedBuildingIds = Array.from(buildingGroups.keys()).sort(
        (a, b) => buildingDepths.get(b)! - buildingDepths.get(a)!
    );

    // Create groups and append elements in building-sorted order
    const SVG_NS = 'http://www.w3.org/2000/svg';

    for (const buildingId of sortedBuildingIds) {
        const elements = buildingGroups.get(buildingId)!;

        // Create group for this building
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', `buildings-${random(0, layerState.fills!.length - 1)}`);
        g.setAttribute('id', buildingId as string);

        // Append all elements of this building to the group
        for (const item of elements) {
            g.appendChild(item.el);
        }

        svgContainer.appendChild(g);
    }
}
