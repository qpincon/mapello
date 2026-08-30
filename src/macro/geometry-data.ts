import { extractFileName, getNumericCols, indexBy, sortBy } from "src/util/common";
import { log } from 'src/util/log';
import iso3Data from "../assets/data/iso3_filtered.json";
import disputedData from "../assets/data/disputed_territories.json";
import { appState, commonState, macroState } from "src/state.svelte";
import { presimplify, simplify } from "topojson-simplify";
import * as topojson from "topojson-client";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { splitMultiPolygons } from "src/util/geojson";
import { defaultColorDef, defaultLegendDef, defaultTooltipContent, defaultTooltipStyle } from "src/stateDefaults";
import type { ZoneDataRow } from "src/types";
import { featureCollection, polygon } from "@turf/helpers";

const iso3DataById = indexBy([...iso3Data, ...disputedData], "alpha-3");
export const GEO_META_KEYS = ["shapeID", "shapeId", "shapeGroup", "shapeType", "alpha-2"];
export const resolvedAdmGeometry: Record<string, any> = {};
// A country's own ADM0 outline, embedded in its ADM1/ADM2 file and presimplified together
// with its regions (see scripts/getAndSimplifyWorld.ts) so it always nests exactly with
// `resolvedAdmGeometry[countryAdm]`. Undefined for disputed-territory (numeric-ID) layers,
// which have no ADM0 counterpart.
export const resolvedAdmCountryOutline: Record<string, Feature<Polygon> | undefined> = {};
const resolvedAdmTopo: Record<string, any> = {};
let adm0Topo: any = null;

interface GeometryState {
    simpleLand: Feature;
    land: FeatureCollection<Polygon>;
    countries: FeatureCollection<Polygon, { name: string }>;
}
export const geometriesState: GeometryState = {
    simpleLand: polygon([]),
    land: featureCollection([polygon([])]),
    countries: featureCollection([polygon([])]),
}

export const availableCountriesAdm1 = import.meta.glob("../assets/layers/adm1/*.json", { import: "default" });
Object.keys(availableCountriesAdm1).forEach((adm1FileName) => {
    const name = extractFileName(adm1FileName);
    const resolvedName = iso3DataById[name]?.name;
    const finalName = resolvedName ? `${resolvedName} ADM1` : name;
    availableCountriesAdm1[finalName] = availableCountriesAdm1[adm1FileName];
    delete availableCountriesAdm1[adm1FileName];
});

export const availableCountriesAdm2 = import.meta.glob("../assets/layers/adm2/*.json", { import: "default" });
Object.keys(availableCountriesAdm2).forEach((adm2FileName) => {
    const name = extractFileName(adm2FileName);
    const resolvedName = iso3DataById[name]?.name;
    const finalName = resolvedName ? `${resolvedName} ADM2` : name;
    availableCountriesAdm2[finalName] = availableCountriesAdm2[adm2FileName];
    delete availableCountriesAdm2[adm2FileName];
});

export const allAvailableAdm: string[] = [
    ...Object.keys(availableCountriesAdm1),
    ...Object.keys(availableCountriesAdm2),
].sort();


function resolveAdm(name: string): Promise<any> {
    if (name.includes("ADM1")) return availableCountriesAdm1[name]();
    return availableCountriesAdm2[name]();
}

// --- Rendering sanity net ----------------------------------------------------------------
// `topojson-simplify`'s point removal occasionally leaves behind a ring whose remaining
// points form a self-intersecting/inverted-winding polygon, which browsers rasterize as
// covering the *entire* map instead of the small region it should be. Found on real data —
// both freshly-built and the previously-shipped layer files — for several countries (e.g.
// Russia, Japan, Bangladesh at ADM2). Every exterior ring in this dataset is consistently
// wound the same way (holes are the opposite, as GeoJSON requires) — a `simplify()` result
// containing exterior rings of both orientations is exactly this failure, and is reliable
// regardless of country size (an extent/bounding-box comparison isn't: for a country whose
// legitimate full-detail render already spans most of the projection, e.g. Russia, a broken
// ring's blown-up extent doesn't stand out against its own already-huge baseline).
function ringSignedArea(ring: number[][]): number {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return sum;
}

function hasInconsistentWinding(fc: any): boolean {
    let sawPositive = false;
    let sawNegative = false;
    for (const feature of fc.features ?? [fc]) {
        const geom = feature.geometry;
        if (!geom) continue;
        const polygons: number[][][][] = geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
        for (const polygon of polygons) {
            const sign = ringSignedArea(polygon[0]);
            if (sign > 0) sawPositive = true;
            else if (sign < 0) sawNegative = true;
            if (sawPositive && sawNegative) return true;
        }
    }
    return false;
}

/** Simplify `topo`'s `objectName` at `va`, falling back to full detail if the result has an
 *  inconsistently-wound ring (see note above). Full detail is never subject to this — there
 *  are no more points left to remove. */
function simplifyWithSanityCheck(topo: any, objectName: string, va: number): any {
    const simplified = simplify(topo, va);
    if (va === 0) return simplified;
    const feature = topojson.feature(simplified, simplified.objects[objectName]);
    return hasInconsistentWinding(feature) ? simplify(topo, 0) : simplified;
}

/** Total point count across every ring of every feature — a proxy for how "detailed" a
 *  rendered layer is, used only for the debug simplification logs below. */
function countVertices(fc: any): number {
    let total = 0;
    for (const feature of fc.features ?? [fc]) {
        const geom = feature.geometry;
        if (!geom) continue;
        const polygons = geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
        for (const polygon of polygons) for (const ring of polygon) total += ring.length;
    }
    return total;
}

/** Counting vertices is a real O(n) pass over every ring — only pay for it when the debug
 *  log it feeds is actually going to print (mirrors the gate inside `log()` itself). */
function logSimplification(label: string, fullDetailFeature: any, simplifiedFeature: any): void {
    if (typeof window === "undefined" || !(window as any).__DEBUG__) return;
    const full = countVertices(fullDetailFeature);
    const current = countVertices(simplifiedFeature);
    const pct = full > 0 ? Math.round((current / full) * 100) : 100;
    log(`[simplify] ${label}: ${current}/${full} vertices (${pct}%) at visibleArea=${macroState.visibleArea}`);
}

export async function updateLayerSimplification(): Promise<void> {
    if (!adm0Topo) await initWorldData();
    log('macroState.visibleArea=', macroState.visibleArea);
    updateAdm0LandAndCountriesSimplification();
    Object.keys(resolvedAdmTopo).forEach((countryAdm) => {
        const level = countryAdm.includes("ADM1") ? "adm1" : "adm2";
        const simplified = simplifyWithSanityCheck(resolvedAdmTopo[countryAdm], level, macroState.visibleArea);
        const geometry = topojson.feature(simplified, simplified.objects[level]);
        resolvedAdmGeometry[countryAdm] = geometry;
        // The embedded ADM0 outline is only ever used as a glow-mask / fill substitute (see
        // drawing.ts), never as a detailed data layer, so it doesn't need to track zoom level —
        // always pull it at full (threshold-0) detail rather than `macroState.visibleArea`.
        // Full detail is never subject to the sanity issue above (there's nothing left to
        // remove), and the outline's own vertex count is small (it's a country boundary, not
        // its regions), so this has no meaningful performance cost.
        const fullDetail = simplify(resolvedAdmTopo[countryAdm], 0);
        resolvedAdmCountryOutline[countryAdm] = fullDetail.objects.adm0
            ? (topojson.feature(fullDetail, fullDetail.objects.adm0) as FeatureCollection<Polygon>).features[0]
            : undefined;
        logSimplification(countryAdm, topojson.feature(fullDetail, fullDetail.objects[level]), geometry);
    });
}

function updateAdm0LandAndCountriesSimplification(): void {
    if (!adm0Topo) return;
    const firstKey = Object.keys(adm0Topo.objects)[0];
    const simplified = simplifyWithSanityCheck(adm0Topo, firstKey, macroState.visibleArea);
    geometriesState.countries = topojson.feature(simplified, simplified.objects[firstKey]) as unknown as FeatureCollection<
        Polygon,
        { name: string }
    >;
    if (typeof window !== "undefined" && (window as any).__DEBUG__) {
        const fullDetail = simplify(adm0Topo, 0);
        logSimplification("world countries", topojson.feature(fullDetail, fullDetail.objects[firstKey]), geometriesState.countries);
    }
    geometriesState.countries.features.forEach((feat: any) => {
        const propertiesFromIso = iso3DataById[feat.properties["shapeGroup"]];
        feat.properties = propertiesFromIso || feat.properties;
    });
    // @ts-expect-error
    geometriesState.land = topojson.merge(simplified, simplified.objects[firstKey].geometries);
    geometriesState.land = splitMultiPolygons(
        {
            type: "FeatureCollection",
            // @ts-expect-error
            features: [{ type: "Feature", geometry: { ...geometriesState.land } }],
        },
        "land",
    );
}

export async function initWorldData() {
    log("initWorldData");
    const topoAdm0 = await import("../assets/layers/world_adm0_simplified_topo.json");
    adm0Topo = presimplify(topoAdm0 as unknown as TopoJSON.Topology<{}>);
    const verySimpleLandTopo = await import("../assets/layers/world_land_very_simplified_topo.json") as unknown as TopoJSON.Topology;
    const firstKey = Object.keys(verySimpleLandTopo.objects)[0];
    geometriesState.simpleLand = topojson.feature(verySimpleLandTopo, verySimpleLandTopo.objects[firstKey]) as Feature;
    await initializeAdms();
    await updateLayerSimplification();
}

export async function initializeAdms(): Promise<void> {
    if (!adm0Topo) await initWorldData();
    let hasNewAdm = false;
    for (const countryAdm of macroState.chosenCountriesAdm) {
        if (!(countryAdm in resolvedAdmGeometry)) {
            const resolved = await resolveAdm(countryAdm);
            resolvedAdmTopo[countryAdm] = presimplify(resolved);
            hasNewAdm = true;
        }
    }
    // Simplify once for every newly-loaded country, instead of once per country in the loop
    // above (which re-simplified ADM0 plus every already-loaded country each time).
    if (hasNewAdm) await updateLayerSimplification();

    for (const countryAdm of macroState.chosenCountriesAdm) {
        if (!(countryAdm in macroState.tooltipDefs)) {
            const contentTemplate = defaultTooltipContent(false);
            macroState.tooltipDefs[countryAdm] = {
                template: contentTemplate,
                containerStyle: { ...defaultTooltipStyle },
                enabled: false,
                locale: "en-US",
            };
            macroState.colorDataDefs[countryAdm] = { ...defaultColorDef };
            macroState.legendDefs[countryAdm] = JSON.parse(JSON.stringify(defaultLegendDef));
        }
        if (!(countryAdm in macroState.zonesData) && !macroState.zonesData?.[countryAdm]?.provided) {
            const data: ZoneDataRow[] = sortBy(
                resolvedAdmGeometry[countryAdm].features.map((f: Feature) => {
                    const props = { ...f.properties };
                    GEO_META_KEYS.forEach((k) => delete props[k]);
                    return props;
                }),
                "name",
            )!;
            macroState.zonesData[countryAdm] = {
                data: data,
                provided: false,
                numericCols: getNumericCols(data),
            };
        }
    }
}