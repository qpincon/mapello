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

/**
 * Render extruded building polygons using Three.js + MapLibre camera transform
 * into a D3-managed SVG element.
 */
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
        // .attr('transform', `translate(${translateAmount}, ${translateAmount})`)
        .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
        .attr('height', width)
        .attr('width', height);
    const fill = options.fill ?? "#cccccc";
    const wallFill = options.wallFill ?? "#999999";
    const stroke = options.stroke ?? "#222222";

    const svgNode = container.node();
    if (!svgNode) throw new Error("Provided svgSelection has no DOM node.");


    // --- Calculate single scene origin (center of all features) ---
    let totalLng = 0, totalLat = 0, totalPoints = 0;
    for (const feat of features) {
        const coords = feat.geometry.coordinates[0];
        for (const [lng, lat] of coords) {
            totalLng += lng;
            totalLat += lat;
            totalPoints++;
        }
    }

    if (totalPoints === 0) return;

    const sceneOrigin: [number, number] = [totalLng / totalPoints, totalLat / totalPoints];
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

    const renderer = new SVGRenderer();
    renderer.setSize(width, height);

    // Material with different colors for walls and top
    const material = [
        new THREE.MeshBasicMaterial({ color: new THREE.Color(wallFill), side: THREE.DoubleSide }), // sides
        new THREE.MeshBasicMaterial({ color: new THREE.Color(fill), side: THREE.DoubleSide })       // top/bottom
    ];

    // --- Geometry creation ---
    for (const feat of features) {
        const coords = feat.geometry.coordinates[0];
        const heightMeters = feat.properties.height ?? 0;
        if (heightMeters <= 0 || coords.length < 3) continue;

        // Convert coordinates to meters relative to scene origin
        const shapePts: THREE.Vector2[] = coords.map(([lng, lat]) => {
            const mc = MercatorCoordinate.fromLngLat([lng, lat], sceneAltitude);
            // Distance in Mercator units, converted to meters
            const x = (mc.x - mercatorOrigin.x) / metersToMercator;
            const z = (mc.y - mercatorOrigin.y) / metersToMercator;
            // Create shape in XY plane, but negate z to account for rotation
            // After rotation by -90° around X: (x, -z, height) becomes (x, height, z)
            return new THREE.Vector2(x, -z);
        });

        const shape = new THREE.Shape(shapePts);

        // Extrude the shape
        const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
            depth: heightMeters,
            bevelEnabled: false,
        });

        // Rotate geometry so extrusion goes along Y axis (up) instead of Z
        // Rotation by -90° around X: (x, y, z) -> (x, z, -y)
        // Our shape has (x, -z, 0) at base and (x, -z, height) at top
        // After rotation: (x, 0, z) at base and (x, height, z) at top ✓
        extrudeGeom.rotateX(-Math.PI / 2);

        // Create single mesh
        const mesh = new THREE.Mesh(extrudeGeom, material);

        scene.add(mesh);
    }
    // --- Render once ---
    renderer.render(scene, camera);

    // Copy rendered SVG into provided D3-managed SVG element
    const producedSvg = renderer.domElement as SVGSVGElement;
    console.log(producedSvg);
    producedSvg.setAttribute("width", String(width));
    producedSvg.setAttribute("height", String(height));
    producedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    for (const child of Array.from(producedSvg.childNodes)) {
        svgNode.appendChild(child.cloneNode(true));
    }
}