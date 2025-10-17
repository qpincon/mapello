import type { Feature, Polygon } from 'geojson';
import { MercatorCoordinate, type Map } from 'maplibre-gl';
import type { SvgSelection } from 'src/types';
import type { RenderedFeaturePoly } from 'src/util/geometryStitch';
import type { Illustration, Group } from 'zdog';
import Zdog from 'zdog';

const DEFAULT_HEIGHT = 0;
interface BuildingOptions {
    height?: number;
    color?: string;
    roofColor?: string;
    stroke?: number;
    fill?: boolean;
    addTo?: Illustration | Group;
}

interface Building {
    group: Group;
    feature: Feature<Polygon>;
    options: BuildingOptions;
}

function sortFeaturesByDepth(
    map: Map,
    features: RenderedFeaturePoly[]
): RenderedFeaturePoly[] {
    const center = map.getCenter();
    const bearing = map.getBearing() * (Math.PI / 180);
    const pitch = map.getPitch() * (Math.PI / 180);

    // Camera direction vector (adjusted for bearing and pitch)
    const camDirX = Math.sin(bearing) * Math.cos(pitch);
    const camDirY = -Math.cos(bearing) * Math.cos(pitch);

    return features
        .map(f => {
            // Calculate feature centroid
            const coords = f.geometry.coordinates[0];
            const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
            const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

            // Distance from camera (dot product with camera direction)
            const dx = lng - center.lng;
            const dy = lat - center.lat;
            const depth = dx * camDirX + dy * camDirY;
            // console.log(document.getElementById(f.properties.uuid!), depth);
            return { feature: f, depth };
        })
        .sort((a, b) => a.depth - b.depth) // Furthest first
        .map(({ feature }) => feature);
};


const shadeColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
};

// const projectPoint = (map: Map, lng: number, lat: number, altitude: number, illo: Illustration) => {
//     const mercator = MercatorCoordinate.fromLngLat([lng, lat], altitude);
//     const point = map.transform.locationPoint(mercator);
//     return { x: point.x - illo.width / 2, y: point.y - illo.height / 2 };
// };

const projectPoint = (map: Map, lng: number, lat: number, altitude: number, illo: Illustration) => {
    const point = map.project([lng, lat]);
    const pitch = map.getPitch();

    if (pitch === 0) {
        // No altitude adjustment for top-down view
        return { x: point.x - illo.width / 2, y: point.y - illo.height / 2 };
    }

    // Calculate meters per pixel at this latitude
    const zoom = map.getZoom();
    const lat_rad = (point.y / 256) * (Math.PI / 180);
    const metersPerPixel = (40075016.686 * Math.cos(lat_rad)) / (256 * Math.pow(2, zoom));
    const altitudeInPixels = altitude / metersPerPixel;

    const pitch_rad = pitch * (Math.PI / 180);

    // Adjust y coordinate based on altitude and pitch
    const adjustedY = point.y - altitudeInPixels * Math.cos(pitch_rad);

    return { x: point.x - illo.width / 2, y: adjustedY - illo.height / 2 };

};


export const polygonToZdogBuilding = (
    map: Map,
    polygon: GeoJSON.Feature<GeoJSON.Polygon>,
    illo: Illustration,
    opts: BuildingOptions = {}
): void => {
    const { height = 50, color = '#C25', roofColor = '#ED0', stroke = 1, fill = true, addTo = illo } = opts;
    if (!height) return;
    const group = new Zdog.Group({ addTo });

    const coords = polygon.geometry.coordinates[0].slice(0, -1);
    // Project bottom vertices (ground level, altitude = 0)
    const bottomVertices = coords.map(([lng, lat]) =>
        projectPoint(map, lng, lat, 0, illo)
    );

    // Project top vertices (roof level, altitude = height in meters)
    const topVertices = coords.map(([lng, lat]) =>
        projectPoint(map, lng, lat, height, illo)
    );

    // Walls
    bottomVertices.forEach((b1, i) => {
        const b2 = bottomVertices[(i + 1) % bottomVertices.length];
        const t1 = topVertices[i];
        const t2 = topVertices[(i + 1) % topVertices.length];

        new Zdog.Shape({
            addTo: group,
            path: [
                { x: b1.x, y: b1.y, z: 0 },
                { x: b2.x, y: b2.y, z: 0 },
                { x: t2.x, y: t2.y, z: 0 },
                { x: t1.x, y: t1.y, z: 0 }
            ],
            closed: true,
            stroke,
            color: shadeColor(color, -10 * (i % 3)),
            fill
        });
    });

    // Top face
    new Zdog.Shape({
        addTo: group,
        path: topVertices.map(v => ({ x: v.x, y: v.y, z: 0 })),
        closed: true,
        stroke,
        color: roofColor,
        fill
    });

};

// export const polygonToZdogBuilding = (
//     map: Map,
//     polygon: Feature<Polygon>,
//     illo: Illustration,
//     opts: BuildingOptions = {}
// ): Group => {
//     const { height = DEFAULT_HEIGHT, color = '#C25', roofColor = '#ED0', stroke = 1, fill = true, addTo = illo } = opts;
//     const group = new Zdog.Group({ addTo });

//     const rotate = { x: -0.3 }
//     console.log('illo.width', illo.width);
//     /** Don't get the last point (which is the same as the first) */
//     const vertices = polygon.geometry.coordinates[0].slice(0, -1).map(coord => {
//         const { x, y } = map.project(coord as [number, number]);
//         return { x: x - illo.width / 2, y: y - illo.height / 2 };
//     });

//     const h2 = height;
//     // console.log(vertices, h2, vertices.map(v => ({ ...v, z: h2 })));



//     // Walls
//     vertices.forEach((v1, i) => {
//         const v2 = vertices[(i + 1) % vertices.length];
//         new Zdog.Shape({
//             addTo: group,
//             path: [
//                 { ...v1, z: h2 }, { ...v2, z: h2 },
//                 { ...v2, z: -h2 }, { ...v1, z: -h2 }
//             ],
//             closed: true,
//             stroke,
//             color: shadeColor(color, -10 * (i % 3)),
//             fill,
//             // rotate
//         });
//     });

//     // Bottom & top faces
//     [-height].forEach((z, i) => {
//         new Zdog.Shape({
//             addTo: group,
//             path: vertices.map(v => ({ ...v, z })),
//             closed: true,
//             stroke,
//             color: i === 0 ? '#333' : roofColor,
//             fill,
//             // rotate
//         });
//     });

//     return group;
// };

export function renderBuildings(
    map: Map,
    features: RenderedFeaturePoly[],
    svg: SvgSelection,
    translateAmount: number
): void {
    const container = svg.append('svg')
        .attr('transform', `translate(${translateAmount}, ${translateAmount})`)
        .attr('height', svg.attr('height'))
        .attr('width', svg.attr('width'));

    const pitch = map.getPitch() * (Math.PI / 180); // Convert to radians
    const bearing = map.getBearing() * (Math.PI / 180); // Convert to radians

    const illustration = new Zdog.Illustration({
        element: container.node()!,
        dragRotate: true,
        // rotate: {
        // x: -pitch, // Negative because map pitch is opposite to Zdog rotation 
        // z: bearing
        // }  
    });
    sortFeaturesByDepth(map, features).forEach((f, i) => {
        // console.log(document.getElementById(f.properties.uuid!));
        const height = f.properties?.height ?? DEFAULT_HEIGHT;
        const color = f.properties?.color || ['#C25', '#5C2', '#25C', '#C52', '#2C5'][i % 5];
        const opts = { height, color, roofColor: shadeColor(color, 30) };

        return {
            group: polygonToZdogBuilding(map, f, illustration, opts),
            feature: f,
            options: opts
        };
    });

    try {
        illustration.updateRenderGraph();

    } catch (e) {
        console.log(e);
        return;
    }
    // function animate() {
    //     illustration.updateRenderGraph();
    //     requestAnimationFrame(animate);
    // }
    // animate();
    // return buildings;
};
