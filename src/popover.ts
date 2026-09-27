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
import { createOverlayHost, placeOverlayAnchored, normalizeLengthsInCss } from './svg/overlay';

// Module-level state: only one popover can be active at a time.
let _activeId: string | null = null;
let _host: ReturnType<typeof createOverlayHost> | null = null;
let _svgEl: SVGSVGElement | null = null;
let _targetEl: Element | null = null;
let _arrowEl: HTMLElement | null = null;
let _bgColor = 'white';
let _repositionScheduled = false;

export function getActivePopoverId(): string | null {
    return _activeId;
}

function stopTrackingReposition(): void {
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
}

export function hidePopover(): void {
    if (_host) { _host.fo.remove(); _host = null; }
    _activeId = null;
    _svgEl = null;
    _targetEl = null;
    _arrowEl = null;
    stopTrackingReposition();
}

// Since placement is derived entirely from getBoundingClientRect() (see src/svg/overlay.js),
// anything that can move the map or the target on screen without emitting a mousemove/click —
// window resize, or the page (or an ancestor) scrolling — must re-run it while a popover stays
// open, or it silently drifts away from its target.
function reposition(): void {
    if (_repositionScheduled || !_host || !_svgEl || !_targetEl || !_arrowEl) return;
    _repositionScheduled = true;
    requestAnimationFrame(() => {
        _repositionScheduled = false;
        if (!_host || !_svgEl || !_targetEl || !_arrowEl) return;
        placeOverlayAnchored(_host, _targetEl, _svgEl, _arrowEl, _bgColor);
    });
}

/**
 * Shows (or toggles off) a popover for the given element.
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

    const el = svgEl.getElementById(elemId);
    if (!el) return;

    // Parse stored HTML to extract background color for the arrow and strip box-shadow
    // (shadow is applied via CSS filter on the wrapper instead, for cleaner rendering).
    // Normalize any rem/em already saved into this annotation's inline style (see
    // normalizeLengthsInCss) — applied at render time so already-saved projects are fixed
    // without a migration.
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = normalizeLengthsInCss(ann.popover);
    const outerEl = tmpDiv.firstElementChild as HTMLElement | null;
    const bgColor = outerEl?.style?.backgroundColor || 'white';
    if (outerEl) outerEl.style.boxShadow = '';

    const host = createOverlayHost(svgEl, { pointerEvents: true });
    // filter/drop-shadow on the same element that shrink-wraps its content (rather than an
    // extra wrapper level) — WebKitGTK (GNOME Web) has been observed to not respect a
    // descendant's max-width for shrink-to-fit sizing through an extra plain wrapper level,
    // letting text overflow.
    host.div.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,.3))';
    host.div.addEventListener('click', (e) => e.stopPropagation());

    // The popover HTML's own root div carries its width/max-width constraint (e.g.
    // max-width:210px) inline — set directly as the host's content.
    host.div.innerHTML = tmpDiv.innerHTML;
    host.div.querySelectorAll('img').forEach(img => { (img as HTMLImageElement).style.maxWidth = '100%'; (img as HTMLImageElement).style.height = 'auto'; });

    const arrow = document.createElement('div');
    host.div.appendChild(arrow);

    _activeId = elemId;
    _host = host;
    _svgEl = svgEl;
    _targetEl = el;
    _arrowEl = arrow;
    _bgColor = bgColor;

    // Measure actual size and finalize position + arrow placement
    requestAnimationFrame(() => {
        if (_activeId !== elemId || !_host) return;
        placeOverlayAnchored(_host, el, svgEl, arrow, bgColor);
        _host.div.style.opacity = '1';
    });

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
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
