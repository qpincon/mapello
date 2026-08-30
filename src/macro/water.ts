import type { VectorTile } from "@mapbox/vector-tile";
import type { Feature, Polygon } from "geojson";
import { macroState, appState } from "src/state.svelte";
import { type RenderedFeature } from "src/util/geometryStitch";
import { geoPath } from "d3-geo";
import { getMacroTileCoords, createTileFeatureFetcher, createLayerRenderer, clipAndRewindPolygons, pmtilesFetcher, PMTILES_URL } from "./vectorTiles";

/**
 * Fetches lakes/rivers (everything except the ocean) for macro mode directly from the
 * PMTiles vector tile archive — same principle as roads.ts, but polygons instead of lines.
 * See `clipAndRewindPolygons` in vectorTiles.ts for why cross-tile polygons are clipped
 * per-tile instead of stitched/merged.
 */

// Lower than roads' MAX_ZOOM (5): water is a filled shape, not a stroked line, so it
// tolerates a coarser network + lower coordinate precision without looking wrong. Vertex
// count explodes between z5 and z6 (measured ~24x for the same area) — z4 keeps lake/river
// shapes recognizable without tracing every little inlet.
const MAX_ZOOM = 6;

function extractWaterFeatures(tile: VectorTile, x: number, y: number, z: number): RenderedFeature[] {
    const layer = tile.layers.water;
    if (!layer) return [];

    const features: RenderedFeature[] = [];
    for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        // The water source-layer also carries type-1 Point features (label anchors
        // for "ocean"/"lake" labels) — this filter is required, not defensive.
        if (feat.type !== 3 /* Polygon */) continue;
        if (feat.properties.kind === "ocean") continue;

        const geojson = feat.toGeoJSON(x, y, z) as Feature<Polygon>;
        const rendered = geojson as unknown as RenderedFeature;
        rendered.properties.x = x;
        rendered.properties.y = y;
        rendered.properties.sourceLayer = "water";
        features.push(rendered);
    }
    return features;
}

const fetchWaterTiles = createTileFeatureFetcher(pmtilesFetcher(PMTILES_URL), extractWaterFeatures);

// Below this projected (on-screen) area, in square pixels, a water feature is a speck too
// small to register visually — drop it rather than spend SVG path bytes on it. This is a
// render-time (not fetch-time) filter deliberately: "small" depends on the current
// zoom/projection, not the feature's real-world size, so it has to be checked against the
// actual projected geometry, not something precomputed once per tile.
const MIN_PERCEIVED_AREA_PX = 1;

/**
 * Fetches and decodes non-ocean water covering the current macro viewport, clipped to tile
 * boundaries (no cross-tile merging — see `clipAndRewindPolygons` for why). Returns plain
 * lon/lat Polygon features with d3-compatible ring winding, and degrades to an empty array
 * (never throws) on tile fetch/decode failure.
 */
export async function getMacroWater(): Promise<Feature<Polygon>[]> {
    try {
        const { zoom, tileCoords } = getMacroTileCoords(MAX_ZOOM);
        if (tileCoords.length === 0) return [];

        const rawFeatures = await fetchWaterTiles(tileCoords);
        return clipAndRewindPolygons(rawFeatures, zoom);
    } catch (err) {
        console.warn("getMacroWater: failed to build water layer, exporting without it", err);
        return [];
    }
}

/**
 * Draws (or clears) the water layer into the `<g id="water-layer">` placeholder created
 * once by `ensureLayerGroup` in `drawMacroBase` (see that call site for why its position is
 * fixed regardless of async timing).
 */
export const updateMacroWater = createLayerRenderer<Feature<Polygon>>({
    isEnabled: () => macroState.inlinePropsMacro.showWater,
    fetchFeatures: getMacroWater,
    render: (group, waterFeatures) => {
        if (!appState.projection) return;
        // Fills tolerate less precision than strokes; keep the path data modest.
        const waterPath = geoPath(appState.projection).digits(1);
        const d = waterFeatures
            .filter((feature) => Math.abs(waterPath.area(feature)) >= MIN_PERCEIVED_AREA_PX)
            .map((feature) => waterPath(feature))
            .filter(Boolean)
            .join(' ');
        if (!d) return;

        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', d);
        pathElem.setAttribute('fill', macroState.macroParams.Background.waterColor);
        // Default fill-rule (nonzero) is correct given rewindForD3() above — evenodd would
        // punch visible holes wherever two adjacent tile pieces legitimately overlap.
        pathElem.setAttribute('clip-path', 'url(#clipMapBorder)');
        group.appendChild(pathElem);
    },
});
