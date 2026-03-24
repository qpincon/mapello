/**
 * Popover display for element annotations.
 *
 * Renders a popover (stored HTML content) inside an SVG foreignObject, positioned
 * above or below the target element with a small arrow pointing at it.
 * Toggling: clicking the same element again hides the popover.
 *
 * The popover HTML is stored as `<div style="...">content</div>` in
 * `commonState.elementAnnotations[elemId].popover`. The outer div's background-color
 * is extracted to color the arrow tip for visual continuity.
 */
import type { ElementAnnotations } from './types';

// Module-level state: only one popover can be active at a time
let _activeId: string | null = null;
let _fo: SVGForeignObjectElement | null = null;

export function getActivePopoverId(): string | null {
    return _activeId;
}

export function hidePopover(): void {
    if (_fo) { _fo.remove(); _fo = null; }
    _activeId = null;
}

/**
 * Shows (or toggles off) a popover for the given element.
 * Creates a foreignObject with 1x1 size + overflow:visible so the popover
 * content can extend beyond its bounds without clipping.
 */
export function showElementPopover(
    elemId: string,
    svgEl: SVGSVGElement,
    elementAnnotations: ElementAnnotations,
): void {
    // Toggle off if already showing this element's popover
    if (_activeId === elemId) { hidePopover(); return; }
    const ann = elementAnnotations[elemId];
    if (!ann?.popover) return;
    hidePopover();
    _activeId = elemId;

    // Compute center of the target element in SVG coordinate space
    const el = svgEl.getElementById(elemId);
    const svgRect = svgEl.getBoundingClientRect();
    const rect = el ? el.getBoundingClientRect() : svgRect;
    const centerX = rect.left + rect.width / 2 - svgRect.left;
    const centerY = rect.top + rect.height / 2 - svgRect.top;

    // Parse stored HTML to extract background color for the arrow and strip box-shadow
    // (shadow is applied via CSS filter on the wrapper instead, for cleaner rendering)
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = ann.popover;
    const outerEl = tmpDiv.firstElementChild as HTMLElement | null;
    const bgColor = outerEl?.style?.backgroundColor || 'white';
    if (outerEl) outerEl.style.boxShadow = '';

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') as SVGForeignObjectElement;
    fo.setAttribute('width', '1');
    fo.setAttribute('height', '1');
    fo.style.overflow = 'visible';
    svgEl.appendChild(fo);
    _fo = fo;

    const wrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLElement;
    wrapper.style.cssText = 'display:inline-block;position:relative;filter:drop-shadow(0 2px 6px rgba(0,0,0,.3));';
    wrapper.addEventListener('click', (e) => e.stopPropagation());

    const content = document.createElement('div');
    content.innerHTML = tmpDiv.innerHTML;

    const arrow = document.createElement('div');

    wrapper.appendChild(content);
    wrapper.appendChild(arrow);
    fo.appendChild(wrapper);

    // Place roughly centered above the element; refined in rAF once layout is measured
    fo.setAttribute('x', (centerX - 140).toString());
    fo.setAttribute('y', (centerY - 128).toString());

    // Measure actual size and finalize position + arrow placement
    requestAnimationFrame(() => {
        if (!_fo) return;
        const w = wrapper.offsetWidth || 280;
        const h = wrapper.offsetHeight || 120;
        const svgW = parseFloat(svgEl.getAttribute('width') ?? '800');

        // Horizontal: centered on element, clamped to SVG bounds
        let x = centerX - w / 2;
        x = Math.max(8, Math.min(x, svgW - w - 8));

        // Vertical: prefer above the element, fall back to below if not enough space
        const yAbove = centerY - h - 8;
        const isAbove = yAbove >= 0;
        const y = isAbove ? yAbove : centerY + 8;

        _fo.setAttribute('x', x.toString());
        _fo.setAttribute('y', y.toString());

        // Arrow: CSS triangle centered on the element's centerX, clamped inside the popover
        const arrowLeft = Math.max(8, Math.min(Math.round(centerX - x - 8), w - 24));
        if (isAbove) {
            arrow.style.cssText = `position:absolute;bottom:-8px;left:${arrowLeft}px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ${bgColor};border-bottom:none;`;
        } else {
            arrow.style.cssText = `position:absolute;top:-8px;left:${arrowLeft}px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:8px solid ${bgColor};border-top:none;`;
        }
    });
}

/** Sets cursor:pointer on all SVG elements that have a popover annotation. */
export function setupPopoverCursors(
    svgEl: SVGSVGElement,
    elementAnnotations: ElementAnnotations,
): void {
    for (const [id, ann] of Object.entries(elementAnnotations)) {
        if (!ann.popover) continue;
        const el = svgEl.getElementById(id) as SVGElement | null;
        if (el) el.style.cursor = 'pointer';
    }
}
