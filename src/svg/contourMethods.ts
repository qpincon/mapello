import { select } from 'd3-selection'
import { appendGlow, glowFilterId } from './svgDefs';
import type { ContourParams, InlineStyles, SvgSelection } from 'src/types';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { GlowParams } from 'src/params';
import type { GeoPath } from 'd3-geo';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Using encodeURIComponent() as replacement function
// allows to keep result code readable
// should be in svg.js, but if we import, the toString method on function will not work properly
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
 * Builds a standalone `<svg>` from a contour `<g>` (geometry + an optional embedded glow
 * `<filter>`, see embedFilterClone) and returns an `<image>` referencing it as a data URI.
 * Two `<use>` of the same geometry are emitted: one under the glow filter (filled, so the
 * filter has a solid alpha mask to work with), one on top carrying the visible stroke.
 *
 * The source `<g>` carries its layer identity directly — `id`/`class`/`clip-path`/`style`
 * (see appendLandImageNew / appendCountryImageNew) — so that identity travels onto the built
 * `<image>` unchanged (both here, in-app, and when the exported runtime script rebuilds the
 * image from the same `<g>` — see gElemsToImages.js); it is NOT copied onto the embedded `<svg>`
 * root, where `clip-path` in particular would be a dangling reference (the id it points at
 * lives in the host document, unreachable from inside a data URI). `image-class` is a pure
 * marker for gElemsToImages.js's `g[image-class]` lookup and carries no value of its own.
 * Attributes prefixed `image-` (besides `image-class`) move onto the `<image>` too (dropping
 * the prefix); everything else moves onto the embedded `<svg>` root, where it is inherited by
 * both `<use>`s exactly as it would be inherited by the original `<g>`'s children.
 */
export function imageFromSpecialGElem(gElem: SVGGElement) {
    // Everything this function touches must be self-contained: it's shipped into the exported
    // SVG via Function.prototype.toString() (see imageFromSpecialGElemStr below), so it cannot
    // reference module-level consts, imports, or anything else outside its own body.
    const svgNs = 'http://www.w3.org/2000/svg';
    const embeddedSvg = document.createElementNS(svgNs, 'svg');
    embeddedSvg.setAttribute('xmlns', svgNs);
    embeddedSvg.setAttribute('preserveAspectRatio', 'none');

    const hostFilter = gElem.querySelector(':scope > defs > filter');

    const geomGroup = document.createElementNS(svgNs, 'g');
    geomGroup.setAttribute('id', 's');
    gElem.querySelectorAll(':scope > path').forEach(p => {
        const clone = p.cloneNode(true) as Element;
        clone.removeAttribute('pathLength');
        geomGroup.appendChild(clone);
    });
    const defs = document.createElementNS(svgNs, 'defs');
    if (hostFilter) defs.appendChild(hostFilter.cloneNode(true));
    defs.appendChild(geomGroup);
    embeddedSvg.appendChild(defs);

    const rootFill = gElem.getAttribute('fill');
    if (hostFilter) {
        const glowUse = document.createElementNS(svgNs, 'use');
        glowUse.setAttribute('href', '#s');
        glowUse.setAttribute('filter', `url(#${hostFilter.getAttribute('id')})`);
        // The filter needs a filled alpha mask to dilate/erode/blur, not just a stroke outline;
        // the actual color only matters when the filter merges SourceGraphic back in (showSource).
        glowUse.setAttribute('fill', (!rootFill || rootFill === 'none') ? '#000' : rootFill);
        embeddedSvg.appendChild(glowUse);
    }
    const strokeUse = document.createElementNS(svgNs, 'use');
    strokeUse.setAttribute('href', '#s');
    embeddedSvg.appendChild(strokeUse);

    const imageElem = document.createElementNS(svgNs, 'image');
    [...gElem.attributes].forEach(attr => {
        if (attr.nodeName === 'image-class') return;
        if (attr.nodeName === 'id' || attr.nodeName === 'class' || attr.nodeName === 'clip-path' || attr.nodeName === 'style') {
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
export const imageFromSpecialGElemStr = imageFromSpecialGElem.toString();

/**
 * Clones an existing host `<filter>` (by id) into `gElem`'s own `<defs>`, under a fixed local
 * id, plus an empty sibling `<g filter="url(#f)">` that keeps SVGO from pruning it as unused.
 * This makes the filter travel with `gElem.innerHTML` — imageFromSpecialGElem picks it up with
 * no cross-document/cross-context lookup, so it works identically in-app and inside the
 * stringified export script (which has no access to the app's module imports, see the note
 * on imageFromSpecialGElemStr above).
 */
function embedFilterClone(gElem: SVGGElement, hostFilterId: string): void {
    const hostFilter = document.getElementById(hostFilterId);
    if (!hostFilter) return;
    const clonedFilter = hostFilter.cloneNode(true) as Element;
    clonedFilter.setAttribute('id', 'f');
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.appendChild(clonedFilter);
    const filterRef = document.createElementNS(SVG_NS, 'g');
    filterRef.setAttribute('filter', 'url(#f)');
    gElem.prepend(filterRef);
    gElem.prepend(defs);
}

/**
 * The source `<g>` behind each contour `<image>` is never attached to the visible tree — only
 * the derived `<image>` is (see appendLandImageNew / appendCountryImageNew below). Export still
 * needs the raw vector `<g>` (so SVGO can optimize it and the exported runtime script can rebuild
 * the `<image>` from it), so each produced `<image>` is registered here against its source `<g>`.
 */
const contourSources = new WeakMap<Element, SVGGElement>();
export function getContourSource(imageEl: Element): SVGGElement | undefined {
    return contourSources.get(imageEl);
}

/**
 * Copies the `<image>` attributes built by imageFromSpecialGElem onto the real target element
 * (the `.macro-layer <image>` itself — see appendLandImageNew / appendCountryImageNew), merging
 * `class` instead of overwriting it since the target already carries `macro-layer` (and, for
 * countries, `country-img`) from the caller.
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

export function appendLandImageNew(this: SVGImageElement, showSource: boolean,
    width: number, height: number, borderWidth: number, contourParams: ContourParams, land: FeatureCollection<Polygon> | Polygon,
    pathLarger: GeoPath, glowParams: GlowParams | undefined) {
    // for not having glow effect on sides of view where there is land
    const offCanvasWithBorder = 20 - (borderWidth / 2);
    select(this).attr('id', 'land')
        .style('pointer-events', 'none')
        .style('will-change', 'opacity');

    // Built off-DOM: `this` (the .macro-layer <image> itself) is the only thing attached to
    // the visible tree — see applyImageAttrs. gElem mirrors this's own identity (id/class/
    // clip-path/style) directly, so the exported <g> needs no separate wrapper (see
    // macro/export.ts) and the runtime conversion (gElemsToImages.js) carries that identity
    // over to the rebuilt <image> unchanged. The source <g> itself is registered in
    // contourSources so export can still pull the raw vector geometry from it (see
    // getContourSource).
    const gElem = select(document.createElementNS(SVG_NS, 'g') as SVGGElement)
        .attr('id', this.getAttribute('id'))
        .attr('class', `${this.getAttribute('class') ?? ''} contour-to-dup`.trim())
        .attr('clip-path', this.getAttribute('clip-path'))
        .attr('style', this.getAttribute('style'))
        .attr('stroke', contourParams.strokeColor)
        .attr('stroke-width', contourParams.strokeWidth)
        .attr('stroke-dasharray', contourParams.strokeDash)
        .attr('fill', showSource ? contourParams.fillColor : 'none')
        .attr('viewBox', `${-offCanvasWithBorder / 2} ${-offCanvasWithBorder / 2} ${width + offCanvasWithBorder} ${height + offCanvasWithBorder}`)
        .attr('image-x', -offCanvasWithBorder / 2)
        .attr('image-y', -offCanvasWithBorder / 2)
        .attr('image-width', width + (offCanvasWithBorder))
        .attr('image-height', height + (offCanvasWithBorder))
        .attr('image-class', 'contour-to-dup');

    gElem.selectAll('path')
        // @ts-expect-error
        .data(land.features ? land.features : land)
        .join('path')
        .attr('pathLength', 1)
        // @ts-expect-error
        .attr('d', (d) => { return pathLarger(d) });
    if (glowParams) {
        let filterName = glowFilterId('land');
        if (showSource) {
            filterName = `${glowFilterId('land')}-with-source`;
            appendGlow(select('#static-svg-map') as unknown as SvgSelection, filterName, showSource, glowParams);
        }
        embedFilterClone(gElem.node() as SVGGElement, filterName);
    }

    applyImageAttrs(this, imageFromSpecialGElem(gElem.node() as SVGGElement));
    contourSources.set(this, gElem.node() as SVGGElement);
}

export function appendCountryImageNew(this: SVGImageElement, countryData: Feature<Polygon>, filter: string | null,
    path: GeoPath, inlineStyles: InlineStyles, width: number, height: number) {
    const countryName = countryData.properties!.name;
    const ref = document.getElementById(countryName);

    // if country not present or no stroke width and no filter, do nothing — clear any image
    // this element carried from a previous incremental restyle (see MacroSidebar.svelte)
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
        .style('will-change', 'opacity')
        .classed('country-img', true);

    const gElem = select(document.createElementNS(SVG_NS, 'g') as SVGGElement)
        .attr('id', this.getAttribute('id'))
        .attr('class', `${this.getAttribute('class') ?? ''} contour-to-dup`.trim())
        .attr('clip-path', this.getAttribute('clip-path'))
        .attr('style', this.getAttribute('style'))
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
    if (filter) embedFilterClone(gElem.node() as SVGGElement, filter);

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
