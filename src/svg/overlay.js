// Shared geometry/placement helpers for HTML content rendered inside a <foreignObject> on top
// of a Mapello map: data tooltips (src/tooltip.ts), element-annotation tooltips and popovers
// (src/popover.ts), and their standalone-export twins (src/svg/exportScripts/tooltip.js,
// src/svg/exportScripts/elementAnnotations.js).
//
// Dependency-free plain JS (no imports, no TS-only syntax) so this file can be consumed two ways:
//   - imported as a normal ES module by the app (src/tooltip.ts, src/popover.ts);
//   - imported with Vite's `?raw` and textually concatenated into the exported <script> IIFE
//     (its `export` keywords are stripped first — see src/macro/export.ts / src/micro/drawing.ts).
// Both consumers must keep working after that concatenation + terser minification, so avoid
// anything terser or a plain `new Function` body would choke on.
//
// ---------------------------------------------------------------------------------------------
// HOW THE OVERLAY IS KEPT A FIXED ON-SCREEN SIZE, IN EVERY ENGINE
//
// Engines disagree, irreconcilably, about how a <foreignObject>'s HTML contents relate to the
// SVG coordinate system:
//
//   * Chrome/Firefox follow the spec: the viewBox scale applies to the content, and so does any
//     `transform` on the foreignObject.
//   * Safari ignores BOTH. It paints foreignObject content 1:1 in CSS px anchored at the <svg>
//     element's own top-left corner, disregarding the viewBox scale, the foreignObject's x/y and
//     transform, and any transform on an ancestor <g>.
//
// That difference cannot be measured at runtime: Safari's getBoundingClientRect() on the content
// reports the *spec* geometry, not what it actually paints — so probing for it (an approach that
// was tried here) detects nothing.
//
// The resolution is to stop fighting the divergence and arrange for both behaviours to land in
// the same place. Give the foreignObject `transform="scale(1/mapScale)"`:
//
//                        viewBox scale   fo transform   net content scale
//     Chrome / Firefox   applied (s)     applied (1/s)  1
//     Safari             ignored         ignored        1
//
// Both engines end up rendering the content at exactly 1:1 CSS px — no branching, no UA
// sniffing, no feature detection. From there the content is laid out in real screen pixels, so
// the author's `max-width: 210px` and font sizes mean literal on-screen pixels, text wraps at
// the true final width, and the host div needs only a plain CSS `translate` in screen px to
// position it (which Safari does honour). Nothing is counter-scaled, so nothing blurs.
//
// The one assumption left is the ORIGIN: this anchors the content's (0,0) to the <svg> element's
// top-left corner, because that is where Safari puts it. syncHostBox() translates the
// foreignObject so spec-compliant engines agree. For a map whose container matches its aspect
// ratio the two are the same point regardless; they differ only by the letterbox offset.
// ---------------------------------------------------------------------------------------------

/** Cursor offset (CSS px) between the pointer and a tooltip's near corner. */
export const OVERLAY_OFFSET = 12;

/**
 * @typedef {Object} MapGeometry
 * @property {number} scaleX - user-unit -> screen-px factor, horizontal
 * @property {number} scaleY - user-unit -> screen-px factor, vertical
 * @property {number} contentLeft - screen-px X where the rendered map content starts
 * @property {number} contentTop - screen-px Y where the rendered map content starts
 * @property {number} contentW - rendered map content width, screen px
 * @property {number} contentH - rendered map content height, screen px
 * @property {number} rectLeft - screen-px X of the <svg> element's own box (the overlay origin)
 * @property {number} rectTop - screen-px Y of the <svg> element's own box
 * @property {number} rectW - the <svg> element's own box width, screen px
 * @property {number} rectH - the <svg> element's own box height, screen px
 * @property {number} minX - viewBox origin X, user units
 * @property {number} minY - viewBox origin Y, user units
 */

function parsePreserveAspectRatio(value) {
    const parts = (value || 'xMidYMid meet').trim().split(/\s+/);
    const align = parts[0] || 'xMidYMid';
    const meetOrSlice = parts[1] || 'meet';
    return { align: align, meetOrSlice: meetOrSlice };
}

// align is one of 'none' or the 9 SVG alignment tokens (e.g. 'xMidYMid', 'xMinYMax', ...) —
// always 8 chars: a 4-char x-token followed by a 4-char Y-token. Returns 0 (Min), 0.5 (Mid) or
// 1 (Max) for the requested axis.
function alignFraction(align, axis) {
    if (align === 'none') return 0;
    const token = axis === 'x' ? align.slice(0, 4) : align.slice(4);
    if (token.slice(-3) === 'Min') return 0;
    if (token.slice(-3) === 'Max') return 1;
    return 0.5;
}

/**
 * Computes how `mapElement` (the root map <svg>, which may or may not carry a viewBox) maps its
 * own user-unit coordinate system onto the screen right now. Deliberately does not use
 * getScreenCTM(): WebKit has been observed to report a getScreenCTM() that doesn't match the
 * SVG's actual render size/position (both translation and scale) — getBoundingClientRect() is
 * immune to this, since the root <svg> here is only ever scaled, never rotated/skewed.
 * @param {SVGSVGElement} mapElement
 * @returns {MapGeometry}
 */
export function getMapGeometry(mapElement) {
    const rect = mapElement.getBoundingClientRect();
    const base = { rectLeft: rect.left, rectTop: rect.top, rectW: rect.width, rectH: rect.height };
    const vbAttr = (mapElement.getAttribute('viewBox') || '').trim();
    const vb = vbAttr ? vbAttr.split(/[\s,]+/).filter(Boolean) : [];
    if (vb.length < 4) {
        // No viewBox: SVG user units are CSS px 1:1 and there is no scaling — host CSS resizing
        // the <svg> element's CSS box does not rescale its content (unlike a viewBox, which
        // always maps to whatever the current CSS box size is).
        return Object.assign(base, {
            scaleX: 1, scaleY: 1,
            contentLeft: rect.left, contentTop: rect.top,
            contentW: rect.width, contentH: rect.height,
            minX: 0, minY: 0,
        });
    }
    const minX = parseFloat(vb[0]) || 0;
    const minY = parseFloat(vb[1]) || 0;
    const vbW = parseFloat(vb[2]) || 1;
    const vbH = parseFloat(vb[3]) || 1;
    const sx = rect.width / vbW;
    const sy = rect.height / vbH;
    const par = parsePreserveAspectRatio(mapElement.getAttribute('preserveAspectRatio'));
    let scaleX, scaleY;
    if (par.align === 'none') {
        // Non-uniform stretch: no single scale, so the two axes are handled independently.
        scaleX = sx;
        scaleY = sy;
    } else {
        // 'meet' (the default, and what every Mapello export produces) letterboxes to the
        // smaller axis; 'slice' overflows on the larger one. Using rect.width/rect.height
        // independently (as an earlier implementation did) is only correct when the container's
        // aspect ratio happens to match the viewBox's — otherwise it silently squashes the
        // overlay and drifts it from the cursor.
        scaleX = scaleY = par.meetOrSlice === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
    }
    const contentW = vbW * scaleX;
    const contentH = vbH * scaleY;
    return Object.assign(base, {
        scaleX: scaleX,
        scaleY: scaleY,
        contentLeft: rect.left + (rect.width - contentW) * alignFraction(par.align, 'x'),
        contentTop: rect.top + (rect.height - contentH) * alignFraction(par.align, 'y'),
        contentW: contentW,
        contentH: contentH,
        minX: minX, minY: minY,
    });
}

/**
 * Creates a reusable overlay host: one <foreignObject> covering the map, containing one
 * absolutely-positioned XHTML <div> that is moved by its own CSS transform. See the file header
 * for why the foreignObject carries a counter-scale and nothing else.
 *
 * The host div deliberately has no max-width of its own (only `width:max-content`, so it
 * shrink-wraps its child) — the actual width constraint belongs to the author's own styled
 * content div, which is what gets set as its innerHTML. Imposing a second, independent
 * max-width here would silently override the author's, once the two disagree.
 * @param {SVGSVGElement} mapElement
 * @param {{ pointerEvents?: boolean, fallbackFontSize?: number }} [opts]
 */
export function createOverlayHost(mapElement, opts) {
    opts = opts || {};
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', '0');
    fo.setAttribute('y', '0');
    fo.setAttribute('width', '1');
    fo.setAttribute('height', '1');
    fo.style.cssText = 'overflow:visible;' + (opts.pointerEvents ? '' : 'pointer-events:none');
    mapElement.appendChild(fo);

    const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    // The content renders 1:1 with screen px (file header), so this lays out in real on-screen
    // pixels and is only ever translated — never scaled, hence nothing to blur and no need for
    // `will-change: transform`.
    // font-size is a fallback only — real content carries its own explicit, px-based font-size
    // (see normalizeLengthsInCss) — but pin one anyway so content saved before that existed
    // doesn't inherit the host page's font-size.
    div.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;width:max-content;'
        + 'box-sizing:border-box;overflow-wrap:break-word;font-family:system-ui;font-size:'
        + (opts.fallbackFontSize || 14) + 'px;'
        + 'opacity:0;will-change:opacity;' + (opts.pointerEvents ? '' : 'pointer-events:none');
    fo.appendChild(div);

    return { fo: fo, div: div };
}

// Sizes the foreignObject to cover the map and, crucially, gives it the counter-scale that makes
// its HTML contents render 1:1 with screen px in every engine (see the file header).
//
// With `scale(1/mapScale)` in place the foreignObject's own x/y/width/height are expressed in
// screen px, so it is sized to the <svg> element's box. The translate then puts the content's
// (0,0) on the <svg> element's top-left corner — the point Safari anchors to no matter what —
// so both engines share one origin. Re-applied on every placement, so a resized map, a changed
// viewBox or a scrolled page can never leave it stale.
function syncHostBox(host, geo) {
    const invX = geo.scaleX > 0 ? 1 / geo.scaleX : 1;
    const invY = geo.scaleY > 0 ? 1 / geo.scaleY : 1;
    // User-space point that renders at the <svg> box's top-left corner.
    const tx = geo.minX + (geo.rectLeft - geo.contentLeft) * invX;
    const ty = geo.minY + (geo.rectTop - geo.contentTop) * invY;
    host.fo.setAttribute('x', '0');
    host.fo.setAttribute('y', '0');
    host.fo.setAttribute('width', String(Math.max(1, geo.rectW)));
    host.fo.setAttribute('height', String(Math.max(1, geo.rectH)));
    host.fo.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + invX + ',' + invY + ')');
}

// Moves the host div so its top-left corner lands at the ABSOLUTE screen position
// (screenX, screenY). A pure translate in screen px: the content already renders 1:1, and the
// host's origin is the <svg> box's top-left, so this is a plain subtraction.
function setHostTransform(host, geo, screenX, screenY) {
    host.div.style.transform = 'translate(' + (screenX - geo.rectLeft) + 'px,'
        + (screenY - geo.rectTop) + 'px)';
}

/**
 * Positions a tooltip host so its near corner sits `offset` px from (clientX, clientY),
 * flipping to the opposite side when it would overflow the map's rendered content box.
 * Must run after the host's innerHTML is set (and, for a first reveal, after an rAF so
 * offsetWidth/offsetHeight reflect the new content).
 * @param {{fo: SVGForeignObjectElement, div: HTMLElement}} host - pass the whole object returned
 *   by createOverlayHost(); never a hand-built subset of its fields.
 * @param {SVGSVGElement} mapElement
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} [offset]
 */
export function placeOverlay(host, mapElement, clientX, clientY, offset) {
    offset = offset == null ? OVERLAY_OFFSET : offset;
    const geo = getMapGeometry(mapElement);
    syncHostBox(host, geo);

    // Content renders 1:1 with screen px, so these layout numbers are screen px directly.
    const w = host.div.offsetWidth;
    const h = host.div.offsetHeight;

    // Absolute screen coordinates throughout, flipped to stay inside the map's content box.
    let screenX = clientX + offset;
    let screenY = clientY + offset;
    if (w > 0) {
        if (screenX + w > geo.contentLeft + geo.contentW) screenX = clientX - w - offset;
        if (screenY + h > geo.contentTop + geo.contentH) screenY = clientY - h - offset;
    }

    setHostTransform(host, geo, screenX, screenY);
}

/**
 * Positions a popover host centered on `targetEl`, preferring above it and falling back below,
 * clamped to the map's rendered content box, and styles `arrowEl` to point at the target.
 * @param {{fo: SVGForeignObjectElement, div: HTMLElement}} host - pass the whole object returned
 *   by createOverlayHost(); never a hand-built subset of its fields.
 * @param {Element} targetEl
 * @param {SVGSVGElement} mapElement
 * @param {HTMLElement} arrowEl
 * @param {string} bgColor
 */
export function placeOverlayAnchored(host, targetEl, mapElement, arrowEl, bgColor) {
    const geo = getMapGeometry(mapElement);
    syncHostBox(host, geo);

    const w = host.div.offsetWidth || 280;
    const h = host.div.offsetHeight || 120;

    // Absolute screen coordinates throughout, clamped to the map's content box.
    const targetRect = targetEl.getBoundingClientRect();
    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;

    let x = centerX - w / 2;
    x = Math.max(geo.contentLeft + 8, Math.min(x, geo.contentLeft + geo.contentW - w - 8));
    const yAbove = centerY - h - 8;
    const isAbove = yAbove >= geo.contentTop;
    const y = isAbove ? yAbove : centerY + 8;

    setHostTransform(host, geo, x, y);

    // Arrow offset within the popover, in its own (screen-px) units.
    const arrowLeft = Math.max(8, Math.min(Math.round(centerX - x - 8), w - 24));
    if (isAbove) {
        arrowEl.style.cssText = 'position:absolute;bottom:-8px;left:' + arrowLeft + 'px;width:0;height:0;'
            + 'border-left:8px solid transparent;border-right:8px solid transparent;'
            + 'border-top:8px solid ' + bgColor + ';border-bottom:none;';
    } else {
        arrowEl.style.cssText = 'position:absolute;top:-8px;left:' + arrowLeft + 'px;width:0;height:0;'
            + 'border-left:8px solid transparent;border-right:8px solid transparent;'
            + 'border-bottom:8px solid ' + bgColor + ';border-top:none;';
    }
}

// Rewrites `rem`/`em` lengths in a CSS declaration-list string (e.g. "max-width: 15rem; ...") to
// px, using `baseFontSizePx` as the root font-size — the app's own (14px, see global.scss),
// regardless of the *host* page's root font-size. Without this, an inline SVG pasted into a page
// with a different html{font-size} renders `rem`-sized tooltips at the wrong size — the encoded
// dimension no longer matches what the author saw while editing.
// Safe to run over a whole HTML string, not just a bare declaration list: it only rewrites a
// number immediately followed by rem/em, which in this content only ever occurs inside a style
// attribute (Quill's own size presets are all px).
// Also handles already-saved projects (localStorage / user_projects), applied at render/export
// time rather than as a one-off migration.
/**
 * @param {string} cssText
 * @param {number} [baseFontSizePx]
 */
export function normalizeLengthsInCss(cssText, baseFontSizePx) {
    const base = baseFontSizePx || 14;
    return (cssText || '').replace(/(-?[0-9]*\.?[0-9]+)(rem|em)\b/g, (_, num) => {
        const px = parseFloat(num) * base;
        return (Math.round(px * 100) / 100) + 'px';
    });
}

/**
 * Same as normalizeLengthsInCss but for a { prop: value } style object (containerStyle).
 * @param {Record<string, string>} styleObj
 * @param {number} [baseFontSizePx]
 * @returns {Record<string, string>}
 */
export function normalizeLengthsInStyleObject(styleObj, baseFontSizePx) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const key in styleObj) {
        out[key] = normalizeLengthsInCss(styleObj[key], baseFontSizePx);
    }
    return out;
}
