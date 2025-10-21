// extrude-svg-buildings.ts
import { MercatorCoordinate, type Map } from 'maplibre-gl';
import type { SvgSelection } from 'src/types';
import type { RenderedFeaturePoly } from 'src/util/geometryStitch';


/**
 * Apply the MapLibre 4x4 projection matrix to a MercatorCoordinate (x,y,z,w=1)
 * and return clip-space divided coordinates.
 */
function applyProjectionMatrixToMerc(
    matrix: number[],
    merc: MercatorCoordinate
): { nx: number; ny: number; nz: number; nw: number } {
    const x = merc.x;
    const y = merc.y;
    const z = merc.z;
    const w = 1.0;

    // Column-major order (WebGL style)
    const nx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w;
    const ny = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w;
    const nz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w;
    const nw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;

    return { nx, ny, nz, nw };
}

/**
 * Project lng/lat + heightMeters (in meters) into screen pixels using MapLibre internals.
 */
export function projectWithHeight(map: Map, lng: number, lat: number, heightMeters: number) {
    // Access transform & projection matrix (internal)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   const matrix: number[] = transform.projMatrix;
    //   if (!matrix || matrix.length !== 16) {
    //     throw new Error('Projection matrix not found on map.transform.projMatrix.');
    //   }

    const matrix = map.transform.getProjectionDataForCustomLayer(false).mainMatrix;
    console.log(matrix);

    // Use MercatorCoordinate.fromLngLat to get world coords with z in meters converted to mercator z.
    const merc: MercatorCoordinate = MercatorCoordinate.fromLngLat([lng, lat], heightMeters);

    const { nx, ny, nz, nw } = applyProjectionMatrixToMerc(matrix, merc);

    // Perform perspective divide to get NDC (-1..1)
    const ndcX = nx / nw;
    const ndcY = ny / nw;
    const ndcZ = nz / nw;

    // Convert NDC to screen pixels
    const canvas = map.getCanvas();
    const width = canvas.width;
    const height = canvas.height;

    // NDC origin is center. Convert to pixels.
    const screenX = (ndcX + 1) / 2 * width;
    const screenY = (1 - ndcY) / 2 * height; // flip Y because NDC Y=+1 is top

    return { x: screenX, y: screenY, depth: ndcZ };
}

/**
 * Convert a ring of coords [[lng, lat], ...] to an array of projected screen points for given height.
 */
function projectRing(map: Map, ring: number[][], heightMeters: number) {
    return ring.map(([lng, lat]) => projectWithHeight(map, lng, lat, heightMeters));
}

/**
 * Build an SVG path string for the roof from an array of projected points.
 * The path will be "M x,y L x,y ... Z".
 */
function makeRoofPath(projectedTop: { x: number; y: number }[]) {
    if (!projectedTop.length) return '';
    const d =
        'M ' +
        projectedTop.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ') +
        ' Z';
    return d;
}

/**
 * Build a single walls path (all wall quads concatenated). Each wall quad is a separate subpath
 * "M base0 L base1 L top1 L top0 Z".
 */
function makeWallsPath(
    projectedBottom: { x: number; y: number }[],
    projectedTop: { x: number; y: number }[]
) {
    if (projectedBottom.length !== projectedTop.length) {
        throw new Error('Bottom and top rings must have same number of coordinates');
    }

    let d = '';
    const n = projectedBottom.length;
    for (let i = 0; i < n - 1; i++) {
        const b0 = projectedBottom[i];
        const b1 = projectedBottom[i + 1];
        const t1 = projectedTop[i + 1];
        const t0 = projectedTop[i];

        // Skip degenerate quads (zero area)
        if (
            Number.isFinite(b0.x) &&
            Number.isFinite(b0.y) &&
            Number.isFinite(b1.x) &&
            Number.isFinite(b1.y) &&
            Number.isFinite(t0.x) &&
            Number.isFinite(t0.y) &&
            Number.isFinite(t1.x) &&
            Number.isFinite(t1.y)
        ) {
            d +=
                'M ' +
                `${b0.x.toFixed(2)},${b0.y.toFixed(2)} ` +
                'L ' +
                `${b1.x.toFixed(2)},${b1.y.toFixed(2)} ` +
                'L ' +
                `${t1.x.toFixed(2)},${t1.y.toFixed(2)} ` +
                'L ' +
                `${t0.x.toFixed(2)},${t0.y.toFixed(2)} ` +
                'Z ';
        }
    }

    // If ring is closed (first == last) and we didn't include last-to-first, include that quad:
    // Check last point to first point
    const lastIndex = n - 1;
    if (n > 1) {
        const b0 = projectedBottom[lastIndex];
        const b1 = projectedBottom[0];
        const t1 = projectedTop[0];
        const t0 = projectedTop[lastIndex];
        if (
            Number.isFinite(b0.x) &&
            Number.isFinite(b0.y) &&
            Number.isFinite(b1.x) &&
            Number.isFinite(b1.y) &&
            Number.isFinite(t0.x) &&
            Number.isFinite(t0.y) &&
            Number.isFinite(t1.x) &&
            Number.isFinite(t1.y)
        ) {
            d +=
                'M ' +
                `${b0.x.toFixed(2)},${b0.y.toFixed(2)} ` +
                'L ' +
                `${b1.x.toFixed(2)},${b1.y.toFixed(2)} ` +
                'L ' +
                `${t1.x.toFixed(2)},${t1.y.toFixed(2)} ` +
                'L ' +
                `${t0.x.toFixed(2)},${t0.y.toFixed(2)} ` +
                'Z ';
        }
    }

    return d.trim();
}

/**
 * Render a single BuildingFeature into an SVG <g> element.
 *
 * - feature.geometry.coordinates is assumed to be a Polygon and we'll use the outer ring (index 0).
 * - uses properties.height (meters) and properties.class (string).
 */
export function renderExtrudedBuilding(feature: RenderedFeaturePoly, map: Map): SVGGElement {
    if (!feature || feature.geometry.type !== 'Polygon') {
        throw new Error('Only Polygon features are supported.');
    }

    const outerRing = feature.geometry.coordinates[0];
    if (!outerRing || outerRing.length < 3) {
        throw new Error('Polygon outer ring must contain at least 3 coordinates.');
    }

    const heightMeters = Number(feature.properties?.height) || 0;
    const className = (feature.properties?.class as string) || 'building';

    // Project bottom (ground) and top (height)
    const projectedBottom = projectRing(map, outerRing, 0).map((p) => ({ x: p.x, y: p.y }));
    const projectedTop = projectRing(map, outerRing, heightMeters).map((p) => ({ x: p.x, y: p.y }));

    // Build paths
    const roofD = makeRoofPath(projectedTop);
    const wallsD = makeWallsPath(projectedBottom, projectedTop);

    // Create SVG elements in the SVG namespace
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', className);

    const roof = document.createElementNS(SVG_NS, 'path');
    roof.setAttribute('class', 'roof');
    roof.setAttribute('d', roofD);

    const walls = document.createElementNS(SVG_NS, 'path');
    walls.setAttribute('class', 'walls');
    walls.setAttribute('d', wallsD);

    // Append walls first and roof later so roof overlaps walls visually if same z-order.
    g.appendChild(walls);
    g.appendChild(roof);

    // Compute a depth value for sorting (use average NDC Z of top points)
    // We'll store depth as a data attribute for optional later sorting.
    const depths = projectRing(map, outerRing, heightMeters).map((p) => p.depth);
    const avgDepth = depths.reduce((s, v) => s + v, 0) / Math.max(1, depths.length);
    g.setAttribute('data-depth', String(avgDepth));

    return g;
}

/**
 * Render and insert a list of building features into an SVG container element,
 * taking care of sorting by depth (far -> near).
 *
 * @param features - Array of BuildingFeature (Polygon)
 * @param map - MapLibre map instance
 * @param svgContainer - SVG element (e.g., <svg> or a <g>) where building groups are appended
 */
export function renderBuildingsToSvg(
    features: RenderedFeaturePoly[],
    map: Map,
    svg: SvgSelection
) {
    // const svgContainer = svg.node()!;
    const svgContainer = svg.append('svg')
        // .attr('transform', `translate(${translateAmount}, ${translateAmount})`)
        .attr('height', svg.attr('height'))
        .attr('width', svg.attr('width')).node()!;
    // Render each building and record depth
    const groups: { el: SVGGElement; depth: number }[] = [];

    for (const f of features) {
        try {
            const g = renderExtrudedBuilding(f, map);
            const depthStr = g.getAttribute('data-depth');
            const depth = depthStr ? parseFloat(depthStr) : 0;
            groups.push({ el: g, depth });
        } catch (err) {
            // Skip invalid features silently (or log if you prefer)
            // console.warn('Skipping building feature:', err);
        }
    }

    // Sort by depth ascending (farthest first). NDC Z: smaller (more negative) often means farther.
    groups.sort((a, b) => a.depth - b.depth);

    // Clear container and append in order
    while (svgContainer.firstChild) svgContainer.removeChild(svgContainer.firstChild);
    for (const g of groups) {
        svgContainer.appendChild(g.el);
    }
}
