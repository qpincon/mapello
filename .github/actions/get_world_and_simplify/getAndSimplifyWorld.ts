import fs from 'node:fs';
import path from 'node:path';
import mapshaper from 'mapshaper';

// run: bun run getAndSimplifyWorld.ts
const assetsPath = '/home/quentin/Tests/mapello/src/assets/layers';

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
async function getWorldTopojson() {
    if (fs.existsSync(assetsPath)) {
        fs.rmSync(assetsPath, { recursive: true });
    }
    fs.mkdirSync(assetsPath);
    let topology = await fetch('https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM1.geojson');
    topology = await topology.json();
    console.log('Topology adm1 downloaded');
    let simplified = await mapshaper.applyCommands('-i topo.geojson -rename-fields name=shapeName -simplify 3.5% -clean -o output.geojson', { 'topo.geojson': topology });
    console.log('Simplification ADM1 done');
    simplified = JSON.parse(Buffer.from(simplified['output.geojson']).toString('utf-8'));
    fs.writeFileSync(`${assetsPath}/adm1_simplified.geojson`, JSON.stringify(simplified));

    await mapshaper.runCommands(`-i ${assetsPath}/adm1_simplified.geojson -dissolve shapeGroup where='shapeType!="DISP"' -clean -o quantization=100000000000 ${assetsPath}/world_adm0_simplified.topojson`);
    await mapshaper.runCommands(`-i ${assetsPath}/world_adm0_simplified.topojson -simplify 10% -dissolve -clean -o quantization=100000000000 ${assetsPath}/world_land_very_simplified.topojson`);
    fs.mkdirSync(`${assetsPath}/adm1`);
    await mapshaper.runCommands(`-i ${assetsPath}/adm1_simplified.geojson -split shapeGroup -o format=topojson singles quantization=100000000000 ${assetsPath}/adm1/`);
    fs.unlinkSync(`${assetsPath}/adm1_simplified.geojson`);
    cleanNames(`${assetsPath}/adm1`);

    // Generate disputed_territories.json from numeric-ID layer files,
    // preserving existing region/sub-region values from the previous file
    const dataPath = path.resolve(assetsPath, '../data');
    if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
    const disputedPath = `${dataPath}/disputed_territories.json`;
    const existingById: Record<string, { region: string; "sub-region": string }> = {};
    if (fs.existsSync(disputedPath)) {
        const existing = JSON.parse(fs.readFileSync(disputedPath, 'utf-8'));
        for (const entry of existing) {
            existingById[entry["alpha-3"]] = { region: entry.region || "", "sub-region": entry["sub-region"] || "" };
        }
    }
    const adm1Files = fs.readdirSync(`${assetsPath}/adm1`);
    const disputedTerritories = adm1Files
        .filter(f => /^\d+\.json$/.test(f))
        .map(f => {
            const id = path.basename(f, '.json');
            const topo = JSON.parse(fs.readFileSync(`${assetsPath}/adm1/${f}`, 'utf-8'));
            const firstObj = topo.objects[Object.keys(topo.objects)[0]];
            const name = firstObj.geometries[0].properties.name;
            const prev = existingById[id];
            return { name, "alpha-3": id, "alpha-2": "", region: prev?.region ?? "", "sub-region": prev?.["sub-region"] ?? "" };
        });
    fs.writeFileSync(disputedPath, JSON.stringify(disputedTerritories, null, 2));

    let topologyAdm2 = await fetch('https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM2.geojson');
    topologyAdm2 = await topologyAdm2.json();
    console.log('Topology ADM2 downloaded');
    let simplifiedAdm2 = await mapshaper.applyCommands('-i topo.geojson -rename-fields name=shapeName -simplify 2% -clean -o output.geojson', { 'topo.geojson': topologyAdm2 });
    console.log('Simplification ADM2 done');
    simplifiedAdm2 = JSON.parse(Buffer.from(simplifiedAdm2['output.geojson']).toString('utf-8'));
    fs.writeFileSync(`${assetsPath}/adm2_simplified.geojson`, JSON.stringify(simplifiedAdm2));
    fs.mkdirSync(`${assetsPath}/adm2`);
    await mapshaper.runCommands(`-i ${assetsPath}/adm2_simplified.geojson -filter 'shapeType==="ADM2"' -split shapeGroup -o format=topojson singles quantization=100000000000 ${assetsPath}/adm2/`);
    fs.unlinkSync(`${assetsPath}/adm2_simplified.geojson`);
    cleanNames(`${assetsPath}/adm2`);

    // Rename .topojson files to _topo.json for import compatibility
    fs.renameSync(`${assetsPath}/world_adm0_simplified.topojson`, `${assetsPath}/world_adm0_simplified_topo.json`);
    fs.renameSync(`${assetsPath}/world_land_very_simplified.topojson`, `${assetsPath}/world_land_very_simplified_topo.json`);
    return true;
}


getWorldTopojson().then(res => {
    console.log('done');
});
