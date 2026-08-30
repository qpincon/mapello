import { PMTiles } from "pmtiles";
import { PbfReader } from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { tiles as getCoveringTiles } from "@mapbox/tile-cover";
import bboxPolygon from "@turf/bbox-polygon";
import bboxClip from "@turf/bbox-clip";
import type { BBox, Feature, Polygon } from "geojson";
import { appState, macroState } from "src/state.svelte";
import { getGeographicalBounds, rewindForD3 } from "src/util/projections";
import { explodeGeometry, getTileBounds, type RenderedFeature } from "src/util/geometryStitch";
import mapStyle from "src/micro/components/mapstyle.json";

/**
 * Shared plumbing for fetching macro-mode vector tile layers (roads, water, mountains, …)
 * — no `maplibregl.Map` instance involved. Layers can come from different sources: roads/
 * water read the world PMTiles archive (via `pmtilesFetcher`, keyed by URL so multiple
 * archives can coexist), mountains reads a plain HTTP vector tile API directly (Mapbox) —
 * `createTileFeatureFetcher` only cares that its `fetchTileBytes` callback returns raw MVT
 * bytes, not where from. Each layer module (roads.ts, water.ts, mountains.ts) only supplies
 * what's actually specific to it: how to fetch its tile bytes and which source-layer to
 * read from them (`createTileFeatureFetcher`), its own zoom cap, and how to turn its
 * fetched features into geometry ready for `geoPath` (stitching for lines, clipping for
 * polygons — genuinely different per layer, not worth abstracting further) and how to style
 * the resulting `<path>` (`createLayerRenderer`).
 */

export const MIN_ZOOM = 3;
export const MAX_TILES = 64;
export const MAX_CONCURRENT_FETCHES = 8;

export const PMTILES_URL = (mapStyle as { sources: { protomaps: { url: string } } }).sources.protomaps.url.replace(/^pmtiles:\/\//, "");

const pmtilesInstances = new Map<string, PMTiles>();
export function getPmtiles(url: string): PMTiles {
    let instance = pmtilesInstances.get(url);
    if (!instance) {
        instance = new PMTiles(url);
        pmtilesInstances.set(url, instance);
    }
    return instance;
}

/**
 * Geographic bounds of the current macro viewport, in [minLng, minLat, maxLng, maxLat].
 * `minLng` can come back greater than `maxLng` — that's not an error, it's how
 * `getGeographicalBounds` signals a viewport whose visible longitude range genuinely wraps
 * the antimeridian (common for a wide satellite view, even one centered nowhere near ±180 —
 * see `longitudeBoundsFromSamples` in projections.ts). Every consumer of this bbox must go
 * through `coveringTilesForBounds`, which knows how to split a wrapped bbox in two, rather
 * than feeding it straight to `bboxPolygon`.
 */
export function getMacroBounds(): BBox {
    const { projection } = appState;
    const { width, height } = macroState.macroParams.General;
    if (!projection) return [-180, -85, 180, 85];

    const bounds = getGeographicalBounds(projection, width, height);
    if (!bounds) return [-180, -85, 180, 85];

    const [[minLng, rawMinLat], [maxLng, rawMaxLat]] = bounds;
    const minLat = Math.max(rawMinLat, -85);
    const maxLat = Math.min(rawMaxLat, 85);
    return [minLng, minLat, maxLng, maxLat];
}

/**
 * Tile cover for a bounds box, aware of the antimeridian-wrap convention `getMacroBounds`
 * can now produce: `minLng > maxLng` means the viewport's visible longitude range actually
 * crosses the seam (see `longitudeBoundsFromSamples` in projections.ts for why this can
 * happen well away from lng ±180 for a wide satellite view) — covering `[minLng, 180]` and
 * `[-180, maxLng]` rather than the single (invalid, crossed-over) rectangle a naive
 * `bboxPolygon` would build from those same four numbers.
 */
export function coveringTilesForBounds(bounds: BBox, zoom: number): [number, number, number][] {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    if (minLng <= maxLng) {
        return getCoveringTiles(bboxPolygon(bounds).geometry, { min_zoom: zoom, max_zoom: zoom }) as [number, number, number][];
    }
    const west = getCoveringTiles(bboxPolygon([minLng, minLat, 180, maxLat]).geometry, { min_zoom: zoom, max_zoom: zoom }) as [number, number, number][];
    const east = getCoveringTiles(bboxPolygon([-180, minLat, maxLng, maxLat]).geometry, { min_zoom: zoom, max_zoom: zoom }) as [number, number, number][];
    const seen = new Set<string>();
    const merged: [number, number, number][] = [];
    for (const t of [...west, ...east]) {
        const key = t.join(',');
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(t);
        }
    }
    return merged;
}

function tileCountForZoom(bounds: BBox, zoom: number): number {
    return coveringTilesForBounds(bounds, zoom).length;
}

/**
 * Largest zoom in [minZoom, maxZoom] whose tile cover stays within MAX_TILES. `minZoom`
 * defaults to the shared floor, but a layer wanting a much coarser fetch (e.g. mountains)
 * can pass its own lower one.
 *
 * Note this always tries to climb as high as `maxZoom` allows — with `minZoom === maxZoom`
 * (a fixed, non-adaptive zoom) it just returns that one zoom, verified against the budget;
 * it does NOT fall back to something lower if that single zoom is over budget (matches the
 * existing "never silently truncate coverage" stance). A layer wanting real adaptive
 * behavior should pass a wider [minZoom, maxZoom].
 */
export function pickZoom(bounds: BBox, maxZoom: number, minZoom: number = MIN_ZOOM): number {
    let chosen = minZoom;
    for (let z = minZoom; z <= maxZoom; z++) {
        if (tileCountForZoom(bounds, z) > MAX_TILES) break;
        chosen = z;
    }
    return chosen;
}

/** Bounds → zoom → tile cover, combined (every layer needs exactly this sequence). */
export function getMacroTileCoords(maxZoom: number, minZoom?: number): { zoom: number; tileCoords: [number, number, number][] } {
    const bounds = getMacroBounds();
    const zoom = pickZoom(bounds, maxZoom, minZoom);
    const tileCoords = coveringTilesForBounds(bounds, zoom);
    return { zoom, tileCoords };
}

/**
 * Turns raw per-tile polygon features (as decoded by an `extract` callback — MultiPolygon
 * or Polygon, tagged with `properties.x`/`y`) into d3-ready `Feature<Polygon>[]`: explode
 * MultiPolygon, clip each part to its own tile's exact (unbuffered) bounds, drop anything
 * that clips away to nothing, then rewind for d3's winding convention.
 *
 * Deliberately does NOT reuse the stitchPolygons()/stitch() machinery that merges polygons
 * across tile boundaries for micro mode: that machinery unions matched groups via
 * @turf/union, which normalizes ring winding to GeoJSON/RFC 7946 (CCW exterior) — the
 * OPPOSITE of what d3-geo's spherical polygon clipping expects (CW exterior). Combined with
 * macro projections' spherical preclip (geoClipAntimeridian/geoClipCircle), a flipped ring
 * doesn't render as "the same shape" — it renders as everything EXCEPT that shape, which for
 * a shape spanning a tile boundary (a lake, a mountain range) means filling the entire map
 * in that layer's color. Verified empirically before this was first written (for water).
 *
 * Instead: clip each polygon to its OWN tile's exact (unbuffered) bounds. This preserves
 * winding (bboxClip doesn't touch it) and removes tile-buffer-overlap duplication by
 * construction, without needing any cross-tile merge logic at all.
 */
export function clipAndRewindPolygons(rawFeatures: RenderedFeature[], zoom: number): Feature<Polygon>[] {
    const exploded = explodeGeometry(rawFeatures, "Polygon") as RenderedFeature<Polygon>[];
    if (exploded.length === 0) return [];

    const clipped: RenderedFeature[] = [];
    for (const feature of exploded) {
        if (feature.geometry?.type !== "Polygon") continue;
        const { x, y } = feature.properties;
        if (x == null || y == null) continue;
        const tile = getTileBounds(x, y, zoom);
        const tileBbox: BBox = [tile.tileBounds.west, tile.tileBounds.south, tile.tileBounds.east, tile.tileBounds.north];
        const result = bboxClip(feature, tileBbox) as RenderedFeature;
        if (!result.geometry || (result.geometry as Polygon).coordinates.length === 0) continue;
        clipped.push(result);
    }
    if (clipped.length === 0) return [];

    // bboxClip on a Polygon can in rare cases produce a MultiPolygon (a concave shape split
    // by the clip rect) — normalize back to single Polygons.
    const finalPolygons = explodeGeometry(clipped, "Polygon") as RenderedFeature<Polygon>[];

    const result: Feature<Polygon>[] = [];
    for (const f of finalPolygons) {
        if (f.geometry?.type !== "Polygon") continue;
        const feature = { type: "Feature", geometry: f.geometry, properties: f.properties } as Feature<Polygon>;
        rewindForD3(feature);
        result.push(feature);
    }
    return result;
}

/** Fetches raw (decompressed) MVT bytes for one tile from the world PMTiles archive, or
 *  `undefined` if the tile has no data — the PMTiles-backed counterpart to a plain HTTP
 *  tile fetcher, so both can be passed to `createTileFeatureFetcher` interchangeably. */
export function pmtilesFetcher(pmtilesUrl: string): (x: number, y: number, z: number) => Promise<ArrayBuffer | undefined> {
    return async (x, y, z) => (await getPmtiles(pmtilesUrl).getZxy(z, x, y))?.data;
}

/**
 * Builds a cached, concurrency-limited tile-feature fetcher for one vector tile layer.
 * `fetchTileBytes` supplies the raw MVT bytes for a z/x/y (from a PMTiles archive via
 * `pmtilesFetcher`, or a plain HTTP vector tile API — anything that returns an
 * `ArrayBuffer | undefined`); `extract` reads whichever `tile.layers.<name>` it cares about
 * and returns whatever feature shape its caller wants (already filtered/tagged) — this
 * stays generic over that shape so roads/water/mountains can each get their own fetcher,
 * against their own source, with their own private per-tile cache, without duplicating the
 * fetch/decode/concurrency plumbing.
 */
export function createTileFeatureFetcher<T>(
    fetchTileBytes: (x: number, y: number, z: number) => Promise<ArrayBuffer | undefined>,
    extract: (tile: VectorTile, x: number, y: number, z: number) => T[],
): (tileCoords: [number, number, number][]) => Promise<T[]> {
    const tileCache = new Map<string, T[]>();

    async function fetchTile(x: number, y: number, z: number): Promise<T[]> {
        const key = `${z}/${x}/${y}`;
        const cached = tileCache.get(key);
        if (cached) return cached;

        let features: T[] = [];
        try {
            const data = await fetchTileBytes(x, y, z);
            if (data) features = extract(new VectorTile(new PbfReader(data)), x, y, z);
        } catch (err) {
            console.warn(`createTileFeatureFetcher: failed to fetch/decode tile ${key}`, err);
        }
        tileCache.set(key, features);
        return features;
    }

    return async function fetchTilesLimited(tileCoords) {
        const results: T[] = [];
        let next = 0;
        async function worker() {
            while (next < tileCoords.length) {
                const [x, y, z] = tileCoords[next++];
                results.push(...(await fetchTile(x, y, z)));
            }
        }
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_FETCHES, tileCoords.length) }, worker));
        return results;
    };
}

/**
 * Builds a fire-and-forget "draw this layer into its group" updater, shared by
 * `updateMacroRoads`/`updateMacroWater`. Handles the async race that a naive
 * "only-the-latest-started-request-wins" guard gets wrong: if a slow first fetch (e.g. a
 * cold, uncached one — exactly what happens right after a user enables the layer) is still
 * in flight when a second, unrelated redraw starts a newer fetch, the first fetch must NOT
 * be discarded just because it's no longer the newest — only if a *newer result has already
 * rendered* should an older, late-arriving one be dropped. Otherwise the layer can end up
 * requiring an unrelated extra redraw (e.g. a drag) before anything ever appears, since every
 * "first attempt" keeps losing a race it was never actually behind in.
 */
export function createLayerRenderer<F>(opts: {
    isEnabled: () => boolean;
    fetchFeatures: () => Promise<F[]>;
    render: (group: SVGGElement, features: F[]) => void;
}): (group: SVGGElement) => void {
    let latestRequestId = 0;
    let lastAppliedRequestId = 0;

    return function update(group: SVGGElement) {
        const requestId = ++latestRequestId;

        if (!opts.isEnabled()) {
            group.replaceChildren();
            lastAppliedRequestId = requestId;
            return;
        }

        opts.fetchFeatures().then((features) => {
            if (requestId < lastAppliedRequestId) return; // a newer result already rendered
            lastAppliedRequestId = requestId;
            group.replaceChildren();
            if (features.length > 0) opts.render(group, features);
        }).catch((err) => {
            console.warn('createLayerRenderer: failed to fetch/render layer', err);
        });
    };
}
