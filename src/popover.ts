import type { ElementAnnotations } from './types';

let _activeId: string | null = null;
let _fo: SVGForeignObjectElement | null = null;

export function getActivePopoverId(): string | null {
    return _activeId;
}

export function hidePopover(): void {
    if (_fo) { _fo.remove(); _fo = null; }
    _activeId = null;
}

export function showElementPopover(
    elemId: string,
    svgEl: SVGSVGElement,
    elementAnnotations: ElementAnnotations,
): void {
    if (_activeId === elemId) { hidePopover(); return; }
    const ann = elementAnnotations[elemId];
    if (!ann || ann.type !== 'popover') return;
    hidePopover();
    _activeId = elemId;

    const el = svgEl.getElementById(elemId);
    const svgRect = svgEl.getBoundingClientRect();
    const rect = el ? el.getBoundingClientRect() : svgRect;
    const centerX = rect.left + rect.width / 2 - svgRect.left;
    const centerY = rect.top + rect.height / 2 - svgRect.top;

    // Extract user-defined background color for arrow
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = ann.html;
    const bgColor = (tmpDiv.firstElementChild as HTMLElement)?.style?.backgroundColor || 'white';

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject') as SVGForeignObjectElement;
    fo.setAttribute('width', '1');
    fo.setAttribute('height', '1');
    fo.style.overflow = 'visible';
    svgEl.appendChild(fo);
    _fo = fo;

    const wrapper = document.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLElement;
    wrapper.style.cssText = 'display:inline-block;position:relative;';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close';
    closeBtn.style.cssText = 'position:absolute;right:4px;top:4px;font-size:0.6rem;z-index:1;';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); hidePopover(); });

    const content = document.createElement('div');
    content.innerHTML = ann.html;

    const arrow = document.createElement('div');

    wrapper.appendChild(closeBtn);
    wrapper.appendChild(content);
    wrapper.appendChild(arrow);
    fo.appendChild(wrapper);

    // Initial estimate
    fo.setAttribute('x', (centerX - 140).toString());
    fo.setAttribute('y', (centerY - 128).toString());

    requestAnimationFrame(() => {
        if (!_fo) return;
        const w = wrapper.offsetWidth || 280;
        const h = wrapper.offsetHeight || 120;
        const svgW = parseFloat(svgEl.getAttribute('width') ?? '800');

        let x = centerX - w / 2;
        x = Math.max(8, Math.min(x, svgW - w - 8));

        // Top/bottom placement: prefer above, fallback to below
        const yAbove = centerY - h - 8;
        const isAbove = yAbove >= 0;
        const y = isAbove ? yAbove : centerY + 8;

        _fo.setAttribute('x', x.toString());
        _fo.setAttribute('y', y.toString());

        // Arrow: centered on element's centerX, clamped inside popover
        const arrowLeft = Math.max(8, Math.min(Math.round(centerX - x - 8), w - 24));
        if (isAbove) {
            // Popover above → arrow points DOWN at bottom
            arrow.style.cssText = `position:absolute;bottom:-8px;left:${arrowLeft}px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ${bgColor};border-bottom:none;`;
        } else {
            // Popover below → arrow points UP at top
            arrow.style.cssText = `position:absolute;top:-8px;left:${arrowLeft}px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:8px solid ${bgColor};border-top:none;`;
        }
    });
}

export function setupPopoverCursors(
    svgEl: SVGSVGElement,
    elementAnnotations: ElementAnnotations,
): void {
    for (const [id, ann] of Object.entries(elementAnnotations)) {
        if (ann.type !== 'popover') continue;
        const el = svgEl.getElementById(id) as SVGElement | null;
        if (el) el.style.cursor = 'pointer';
    }
}
