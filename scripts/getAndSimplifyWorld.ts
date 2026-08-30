import fs from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mapshaper from 'mapshaper';
import * as topojson from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { geoMercator, geoPath } from 'd3-geo';

// run: bun run getAndSimplifyWorld.ts
const assetsPath = '/home/quentin/Tests/mapello/src/assets/layers';
const stagingPath = `${assetsPath}.next`;
const scratchDir = '/tmp/mapello-world-build';

// Absolute ground resolution (metres) used for the single, shared static simplification
// pass across ADM0/ADM1/ADM2. Using one absolute distance (instead of the old mismatched
// "3.5%" for ADM1 / "2%" for ADM2) is what lets ADM1 and ADM2 share arcs and lose exactly
// the same vertices. Tune visually; smaller = more detail = bigger per-country files.
// (200m was tried first and measured ~11x more vertices than the old ADM1 for a complex
// coastline like Norway — far more than useful even at ADM2 zoom — hence 500m here.)
const SIMPLIFY_INTERVAL_M = 500;
// Extra percentage-based simplification applied only when exporting the *global*
// world_adm0_simplified_topo.json (every country's outline in one always-loaded file). It
// does not touch the per-country ADM1/ADM2 files or their embedded ADM0 copies — those keep
// the shared SIMPLIFY_INTERVAL_M detail so a drilled-into country's outline still nests
// exactly with its own regions (see geometry-data.ts / drawing.ts). 60% retention lands this
// file's raw size close to the original (pre-rewrite) file's ~2.9MB, while still compressing
// better over the wire thanks to EXPORT_PRECISION_DEG below (the original had no precision
// rounding at all). An absolute interval alone couldn't hit a comparable size here (measured:
// even 8000m barely beat the old file) — percentage-based simplification degrades more
// gracefully across 195 countries of wildly different coastline complexity.
const WORLD_ADM0_EXPORT_SIMPLIFY_PCT = '60%';
// Coordinate precision in degrees (~11m at the equator) for the exported TopoJSON. Far
// coarser than the previous `quantization=100000000000` (~0.4mm), invisible once the
// interval-based simplification above has already reduced vertices to ~200m spacing.
const EXPORT_PRECISION_DEG = 0.0001;

function cleanNames(dir: string) {
    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        const filePath = `${dir}/${file}`;
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        let modified = false;
        for (const objName in data.objects) {
            for (const geom of data.objects[objName].geometries) {
                if (geom.properties?.name) {
                    const cleaned = geom.properties.name
                        .replace(/[\x00-\x1f\xa0]/g, ' ')
                        .replace(/  +/g, ' ')
                        .trim();
                    if (cleaned !== geom.properties.name) {
                        geom.properties.name = cleaned;
                        modified = true;
                    }
                }
            }
        }
        if (modified) fs.writeFileSync(filePath, JSON.stringify(data));
    }
}

// --- Shared-topology arc extraction -----------------------------------------------------
// Pulls a subset of geometries out of a shared TopoJSON topology into a standalone
// topology, preserving arc identity: arcs are copied verbatim (same delta encoding, same
// `transform`, no re-quantization, no dropped points) so that a later `presimplify()` +
// `simplify()` on the extracted file drops exactly the same vertices it would have dropped
// in the original combined topology. This is what makes a country's embedded ADM0 outline
// nest exactly inside its own ADM1/ADM2 regions at runtime.

type Geom = { type: string; arcs: any; properties?: Record<string, any> };

function arcDepthForType(type: string): number {
    if (type === 'Polygon') return 2; // arcs: number[][]
    if (type === 'MultiPolygon') return 3; // arcs: number[][][]
    throw new Error(`Unsupported geometry type for arc extraction: ${type}`);
}

function collectArcIndices(geom: Geom, into: Set<number>) {
    const depth = arcDepthForType(geom.type);
    const visit = (node: any, d: number) => {
        if (d === 0) {
            into.add(node < 0 ? ~node : node);
            return;
        }
        for (const child of node) visit(child, d - 1);
    };
    visit(geom.arcs, depth);
}

function remapGeometry(geom: Geom, remap: Map<number, number>): Geom {
    const depth = arcDepthForType(geom.type);
    const remapRef = (i: number) => {
        const old = i < 0 ? ~i : i;
        const ni = remap.get(old)!;
        return i < 0 ? ~ni : ni;
    };
    const visit = (node: any, d: number): any => (d === 0 ? remapRef(node) : node.map((child: any) => visit(child, d - 1)));
    return { ...geom, arcs: visit(geom.arcs, depth) };
}

/** Extract a fresh topology containing exactly the given named groups of geometries. */
function extractTopology(source: any, groups: Record<string, Geom[]>): any {
    const used = new Set<number>();
    for (const geoms of Object.values(groups)) for (const g of geoms) collectArcIndices(g, used);
    const sorted = [...used].sort((a, b) => a - b);
    const remap = new Map(sorted.map((old, idx) => [old, idx]));
    const arcs = sorted.map((i) => source.arcs[i]);
    const objects: Record<string, any> = {};
    for (const [name, geoms] of Object.entries(groups)) {
        objects[name] = { type: 'GeometryCollection', geometries: geoms.map((g) => remapGeometry(g, remap)) };
    }
    return { type: 'Topology', transform: source.transform, arcs, objects };
}

function groupByShapeGroup(geometries: Geom[]): Map<string, Geom[]> {
    const byGroup = new Map<string, Geom[]>();
    for (const g of geometries) {
        const key = g.properties?.shapeGroup;
        if (!key) continue;
        if (!byGroup.has(key)) byGroup.set(key, []);
        byGroup.get(key)!.push(g);
    }
    return byGroup;
}

// --- Rendering sanity check + fallback -------------------------------------------------
// `-simplify interval=` (mapshaper) occasionally leaves behind a tiny, near-degenerate
// ring that renders fine at full detail but — for a small number of countries, at a
// specific range of runtime simplification thresholds — becomes self-intersecting once
// topojson-simplify's client-side `simplify()` removes just one more of its points, which
// some browsers then rasterize as covering the *entire* map (a Norway/Brazil/Bangladesh
// case, found empirically; not related to the antimeridian issue `-rotate 0` fixes above).
// No arc-level heuristic (e.g. "protect arcs under N points") fixed this in general — it
// shifted which country broke rather than fixing all of them. Root cause is specific to
// `interval=`-based simplification; plain percentage-based (Visvalingam) simplification
// was never observed to trigger it. So: build normally, then verify every country actually
// renders sanely at a range of zoom levels, and re-simplify just the rare failures with
// percentage-based simplification as a fallback.
const VALIDATION_VISIBLE_AREAS = [0.001, 0.005, 0.01, 0.02, 0.05, 0.08];
const FALLBACK_SIMPLIFY_PCT = '3.5%';

function projectedHeight(feat: any): number {
    const proj = geoMercator().fitSize([960, 600], { type: 'Sphere' } as any);
    const b = geoPath(proj).bounds(feat);
    return isFinite(b[0][0]) ? b[1][1] - b[0][1] : -1;
}

/** True if this country's embedded-ADM0 outline renders at a sane size across zoom levels. */
function rendersSanely(countryTopo: any): boolean {
    if (!countryTopo.objects.adm0) return true; // nothing to cross-check (disputed numeric entries)
    let pre: any;
    try {
        pre = presimplify(countryTopo);
    } catch {
        return false;
    }
    const featureOf = (s: any) => {
        const fc: any = topojson.feature(s, s.objects.adm0);
        return fc.features ? fc.features[0] : fc;
    };
    let baseHeight: number;
    try {
        baseHeight = projectedHeight(featureOf(simplify(pre, 0)));
    } catch {
        return false;
    }
    if (baseHeight <= 0) return true; // couldn't establish a baseline; don't block the build on it
    for (const va of VALIDATION_VISIBLE_AREAS) {
        let height: number;
        try {
            height = projectedHeight(featureOf(simplify(pre, va)));
        } catch {
            return false;
        }
        if (height > 0 && height > baseHeight * 3 + 10) return false;
    }
    return true;
}

/** Re-simplify one country's region + ADM0 from its raw source with percentage-based
 *  simplification, as a fallback when the shared interval-based build renders unsafely. */
async function rebuildCountryWithFallback(
    rawPath: string,
    level: 'adm1' | 'adm2',
    shapeGroup: string,
    excludeDisputed: boolean,
): Promise<any | null> {
    const outPath = `${scratchDir}/fallback_${level}_${shapeGroup}.topojson`;
    const filterExpr = level === 'adm2' ? `shapeGroup==="${shapeGroup}" && shapeType==="ADM2"` : `shapeGroup==="${shapeGroup}"`;
    const dissolveWhere = excludeDisputed ? ` where='shapeType!="DISP"'` : '';
    await mapshaper.runCommands(
        [
            `-i ${rawPath}`,
            `-rename-layers ${level}`,
            `-filter target=${level} '${filterExpr}'`,
            `-rename-fields target=${level} name=shapeName`,
            `-rotate 0`,
            `-simplify ${FALLBACK_SIMPLIFY_PCT}`,
            `-clean`,
            `-dissolve target=${level} shapeGroup name=adm0 copy-fields=shapeGroup${dissolveWhere} +`,
            `-o target=adm0,${level} format=topojson precision=${EXPORT_PRECISION_DEG} ${outPath}`,
        ].join(' '),
    );
    const built = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    if (!built.objects[level]?.geometries?.length) return null;
    return built;
}

/** Validate every country in `byGroup`, replacing any that render unsafely with a
 *  percentage-simplified rebuild from `rawPath`. Mutates nothing; returns per-country
 *  override topologies (source + its own arcs) keyed by shapeGroup, for the ones fixed. */
async function validateAndFixCountries(
    byGroup: Map<string, Geom[]>,
    adm0ByGroup: Map<string, Geom[]>,
    source: any,
    rawPath: string,
    level: 'adm1' | 'adm2',
    excludeDisputed: boolean,
): Promise<Map<string, any>> {
    const overrides = new Map<string, any>();
    for (const [shapeGroup, geoms] of byGroup) {
        const groups: Record<string, Geom[]> = { [level]: geoms };
        const adm0Feature = adm0ByGroup.get(shapeGroup);
        if (adm0Feature) groups.adm0 = adm0Feature;
        const topo = extractTopology(source, groups);
        if (rendersSanely(topo)) continue;
        console.log(`  ${level}/${shapeGroup} failed the render check — rebuilding with percentage-based simplification`);
        const fallback = await rebuildCountryWithFallback(rawPath, level, shapeGroup, excludeDisputed);
        if (fallback && rendersSanely(fallback)) {
            overrides.set(shapeGroup, fallback);
        } else {
            console.warn(`  ${level}/${shapeGroup} still fails the render check after fallback — shipping it anyway (rare edge case at extreme zoom-out)`);
        }
    }
    return overrides;
}

// -----------------------------------------------------------------------------------------

async function downloadTo(url: string, destPath: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Failed to download ${url}: ${res.status}`);
    // Bun.write(path, response) was observed to hang indefinitely on these (large, redirected)
    // responses with no error — stream through Node's pipeline instead, which is reliable.
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destPath));
}

async function getWorldTopojson() {
    // Build into a staging directory and only swap it into place once everything below has
    // succeeded — a failed/partial run must never delete or corrupt the current, working
    // assets. `assetsPath` is only touched by the atomic rename at the very end.
    if (fs.existsSync(stagingPath)) fs.rmSync(stagingPath, { recursive: true });
    fs.mkdirSync(stagingPath);
    fs.mkdirSync(`${stagingPath}/adm1`);
    fs.mkdirSync(`${stagingPath}/adm2`);
    if (fs.existsSync(scratchDir)) fs.rmSync(scratchDir, { recursive: true });
    fs.mkdirSync(scratchDir, { recursive: true });

    const adm1Path = `${scratchDir}/adm1_raw.geojson`;
    const adm2Path = `${scratchDir}/adm2_raw.geojson`;
    const adm1TopoPath = `${scratchDir}/adm1_built.topojson`;
    const adm2TopoPath = `${scratchDir}/adm2_built.topojson`;

    console.log('Downloading ADM1...');
    await downloadTo('https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM1.geojson', adm1Path);
    console.log('Downloading ADM2...');
    await downloadTo('https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM2.geojson', adm2Path);

    // ADM1 and ADM2 are each built in their OWN mapshaper session, with their OWN dissolve
    // producing their OWN embedded ADM0 outline. This was tried first as a single shared
    // session (combine-files + one dissolve) so ADM1/ADM2 would share arcs directly — but
    // measured on real data, combining a country whose polygon crosses the antimeridian
    // (e.g. the US, via the Aleutians) with a much denser ADM2 layer corrupts mapshaper's
    // antimeridian handling badly enough that the country renders as if it covers the whole
    // map. Each level dissolving its own ADM0 avoids that entirely (verified: no antimeridian
    // corruption at any zoom, for the US specifically) at the cost of a tiny (~0.1%, same
    // order as the residual documented in geometry-data.ts) mismatch between ADM1's and
    // ADM2's own outline for the same country — never visible, since the app only ever shows
    // one of them nested against its own regions at a time (see resolvedAdmCountryOutline).
    // `-rotate 0` runs d3-geo's own antimeridian-crossing-split algorithm (ported into
    // mapshaper) with a no-op rotation — it's the only way to make the later `-simplify`
    // safe for countries that cross the antimeridian; confirmed a no-op for ones that don't.
    console.log('Building ADM1 (+ its own ADM0)...');
    await mapshaper.runCommands(
        [
            `-i ${adm1Path}`,
            `-rename-layers adm1`,
            `-rename-fields target=adm1 name=shapeName`,
            `-rotate 0`,
            `-simplify interval=${SIMPLIFY_INTERVAL_M} keep-shapes`,
            `-clean`,
            `-dissolve target=adm1 shapeGroup where='shapeType!="DISP"' name=adm0 copy-fields=shapeGroup +`,
            `-o target=adm0,adm1 format=topojson precision=${EXPORT_PRECISION_DEG} ${adm1TopoPath}`,
        ].join(' '),
    );
    console.log('Building ADM2 (+ its own ADM0)...');
    await mapshaper.runCommands(
        [
            `-i ${adm2Path}`,
            `-rename-layers adm2`,
            `-filter target=adm2 'shapeType==="ADM2"'`,
            `-rename-fields target=adm2 name=shapeName`,
            `-rotate 0`,
            `-simplify interval=${SIMPLIFY_INTERVAL_M} keep-shapes`,
            `-clean`,
            `-dissolve target=adm2 shapeGroup name=adm0 copy-fields=shapeGroup +`,
            `-o target=adm0,adm2 format=topojson precision=${EXPORT_PRECISION_DEG} ${adm2TopoPath}`,
        ].join(' '),
    );

    const adm1Built = JSON.parse(fs.readFileSync(adm1TopoPath, 'utf-8'));
    const adm2Built = JSON.parse(fs.readFileSync(adm2TopoPath, 'utf-8'));
    const adm1Geoms: Geom[] = adm1Built.objects.adm1.geometries;
    const adm2Geoms: Geom[] = adm2Built.objects.adm2.geometries;
    const adm0FromAdm1ByGroup = groupByShapeGroup(adm1Built.objects.adm0.geometries);
    const adm0FromAdm2ByGroup = groupByShapeGroup(adm2Built.objects.adm0.geometries);

    const adm1ByGroup = groupByShapeGroup(adm1Geoms);
    const adm2ByGroup = groupByShapeGroup(adm2Geoms);

    // Global world_adm0_simplified_topo.json — every country's ADM1-dissolved outline in one
    // file, further simplified (see WORLD_ADM0_EXPORT_SIMPLIFY_PCT above) since this file is
    // always downloaded and only ever needs whole-world-view detail.
    const worldAdm0 = extractTopology(adm1Built, { adm0: adm1Built.objects.adm0.geometries });
    const worldAdm0RawPath = `${scratchDir}/world_adm0_raw.topojson`;
    fs.writeFileSync(worldAdm0RawPath, JSON.stringify(worldAdm0));
    await mapshaper.runCommands(
        `-i ${worldAdm0RawPath} -simplify ${WORLD_ADM0_EXPORT_SIMPLIFY_PCT} keep-shapes -clean -o format=topojson precision=${EXPORT_PRECISION_DEG} ${stagingPath}/world_adm0_simplified_topo.json`,
    );

    // Verify every country actually renders sanely across a range of zoom levels, and
    // re-simplify the rare failures with percentage-based simplification instead (see the
    // "Rendering sanity check + fallback" section above for why this is needed).
    console.log('Validating ADM1 countries render sanely at every zoom level...');
    const adm1Overrides = await validateAndFixCountries(adm1ByGroup, adm0FromAdm1ByGroup, adm1Built, adm1Path, 'adm1', true);
    console.log('Validating ADM2 countries render sanely at every zoom level...');
    const adm2Overrides = await validateAndFixCountries(adm2ByGroup, adm0FromAdm2ByGroup, adm2Built, adm2Path, 'adm2', false);

    // Per-country ADM1 files: embed that country's own ADM1-dissolved ADM0 outline alongside
    // its regions (when one exists — disputed-territory numeric-ID entries are excluded from
    // the dissolve, matching today's behavior) so the client's single presimplify() call
    // covers both together and they always nest exactly.
    console.log(`Writing ${adm1ByGroup.size} ADM1 files...`);
    for (const [shapeGroup, geoms] of adm1ByGroup) {
        const override = adm1Overrides.get(shapeGroup);
        let topo;
        if (override) {
            topo = extractTopology(override, { adm1: override.objects.adm1.geometries, ...(override.objects.adm0 ? { adm0: override.objects.adm0.geometries } : {}) });
        } else {
            const groups: Record<string, Geom[]> = { adm1: geoms };
            const adm0Feature = adm0FromAdm1ByGroup.get(shapeGroup);
            if (adm0Feature) groups.adm0 = adm0Feature;
            topo = extractTopology(adm1Built, groups);
        }
        fs.writeFileSync(`${stagingPath}/adm1/${shapeGroup}.json`, JSON.stringify(topo));
    }

    // Generate disputed_territories.json from numeric-ID layer files, preserving existing
    // region/sub-region values from the previous file. Computed now, written only after the
    // staging directory has been swapped into place below.
    const dataPath = path.resolve(assetsPath, '../data');
    const disputedPath = `${dataPath}/disputed_territories.json`;
    const existingById: Record<string, { region: string; "sub-region": string }> = {};
    if (fs.existsSync(disputedPath)) {
        const existing = JSON.parse(fs.readFileSync(disputedPath, 'utf-8'));
        for (const entry of existing) {
            existingById[entry["alpha-3"]] = { region: entry.region || "", "sub-region": entry["sub-region"] || "" };
        }
    }
    const adm1Files = fs.readdirSync(`${stagingPath}/adm1`);
    const disputedTerritories = adm1Files
        .filter(f => /^\d+\.json$/.test(f))
        .map(f => {
            const id = path.basename(f, '.json');
            const topo = JSON.parse(fs.readFileSync(`${stagingPath}/adm1/${f}`, 'utf-8'));
            const firstObj = topo.objects.adm1;
            const name = firstObj.geometries[0].properties.name;
            const prev = existingById[id];
            return { name, "alpha-3": id, "alpha-2": "", region: prev?.region ?? "", "sub-region": prev?.["sub-region"] ?? "" };
        });

    // Per-country ADM2 files: embed that country's own ADM2-dissolved ADM0 outline (not the
    // ADM1-dissolved one above — a different mapshaper session, see the note near the top of
    // this function) so ADM2 always nests exactly with its own embedded outline too.
    console.log(`Writing ${adm2ByGroup.size} ADM2 files...`);
    for (const [shapeGroup, geoms] of adm2ByGroup) {
        const override = adm2Overrides.get(shapeGroup);
        let topo;
        if (override) {
            topo = extractTopology(override, { adm2: override.objects.adm2.geometries, ...(override.objects.adm0 ? { adm0: override.objects.adm0.geometries } : {}) });
        } else {
            const groups: Record<string, Geom[]> = { adm2: geoms };
            const adm0Feature = adm0FromAdm2ByGroup.get(shapeGroup);
            if (adm0Feature) groups.adm0 = adm0Feature;
            topo = extractTopology(adm2Built, groups);
        }
        fs.writeFileSync(`${stagingPath}/adm2/${shapeGroup}.json`, JSON.stringify(topo));
    }

    cleanNames(`${stagingPath}/adm1`);
    cleanNames(`${stagingPath}/adm2`);

    // Very simplified land outline, used for the fast canvas-preview path while dragging.
    // Derived from the already-simplified adm0 export, further simplified + dissolved, with
    // keep-shapes so small islands survive (today's pipeline drops ~2,280 of them).
    console.log('Building very-simplified land layer...');
    await mapshaper.runCommands(
        `-i ${stagingPath}/world_adm0_simplified_topo.json -simplify 10% keep-shapes -dissolve -clean -o format=topojson precision=${EXPORT_PRECISION_DEG} ${stagingPath}/world_land_very_simplified.topojson`,
    );
    fs.renameSync(`${stagingPath}/world_land_very_simplified.topojson`, `${stagingPath}/world_land_very_simplified_topo.json`);

    // Everything above succeeded — atomically swap staging into place, then write the small
    // sibling data file. Only now can this run affect the working assets.
    console.log('Swapping in new assets...');
    const backupPath = `${assetsPath}.bak`;
    if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { recursive: true });
    if (fs.existsSync(assetsPath)) fs.renameSync(assetsPath, backupPath);
    fs.renameSync(stagingPath, assetsPath);
    if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { recursive: true });

    if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(disputedPath, JSON.stringify(disputedTerritories, null, 2));

    fs.rmSync(scratchDir, { recursive: true });
    return true;
}

getWorldTopojson().then(() => {
    console.log('done');
}).catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
});
