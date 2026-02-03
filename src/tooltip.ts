import { reportStyle } from './util/dom';
import { formatUnicorn, htmlToElement } from './util/common';
import type { Tooltip, TooltipDefs, ZonesData } from './types';

export function addTooltipListener(
    map: SVGSVGElement,
    tooltipDefs: TooltipDefs,
    zonesData: ZonesData
): void {
    const tooltip: Tooltip = { shapeId: null, element: document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') };
    map.append(tooltip.element);
    tooltip.element.style.display = 'none';

    let hoveredPath: SVGPathElement | null = null;
    let originalIndex: number | null = null;

    function clearHover(): void {
        if (!hoveredPath) return;
        hoveredPath.classList.remove('hovered');
        const parent = hoveredPath.parentNode as SVGElement;
        if (originalIndex !== null && parent) {
            parent.insertBefore(hoveredPath, parent.children[originalIndex]);
        }
        hoveredPath = null;
        originalIndex = null;
    }

    map.addEventListener('mouseleave', () => {
        hideTooltip(tooltip);
        clearHover();
    });

    map.addEventListener('mousemove', (e: MouseEvent) => {
        onMouseMove(e, map, tooltipDefs, zonesData, tooltip);

        const target = e.target;
        const parent = target instanceof SVGElement ? target.parentNode as SVGElement : null;

        if (target instanceof SVGPathElement && parent?.tagName === 'g') {
            if (hoveredPath !== target) {
                clearHover();
                originalIndex = Array.from(parent.children).indexOf(target);
                parent.append(target);
                target.classList.add('hovered');
                hoveredPath = target;
            }
        } else {
            clearHover();
        }
    });
}

function hideTooltip(tooltip: Tooltip): void {
    tooltip.element.style.display = 'none';
    tooltip.element.style.opacity = '0';
}

function onMouseMove(
    e: MouseEvent,
    map: SVGElement,
    tooltipDefs: TooltipDefs,
    zonesData: ZonesData,
    tooltip: Tooltip
): void {
    const parent = e.target instanceof SVGElement ? e.target.parentNode as SVGElement : null;
    if (!parent?.hasAttribute?.("id")) return hideTooltip(tooltip);

    const groupId = parent.getAttribute('id')!;
    if (!tooltipDefs?.[groupId]?.enabled) return hideTooltip(tooltip);

    const shapeId = (e.target as SVGElement).getAttribute('id');
    const mapBounds = map.getBoundingClientRect();
    const ttBounds = (tooltip.element.firstChild?.firstChild as HTMLElement)?.getBoundingClientRect();
    let posX = e.clientX - mapBounds.left + 10;
    let posY = e.clientY - mapBounds.top + 10;
    let tooltipVisibleOpacity = 1;

    if (ttBounds?.width > 0) {
        if (mapBounds.right - ttBounds.width < e.clientX + 10) {
            posX -= ttBounds.width + 20;
        }
        if (mapBounds.bottom - ttBounds.height < e.clientY + 10) {
            posY -= ttBounds.height + 20;
        }
    } else if (groupId in zonesData) {
        tooltipVisibleOpacity = 0;
        setTimeout(() => {
            onMouseMove(e, map, tooltipDefs, zonesData, tooltip);
        }, 0);
    }

    if (!(groupId in zonesData)) {
        hideTooltip(tooltip);
    } else if (shapeId && tooltip.shapeId === shapeId) {
        tooltip.element.setAttribute('x', posX.toString());
        tooltip.element.setAttribute('y', posY.toString());
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = tooltipVisibleOpacity.toString();
    } else {
        const data = { ...zonesData[groupId].data.find(row => row.name === shapeId) };
        zonesData[groupId].numericCols.forEach(colDef => {
            const col = colDef.column;
            data[col] = zonesData[groupId].formatters![col](data[col] as number);
        });
        if (!data) {
            tooltip.element.style.display = 'none';
            tooltip.element.style.opacity = '0';
            return;
        }
        const tt = instanciateTooltip(data, groupId, tooltipDefs);
        if (!tt) return;
        tooltip.element.replaceWith(tt);
        tooltip.element = tt;
        tooltip.shapeId = shapeId;
        tooltip.element.setAttribute('x', posX.toString());
        tooltip.element.setAttribute('y', posY.toString());
        tooltip.element.style.opacity = tooltipVisibleOpacity.toString();
    }
}

function instanciateTooltip(
    dataRow: Record<string, any>,
    groupId: string,
    tooltipDefs: TooltipDefs
): SVGElement | undefined {
    if (!dataRow) return;

    const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    elem.setAttribute('width', '1');
    elem.setAttribute('height', '1');
    elem.style.overflow = 'visible';

    const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    body.classList.add('body');

    const tooltip = document.createElement('div');
    tooltip.innerHTML = formatUnicorn(tooltipDefs?.[groupId]?.template, (dataRow) || '');
    reportStyle(htmlToElement(tooltipDefs?.[groupId]?.content || '')!, tooltip);

    body.innerHTML = tooltip.outerHTML;
    elem.append(body);

    return elem;
}
