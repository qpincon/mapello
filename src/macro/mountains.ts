import type { VectorTile } from "@mapbox/vector-tile";
import type { BBox, Feature, Polygon } from "geojson";
import center from "@turf/center";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { env } from "$env/dynamic/public";
import { macroState, appState } from "src/state.svelte";
import { type RenderedFeature } from "src/util/geometryStitch";
import { geoPath } from "d3-geo";
import { lightenColor, withOpacity } from "src/util/colorMath";
import { geometriesState } from "./geometry-data";
import { getMacroBounds, pickZoom, coveringTilesForBounds, createTileFeatureFetcher, createLayerRenderer, clipAndRewindPolygons } from "./vectorTiles";

/**
 * Fetches hillshade relief for macro mode from Mapbox's Terrain v2 vector tileset —
 * same principle as roads.ts/water.ts, polygons clipped per-tile rather than stitched (see
 * `clipAndRewindPolygons` in vectorTiles.ts for why), but fetched via a plain HTTP request
 * instead of a PMTiles archive (Mapbox's v4 Tile API — CORS-enabled, gzip handled
 * transparently by `fetch()`, no range-request/decompression plumbing needed).
 *
 * The tileset's `hillshade` layer classifies each polygon into one of 6 intensity bands —
 * `class` ("highlight"/"shadow") × `level` (56/67/78/89 for shadow, 90/94 for highlight).
 * One color picker still drives everything: the user's color is the shadow base (darkest
 * band), the highlight base is derived from it via `lightenColor`, and each of the 6 levels
 * gets its own opacity fraction of its class's base color via `withOpacity` — a smoother
 * graduated relief than a flat 2-tone. Shadows are drawn on top of highlights, low-to-high
 * intensity within each class, so the most intense band wins where they overlap (matches
 * the reference example's own layering).
 *
 * The source DEM shades the sea floor too, so polygons whose centroid falls off any land
 * mass are dropped in `getMacroMountains()`, against the same land polygon macro mode's own
 * land layer already loads (see `geometriesState.land` in geometry-data.ts) — cheaper than
 * fetching/maintaining a separate ocean mask dataset.
 */

const MAPBOX_TILESET = "mapbox.mapbox-terrain-v2";

// How far toward white the derived highlight base is blended from the user's (shadow)
// color. High on purpose: a style the user liked uses near-white highlights regardless of
// its (muted grey) shadow color, so this leans hard toward white rather than a modest tint.
const HIGHLIGHT_LIGHTEN_RATIO = 0.85;

// Opacity fraction of its class's base color for each of the 6 hillshade levels, applied on
// top of whatever alpha the user's own color already has (via withOpacity). Drawn in this
// order — highlight bands first (below), shadow bands last (on top), ascending within each
// class — so the most intense band wins where two overlap.
const LEVEL_OPACITY: [level: number, opacity: number][] = [
    [90, 0.50], [94, 0.90],           // highlight
    [56, 0.25], [67, 0.45], [78, 0.65], [89, 0.85], // shadow
];
const HIGHLIGHT_LEVELS = new Set([90, 94]);

// Adaptive, but deliberately coarser than roads/water: compute the zoom the current
// viewport would naturally get — the same "highest zoom whose tile cover still fits the
// shared budget" pickZoom() uses for roads/water — then back off a fixed number of levels.
// So zooming into a small area still increases mountains' detail like the other layers, but
// it always stays this many levels simpler in absolute terms, never matching their detail.
const NATURAL_MAX_ZOOM = 8;
const ZOOM_OFFSET = 2;
const ZOOM_FLOOR = 0;

function pickMountainZoom(bounds: BBox): number {
    const naturalZoom = pickZoom(bounds, NATURAL_MAX_ZOOM);
    return Math.max(ZOOM_FLOOR, naturalZoom - ZOOM_OFFSET);
}

async function fetchMapboxTileBytes(x: number, y: number, z: number): Promise<ArrayBuffer | undefined> {
    const url = `https://api.mapbox.com/v4/${MAPBOX_TILESET}/${z}/${x}/${y}.mvt?access_token=${env.PUBLIC_MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return res.arrayBuffer();
}

function extractMountainFeatures(tile: VectorTile, x: number, y: number, z: number): RenderedFeature[] {
    const layer = tile.layers.hillshade;
    if (!layer) return [];

    const features: RenderedFeature[] = [];
    for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        if (feat.type !== 3 /* Polygon */) continue;

        // toGeoJSON() already copies the source `class`/`level` properties onto the output
        // feature — clipAndRewindPolygons carries `properties` through untouched, so the
        // render step below can read them back to pick each band's fill. No RenderedFeature
        // field for either, so they're read back via GeoJsonProperties' index signature
        // rather than typed here.
        const geojson = feat.toGeoJSON(x, y, z) as Feature<Polygon>;
        const rendered = geojson as unknown as RenderedFeature;
        rendered.properties.x = x;
        rendered.properties.y = y;
        rendered.properties.sourceLayer = "hillshade";
        features.push(rendered);
    }
    return features;
}

const fetchMountainTiles = createTileFeatureFetcher(fetchMapboxTileBytes, extractMountainFeatures);

/**
 * Fetches and decodes hillshade polygons (all 6 intensity bands) covering the current
 * macro viewport, clipped to tile boundaries (no cross-tile merging — see
 * `clipAndRewindPolygons`). Returns plain lon/lat Polygon features with d3-compatible ring
 * winding and their original `class`/`level` properties intact, and degrades to an empty
 * array (never throws) on tile fetch/decode failure.
 */
export async function getMacroMountains(): Promise<Feature<Polygon>[]> {
    try {
        const bounds = getMacroBounds();
        const zoom = pickMountainZoom(bounds);
        const tileCoords = coveringTilesForBounds(bounds, zoom);
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

        // Defensive: hillshade facets are small relief texture, never anywhere near the
        // whole frame. A rare bboxClip ring-ordering edge case (more likely to surface in
        // Mapbox's thousands-of-tiny-facets data than water's handful of simple lake shapes)
        // can leave one polygon mis-wound, which renders as "everything except that shape"
        // instead of the shape itself — i.e. it fills the entire map. Drop anything whose
        // projected area is implausibly large before it ever reaches the `d` string, rather
        // than trying to prove no clip result can ever produce a bad ring order.
        const { width, height } = macroState.macroParams.General;
        const maxSaneArea = width * height * 0.5;

        for (const [level, opacity] of LEVEL_OPACITY) {
            const baseColor = HIGHLIGHT_LEVELS.has(level) ? lightColor : darkColor;
            const fill = withOpacity(baseColor, opacity);

            const d = mountainFeatures
                .filter((feature) => feature.properties?.level === level)
                .filter((feature) => mountainPath.area(feature) < maxSaneArea)
                .map((feature) => mountainPath(feature))
                .filter(Boolean)
                .join(' ');
            if (!d) continue;

            const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElem.setAttribute('d', d);
            pathElem.setAttribute('fill', fill);
            // Default fill-rule (nonzero) is correct given clipAndRewindPolygons() above —
            // evenodd would punch visible holes wherever two adjacent tile pieces legitimately overlap.
            pathElem.setAttribute('clip-path', 'url(#clipMapBorder)');
            group.appendChild(pathElem);
        }
    },
});
