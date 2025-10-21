import * as THREE from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import type maplibregl from "maplibre-gl";
import type { RenderedFeaturePoly } from "src/util/geometryStitch";
import type { SvgSelection } from "src/types";
import { MercatorCoordinate } from "maplibre-gl";

interface AddExtrudedOptions {
    fill?: string;
    wallFill?: string;
    stroke?: string;
}

export async function addExtrudedBuildings(
    map: maplibregl.Map,
    features: RenderedFeaturePoly[],
    svgContainer: SvgSelection,
    translateAmount: number,
    options: AddExtrudedOptions = {}
): Promise<void> {
    const height = parseInt(svgContainer.attr('height'));
    const width = parseInt(svgContainer.attr('width'));
    const container = svgContainer.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('height', String(height))
        .attr('width', String(width));
    const fill = options.fill ?? "#cccccc";
    const wallFill = options.wallFill ?? "#999999";
    const stroke = options.stroke ?? "#222222";

    const svgNode = container.node();
    if (!svgNode) throw new Error("Provided svgSelection has no DOM node.");

    const origin = map.unproject([width / 2, height / 2]);
    const sceneOrigin: [number, number] = [origin.lng, origin.lat];
    const sceneAltitude = 0;

    // Calculate scale: meters to Mercator at scene origin
    const mercatorOrigin = MercatorCoordinate.fromLngLat(sceneOrigin, sceneAltitude);
    const metersToMercator = mercatorOrigin.meterInMercatorCoordinateUnits();

    // --- THREE.js setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    // Get projection matrix for the scene origin
    const modelMatrix = map.transform.getMatrixForModel(sceneOrigin, sceneAltitude);
    const projectionData = map.transform.getProjectionDataForCustomLayer(false);

    // Combine model matrix with projection matrix
    camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(projectionData.mainMatrix)
        .multiply(new THREE.Matrix4().fromArray(modelMatrix));

    // helper: project a world-space Vector3 (x,y,z) through the camera.projectionMatrix
    // returns screen coordinates in the SVG coordinate system (0..width, 0..height) and ndc.z
    function projectToScreen(x: number, y: number, z: number) {
        const v = new THREE.Vector4(x, y, z, 1).applyMatrix4(camera.projectionMatrix);
        if (v.w === 0) return null;
        v.divideScalar(v.w); // NDC
        const ndcX = v.x;
        const ndcY = v.y;
        const ndcZ = v.z;
        const sx = (ndcX * 0.5 + 0.5) * width;
        const sy = (-ndcY * 0.5 + 0.5) * height; // flip Y for screen coordinates
        return { x: sx, y: sy, z: ndcZ };
    }

    // helper: round coordinates to reduce SVG size
    function round(n: number, decimals = 2) {
        const p = Math.pow(10, decimals);
        return Math.round(n * p) / p;
    }

    // Main polygon accumulator for all features
    type PolyOutput = { d: string; fill: string; depth: number; stroke?: string };
    const outPolys: PolyOutput[] = [];

    // For each building feature, extract polygons
    for (const feat of features) {
        const coords = feat.geometry.coordinates[0];
        const heightMeters = feat.properties.height ?? 0;
        if (heightMeters <= 0 || coords.length < 3) continue;

        // Convert coordinates to meters relative to scene origin
        const shapePts: THREE.Vector2[] = coords.map(([lng, lat]) => {
            const mc = MercatorCoordinate.fromLngLat([lng, lat], sceneAltitude);
            const x = (mc.x - mercatorOrigin.x) / metersToMercator;
            const z = (mc.y - mercatorOrigin.y) / metersToMercator;
            return new THREE.Vector2(x, -z);
        });

        const shape = new THREE.Shape(shapePts);

        // Extrude the shape
        const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
            depth: heightMeters,
            bevelEnabled: false,
        });

        // Rotate geometry so extrusion goes along Y axis (up)
        extrudeGeom.rotateX(-Math.PI / 2);

        // Ensure non-indexed so we can iterate triangles easily
        const geom = extrudeGeom.toNonIndexed() as THREE.BufferGeometry;
        const posAttr = geom.getAttribute('position');
        const positions = posAttr.array as Float32Array;
        const triCount = positions.length / 9; // 3 verts * 3 components

        // helper: build a key for a vertex (rounded to avoid floating noise)
        function vKey(x: number, y: number, z: number) {
            return `${round(x, 6)},${round(y, 6)},${round(z, 6)}`;
        }

        // Collect triangles
        type Tri = {
            verts: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
            normal: THREE.Vector3;
            centroid: THREE.Vector3;
        };
        const triangles: Tri[] = [];

        for (let t = 0; t < triCount; t++) {
            const i = t * 9;
            const v0 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const v1 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
            const v2 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

            // compute normal in geometry local space
            const e1 = new THREE.Vector3().subVectors(v1, v0);
            const e2 = new THREE.Vector3().subVectors(v2, v0);
            const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();

            const centroid = new THREE.Vector3().addVectors(v0, v1).add(v2).multiplyScalar(1 / 3);

            triangles.push({ verts: [v0, v1, v2], normal, centroid });
        }

        // Classify triangles into roof vs wall using normal dot with up vector
        const up = new THREE.Vector3(0, 1, 0); // +Y is up after rotation
        const roofDotThreshold = 0.5; // tuneable: near 1 is strict horizontal
        const roofTriangles = triangles.filter(tri => tri.normal.dot(up) >= roofDotThreshold);
        const wallTriangles = triangles.filter(tri => tri.normal.dot(up) < roofDotThreshold);

        console.log("roofTriangles", roofTriangles);
        console.log("wallTriangles", wallTriangles);
        // Function that takes a triangle set and produces polygon outlines (array of loops)
        function trianglesToLoops(tris: Tri[]) {
            // Edge counting: undirected edges represented by ordered keys
            const edgeCount = new Map<string, number>();
            const edgeToVerts = new Map<string, [string, string]>();
            const keyToVec = new Map<string, THREE.Vector3>();

            function addVertexKey(v: THREE.Vector3) {
                const key = vKey(v.x, v.y, v.z);
                if (!keyToVec.has(key)) keyToVec.set(key, v.clone());
                return key;
            }

            for (const tri of tris) {
                const keys = tri.verts.map(addVertexKey);
                // edges: [0-1], [1-2], [2-0]
                const pairs: [string, string][] = [
                    [keys[0], keys[1]],
                    [keys[1], keys[2]],
                    [keys[2], keys[0]],
                ];
                for (const [a, b] of pairs) {
                    // undirected edge key: smaller|larger (string compare)
                    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
                    edgeToVerts.set(key, [a, b]);
                    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
                }
            }

            // boundary edges are those with count === 1
            const boundaryEdges: [string, string][] = [];
            for (const [k, cnt] of edgeCount) {
                if (cnt === 1) {
                    const pair = edgeToVerts.get(k)!;
                    boundaryEdges.push(pair);
                }
            }

            // Build adjacency map for boundary edges to walk loops
            const adj = new Map<string, Set<string>>();
            function link(a: string, b: string) {
                if (!adj.has(a)) adj.set(a, new Set());
                adj.get(a)!.add(b);
            }
            for (const [a, b] of boundaryEdges) {
                link(a, b);
                link(b, a);
            }

            // Walk loops
            const loops: string[][] = [];
            const visited = new Set<string>();

            for (const start of adj.keys()) {
                if (visited.has(start)) continue;
                let loop: string[] = [];
                let current = start;
                let prev: string | null = null;

                // walk until we return to start
                while (true) {
                    loop.push(current);
                    visited.add(current);
                    const neighbors = Array.from(adj.get(current) || []);
                    // choose next neighbor that isn't prev (simple heuristic)
                    let next: string | undefined = undefined;
                    if (neighbors.length === 0) break;
                    if (neighbors.length === 1) {
                        next = neighbors[0];
                    } else {
                        next = neighbors.find(n => n !== prev) ?? neighbors[0];
                    }
                    prev = current;
                    current = next!;
                    if (current === start || !current) break;
                    if (loop.length > 10000) break; // safety
                }

                if (loop.length >= 3) loops.push(loop);
            }

            // Convert key sequences to arrays of Vector3
            const loopsVec = loops.map(loopKeys => loopKeys.map(k => keyToVec.get(k)!.clone()));
            return loopsVec;
        }

        // Produce loops for roof and walls
        const roofLoops = trianglesToLoops(roofTriangles);
        const wallLoops = trianglesToLoops(wallTriangles);

        console.log('roofLoops', roofLoops);
        console.log('wallLoops', wallLoops);


        // For walls, we might have multiple vertical faces (each a loop); for each, project and create path
        function loopsToPolys(loops: THREE.Vector3[][], polyFill: string) {
            for (const loop of loops) {
                // project each vertex
                const projected = loop.map(v => projectToScreen(v.x, v.y, v.z)).filter(Boolean) as { x: number; y: number; z: number }[];
                if (projected.length < 3) continue;
                // compute average depth for sorting
                const avgDepth = projected.reduce((s, p) => s + p.z, 0) / projected.length;
                // build 'd' path
                const d = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ') + ' Z';
                outPolys.push({ d, fill: polyFill, depth: avgDepth, stroke });
            }
        }

        // push roof polygons (use top fill)
        loopsToPolys(roofLoops, fill);
        // push wall polygons (use wall fill)
        loopsToPolys(wallLoops, wallFill);
    }

    // Depth sort polygons back-to-front (draw farthest first).
    // In normalized device coordinates z: -1 = near, +1 = far. So sort descending by z to draw far first.
    outPolys.sort((a, b) => b.depth - a.depth);

    // Append polygons to svg
    for (const p of outPolys) {
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', p.d);
        pathEl.setAttribute('fill', p.fill);
        if (p.stroke) {
            pathEl.setAttribute('stroke', p.stroke);
            pathEl.setAttribute('stroke-width', '0.5');
        }
        svgNode.appendChild(pathEl);
    }
}
