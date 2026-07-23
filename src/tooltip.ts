import { extractTemplateVariables, formatUnicorn } from './util/common';
import type { ElementAnnotations, FormatterObject, Tooltip, TooltipDefs, ZonesData } from './types';

// Positioning offset (screen px) between the cursor and the tooltip's near corner.
const TOOLTIP_OFFSET = 12;

// Reads the map's own size (and viewBox origin) in its local (viewBox / user-unit)
// coordinate system — the same coordinate system a directly-appended <foreignObject>
// renders in. Mirrors _getSvgSize() in src/svg/exportScripts/elementAnnotations.js.
function getSvgSize(map: SVGSVGElement): { w: number; h: number; minX: number; minY: number } {
    const vb = map.getAttribute('viewBox')?.split(/[\s,]+/) ?? [];
    if (vb.length >= 4) return { minX: parseFloat(vb[0]) || 0, minY: parseFloat(vb[1]) || 0, w: parseFloat(vb[2]), h: parseFloat(vb[3]) };
    return {
        minX: 0,
        minY: 0,
        w: parseFloat(map.getAttribute('width') || '') || map.clientWidth,
        h: parseFloat(map.getAttribute('height') || '') || map.clientHeight,
    };
}

// Creates the single reusable tooltip host for a map: one full-size <foreignObject>
// (so Safari doesn't clip content overflowing a tightly-sized foreignObject) containing
// one absolutely-positioned XHTML <div> that is moved via a CSS transform. This mirrors
// the technique used in the exported SVG (src/svg/exportScripts/elementAnnotations.js),
// which Safari handles correctly, unlike mutating a foreignObject's x/y/opacity in place.
function createTooltipHost(map: SVGSVGElement): Tooltip {
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', '0');
    fo.setAttribute('y', '0');
    const size = getSvgSize(map);
    fo.setAttribute('width', String(size.w || 1));
    fo.setAttribute('height', String(size.h || 1));
    fo.style.cssText = 'overflow:visible;pointer-events:none';
    map.append(fo);

    const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLDivElement;
    div.style.cssText = 'position:absolute;left:0;top:0;width:max-content;opacity:0;pointer-events:none;'
        + 'transform-origin:0 0;will-change:transform,opacity;overflow-wrap:break-word';
    fo.appendChild(div);

    return { shapeId: null, fo, div };
}

// Scale and screen-origin are derived entirely from getBoundingClientRect() + the
// viewBox/width/height attributes — not from map.getScreenCTM(). WebKit has been observed
// to report a getScreenCTM() that doesn't match the SVG's actual render size/position
// (both the e/f translation and the a/d scale), which pushed tooltips off from the cursor
// and, when the SVG was CSS-stretched to a much larger size, shrank them and dampened how
// far they tracked the cursor. getBoundingClientRect() is immune to this: the root <svg>
// here is only ever scaled (never rotated/skewed), so renderedSize/viewBoxSize is exactly
// the scale getScreenCTM() would give in a bug-free browser.
function getSvgScreenTransform(map: SVGSVGElement, mapBounds: DOMRect): { invSx: number; invSy: number; svgLeft: number; svgTop: number } {
    const { w, h, minX, minY } = getSvgSize(map);
    const sx = w > 0 ? mapBounds.width / w : 1;
    const sy = h > 0 ? mapBounds.height / h : 1;
    return {
        invSx: 1 / sx,
        invSy: 1 / sy,
        svgLeft: mapBounds.left - sx * minX,
        svgTop: mapBounds.top - sy * minY,
    };
}

// Moves the tooltip's inner div so its near corner sits `TOOLTIP_OFFSET` px from the
// cursor, flipping to the opposite side of the cursor when it would overflow `mapBounds`.
function positionTooltip(tooltip: Tooltip, map: SVGSVGElement, clientX: number, clientY: number, mapBounds: DOMRect): void {
    const { invSx, invSy, svgLeft, svgTop } = getSvgScreenTransform(map, mapBounds);
    let posX = clientX - svgLeft + TOOLTIP_OFFSET;
    let posY = clientY - svgTop + TOOLTIP_OFFSET;
    if (tooltip.div.offsetWidth > 0) {
        if (posX + tooltip.div.offsetWidth > mapBounds.width) posX = clientX - svgLeft - tooltip.div.offsetWidth - TOOLTIP_OFFSET;
        if (posY + tooltip.div.offsetHeight > mapBounds.height) posY = clientY - svgTop - tooltip.div.offsetHeight - TOOLTIP_OFFSET;
    }
    tooltip.div.style.transform = `matrix(${invSx},0,0,${invSy},${posX * invSx},${posY * invSy})`;
}

// Walks up from the hovered target to the nearest ancestor (self included) whose id
// is a key in elementAnnotations with a tooltip. Needed because some entities (freehand
// drawings, labels) have id-bearing children (path/tspan) that shadow the annotated
// container (the .freehand group / the text element) — a plain "first id-bearing ancestor"
// lookup would stop on the child and miss the annotation.
function findTooltipAnnotationId(
    target: EventTarget | null,
    elementAnnotations?: ElementAnnotations,
): string | null {
    let el = target instanceof SVGElement ? target : null;
    while (el) {
        const id = el.getAttribute('id');
        if (id && elementAnnotations?.[id]?.tooltip) return id;
        el = el.parentElement instanceof SVGElement ? el.parentElement : null;
    }
    return null;
}

export function addTooltipListener(
    map: SVGSVGElement,
    tooltipDefs: TooltipDefs,
    zonesData: ZonesData,
    elementAnnotations?: ElementAnnotations,
): void {
    const tooltip = createTooltipHost(map);

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
    tooltip.div.style.opacity = '0';
    tooltip.shapeId = null;
    tooltip.html = undefined;
}

function onMouseMove(
    e: MouseEvent,
    map: SVGSVGElement,
    tooltipDefs: TooltipDefs,
    zonesData: ZonesData,
    tooltip: Tooltip,
    elementAnnotations?: ElementAnnotations,
): void {
    // Element-level annotation takes precedence over macro tooltip
    const annId = findTooltipAnnotationId(e.target, elementAnnotations);
    if (annId) {
        const mapBounds = map.getBoundingClientRect();
        return showElementAnnotationTooltip(
            elementAnnotations![annId].tooltip!, annId, e.clientX, e.clientY, mapBounds, map, tooltip);
    }

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

    if (!tooltipDefs?.[groupId]?.enabled || !(groupId in zonesData)) return hideTooltip(tooltip);

    const mapBounds = map.getBoundingClientRect();

    if (shapeId && tooltip.shapeId === shapeId) {
        // Reposition — tooltip is already showing the right content
        if (tooltip.measuring) return;
        positionTooltip(tooltip, map, e.clientX, e.clientY, mapBounds);
        tooltip.div.style.opacity = '1';
    } else {
        // New tooltip — fill content hidden, measure via rAF, then reveal at correct position
        const data = { ...zonesData[groupId].data.find(row => row.name === shapeId) };
        if (!data) return hideTooltip(tooltip);
        const html = instanciateTooltip(data, groupId, tooltipDefs, zonesData[groupId]?.formatters);
        if (!html) return hideTooltip(tooltip);
        tooltip.div.innerHTML = html;
        tooltip.shapeId = shapeId;
        tooltip.html = html;
        tooltip.div.style.opacity = '0';
        tooltip.measuring = true;
        positionTooltip(tooltip, map, e.clientX, e.clientY, mapBounds);
        requestAnimationFrame(() => {
            tooltip.measuring = false;
            positionTooltip(tooltip, map, e.clientX, e.clientY, mapBounds);
            tooltip.div.style.opacity = '1';
        });
    }
}

function showElementAnnotationTooltip(
    html: string,
    shapeId: string,
    clientX: number,
    clientY: number,
    mapBounds: DOMRect,
    map: SVGSVGElement,
    tooltip: Tooltip,
): void {
    if (tooltip.shapeId !== shapeId || tooltip.html !== html) {
        tooltip.div.innerHTML = html;
        tooltip.div.querySelectorAll('img').forEach(img => { img.style.maxWidth = '100%'; img.style.height = 'auto'; });
        tooltip.shapeId = shapeId;
        tooltip.html = html;
        tooltip.div.style.opacity = '0';
        tooltip.measuring = true;
        positionTooltip(tooltip, map, clientX, clientY, mapBounds);
        requestAnimationFrame(() => {
            tooltip.measuring = false;
            positionTooltip(tooltip, map, clientX, clientY, mapBounds);
            tooltip.div.style.opacity = '1';
        });
    } else {
        if (tooltip.measuring) return;
        positionTooltip(tooltip, map, clientX, clientY, mapBounds);
        tooltip.div.style.opacity = '1';
    }
}

export function addElementAnnotationListener(
    map: SVGSVGElement,
    elementAnnotations: ElementAnnotations,
): void {
    const tooltip = createTooltipHost(map);

    map.addEventListener('mouseleave', () => hideTooltip(tooltip));
    map.addEventListener('mousemove', (e: MouseEvent) => {
        const shapeId = findTooltipAnnotationId(e.target, elementAnnotations);
        if (!shapeId) return hideTooltip(tooltip);

        const mapBounds = map.getBoundingClientRect();
        showElementAnnotationTooltip(elementAnnotations[shapeId].tooltip!, shapeId, e.clientX, e.clientY, mapBounds, map, tooltip);
    });
}

// Builds the tooltip's inner HTML for a macro-layer data row, or undefined if there's
// nothing worth showing (all referenced template variables are empty).
function instanciateTooltip(
    dataRow: Record<string, any>,
    groupId: string,
    tooltipDefs: TooltipDefs,
    formatters?: FormatterObject,
): string | undefined {
    if (!dataRow) return;

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

    const tooltip = document.createElement('div');
    tooltip.innerHTML = formatUnicorn(cleanTemplate, formattedRow || {});

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
    tooltip.style.setProperty('overflow-wrap', 'break-word');

    tooltip.querySelectorAll('img').forEach(img => { (img as HTMLImageElement).style.maxWidth = '100%'; (img as HTMLImageElement).style.height = 'auto'; });

    return tooltip.outerHTML;
}
