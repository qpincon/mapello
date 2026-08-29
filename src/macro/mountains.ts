import type { VectorTile } from "@mapbox/vector-tile";
import type { BBox, Feature, Polygon } from "geojson";
import { tiles as getCoveringTiles } from "@mapbox/tile-cover";
import bboxPolygon from "@turf/bbox-polygon";
import center from "@turf/center";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { macroState, appState } from "src/state.svelte";
import { type RenderedFeature } from "src/util/geometryStitch";
import { geoPath } from "d3-geo";
import { lightenColor } from "src/util/colorMath";
import { geometriesState } from "./geometry-data";
import { getMacroBounds, pickZoom, createTileFeatureFetcher, createLayerRenderer, clipAndRewindPolygons } from "./vectorTiles";

/**
 * Fetches hillshade relief for macro mode directly from a separate PMTiles archive (a
 * VersaTiles "hillshade-vectors" export — polygons pre-classified into shading bands, not
 * raw elevation) — same principle as roads.ts/water.ts, polygons clipped per-tile rather
 * than stitched (see `clipAndRewindPolygons` in vectorTiles.ts for why).
 *
 * One color picker drives both shades: the user's color is the shadow (`shade === "dark"`),
 * and the highlight (`shade === "light"`) is derived from it via `lightenColor`, rather than
 * exposing a second picker. Shadows are drawn on top of highlights so they win where ridges
 * overlap, matching the reference example's own layering.
 *
 * The source DEM shades the sea floor too, so polygons whose centroid falls off any land
 * mass are dropped in `getMacroMountains()`, against the same land polygon macro mode's own
 * land layer already loads (see `geometriesState.land` in geometry-data.ts) — cheaper than
 * fetching/maintaining a separate ocean mask dataset.
 */

const HILLSHADE_PMTILES_URL = "https://tiles.mapello.net/hillshade.pmtiles";

// How far toward white the derived highlight shade is blended from the user's (shadow) color.
const HIGHLIGHT_LIGHTEN_RATIO = 0.55;

// Adaptive, but deliberately coarser than roads/water: compute the zoom the current
// viewport would naturally get — the same "highest zoom whose tile cover still fits the
// shared budget" pickZoom() uses for roads/water — then back off a fixed number of levels.
// So zooming into a small area still increases mountains' detail like the other layers, but
// it always stays this many levels simpler in absolute terms, never matching their detail.
const NATURAL_MAX_ZOOM = 8; // hillshade archive's own ceiling
const ZOOM_OFFSET = 2;
const ZOOM_FLOOR = 0;

function pickMountainZoom(bounds: BBox): number {
    const naturalZoom = pickZoom(bounds, NATURAL_MAX_ZOOM);
    return Math.max(ZOOM_FLOOR, naturalZoom - ZOOM_OFFSET);
}

function extractMountainFeatures(tile: VectorTile, x: number, y: number, z: number): RenderedFeature[] {
    const layer = tile.layers['hillshade-vectors'];
    if (!layer) return [];

    const features: RenderedFeature[] = [];
    for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        if (feat.type !== 3 /* Polygon */) continue;
        const shade = feat.properties.shade;
        if (shade !== "dark" && shade !== "light") continue;

        // toGeoJSON() already copies the source `shade` property onto the output feature —
        // clipAndRewindPolygons carries `properties` through untouched, so the render step
        // below can read it back to split light vs dark. No RenderedFeature field for it,
        // so it's read back via GeoJsonProperties' index signature rather than typed here.
        const geojson = feat.toGeoJSON(x, y, z) as Feature<Polygon>;
        const rendered = geojson as unknown as RenderedFeature;
        rendered.properties.x = x;
        rendered.properties.y = y;
        rendered.properties.sourceLayer = "hillshade-vectors";
        features.push(rendered);
    }
    return features;
}

const fetchMountainTiles = createTileFeatureFetcher(HILLSHADE_PMTILES_URL, extractMountainFeatures);

/**
 * Fetches and decodes hillshade polygons (both light and dark shade bands) covering the
 * current macro viewport, clipped to tile boundaries (no cross-tile merging — see
 * `clipAndRewindPolygons`). Returns plain lon/lat Polygon features with d3-compatible ring
 * winding and their original `shade` property intact, and degrades to an empty array (never
 * throws) on tile fetch/decode failure.
 */
export async function getMacroMountains(): Promise<Feature<Polygon>[]> {
    try {
        const bounds = getMacroBounds();
        const zoom = pickMountainZoom(bounds);
        const tileCoords = getCoveringTiles(bboxPolygon(bounds).geometry, { min_zoom: zoom, max_zoom: zoom }) as [number, number, number][];
        if (tileCoords.length === 0) return [];

        const rawFeatures = await fetchMountainTiles(tileCoords);
        const polygons = clipAndRewindPolygons(rawFeatures, zoom);

        // The DEM this hillshade is derived from shades the sea floor too — drop anything
        // whose centroid isn't on land. Reuses the same land mask macro mode's own land
        // layer already loads, rather than fetching/maintaining a separate ocean dataset.
        return polygons.filter((feature) => {
            const centroid = center(feature);
            return geometriesState.land.features.some((land) => booleanPointInPolygon(centroid, land));
        });
    } catch (err) {
        console.warn("getMacroMountains: failed to build mountains layer, exporting without it", err);
        return [];
    }
}

/**
 * Draws (or clears) the mountains layer into the `<g id="mountains-layer">` placeholder
 * created once by `ensureLayerGroup` in `drawMacroBase` (see that call site for why its
 * position is fixed regardless of async timing).
 */
export const updateMacroMountains = createLayerRenderer<Feature<Polygon>>({
    isEnabled: () => macroState.inlinePropsMacro.showMountains,
    fetchFeatures: getMacroMountains,
    render: (group, mountainFeatures) => {
        if (!appState.projection) return;
        // Fills tolerate less precision than strokes; keep the path data modest.
        const mountainPath = geoPath(appState.projection).digits(1);
        const darkColor = macroState.macroParams.Background.mountainColor;
        const lightColor = lightenColor(darkColor, HIGHLIGHT_LIGHTEN_RATIO);

        // Highlights first, shadows on top — shadows should win where the two overlap
        // along a ridge (matches the reference example's own layering).
        const bands: [string, string][] = [
            ["light", lightColor],
            ["dark", darkColor],
        ];
        for (const [shade, fill] of bands) {
            const d = mountainFeatures
                .filter((feature) => feature.properties?.shade === shade)
                .map((feature) => mountainPath(feature))
                .filter(Boolean)
                .join(' ');
            if (!d) continue;

            const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElem.setAttribute('d', d);
            // Alpha channel lives in the color itself (same pattern as seaColor's 8-digit
            // hex) — no separate opacity control needed for the translucent shading look.
            pathElem.setAttribute('fill', fill);
            // Default fill-rule (nonzero) is correct given clipAndRewindPolygons() above —
            // evenodd would punch visible holes wherever two adjacent tile pieces legitimately overlap.
            pathElem.setAttribute('clip-path', 'url(#clipMapBorder)');
            group.appendChild(pathElem);
        }
    },
});
