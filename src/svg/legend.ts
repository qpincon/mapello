import { select } from 'd3-selection';
import { reportStyle } from '../util/dom';
import { setTransformTranslate, getTranslateFromTransform } from './svg';
import { drag } from 'd3-drag';
import type { LegendColor, LegendDef, SvgGSelection } from "src/types";

export function drawLegend(
    legendSelection: SvgGSelection,
    legendDef: LegendDef,
    legendColors: LegendColor[],
    isCategorical: boolean,
    sampleElem: SVGGElement,
    tabName: string,
    saveFunc: () => void,
    entryWidth: number = legendDef.lineWidth
): SvgGSelection {
    const colors = [...legendColors];
    if (legendDef.noData.active) {
        colors.unshift([legendDef.noData.color, legendDef.noData.text]);
    }

    const labelWidths = getEntryWidths(legendSelection.node() as SVGGElement, colors.map(x => x[1]), sampleElem);
    const maxLabelWidth = Math.max(...labelWidths);
    const horizontal = legendDef.direction === 'h';
    const gap = isCategorical ? 5 : 0;
    const textBaseline = !isCategorical && horizontal ? 'hanging' : 'middle';
    const willRerun = entryWidth === legendDef.lineWidth && isCategorical && horizontal;
    let xAcc = 0, yAcc = 0;

    const computeX = (): number => {
        if (horizontal) {
            if (isCategorical && xAcc >= legendDef.maxWidth) {
                xAcc = 0;
                yAcc += legendDef.rectHeight + gap;
            }
            const xPos = xAcc;
            xAcc += isCategorical ? entryWidth + 5 : legendDef.rectWidth;
            return xPos;
        }
        return 0;
    };

    const computeY = (index: number): number => {
        if (horizontal) {
            return yAcc;
        }
        return index * (legendDef.rectHeight + gap);
    };

    const nbLegend = legendSelection.node()?.childElementCount || 0;
    let offsetX = 0;
    if (nbLegend > 0) {
        const lastChild = legendSelection.node()?.lastChild as SVGGElement;
        offsetX = Math.min(lastChild.getBBox().width + 20, 100);
    }

    const groupId = `${tabName}-legend-group`;
    if (!legendDef.changes[groupId]) legendDef.changes[groupId] = { dx: 0, dy: 0 };
    offsetX += legendDef.changes[groupId].dx;
    const offsetY = legendDef.changes[groupId].dy;

    const legendGroup = legendSelection.append('g')
        .attr('id', groupId)
        .attr('transform', `translate(${legendDef.x + offsetX} ${offsetY + (legendDef.y ? legendDef.y : 100)})`);

    legendGroup.call(drag<SVGGElement, unknown>()
        .on("drag", (e) => {
            legendDef.changes[groupId].dx += e.dx;
            legendDef.changes[groupId].dy += e.dy;
            const [x, y] = getTranslateFromTransform(legendGroup.node()!)!;
            setTransformTranslate(legendGroup.node()!, `translate(${x + e.dx} ${y + e.dy})`);
            saveFunc();
        })
    );

    const legendEntries = legendGroup.selectAll('g').data(colors).join('g')
        .attr('transform', (d, i) => {
            const x = computeX();
            const y = computeY(i);
            return `translate(${x} ${y})`;
        });

    const canBeOnLeft = isCategorical || legendDef.direction === 'v';
    const getX = (index: number, isRect = false): number => {
        if (canBeOnLeft && legendDef.labelOnLeft) {
            if (isRect) return maxLabelWidth + 5;
            return maxLabelWidth - labelWidths[index];
        }
        if (isRect) return 0;
        return (!isCategorical && horizontal) ? 0 : legendDef.rectWidth + 5;
    };

    legendEntries.append('rect')
        .attr('x', (_, i) => getX(i, true))
        .attr('y', 0)
        .attr('width', legendDef.rectWidth)
        .attr('height', legendDef.rectHeight)
        .attr('fill', d => d[0])
        .attr('stroke', 'black');

    legendEntries.append('text')
        .attr('text-anchor', !isCategorical && horizontal ? 'middle' : 'start')
        .attr('dominant-baseline', textBaseline)
        .attr('x', (_, i) => getX(i, false))
        .attr('y', () => (!isCategorical ? (horizontal ? legendDef.rectHeight + 5 : legendDef.rectHeight) : legendDef.rectHeight / 2))
        .text(d => d[1]);

    if (sampleElem) {
        legendEntries.each(function () {
            reportStyle(sampleElem, select(this).node() as SVGGElement);
        });
    }

    if (willRerun) {
        let maxWidth = 0;
        legendEntries.each(function () {
            maxWidth = Math.max(maxWidth, (select(this).node()! as SVGGElement).getBBox().width);
        });
        legendGroup.remove();
        return drawLegend(legendSelection, legendDef, legendColors, isCategorical, sampleElem, tabName, saveFunc, maxWidth);
    }

    return legendSelection;
}

function getEntryWidths(container: SVGGElement, labels: string[], sampleElem: SVGElement | null): number[] {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    if (sampleElem) reportStyle(sampleElem.querySelector('text')!, text);
    container.append(text);
    const widths = labels.map(label => {
        text.textContent = label;
        return text.getBoundingClientRect().width;
    });
    text.remove();
    return widths;
}
