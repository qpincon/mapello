import { create } from 'd3-selection';
import { createSvgFromPart } from './svg';
import * as shapes from './shapeDefs';
import type { Coords, ShapeDefinition } from 'src/types';
import type { GeoProjection } from 'd3-geo';

export function drawShapes(
    shapeDefinitions: ShapeDefinition[],
    container: HTMLElement | null,
    projection: GeoProjection,
): void {
    if (!container) return;

    container.innerHTML = '';

    shapeDefinitions.forEach((shapeDef: ShapeDefinition) => {
        // shape is a symbol
        const projectedPos: Coords = projection(shapeDef.pos)!;
        let svgShape: SVGElement;

        if (shapeDef.name) {
            svgShape = createSvgFromPart(shapes[shapeDef.name]);
        }
        // shape is a label
        else if (shapeDef.text) {
            svgShape = addSvgText(shapeDef.text, shapeDef.id).node() as SVGElement;
        } else {
            // Handle case where neither name nor text is provided
            throw new Error(`Shape definition ${shapeDef.id} must have either 'name' or 'text' property`);
        }

        let transform: string = `translate(${projectedPos[0]} ${projectedPos[1]})`;
        if (shapeDef.scale && shapeDef.scale !== 1) {
            transform += ` scale(${shapeDef.scale})`;
        }
        svgShape.setAttribute('transform', transform);
        svgShape.setAttribute('id', shapeDef.id);
        container.appendChild(svgShape);
    });
}


export function addSvgText(text: string, id: string) {
    const parts: string[] = text.split('\n');
    const textElem = create('svg:text')
        .style('stroke-width', 0)
        .attr('id', id);

    const countPrefixSpace = (str: string): number => {
        let i = 0;
        while (i < str.length && str[i] === ' ') ++i;
        return i;
    };

    textElem.selectAll('tspan')
        .data(parts)
        .join('tspan')
        .attr('x', 0)
        .attr('dx', (d: string) => `${countPrefixSpace(d) / 3}em`)
        .attr('dy', (_: string, i: number) => (i ? '1.1em' : 0))
        .attr('id', (_: string, i: number) => (`${id}-${i}`))
        .text((d: string) => d);

    return textElem;
}
