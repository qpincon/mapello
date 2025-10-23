import { MercatorCoordinate, type Map } from 'maplibre-gl';
import type { SvgSelection } from 'src/types';
import type { RenderedFeaturePoly } from 'src/util/geometryStitch';


/** Small numeric helper */
const EPS = 1e-9;
const MIN_BUILDING_HEIGHT = 5;
/**
 * Apply a 4x4 projection matrix to a MercatorCoordinate, returning clip-space components.
 */
function applyMatrixToMerc(
    matrix: number[] /* length 16 */,
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
    if (Math.abs(cw) < EPS) return { x: cx, y: cy, z: cz, w: cw }; // degenerate, keep raw
    return { x: cx / cw, y: cy / cw, z: cz / cw, w: cw / cw };
}

/**
 * Convert NDC to screen pixels given map canvas size.
 */
function ndcToScreen(ndc: { x: number; y: number }, width: number, height: number) {
    const screenX = (ndc.x + 1) / 2 * width;
    const screenY = (1 - ndc.y) / 2 * height; // NDC Y=+1 top
    return { x: screenX, y: screenY };
}

function getCameraDirectionFromPitchBearing(map: Map): { x: number; y: number; z: number } {
    const pitchRad = (map.getPitch() * Math.PI) / 180;
    const bearingRad = ((map.getBearing() % 360) * Math.PI) / 180;

    // MapLibre convention: 
    // - X: east, Y: north, Z: up
    // - pitch=0 → top-down → looking straight down (-Z)
    // - pitch increases → tilts toward horizon
    const cosPitch = Math.cos(pitchRad);
    const sinPitch = Math.sin(pitchRad);

    // Horizontal direction in XY plane (bearing)
    const dirX = sinPitch * Math.sin(bearingRad);
    const dirY = sinPitch * Math.cos(bearingRad);
    const dirZ = -cosPitch; // negative Z because camera looks down at Z-up

    return { x: dirX, y: dirY, z: dirZ };
}

/**
 * Try to get projection data from MapLibre and a mainMatrix.
 * We'll use map.transform.getProjectionDataForCustomLayer(false) if available.
 */
function getProjectionData(map: Map) {
    const projData = map.transform.getProjectionDataForCustomLayer(false);

    return {
        projData,
        mainMatrix: projData.mainMatrix as number[],
        cameraPosition: map.transform.cameraPosition,
        cameraDirection: getCameraDirectionFromPitchBearing(map),
    };
}

/**
 * Project a lng/lat/height into:
 *  - screenX, screenY (pixels),
 *  - clip (cx,cy,cz,cw),
 *  - ndc (x,y,z) (after perspective divide)
 *  - depth: ndc.z
 */
export function projectWithHeightUsingMainMatrix(
    map: Map,
    mainMatrix: number[],
    lng: number,
    lat: number,
    heightMeters: number
) {
    const merc: MercatorCoordinate = MercatorCoordinate.fromLngLat([lng, lat], heightMeters);

    const clip = applyMatrixToMerc(mainMatrix, merc);
    const ndc = clipToNDC(clip);

    const canvas = map.getCanvas();
    const screen = ndcToScreen(ndc, canvas.width, canvas.height);

    return {
        screen,
        clip,
        ndc,
        depth: ndc.z,
        world: merc,
    };
}

/**
 * Compute a 3D cross product (a x b).
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
 * Decide whether a wall face (quad) is visible.
 *
 * Strategy:
 * 1) If projection data exposes a cameraDirection (world space), compute face normal
 *    in world coords (using MercatorCoordinate.x,y,z) and dot(normal, cameraDirection).
 *    If dot < 0 -> facing camera (visible). This matches GPU backface culling heuristics.
 *
 * 2) Fallback: compute a normal in NDC (or clip-space after perspective divide) using three
 *    of the quad's corner points and check the sign of the Z component of that normal.
 *    This is a commonly used robust fallback for detecting facing vs. backface in screen-space.
 *
 * Note: Some sign conventions can flip depending on matrix conventions; if you observe reversed
 * culling, invert the comparisons (dot > 0 -> visible, or normal.z > 0 -> visible).
 */
function isWallVisible({
    ndcP0,
    ndcP1,
    ndcP2,
}: {
    ndcP0: { x: number; y: number; z: number };
    ndcP1: { x: number; y: number; z: number };
    ndcP2: { x: number; y: number; z: number };
}) {
    const v1 = sub3(ndcP1, ndcP0);
    const v2 = sub3(ndcP2, ndcP0);
    const n = cross3(v1, v2);
    // If n.z < 0 => facing camera (this is the convention we use). If you get reversed culling,
    // invert this sign check.
    return n.z < 0;
}
function renderExtrudedBuildingGrouped(feature: RenderedFeaturePoly, map: Map): SVGGElement | null {
    if (!feature || feature.geometry.type !== 'Polygon') {
        throw new Error('Only Polygon features are supported.');
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(SVG_NS, 'g');

    const className = (feature.properties?.class as string) || 'building';
    g.setAttribute('class', className);

    // Get projection data & matrix
    const { mainMatrix } = getProjectionData(map);

    // Structure to hold a part with all its elements
    type PartGroup = {
        baseHeight: number;
        walls: { el: SVGPathElement; depth: number }[];
        roof: SVGPathElement | null;
        roofDepth: number;
    };

    const partGroups: PartGroup[] = [];

    // Helper function to process a single feature (main or part)
    function processFeature(feat: RenderedFeaturePoly): PartGroup | null {
        const outerRing = feat.geometry.coordinates[0];
        if (!outerRing || outerRing.length < 3) {
            return null; // Skip invalid polygons
        }

        const heightMeters = feat.properties.height ?? feat.properties.min_height ?? MIN_BUILDING_HEIGHT;
        if (!heightMeters) return null;

        const baseHeight = feat.properties.base_height ?? 0;

        const walls: { el: SVGPathElement; depth: number }[] = [];
        let roofEl: SVGPathElement | null = null;
        let roofDepth = 0;

        // Pre-create list of projected points for bottom and top
        const projectedBottom = outerRing.map(([lng, lat]) => {
            return projectWithHeightUsingMainMatrix(map, mainMatrix, lng, lat, baseHeight);
        });

        const projectedTop = outerRing.map(([lng, lat]) =>
            projectWithHeightUsingMainMatrix(map, mainMatrix, lng, lat, heightMeters)
        );

        // Create walls
        const n = projectedBottom.length;
        for (let i = 0; i < n; i++) {
            const ni = (i + 1) % n;

            const b0p = projectedBottom[i];
            const b1p = projectedBottom[ni];
            const t0p = projectedTop[i];
            const t1p = projectedTop[ni];

            // Clip/NDC points for visibility test
            const ndc0 = b0p.ndc;
            const ndc1 = b1p.ndc;
            const ndc2 = t0p.ndc;

            // Decide visibility
            const visible = isWallVisible({
                ndcP0: { x: ndc0.x, y: ndc0.y, z: ndc0.z },
                ndcP1: { x: ndc1.x, y: ndc1.y, z: ndc1.z },
                ndcP2: { x: ndc2.x, y: ndc2.y, z: ndc2.z },
            });

            if (!visible) {
                continue; // Skip backfacing wall
            }

            // Build path string for this quad
            const b0s = b0p.screen;
            const b1s = b1p.screen;
            const t1s = t1p.screen;
            const t0s = t0p.screen;

            const pathD = `M ${b0s.x.toFixed(2)},${b0s.y.toFixed(2)} L ${b1s.x.toFixed(2)},${b1s.y.toFixed(2)} L ${t1s.x.toFixed(2)},${t1s.y.toFixed(2)} L ${t0s.x.toFixed(2)},${t0s.y.toFixed(2)} Z`;

            const pathEl = document.createElementNS(SVG_NS, 'path');
            pathEl.setAttribute('class', 'wall');
            pathEl.setAttribute('d', pathD);

            // Compute depth for ordering
            // const depthValues = [b0p.depth, b1p.depth].filter((d) => Number.isFinite(d));
            const depthValues = [b0p.depth, b1p.depth, t0p.depth, t1p.depth].filter((d) => Number.isFinite(d));
            const depth = depthValues.length ? depthValues.reduce((s, v) => s + v, 0) / depthValues.length : 0;
            pathEl.setAttribute('data-depth', String(depth));

            walls.push({ el: pathEl, depth });
        }

        // Build roof
        const roofPathD = (() => {
            const coords: string[] = [];
            for (let i = 0; i < projectedTop.length; i++) {
                const s = projectedTop[i].screen;
                coords.push(`${s.x.toFixed(2)},${s.y.toFixed(2)}`);
            }
            return coords.length ? `M ${coords.join(' L ')} Z` : '';
        })();

        if (roofPathD) {
            roofEl = document.createElementNS(SVG_NS, 'path');
            roofEl.setAttribute('class', 'roof');
            roofEl.setAttribute('d', roofPathD);

            // Calculate roof depth
            roofDepth = projectedBottom.reduce((s, p) => s + (p.depth || 0), 0) / Math.max(1, projectedBottom.length);
            // roofDepth = projectedTop.reduce((s, p) => s + (p.depth || 0), 0) / Math.max(1, projectedTop.length);
            roofEl.setAttribute('data-depth', String(roofDepth));
        }

        return {
            baseHeight,
            walls,
            roof: roofEl,
            roofDepth
        };
    }

    // Process main feature
    const mainGroup = processFeature(feature);
    if (mainGroup) {
        partGroups.push(mainGroup);
    }

    // Process all parts
    if (feature.properties.parts && Array.isArray(feature.properties.parts)) {
        for (const part of feature.properties.parts) {
            const partGroup = processFeature(part as RenderedFeaturePoly);
            if (partGroup) {
                partGroups.push(partGroup);
            }
        }
    }

    // Sort part groups by base height (lower first)
    partGroups.sort((a, b) => a.baseHeight - b.baseHeight);

    // Render each part group in order
    const allDepths: number[] = [];

    for (const partGroup of partGroups) {
        // Sort and append walls for this part (by depth)
        partGroup.walls.sort((a, b) => a.depth - b.depth);
        for (const wall of partGroup.walls) {
            g.appendChild(wall.el);
            allDepths.push(wall.depth);
        }

        // Append roof for this part
        if (partGroup.roof) {
            g.appendChild(partGroup.roof);
            allDepths.push(partGroup.roofDepth);
        }
    }

    // Store average depth of all elements for building-level sorting
    const avgDepth = allDepths.length ? allDepths.reduce((s, d) => s + d, 0) / allDepths.length : 0;
    // const minDepth = Math.min(...allDepths);
    g.setAttribute('data-depth', String(avgDepth));
    // g.setAttribute('data-depth', String(minDepth));

    return g;
}
export function renderBuildingsToSvg(
    features: RenderedFeaturePoly[],
    map: Map,
    svg: SvgSelection,
    translateAmount: number
) {
    // const svgContainer = svg.node()!;
    const svgContainer = svg.append('g')
        .attr('id', 'buildings')
        .attr("clip-path", "url(#clipMapBorder)")
        .attr('transform', `translate(${translateAmount}, ${translateAmount})`)
        .node()!
    // Render each building and record depth
    const groups: { el: SVGGElement; depth: number }[] = [];

    for (const f of features) {
        try {
            const g = renderExtrudedBuildingGrouped(f, map);
            if (!g) continue;
            const depthStr = g.getAttribute('data-depth');
            const depth = depthStr ? parseFloat(depthStr) : 0;
            groups.push({ el: g, depth });
        } catch (err) {
            // Skip invalid features silently (or log if you prefer)
            console.warn('Skipping building feature:', err);
        }
    }

    // Sort by depth ascending (farthest first). NDC Z: smaller (more negative) often means farther.
    groups.sort((a, b) => b.depth - a.depth);

    // Clear container and append in order
    for (const g of groups) {
        svgContainer.appendChild(g.el);
    }
}
