import { extractTemplateVariables, formatUnicorn } from './util/common';
import type { ElementAnnotations, FormatterObject, Tooltip, TooltipDefs, ZonesData } from './types';

function getMapScale(map: SVGElement): { sx: number; sy: number } {
    const ctm = (map as SVGSVGElement).getScreenCTM();
    return { sx: ctm?.a ?? 1, sy: ctm?.d ?? 1 };
}

export function addTooltipListener(
    map: SVGSVGElement,
    tooltipDefs: TooltipDefs,
    zonesData: ZonesData,
    elementAnnotations?: ElementAnnotations,
): void {
    const tooltip: Tooltip = { shapeId: null, element: document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') };
    map.append(tooltip.element);
    tooltip.element.style.display = 'none';
    tooltip.element.style.pointerEvents = 'none';

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
    tooltip.shapeId = null;
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

    // Element-level annotation takes precedence over macro tooltip
    const ann = elementAnnotations?.[shapeId ?? ''];
    if (ann?.tooltip) {
        const mapBounds = map.getBoundingClientRect();
        return showElementAnnotationTooltip(ann.tooltip, shapeId!, e.clientX, e.clientY, mapBounds, map, tooltip);
    }

    if (!tooltipDefs?.[groupId]?.enabled || !(groupId in zonesData)) return hideTooltip(tooltip);

    const mapBounds = map.getBoundingClientRect();
    let posX = e.clientX - mapBounds.left + 10;
    let posY = e.clientY - mapBounds.top + 10;
    const { sx, sy } = getMapScale(map);

    if (shapeId && tooltip.shapeId === shapeId) {
        // Reposition — tooltip is visible, bounds are available for edge correction
        if (tooltip.measuring) return;
        const ttBounds = (tooltip.element.firstChild?.firstChild as HTMLElement)?.getBoundingClientRect();
        if (ttBounds && ttBounds.width > 0) {
            if (mapBounds.right - ttBounds.width < e.clientX + 10) posX -= ttBounds.width + 20;
            if (mapBounds.bottom - ttBounds.height < e.clientY + 10) posY -= ttBounds.height + 20;
        }
        tooltip.element.setAttribute('x', (posX / sx).toString());
        tooltip.element.setAttribute('y', (posY / sy).toString());
        tooltip.element.setAttribute('transform', `scale(${1 / sx},${1 / sy})`);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = '1';
    } else {
        // New tooltip — create hidden, measure via rAF, then reveal at correct position
        const data = { ...zonesData[groupId].data.find(row => row.name === shapeId) };
        if (!data) return hideTooltip(tooltip);
        const tt = instanciateTooltip(data, groupId, tooltipDefs, zonesData[groupId]?.formatters);
        if (!tt) return hideTooltip(tooltip);
        tooltip.element.replaceWith(tt);
        tooltip.element = tt;
        tooltip.shapeId = shapeId;
        tooltip.element.setAttribute('x', (posX / sx).toString());
        tooltip.element.setAttribute('y', (posY / sy).toString());
        tooltip.element.setAttribute('transform', `scale(${1 / sx},${1 / sy})`);
        tooltip.element.style.opacity = '0';
        tooltip.measuring = true;
        requestAnimationFrame(() => {
            tooltip.measuring = false;
            const newBounds = (tooltip.element.firstChild?.firstChild as HTMLElement)?.getBoundingClientRect();
            if (newBounds && newBounds.width > 0) {
                if (mapBounds.right - newBounds.width < e.clientX + 10) posX -= newBounds.width + 20;
                if (mapBounds.bottom - newBounds.height < e.clientY + 10) posY -= newBounds.height + 20;
                tooltip.element.setAttribute('x', (posX / sx).toString());
                tooltip.element.setAttribute('y', (posY / sy).toString());
            }
            tooltip.element.style.opacity = '1';
        });
    }
}

function showElementAnnotationTooltip(
    html: string,
    shapeId: string,
    clientX: number,
    clientY: number,
    mapBounds: DOMRect,
    map: SVGElement,
    tooltip: Tooltip,
): void {
    const offset = 10;
    let posX = clientX - mapBounds.left + offset;
    let posY = clientY - mapBounds.top + offset;
    const { sx, sy } = getMapScale(map);

    if (tooltip.shapeId !== shapeId || tooltip.html !== html) {
        const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        elem.setAttribute('width', '1');
        elem.setAttribute('height', '1');
        elem.style.overflow = 'visible';
        elem.style.pointerEvents = 'none';

        const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        body.style.cssText = 'display:inline-block;width:max-content;pointer-events:none;';
        body.innerHTML = html;
        body.querySelectorAll('img').forEach(img => { img.style.maxWidth = '100%'; img.style.height = 'auto'; });
        elem.append(body);

        tooltip.element.replaceWith(elem);
        tooltip.element = elem;
        tooltip.shapeId = shapeId;
        tooltip.html = html;
        tooltip.element.setAttribute('x', (posX / sx).toString());
        tooltip.element.setAttribute('y', (posY / sy).toString());
        tooltip.element.setAttribute('transform', `scale(${1 / sx},${1 / sy})`);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = '0';
        tooltip.measuring = true;
        requestAnimationFrame(() => {
            tooltip.measuring = false;
            const ttBounds = (tooltip.element.firstChild as HTMLElement)?.getBoundingClientRect();
            if (ttBounds && ttBounds.width > 0) {
                if (mapBounds.right - ttBounds.width < clientX + offset) posX -= ttBounds.width + offset * 2;
                if (mapBounds.bottom - ttBounds.height < clientY + offset) posY -= ttBounds.height + offset * 2;
                tooltip.element.setAttribute('x', (posX / sx).toString());
                tooltip.element.setAttribute('y', (posY / sy).toString());
            }
            tooltip.element.style.opacity = '1';
        });
    } else {
        if (tooltip.measuring) return;
        const ttBounds = (tooltip.element.firstChild as HTMLElement)?.getBoundingClientRect();
        if (ttBounds && ttBounds.width > 0) {
            if (mapBounds.right - ttBounds.width < clientX + offset) posX -= ttBounds.width + offset * 2;
            if (mapBounds.bottom - ttBounds.height < clientY + offset) posY -= ttBounds.height + offset * 2;
        }
        tooltip.element.setAttribute('x', (posX / sx).toString());
        tooltip.element.setAttribute('y', (posY / sy).toString());
        tooltip.element.setAttribute('transform', `scale(${1 / sx},${1 / sy})`);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = '1';
    }
}

export function addElementAnnotationListener(
    map: SVGSVGElement,
    elementAnnotations: ElementAnnotations,
): void {
    const tooltip: Tooltip = { shapeId: null, element: document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') };
    map.append(tooltip.element);
    tooltip.element.style.display = 'none';
    tooltip.element.style.pointerEvents = 'none';

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
        showElementAnnotationTooltip(ann.tooltip, shapeId, e.clientX, e.clientY, mapBounds, map, tooltip);
    });
}

function instanciateTooltip(
    dataRow: Record<string, any>,
    groupId: string,
    tooltipDefs: TooltipDefs,
    formatters?: FormatterObject,
): SVGElement | undefined {
    if (!dataRow) return;

    const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    elem.setAttribute('width', '1');
    elem.setAttribute('height', '1');
    elem.style.overflow = 'visible';
    elem.style.pointerEvents = 'none';

    const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    body.classList.add('body');
    body.style.pointerEvents = 'none';

    const tooltip = document.createElement('div');
    const cleanTemplate = (tooltipDefs?.[groupId]?.template || '')
        .replace(/<(b|i|u|em|strong|span)>\s*<\/\1>/gi, '')
        .replace(/<div><br\s*\/?><\/div>/gi, '');

    // If all referenced variables are null/empty/zero, don't show tooltip
    const vars = extractTemplateVariables(cleanTemplate).filter(v => v !== 'name');
    if (vars.length > 0 && vars.every(v => !dataRow[v] && dataRow[v] !== false)) return;

    const formattedRow = { ...dataRow };
    if (formatters) {
        for (const [col, fmt] of Object.entries(formatters)) {
            if (col in formattedRow && typeof formattedRow[col] === 'number') {
                formattedRow[col] = fmt(formattedRow[col]);
            }
        }
    }
    tooltip.innerHTML = formatUnicorn(cleanTemplate, (formattedRow) || {});

    // Apply container styles + runtime properties
    const cs = tooltipDefs?.[groupId]?.containerStyle;
    if (cs) {
        for (const [prop, val] of Object.entries(cs)) {
            tooltip.style.setProperty(prop, val as string);
        }
    }
    tooltip.style.setProperty('will-change', 'opacity');
    tooltip.style.setProperty('z-index', '1000');
    tooltip.style.setProperty('width', 'max-content');
    tooltip.style.setProperty('max-width', '15rem');
    tooltip.style.setProperty('line-height', '1.42');

    body.innerHTML = tooltip.outerHTML;
    body.querySelectorAll('img').forEach(img => { img.style.maxWidth = '100%'; img.style.height = 'auto'; });
    elem.append(body);

    return elem;
}
