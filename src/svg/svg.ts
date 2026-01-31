import type { GeoProjection } from "d3-geo";
import type { Coords, ParsedPath, Point } from "../types";
import { DOM_PARSER } from "../util/dom";
import { commonState } from "src/state.svelte";
import { select } from "d3-selection";

// remove buggy paths, covering the whole svg element
export function removeCoveringAll(groupElement: SVGGElement | null): void {
    if (!groupElement) return;
    const parent = groupElement.closest('svg');
    if (!parent) return;
    const containerRect = parent.getBoundingClientRect();
    for (const child of Array.from(groupElement.children)) {
        if (child.tagName !== 'path') continue;
        const d = child.getAttribute('d');
        // ignore empty path, and big ones (that actually draw something)
        if (!d || d.length > 100) continue;
        const rect = (child as SVGPathElement).getBoundingClientRect();
        const includes = rect.x <= containerRect.x && rect.right >= containerRect.right
            && rect.y <= containerRect.y && rect.bottom >= containerRect.bottom;
        if (includes) {
            console.log('removing', child);
            child.remove();
        }
    }
}


export function postClipSimple(): void {
    const container = document.getElementById('static-svg-map')?.getBoundingClientRect()!;
    const elementsToCheck = ['path', 'rect', 'text', 'circle'];
    const selector = elementsToCheck.map(el => `#static-svg-map > g:not(.macro-layer) ${el}`).join(',');
    const toRemove: Element[] = [];
    document.querySelectorAll(selector).forEach(el => {
        const bbox = el.getBoundingClientRect();
        if (bbox.right < container.left || bbox.left > container.right || bbox.bottom < container.top || bbox.top > container.bottom) {
            toRemove.push(el);
        }
    });
    console.log("simple post clip:", toRemove);
    toRemove.forEach(el => el.remove());
    cleanupOrphanedPathImages();
}

/** Removes path-images elements whose referenced paths no longer exist */
export function cleanupOrphanedPathImages(): void {
    const pathImagesGroup = document.getElementById('path-images');
    if (!pathImagesGroup) return;

    const toRemove: Element[] = [];
    pathImagesGroup.querySelectorAll('mpath').forEach(mpath => {
        const href = mpath.getAttribute('xlink:href') || mpath.getAttribute('href');
        if (!href) return;

        const referencedPath = document.querySelector(href);
        if (!referencedPath) {
            const useElement = mpath.closest('use');
            if (useElement) toRemove.push(useElement);
        }
    });

    if (toRemove.length) console.log("orphaned path-images removed:", toRemove.length);
    toRemove.forEach(el => el.remove());
}

export function distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export interface DistanceQueryResult {
    distance?: number;
    point?: Point;
    advancement: number;
    elem?: SVGPathElement;
}

export function closestDistance(point: Point, pathElem: SVGPathElement): DistanceQueryResult {
    const pathLength = pathElem.getTotalLength();
    const delta = 10;
    const nbSample = Math.ceil(pathLength / delta);
    let minDist = Number.MAX_SAFE_INTEGER;
    let minDistPoint: DOMPoint | undefined;
    let advancement = 0;
    for (let i = 0; i < nbSample; i++) {
        const pathPoint = pathElem.getPointAtLength(i * delta);
        const dist = distance(pathPoint, point);
        if (dist < minDist) {
            minDist = dist;
            minDistPoint = pathPoint;
            advancement = (i * delta) / pathLength;
        }
    }
    return { distance: minDist, point: minDistPoint!, advancement };
}

export function setTransformScale(el: SVGElement, scaleStr: string): void {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) {
        el.setAttribute("transform", scaleStr);
    } else if (existingTransform.length && !existingTransform.includes('scale')) {
        el.setAttribute("transform", `${existingTransform} ${scaleStr}`);
    } else {
        const newAttr = existingTransform.replace(/scale\(.*?\)/, scaleStr);
        el.setAttribute("transform", newAttr);
    }
}

export function getTranslateFromTransform(el: SVGElement): Coords | null {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) return null;
    const matched = existingTransform.match(/([\-0-9\.]+),? ([\-0-9\.]+)/);
    if (matched && matched.length === 3) return [parseFloat(matched[1]), parseFloat(matched[2])];
    return null;
}

export function setTransformTranslate(el: SVGElement, translateStr: string): void {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) {
        el.setAttribute("transform", translateStr);
    } else if (existingTransform.length && !existingTransform.includes('translate')) {
        el.setAttribute("transform", `${translateStr} ${existingTransform}`);
    } else {
        const newAttr = existingTransform.replace(/translate\(.*?\)/, translateStr);
        el.setAttribute("transform", newAttr);
    }
}

export function createSvgFromPart(partStr: string): SVGElement {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg">${partStr}</svg>`;
    const parsed = DOM_PARSER.parseFromString(svgStr, 'text/html').body.childNodes[0];
    return parsed?.firstChild as SVGElement;
}

export function duplicateContourCleanFirst(svgElem: SVGSVGElement): void {
    Array.from(svgElem.querySelectorAll('.contour-to-dup[filter]')).forEach(el => el.remove());
    duplicateContours(svgElem);
}

/** Duplicate contour <image> tags, that only contain stroke, to have a new one with a fill and a filter applied */
export function duplicateContours(svgElem: SVGSVGElement): void {
    Array.from(svgElem.querySelectorAll('.contour-to-dup')).forEach(el => {
        if (!el.hasAttribute('filter-name')) return;
        const clone = el.cloneNode() as SVGElement;
        const href = el.getAttribute('href');
        if (href) {
            clone.setAttribute('href', href.replace(`fill='none'`, ''));
        }
        const filterName = el.getAttribute('filter-name');
        if (filterName) {
            clone.setAttribute('filter', `url(#${filterName})`);
        }
        // set opacity to 0 once to initiate transition
        (clone.style as CSSStyleDeclaration).opacity = '0';
        setTimeout(() => {
            (clone.style as CSSStyleDeclaration).opacity = '1';
        }, 0);
        el.parentNode?.insertBefore(clone, el);
    });
}

export function pathStringFromParsed(parsedD: ParsedPath, projection: GeoProjection): string {
    return parsedD.reduce((d, curGroup) => {
        const [instruction, ...data] = curGroup;
        let newData = '';
        for (let i = 0; i < data.length; i += 2) {
            newData += projection([data[i], data[i + 1]]) + ' ';
        }
        d += `${instruction}${newData}`;
        return d;
    }, '');
}

export function handleInlineStyleChange(elemId: string, target: HTMLElement, cssProp: string, value: string): void {
    if (elemId.includes("label")) {
        commonState.lastUsedLabelProps[cssProp] = value;
    }
    if (target.classList?.[0].includes("buildings") && cssProp === "fill") {
        cssProp = "--building-color";
        target.style.setProperty(cssProp, value);
    }
    if (elemId in commonState.inlineStyles) commonState.inlineStyles[elemId][cssProp] = value;
    else commonState.inlineStyles[elemId] = { [cssProp]: value };
    console.log({ ...commonState.inlineStyles });
    // update path markers
    if (cssProp === "stroke" && target.hasAttribute("marker-end")) {
        const markerId = target.getAttribute("marker-end")?.match(/url\(#(.*)\)/)?.[1];
        if (!markerId) return;
        const newMarkerId = `${markerId.split("-")[0]}-${value.substring(1)}`;
        select(`#${markerId}`).attr("fill", value).attr("id", newMarkerId);
        select(target).attr("marker-end", `url(#${newMarkerId})`);
    }
}