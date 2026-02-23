import { reportStyle } from './util/dom';
import { formatUnicorn, htmlToElement } from './util/common';
import type { ElementAnnotations, Tooltip, TooltipDefs, ZonesData } from './types';

export function addTooltipListener(
    map: SVGSVGElement,
    tooltipDefs: TooltipDefs,
    zonesData: ZonesData,
    elementAnnotations?: ElementAnnotations,
): void {
    const tooltip: Tooltip = { shapeId: null, element: document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') };
    map.append(tooltip.element);
    tooltip.element.style.display = 'none';

    let hoveredPath: SVGPathElement | null = null;
    let zOrderElem: SVGElement | null = null;
    let originalIndex: number | null = null;

    function clearHover(): void {
        if (!hoveredPath) return;
        hoveredPath.classList.remove('hovered');
        const parent = zOrderElem?.parentNode as SVGElement;
        if (originalIndex !== null && parent) {
            parent.insertBefore(zOrderElem!, parent.children[originalIndex]);
        }
        hoveredPath = null;
        zOrderElem = null;
        originalIndex = null;
    }

    map.addEventListener('mouseleave', () => {
        hideTooltip(tooltip);
        clearHover();
    });

    map.addEventListener('mousemove', (e: MouseEvent) => {
        onMouseMove(e, map, tooltipDefs, zonesData, tooltip, elementAnnotations);

        const target = e.target;
        let pathElem: SVGPathElement | null = null;
        let zElem: SVGElement | null = null;
        if (target instanceof SVGPathElement) {
            pathElem = target;
            const par = target.parentElement;
            zElem = par?.tagName.toLowerCase() === 'a' ? par : target;
        } else if ((target as SVGElement).tagName?.toLowerCase() === 'a') {
            pathElem = (target as SVGElement).querySelector('path');
            zElem = target as SVGElement;
        }
        const gParent = zElem?.parentElement;
        if (pathElem && gParent?.tagName === 'g') {
            if (hoveredPath !== pathElem) {
                clearHover();
                originalIndex = Array.from(gParent.children).indexOf(zElem!);
                gParent.append(zElem!);
                pathElem.classList.add('hovered');
                hoveredPath = pathElem;
                zOrderElem = zElem;
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
    tooltip: Tooltip,
    elementAnnotations?: ElementAnnotations,
): void {
    let parent = e.target instanceof SVGElement ? e.target.parentNode as SVGElement | null : null;
    while (parent && !parent.hasAttribute('id')) {
        parent = parent.parentNode as SVGElement | null;
    }
    if (!parent) return hideTooltip(tooltip);

    const groupId = parent.getAttribute('id')!;

    let shapeElem = e.target as SVGElement;
    if (!shapeElem.getAttribute('id') && shapeElem.tagName.toLowerCase() === 'a') {
        shapeElem = (shapeElem.querySelector('[id]') as SVGElement) ?? shapeElem;
    }
    const shapeId = shapeElem.getAttribute('id');
    const mapBounds = map.getBoundingClientRect();
    const ttBounds = (tooltip.element.firstChild?.firstChild as HTMLElement)?.getBoundingClientRect();
    let posX = e.clientX - mapBounds.left + 10;
    let posY = e.clientY - mapBounds.top + 10;

    // Element-level annotation takes precedence over macro tooltip
    const ann = elementAnnotations?.[shapeId ?? ''];
    if (ann?.tooltip) {
        return showElementAnnotationTooltip(ann.tooltip, shapeId!, posX, posY, map, tooltip);
    }

    if (!tooltipDefs?.[groupId]?.enabled) return hideTooltip(tooltip);

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
            onMouseMove(e, map, tooltipDefs, zonesData, tooltip, elementAnnotations);
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

function showElementAnnotationTooltip(
    html: string,
    shapeId: string,
    posX: number,
    posY: number,
    map: SVGElement,
    tooltip: Tooltip,
): void {
    if (tooltip.shapeId !== shapeId) {
        const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        elem.setAttribute('width', '1');
        elem.setAttribute('height', '1');
        elem.style.overflow = 'visible';
        elem.style.pointerEvents = 'none';

        const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        body.style.cssText = 'display:inline-block;width:max-content;';
        body.innerHTML = html;
        elem.append(body);

        tooltip.element.replaceWith(elem);
        tooltip.element = elem;
        tooltip.shapeId = shapeId;
    }
    tooltip.element.setAttribute('x', posX.toString());
    tooltip.element.setAttribute('y', posY.toString());
    tooltip.element.style.display = 'block';
    tooltip.element.style.opacity = '1';
}

export function addElementAnnotationListener(
    map: SVGSVGElement,
    elementAnnotations: ElementAnnotations,
): void {
    const tooltip: Tooltip = { shapeId: null, element: document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') };
    map.append(tooltip.element);
    tooltip.element.style.display = 'none';

    map.addEventListener('mouseleave', () => hideTooltip(tooltip));
    map.addEventListener('mousemove', (e: MouseEvent) => {
        let el: SVGElement | null = e.target instanceof SVGElement ? e.target : null;
        while (el && !el.getAttribute('id')) {
            el = el.parentElement instanceof SVGElement ? el.parentElement : null;
        }
        if (!el) return hideTooltip(tooltip);
        const shapeId = el.getAttribute('id');
        if (!shapeId) return hideTooltip(tooltip);

        const ann = elementAnnotations[shapeId];
        if (!ann?.tooltip) return hideTooltip(tooltip);

        const mapBounds = map.getBoundingClientRect();
        let posX = e.clientX - mapBounds.left + 12;
        const posY = e.clientY - mapBounds.top + 12;

        // Fix right-edge clipping: shift tooltip to the left if it would overflow
        const ttBounds = (tooltip.element.firstChild?.firstChild as HTMLElement)?.getBoundingClientRect();
        if (ttBounds?.width > 0 && mapBounds.right - ttBounds.width < e.clientX + 12) {
            posX -= ttBounds.width + 24;
        }

        showElementAnnotationTooltip(ann.tooltip, shapeId, posX, posY, map, tooltip);
    });
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
