import { extractFileName, getNumericCols, indexBy, sortBy } from "src/util/common";
import iso3Data from "../assets/data/iso3_filtered.json";
import disputedData from "../assets/data/disputed_territories.json";
import { appState, commonState, macroState } from "src/state.svelte";
import { presimplify, simplify } from "topojson-simplify";
import * as topojson from "topojson-client";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { splitMultiPolygons } from "src/util/geojson";
import { defaultColorDef, defaultLegendDef, defaultTooltipContent, defaultTooltipFull } from "src/stateDefaults";
import type { ZoneDataRow } from "src/types";
import { featureCollection, polygon } from "@turf/helpers";

const iso3DataById = indexBy([...iso3Data, ...disputedData], "alpha-3");
const GEO_META_KEYS = ["shapeID", "shapeId", "shapeGroup", "shapeType"];
export const resolvedAdmGeometry: Record<string, any> = {};
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

export async function updateLayerSimplification(): Promise<void> {
    if (!adm0Topo) await initWorldData();
    console.log('macroState.visibleArea=', macroState.visibleArea);
    updateAdm0LandAndCountriesSimplification();
    Object.keys(resolvedAdmTopo).forEach((countryAdm) => {
        const simplified = simplify(resolvedAdmTopo[countryAdm], macroState.visibleArea);
        const firstKey = Object.keys(simplified.objects)[0];
        resolvedAdmGeometry[countryAdm] = topojson.feature(simplified, simplified.objects[firstKey]);
    });
}

function updateAdm0LandAndCountriesSimplification(): void {
    if (!adm0Topo) return;
    const simplified = simplify(adm0Topo, macroState.visibleArea);
    const firstKey = Object.keys(simplified.objects)[0];
    geometriesState.countries = topojson.feature(simplified, simplified.objects[firstKey]) as FeatureCollection<
        Polygon,
        { name: string }
    >;
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
    console.log("initWorldData");
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
    for (const countryAdm of macroState.chosenCountriesAdm) {
        if (!(countryAdm in resolvedAdmGeometry)) {
            const resolved = await resolveAdm(countryAdm);
            resolvedAdmTopo[countryAdm] = presimplify(resolved);
            updateLayerSimplification();
        }
        if (!(countryAdm in macroState.tooltipDefs)) {
            const contentTemplate = defaultTooltipContent(false);
            macroState.tooltipDefs[countryAdm] = {
                template: contentTemplate,
                content: defaultTooltipFull(contentTemplate),
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