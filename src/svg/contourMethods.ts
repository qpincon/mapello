import { select } from 'd3-selection'
import { appendGlow, glowFilterId } from './svgDefs';
import { color as d3Color, hsl } from 'd3-color';
import type { Color, ContourParams, InlineStyles, SvgSelection, WaterlineParams } from 'src/types';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { GlowParams } from 'src/params';
import type { GeoPath } from 'd3-geo';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Dedupes 'contour-to-dup' so re-running this on an already-processed <image> (incremental
// restyle, see MacroSidebar.svelte) doesn't pile up repeated class tokens.
function withContourToDupClass(existingClass: string | null): string {
    const tokens = new Set((existingClass ?? '').trim().split(/\s+/).filter(Boolean));
    tokens.add('contour-to-dup');
    return [...tokens].join(' ');
}

// encodeURIComponent as the replace() callback keeps the output readable. Kept standalone here
// (not in svg.js) so .toString() below still yields valid, self-contained source for export.
export function encodeSVGDataImage(data: string) {
    const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g;
    if (data.indexOf(`http://www.w3.org/2000/svg`) < 0) {
        data = data.replace(/<svg/g, `<svg xmlns='http://www.w3.org/2000/svg'`);
    }
    data = data.replace(/"/g, `'`);
    data = data.replace(/>\s{1,}</g, `><`);
    data = data.replace(/\s{2,}/g, ` `);
    data = data.replace(symbols, encodeURIComponent);
    return `data:image/svg+xml,${data}`
}
export const encodeSVGDataImageStr = encodeSVGDataImage.toString();

/**
 * Builds the waterline `<mask>` (appended to `defs`) and masked `<rect>` (returned) for a land
 * `<g>`: concentric contour rings echoing outward from the coastline, driven by the `wl-*`
 * attributes set on `gElem` (see appendLandImageNew). Returns `null` if waterlines are disabled.
 *
 * Each ring is a "grow" stroke (white) minus an inner "erase" stroke (black) — since a
 * round-joined stroke is the Minkowski sum of the path with a disc, this carves a true distance
 * band around the coastline rather than an offset curve, so concave coasts and archipelagos are
 * handled correctly. Shipped into the export bundle via Function.prototype.toString() (see
 * appendWaterlinesStr) only when a layer actually uses waterlines, so it must stay self-contained
 * (no imports, closures, or module-level consts).
 */
export function appendWaterlines(gElem: SVGGElement, defs: SVGDefsElement): SVGRectElement | null {
    const svgNs = 'http://www.w3.org/2000/svg';
    const wlCount = parseInt(gElem.getAttribute('wl-count') || '0', 10);
    if (wlCount <= 0) return null;

    const spacing = parseFloat(gElem.getAttribute('wl-spacing') || '0');
    const thickness = parseFloat(gElem.getAttribute('wl-thickness') || '0');
    const wlColor = gElem.getAttribute('wl-color') || '#000';
    // Offset from the coastline stroke's own outer edge, so rings never collide with it.
    const base = parseFloat(gElem.getAttribute('stroke-width') || '0') / 2;
    // Clamp so thickness can't exceed spacing (avoids a negative inner stroke-width).
    const w = Math.min(thickness, spacing * 0.9);
    const viewBoxParts = (gElem.getAttribute('viewBox') || '0 0 0 0').split(' ').map(Number);
    const [vx, vy, vw, vh] = viewBoxParts;

    const mask = document.createElementNS(svgNs, 'mask');
    mask.setAttribute('id', 'w');
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', String(vx));
    mask.setAttribute('y', String(vy));
    mask.setAttribute('width', String(vw));
    mask.setAttribute('height', String(vh));
    // Pure black/white mask renders the same under either color-interpolation mode; set
    // explicitly as cheap insurance.
    mask.setAttribute('style', 'color-interpolation:sRGB');
    // Black floor under all rings, so each ring's erase pass composes consistently regardless
    // of paint order.
    const floor = document.createElementNS(svgNs, 'rect');
    floor.setAttribute('x', String(vx));
    floor.setAttribute('y', String(vy));
    floor.setAttribute('width', String(vw));
    floor.setAttribute('height', String(vh));
    floor.setAttribute('fill', '#000');
    mask.appendChild(floor);
    for (let i = wlCount - 1; i >= 0; i--) {
        // (i+1) so the innermost ring also sits a full `spacing` out from the coastline.
        const o = base + w + (i + 1) * spacing;
        const ring = document.createElementNS(svgNs, 'g');
        ring.setAttribute('opacity', String((wlCount - i) / wlCount));
        const grow = document.createElementNS(svgNs, 'use');
        grow.setAttribute('href', '#s');
        grow.setAttribute('fill', 'none');
        grow.setAttribute('stroke', '#fff');
        grow.setAttribute('stroke-width', String(2 * o));
        grow.setAttribute('stroke-linejoin', 'round');
        grow.setAttribute('stroke-linecap', 'round');
        grow.setAttribute('stroke-dasharray', 'none');
        ring.appendChild(grow);
        const erase = document.createElementNS(svgNs, 'use');
        erase.setAttribute('href', '#s');
        erase.setAttribute('fill', '#000');
        erase.setAttribute('stroke', '#000');
        erase.setAttribute('stroke-width', String(Math.max(0, 2 * (o - w))));
        erase.setAttribute('stroke-linejoin', 'round');
        erase.setAttribute('stroke-linecap', 'round');
        erase.setAttribute('stroke-dasharray', 'none');
        ring.appendChild(erase);
        mask.appendChild(ring);
    }
    defs.appendChild(mask);

    const waterlineRect = document.createElementNS(svgNs, 'rect');
    waterlineRect.setAttribute('x', String(vx));
    waterlineRect.setAttribute('y', String(vy));
    waterlineRect.setAttribute('width', String(vw));
    waterlineRect.setAttribute('height', String(vh));
    waterlineRect.setAttribute('fill', wlColor);
    // Explicit 'none': otherwise inherits the contour stroke from the embedded <svg> root and
    // draws a stray frame line around the whole canvas.
    waterlineRect.setAttribute('stroke', 'none');
    waterlineRect.setAttribute('mask', 'url(#w)');
    return waterlineRect;
}
// Wrapped so minification can't rename it — imageFromSpecialGElem's stringified body calls it
// by the literal name `appendWaterlines`.
export const appendWaterlinesStr = `const appendWaterlines = ${appendWaterlines.toString()};`;

/**
 * Builds a standalone `<svg>` from a contour `<g>` and returns an `<image>` referencing it as a
 * data URI. Two `<use>`s of the geometry are emitted: one under the glow filter (filled, so the
 * filter has an alpha mask to work with), one on top carrying the visible stroke; both are
 * wrapped in a clipped `<g>` when a frame clip is embedded.
 *
 * The source `<g>`'s id/class/style travel onto the built `<image>` unchanged (both in-app and
 * when the export runtime rebuilds it — see gElemsToImages.js). Attributes prefixed `image-` move
 * onto the `<image>` (dropping the prefix); `wl-*` attributes are consumed by appendWaterlines;
 * everything else lands on the embedded `<svg>` root, inherited by both `<use>`s. `clip-path` is
 * handled separately (see embedRefClone), since gElem's own clip-path attribute only matters
 * transiently while it's briefly live in the host document during the export draw-in animation.
 */
export function imageFromSpecialGElem(gElem: SVGGElement) {
    // Must stay fully self-contained: shipped via .toString() into the export bundle (see
    // imageFromSpecialGElemStr below).
    const svgNs = 'http://www.w3.org/2000/svg';
    const embeddedSvg = document.createElementNS(svgNs, 'svg');
    embeddedSvg.setAttribute('xmlns', svgNs);
    embeddedSvg.setAttribute('preserveAspectRatio', 'none');

    const hostFilter = gElem.querySelector(':scope > defs > filter');
    const hostClip = gElem.querySelector(':scope > defs > clipPath');

    const geomGroup = document.createElementNS(svgNs, 'g');
    geomGroup.setAttribute('id', 's');
    gElem.querySelectorAll(':scope > path').forEach(p => {
        const clone = p.cloneNode(true) as Element;
        clone.removeAttribute('pathLength');
        geomGroup.appendChild(clone);
    });
    const defs = document.createElementNS(svgNs, 'defs');
    if (hostFilter) defs.appendChild(hostFilter.cloneNode(true));
    if (hostClip) defs.appendChild(hostClip.cloneNode(true));
    defs.appendChild(geomGroup);
    embeddedSvg.appendChild(defs);

    // appendWaterlines is only shipped into the export bundle when a layer uses it, so guard
    // with typeof (a plain reference would throw if it's absent).
    const waterlineRect = typeof appendWaterlines === 'function' ? appendWaterlines(gElem, defs) : null;

    // Both <use>s share one clip application when a frame clip is embedded.
    const useContainer = hostClip ? document.createElementNS(svgNs, 'g') : embeddedSvg;
    if (hostClip) useContainer.setAttribute('clip-path', `url(#${hostClip.getAttribute('id')})`);
    // Rings paint first so they sit under both the glow and the coastline stroke below.
    if (waterlineRect) useContainer.appendChild(waterlineRect);

    const rootFill = gElem.getAttribute('fill');
    if (hostFilter) {
        const glowUse = document.createElementNS(svgNs, 'use');
        glowUse.setAttribute('href', '#s');
        glowUse.setAttribute('filter', `url(#${hostFilter.getAttribute('id')})`);
        // Filter needs a filled alpha mask to work with, not just an outline; the color only
        // matters when the filter merges SourceGraphic back in (isBaseLayer).
        glowUse.setAttribute('fill', (!rootFill || rootFill === 'none') ? '#000' : rootFill);
        useContainer.appendChild(glowUse);
    }
    const strokeUse = document.createElementNS(svgNs, 'use');
    strokeUse.setAttribute('href', '#s');
    // Force 'none': glowUse already paints the fill (when isBaseLayer) plus the inner glow on
    // top; inheriting rootFill here too would repaint over that inner glow and hide it.
    if (hostFilter) strokeUse.setAttribute('fill', 'none');
    useContainer.appendChild(strokeUse);
    if (hostClip) embeddedSvg.appendChild(useContainer);

    const imageElem = document.createElementNS(svgNs, 'image');
    [...gElem.attributes].forEach(attr => {
        // Skip image-class (pure marker), clip-path (handled via embedRefClone/hostClip —
        // copying it here would dangle or land where it's not wanted), and wl-* (already
        // consumed above).
        if (attr.nodeName === 'image-class' || attr.nodeName === 'clip-path' || attr.nodeName.startsWith('wl-')) return;
        if (attr.nodeName === 'id' || attr.nodeName === 'class' || attr.nodeName === 'style') {
            imageElem.setAttribute(attr.nodeName, attr.nodeValue!);
        }
        else if (attr.nodeName.startsWith('image-')) {
            const attrName = attr.nodeName.slice(6);
            imageElem.setAttribute(attrName, attr.nodeValue!);
        }
        else {
            embeddedSvg.setAttribute(attr.nodeName, attr.nodeValue!)
        }
    });
    const optimized = encodeSVGDataImage(embeddedSvg.outerHTML);
    imageElem.setAttribute('href', optimized);
    return imageElem;
}
// Wrapped in an explicit `const imageFromSpecialGElem = ...` so the name survives minification —
// gElemsToImages.js (loaded via `?raw`) calls it by the literal name `imageFromSpecialGElem`.
export const imageFromSpecialGElemStr = `const imageFromSpecialGElem = ${imageFromSpecialGElem.toString()};`;

/**
 * Clones a host element (by id) into `gElem`'s own `<defs>` under a fixed local id, plus an empty
 * sibling `<g [attrName]="url(#[localId])">` stub that keeps SVGO from treating the clone as
 * unreferenced and dropping it. This makes the referenced element (glow `<filter>` or frame
 * `<clipPath>`) travel with `gElem.innerHTML`, so imageFromSpecialGElem can pick it up with no
 * cross-document lookup — both in-app and inside the stringified export script.
 */
function embedRefClone(gElem: SVGGElement, hostId: string, localId: string, attrName: string): void {
    const hostEl = document.getElementById(hostId);
    if (!hostEl) return;
    const clone = hostEl.cloneNode(true) as Element;
    clone.setAttribute('id', localId);
    let defs = gElem.querySelector(':scope > defs');
    if (!defs) {
        defs = document.createElementNS(SVG_NS, 'defs');
        gElem.prepend(defs);
    }
    defs.appendChild(clone);
    const ref = document.createElementNS(SVG_NS, 'g');
    ref.setAttribute(attrName, `url(#${localId})`);
    defs.after(ref);
}

/**
 * The source `<g>` behind each contour `<image>` is never attached to the visible tree (see
 * appendLandImageNew / appendCountryImageNew) — export still needs it (for SVGO and for rebuilding
 * the `<image>` at runtime), so each produced `<image>` is registered here against its source `<g>`.
 */
const contourSources = new WeakMap<Element, SVGGElement>();
export function getContourSource(imageEl: Element): SVGGElement | undefined {
    return contourSources.get(imageEl);
}

/**
 * Copies the `<image>` attributes built by imageFromSpecialGElem onto the real target element,
 * merging `class` instead of overwriting it since the target already carries its own classes.
 */
function applyImageAttrs(target: SVGImageElement, built: SVGImageElement): void {
    [...built.attributes].forEach(attr => {
        if (attr.nodeName === 'class') {
            target.classList.add(...attr.nodeValue!.split(/\s+/).filter(Boolean));
        } else {
            target.setAttribute(attr.nodeName, attr.nodeValue!);
        }
    });
}

/**
 * Resolves the waterline ring color: the user's explicit choice, or a darkened sea color so rings
 * read as depth contours and follow palette changes. App-only — the resolved value is stamped
 * into `wl-color` before it ever reaches imageFromSpecialGElem / export.
 */
export function resolveWaterlineColor(waterlineParams: WaterlineParams, seaColor: Color): Color {
    if (waterlineParams.color) return waterlineParams.color;
    const parsed = d3Color(seaColor);
    if (!parsed) return seaColor;
    return hsl(parsed)!.darker(1.2).formatHex8() as Color;
}

export interface LandImageOptions {
    /**
     * True when land is the bottom-most painted layer (nothing else sits under it), so its own
     * fill must render as solid ground. False when another layer (e.g. ADM colors) is painted
     * below land, in which case land stays `fill: none` and contributes only its coastline glow,
     * so it doesn't paint over what's underneath. Set by the caller as `i === 0` in the paint
     * order loop — see drawMacro in drawing.ts.
     */
    isBaseLayer: boolean;
    width: number;
    height: number;
    borderWidth: number;
    contourParams: ContourParams;
    waterlineParams: WaterlineParams;
    seaColor: Color;
    land: FeatureCollection<Polygon> | Polygon;
    pathLarger: GeoPath;
    glowParams: GlowParams | undefined;
}

export function appendLandImageNew(this: SVGImageElement, opts: LandImageOptions) {
    const { isBaseLayer, width, height, borderWidth, contourParams, waterlineParams, seaColor, land, pathLarger, glowParams } = opts;
    // Avoids glow bleeding past the view edge where land touches it.
    const offCanvasWithBorder = 20 - (borderWidth / 2);
    // id="land" already set by the caller (drawMacro in drawing.ts).
    select(this)
        .style('pointer-events', 'none')
        .style('will-change', 'transform');

    // Built off-DOM: only `this` (the .macro-layer <image>) is attached to the visible tree (see
    // applyImageAttrs). gElem mirrors this's id/class/style so identity carries onto the rebuilt
    // <image> in-app and on export (gElemsToImages.js), and is registered in contourSources so
    // export can pull the raw vector geometry back out. Its own clip-path (not mirrored from
    // `this`) keeps it clipped correctly while briefly live during the export draw-in animation.
    const gElem = select(document.createElementNS(SVG_NS, 'g') as SVGGElement)
        .attr('id', this.getAttribute('id'))
        .attr('class', withContourToDupClass(this.getAttribute('class')))
        .attr('style', this.getAttribute('style'))
        .attr('clip-path', 'url(#clipMapBorder)')
        .attr('stroke', contourParams.strokeColor)
        .attr('stroke-width', contourParams.strokeWidth)
        .attr('stroke-dasharray', contourParams.strokeDash)
        // Set as inline style too (not just the attribute imageFromSpecialGElem reads): a
        // presentation attribute would lose to a stale stylesheet rule (e.g. a leftover
        // baseCss `#land { fill: ... }`) while gElem is briefly live during the export animation.
        .style('fill', isBaseLayer ? contourParams.fillColor : 'none')
        .attr('fill', isBaseLayer ? contourParams.fillColor : 'none')
        .attr('viewBox', `${-offCanvasWithBorder / 2} ${-offCanvasWithBorder / 2} ${width + offCanvasWithBorder} ${height + offCanvasWithBorder}`)
        .attr('image-x', -offCanvasWithBorder / 2)
        .attr('image-y', -offCanvasWithBorder / 2)
        .attr('image-width', width + (offCanvasWithBorder))
        .attr('image-height', height + (offCanvasWithBorder))
        .attr('image-class', 'contour-to-dup');
    // Only stamped when enabled, so maps without waterlines carry no wl-* attributes/mask/rect.
    if (waterlineParams.enabled && waterlineParams.count > 0) {
        gElem.attr('wl-count', waterlineParams.count)
            .attr('wl-spacing', waterlineParams.spacing)
            .attr('wl-thickness', waterlineParams.thickness)
            .attr('wl-color', resolveWaterlineColor(waterlineParams, seaColor));
    }

    gElem.selectAll('path')
        // @ts-expect-error
        .data(land.features ? land.features : land)
        .join('path')
        .attr('pathLength', 1)
        // @ts-expect-error
        .attr('d', (d) => { return pathLarger(d) });
    if (glowParams) {
        let filterName = glowFilterId('land');
        // Only the base layer paints its own fill, so only it needs a filter variant that also
        // merges that fill back in (SourceGraphic) — see appendGlow's displaySource param.
        if (isBaseLayer) {
            filterName = `${glowFilterId('land')}-with-source`;
            appendGlow(select('#static-svg-map') as unknown as SvgSelection, filterName, isBaseLayer, glowParams);
        }
        embedRefClone(gElem.node() as SVGGElement, filterName, 'f', 'filter');
    }
    embedRefClone(gElem.node() as SVGGElement, 'clipMapBorder', 'c', 'clip-path');

    applyImageAttrs(this, imageFromSpecialGElem(gElem.node() as SVGGElement));
    contourSources.set(this, gElem.node() as SVGGElement);
}

export function appendCountryImageNew(this: SVGImageElement, countryData: Feature<Polygon>, filter: string | null,
    path: GeoPath, inlineStyles: InlineStyles, width: number, height: number) {
    const countryName = countryData.properties!.name;
    const ref = document.getElementById(countryName);

    // Nothing to draw (no filter, no stroke, or country missing): clear any leftover image from
    // a previous incremental restyle (see MacroSidebar.svelte).
    if (filter === null) {
        const strokeWidth = inlineStyles[countryName]?.['stroke-width'];
        if (!strokeWidth || strokeWidth == '0px' || !ref) {
            this.removeAttribute('href');
            this.classList.remove('contour-to-dup');
            contourSources.delete(this);
            return;
        }
    }
    select(this).style('pointer-events', 'none')
        .style('will-change', 'transform')
        .classed('country-img', true);

    const gElem = select(document.createElementNS(SVG_NS, 'g') as SVGGElement)
        .attr('id', this.getAttribute('id'))
        .attr('class', withContourToDupClass(this.getAttribute('class')))
        .attr('style', this.getAttribute('style'))
        .attr('clip-path', 'url(#clipMapBorder)')
        // Same defensive inline style as appendLandImageNew above, for the same reason.
        .style('fill', 'none')
        .attr('fill', 'none')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('image-x', 0)
        .attr('image-y', 0)
        .attr('image-width', width)
        .attr('image-height', height)
        .attr('image-class', 'contour-to-dup');
    gElem.append('path')
        .attr('d', path(countryData))
        .attr('pathLength', 1);
    if (filter) embedRefClone(gElem.node() as SVGGElement, filter, 'f', 'filter');
    embedRefClone(gElem.node() as SVGGElement, 'clipMapBorder', 'c', 'clip-path');

    const pathElem = gElem.select('path');
    if (ref) {
        const strokeParams = ['stroke', 'stroke-width', 'stroke-linejoin', 'stroke-dasharray'];
        const computedRef = window.getComputedStyle(ref);
        const countryStyles = inlineStyles[countryName] || {};
        strokeParams.forEach(p => {
            // @ts-expect-error
            const value = countryStyles[p] ?? computedRef[p];
            pathElem.attr(p, value)
        });
    }
    applyImageAttrs(this, imageFromSpecialGElem(gElem.node() as SVGGElement));
    contourSources.set(this, gElem.node() as SVGGElement);
}
