import bbox from "@turf/bbox";
import type { VectorTile } from "@mapbox/vector-tile";
import type { BBox, Feature, LineString } from "geojson";
import { macroState, appState } from "src/state.svelte";
import { explodeGeometry, stitchTileLines, type RenderedFeature } from "src/util/geometryStitch";
import { geoPath } from "d3-geo";
import { getMacroTileCoords, createTileFeatureFetcher, createLayerRenderer, PMTILES_URL } from "./vectorTiles";

/**
 * Fetches the major road network for macro mode directly from the PMTiles vector tile
 * archive shared with micro mode — no `maplibregl.Map` instance is ever created.
 * `pmtiles.getZxy()` returns raw MVT bytes, which are decoded straight to lon/lat GeoJSON
 * via `@mapbox/vector-tile`, so the result can be fed through whichever D3 projection
 * macro mode currently uses (all of them, unlike a MapLibre camera sync which would only
 * ever work for plain mercator).
 */

// Capped low on purpose: lower-zoom tiles carry pre-simplified road geometry, which keeps
// the exported network visually simple instead of tracing every minor bend.
const MAX_ZOOM = 5;

function extractRoadFeatures(tile: VectorTile, x: number, y: number, z: number): RenderedFeature[] {
    const layer = tile.layers.roads;
    if (!layer) return [];

    const features: RenderedFeature[] = [];
    for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        if (feat.type !== 2 /* LineString */) continue;
        const props = feat.properties;
        if (props.kind !== "highway") continue;
        if ("is_tunnel" in props) continue;
        if (props.kind_detail === "pier") continue;

        const geojson = feat.toGeoJSON(x, y, z) as Feature<LineString>;
        const rendered = geojson as unknown as RenderedFeature;
        rendered.properties.x = x;
        rendered.properties.y = y;
        rendered.properties.sourceLayer = "roads";
        // Protomaps has no class/subclass (OpenMapTiles-era fields the default
        // getComputedId() expects), so we assign the stitch grouping key ourselves.
        rendered.properties.computedId = "roads-highway";
        // boundingBox is intentionally not set here: most Protomaps road features
        // decode as MultiLineString, and explodeGeometry() below builds fresh
        // per-part feature objects that don't carry it over. Set it after exploding.
        features.push(rendered);
    }
    return features;
}

const fetchRoadTiles = createTileFeatureFetcher(PMTILES_URL, extractRoadFeatures);

/**
 * Fetches, decodes and stitches the highway network covering the current macro viewport.
 * Returns plain lon/lat LineString features — never touches a MapLibre map instance, and
 * degrades to an empty array (never throws) on tile fetch/decode failure.
 */
export async function getMacroRoads(): Promise<Feature<LineString>[]> {
    try {
        const { tileCoords } = getMacroTileCoords(MAX_ZOOM);
        if (tileCoords.length === 0) return [];

        const exploded = explodeGeometry(await fetchRoadTiles(tileCoords), "LineString") as RenderedFeature[];
        if (exploded.length === 0) return [];
        exploded.forEach((f) => { f.boundingBox = bbox(f) as BBox; });

        const stitched = await stitchTileLines(exploded, tileCoords);
        if (!stitched) return [];

        return stitched
            .filter((f): f is RenderedFeature<LineString> => f.geometry?.type === "LineString")
            .map((f) => ({ type: "Feature", geometry: f.geometry, properties: f.properties }) as Feature<LineString>);
    } catch (err) {
        console.warn("getMacroRoads: failed to build road network, exporting without roads", err);
        return [];
    }
}

/**
 * Draws (or clears) the road network into the `<g id="roads-layer">` placeholder created
 * once by `ensureLayerGroup` in `drawMacroBase` (see that call site for why its position is
 * fixed regardless of async timing).
 */
export const updateMacroRoads = createLayerRenderer<Feature<LineString>>({
    isEnabled: () => macroState.inlinePropsMacro.showRoads,
    fetchFeatures: getMacroRoads,
    render: (group, roadFeatures) => {
        if (!appState.projection) return;
        const roadPath = geoPath(appState.projection).digits(2);
        const d = roadFeatures.map((feature) => roadPath(feature)).filter(Boolean).join(' ');
        if (!d) return;

        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', d);
        pathElem.setAttribute('fill', 'none');
        pathElem.setAttribute('stroke', macroState.macroParams.Background.roadColor);
        pathElem.setAttribute('stroke-width', '0.75');
        pathElem.setAttribute('stroke-linejoin', 'round');
        pathElem.setAttribute('stroke-linecap', 'round');
        // Clip to the (possibly rounded/globe-shaped) map frame: the D3 projection's own
        // postclip only guarantees a rectangular bound, which can spill past a rounded corner.
        pathElem.setAttribute('clip-path', 'url(#clipMapBorder)');
        group.appendChild(pathElem);
    },
});
