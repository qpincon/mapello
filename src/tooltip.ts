import { extractTemplateVariables, formatUnicorn } from './util/common';
import { createOverlayHost, placeOverlay, normalizeLengthsInCss, normalizeLengthsInStyleObject } from './svg/overlay';
import type { ElementAnnotations, FormatterObject, Tooltip, TooltipDefs, ZonesData } from './types';

// Creates the single reusable tooltip host for a map — see src/svg/overlay.js for the mechanism.
// This mirrors the technique used in the exported SVG (src/svg/exportScripts/tooltip.js /
// elementAnnotations.js).
// Spread the host rather than listing its fields: placeOverlay() needs every one of them
// (including the calibration probe), and a hand-listed copy silently drops any field added later.
function createTooltipHost(map: SVGSVGElement): Tooltip {
    return { shapeId: null, ...createOverlayHost(map) };
}

// Moves the tooltip so its near corner sits an offset away from the cursor, flipping to the
// opposite side when it would overflow the map's rendered content box. Passes `tooltip` itself —
// it *is* a superset of an overlay host, so there's nothing to reconstruct.
function positionTooltip(tooltip: Tooltip, map: SVGSVGElement, clientX: number, clientY: number): void {
    placeOverlay(tooltip, map, clientX, clientY);
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
        return showElementAnnotationTooltip(
            elementAnnotations![annId].tooltip!, annId, e.clientX, e.clientY, map, tooltip);
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

    if (shapeId && tooltip.shapeId === shapeId) {
        // Reposition — tooltip is already showing the right content
        if (tooltip.measuring) return;
        positionTooltip(tooltip, map, e.clientX, e.clientY);
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
        positionTooltip(tooltip, map, e.clientX, e.clientY);
        requestAnimationFrame(() => {
            tooltip.measuring = false;
            positionTooltip(tooltip, map, e.clientX, e.clientY);
            tooltip.div.style.opacity = '1';
        });
    }
}

function showElementAnnotationTooltip(
    rawHtml: string,
    shapeId: string,
    clientX: number,
    clientY: number,
    map: SVGSVGElement,
    tooltip: Tooltip,
): void {
    // Normalize any rem/em already saved into this annotation's inline style (see
    // normalizeLengthsInCss) — applied at render time so already-saved projects are fixed
    // without a migration.
    const html = normalizeLengthsInCss(rawHtml);
    if (tooltip.shapeId !== shapeId || tooltip.html !== html) {
        tooltip.div.innerHTML = html;
        tooltip.div.querySelectorAll('img').forEach(img => { img.style.maxWidth = '100%'; img.style.height = 'auto'; });
        tooltip.shapeId = shapeId;
        tooltip.html = html;
        tooltip.div.style.opacity = '0';
        tooltip.measuring = true;
        positionTooltip(tooltip, map, clientX, clientY);
        requestAnimationFrame(() => {
            tooltip.measuring = false;
            positionTooltip(tooltip, map, clientX, clientY);
            tooltip.div.style.opacity = '1';
        });
    } else {
        if (tooltip.measuring) return;
        positionTooltip(tooltip, map, clientX, clientY);
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

        showElementAnnotationTooltip(elementAnnotations[shapeId].tooltip!, shapeId, e.clientX, e.clientY, map, tooltip);
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
    tooltip.style.setProperty('font-family', 'system-ui');
    const cs = tooltipDefs?.[groupId]?.containerStyle;
    if (cs) {
        // Defensively normalize rem/em to px (see normalizeLengthsInStyleObject) — user-authored
        // containerStyle values aren't currently sourced from a free-text input, but this keeps
        // instanciateTooltip and getFinalTooltipTemplate (export.ts) behaving identically for
        // any value that ever does end up rem/em-based.
        const normalizedCs = normalizeLengthsInStyleObject(cs);
        for (const [prop, val] of Object.entries(normalizedCs)) {
            tooltip.style.setProperty(prop, val as string);
        }
    }
    tooltip.style.setProperty('will-change', 'opacity');
    tooltip.style.setProperty('z-index', '1000');
    tooltip.style.setProperty('width', 'max-content');
    // px, not rem: an inline SVG's foreignObject content is laid out relative to the *host*
    // page's root font-size, so a rem-based max-width would silently rescale the tooltip
    // depending on where the exported SVG is pasted. 210px = 15rem at the app's own root
    // font-size (14px, see src/assets/global.scss) — this keeps the shipped size matching
    // what the author saw while editing.
    tooltip.style.setProperty('max-width', '210px');
    tooltip.style.setProperty('box-sizing', 'border-box');
    tooltip.style.setProperty('line-height', '1.42');
    tooltip.style.setProperty('overflow-wrap', 'break-word');

    tooltip.querySelectorAll('img').forEach(img => { (img as HTMLImageElement).style.maxWidth = '100%'; (img as HTMLImageElement).style.height = 'auto'; });

    return tooltip.outerHTML;
}
