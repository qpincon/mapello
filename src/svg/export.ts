import svgoConfigText from '../svgoExportText.config';

import { reportStyleElem, DOM_PARSER, fetchFontAsDataUrl } from '../util/dom';
import type { Config } from 'svgo/browser';
import type { ProvidedFont } from 'src/types';


export enum ExportFontChoice {
    noExport = "0",
    convertToPath = "1",
    embedFont = "2",
    smallest = "3",
    embedFontFace = "4",
}

export interface ExportOptions {
    exportFonts?: ExportFontChoice;
    minifyJs?: boolean;
    animate?: boolean;
    useViewBox?: boolean;
    frameShadow?: boolean;
}

interface Position {
    x: number;
    y: number;
}

interface TransformedTexts {
    [fontFamily: string]: {
        [text: string]: string;
    };
}


// Enums and constants

export const rgb2hex = (rgb: string): string =>
    `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)!.slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`;

export function isHexColor(hex: string): boolean {
    return (hex.length === 6 || hex.length === 3 || hex.length === 8) && !isNaN(Number('0x' + hex));
}

export const replaceReferenceValue = (value: string, prefix: string): string | undefined => {
    let newValue: string | undefined;
    // discriminate colors in hex notation
    if (value[0] === '#' && !isHexColor(value.slice(1))) {
        newValue = `#${prefix}-${value.slice(1)}`;
    }
    if (value.slice(0, 3) === 'url') {
        const existing = value.match(/url\(\"?#(.*?)\"?\)/)?.[1];
        if (existing) {
            newValue = `url("#${prefix}-${existing}")`;
        }
    }
    return newValue;
};

export const exportFontChoices = Object.freeze(ExportFontChoice);

const domBaselineToBaseline: Record<string, string> = {
    hanging: "top",
    auto: "middle",
    middle: "middle",
    "text-top": "bottom"
};

const anchorToAnchor: Record<string, string> = {
    left: 'left',
    middle: 'center',
    right: 'right'
};

export const additionnalCssExport = '#points-labels {pointer-events:none} #points-labels a, #points-labels a * {pointer-events:auto}';
const cssFontProps = ['font-family', 'font-size', 'font-weight', 'color'];

export function getTextElems(svgElem: SVGElement): Element[] {
    const texts = Array.from(svgElem.querySelectorAll('text')).concat(Array.from(svgElem.querySelectorAll('tspan')));
    // ignore text elements containing tspans
    return texts.filter(t => !(t.tagName === 'text' && (t.firstChild as Element)?.tagName === 'tspan'));
}

export function getInlineStyle(el: Element, defaultStyles: CSSStyleDeclaration, propName: string): string {
    const isTspan = el.tagName === 'tspan';
    const elementStyle = (el as HTMLElement).style;
    const parentStyle = isTspan ? (el.parentNode as HTMLElement)?.style : null;
    return elementStyle[propName as any] || parentStyle?.[propName as any] || defaultStyles.getPropertyValue(propName);
}

export function replaceTextsWithPaths(svgElem: SVGElement, transformedTexts: TransformedTexts): void {
    const defaultStyles = getComputedStyle(document.body);
    const texts = getTextElems(svgElem);

    texts.forEach(textElem => {
        const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
        const text = textElem.textContent?.trim() || '';
        const transformed = transformedTexts[fontFamily]?.[text];
        if (!transformed) return;

        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', transformed);
        reportStyleElem(textElem, pathElem);

        if (textElem.tagName === 'tspan') {
            textElem.parentNode?.parentNode?.appendChild(pathElem);
            if (textElem.parentNode) {
                reportStyleElem(textElem.parentNode as Element, pathElem);
            }
            textElem.remove();
        } else {
            textElem.replaceWith(pathElem);
        }

        // no need to keep font-xxx properties on a path
        cssFontProps.forEach(prop => (pathElem.style as any).removeProperty(prop));
    });

    // Remove now empty <text>s
    svgElem.querySelectorAll('text:empty').forEach(el => el.remove());
}

export function getTextPosition(textElem: Element, defaultStyles: CSSStyleDeclaration): Position {
    const getShift = (elem: Element, attr: string): number => {
        const fontSize = parseFloat(getInlineStyle(elem, defaultStyles, 'font-size'));
        const delta = elem.getAttribute(attr);
        if (delta && delta.includes('em')) return parseFloat(delta) * fontSize;
        return 0;
    };

    const getPos = (elem: Element, direction: 'x' | 'y'): number => {
        let attributes = { delta: 'dx', pos: 'x' };
        if (direction === 'y') attributes = { delta: 'dy', pos: 'y' };

        let pos = parseFloat(elem.getAttribute(attributes.pos) || '0') || 0;
        pos += getShift(elem, attributes.delta);
        let prevSibling = elem.previousSibling;

        // if "y" is omitted, "dy" is cumulative
        while (prevSibling !== null && !(prevSibling as Element).hasAttribute?.(attributes.pos)) {
            pos += getShift(prevSibling as Element, attributes.delta);
            prevSibling = prevSibling.previousSibling;
        }
        return pos;
    };

    const x = getPos(textElem, 'x');
    const y = getPos(textElem, 'y');
    return { x, y };
}

export async function inlineFontVsPath(
    svgElem: SVGElement,
    providedFonts: ProvidedFont[],
    exportFontsOption: ExportFontChoice
): Promise<boolean> {
    let nbFontChars = 0;
    let nbPathChars = 0;
    const transformedTexts: TransformedTexts = {};
    const SVGO = await import('svgo/browser');
    // @ts-expect-error
    window["process"] = {}; window["__dirname"] = '';
    const TextToSVG = (await import('text-to-svg')).default;
    const defaultStyles = getComputedStyle(document.body);

    await Promise.all(providedFonts.map(async ({ name, slug, weight, style, defSubset }) => {
        const content = await fetchFontAsDataUrl({ name, slug, weight, style, defSubset });
        transformedTexts[name] = {};
        const base64Part = content.substring(content.indexOf(',') + 1);
        nbFontChars += Math.ceil(base64Part.length * 3 / 4);
        const texts = getTextElems(svgElem);

        return new Promise<void>(resolve => {
            TextToSVG.load(content, function (err: any, textToSVG: any) {
                // console.log(content, err, textToSVG);
                texts.forEach(textElem => {
                    if (textElem.tagName === 'text' && (textElem.firstChild as Element)?.tagName === 'tspan') return;

                    const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
                    if (fontFamily === name) {
                        const text = textElem.textContent?.trim() || '';
                        const anchor = anchorToAnchor[textElem.getAttribute('text-anchor') || ''] || 'left';
                        const baseline = domBaselineToBaseline[textElem.getAttribute('dominant-baseline') || ''] || 'baseline';
                        const fontSize = parseFloat(getInlineStyle(textElem, defaultStyles, 'font-size'));
                        const { x, y } = getTextPosition(textElem, defaultStyles);

                        const options = {
                            x: x,
                            y: y,
                            fontSize: fontSize,
                            anchor: `${anchor} ${baseline}`
                        };

                        let path = textToSVG.getD(text, options);
                        const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        const tmpPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        tmpPath.setAttribute('d', path);
                        tmpSvg.append(tmpPath);

                        const optimized = DOM_PARSER.parseFromString(SVGO.optimize(tmpSvg.outerHTML, svgoConfigText as Config).data, 'image/svg+xml');
                        path = optimized.querySelector('path')?.getAttribute('d');
                        if (!path) return;

                        transformedTexts[name][text] = path;
                        nbPathChars += path.length;
                    }
                });
                resolve();
            });
        });
    }));

    const pathIsBetter = nbPathChars + 10000 < nbFontChars;
    if (exportFontsOption === ExportFontChoice.convertToPath || pathIsBetter) {
        replaceTextsWithPaths(svgElem, transformedTexts);
        return true;
    }
    return false;
}

export function addFrameShadow(
    svgElement: SVGElement | Element,
    mapId: string,
    shadowRect: { x: number; y: number; width: number; height: number; rx: number },
): void {
    const filterId = `${mapId}-frame-shadow`;

    let defs = svgElement.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.prepend(defs);
    }

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', filterId);

    const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    feDropShadow.setAttribute('dx', '2');
    feDropShadow.setAttribute('dy', '2');
    feDropShadow.setAttribute('stdDeviation', '4');
    feDropShadow.setAttribute('flood-color', 'black');
    feDropShadow.setAttribute('flood-opacity', '0.2');
    filter.append(feDropShadow);
    defs.append(filter);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', shadowRect.x.toString());
    rect.setAttribute('y', shadowRect.y.toString());
    rect.setAttribute('width', shadowRect.width.toString());
    rect.setAttribute('height', shadowRect.height.toString());
    rect.setAttribute('rx', shadowRect.rx.toString());
    rect.setAttribute('fill', 'white');
    rect.setAttribute('filter', `url(#${filterId})`);
    svgElement.prepend(rect);

    svgElement.setAttribute('overflow', 'visible');
}

const urlUsingAttributes = ['marker-start', 'marker-mid', 'marker-end', 'clip-path', 'fill', 'filter', '*|href'];

export function addAttribution(
    svgElement: SVGElement | Element,
    width: number,
    height: number,
    mode: 'macro' | 'micro',
): void {
    const margin = 8;
    const pillWidth = 100;
    const fontSize = 9;
    const pillPaddingX = 10;
    const pillPaddingY = 6;
    const lineGap = 4;
    const pillHeight = fontSize * 2 + lineGap + pillPaddingY * 2;

    const rightX = width - margin;
    const rectX = rightX - pillWidth;
    const rectY = height - margin - pillHeight;
    const textX = rightX - pillPaddingX;
    const textY1 = rectY + pillPaddingY + fontSize;
    const textY2 = textY1 + fontSize + lineGap;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'attribution');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', rectX.toString());
    rect.setAttribute('y', rectY.toString());
    rect.setAttribute('width', pillWidth.toString());
    rect.setAttribute('height', pillHeight.toString());
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', 'white');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('stroke-width', '0.2px');
    rect.setAttribute('fill-opacity', '0.7');
    g.append(rect);

    const createLinkedText = (label: string, href: string, y: number) => {
        const a = document.createElementNS('http://www.w3.org/2000/svg', 'a');
        a.setAttribute('href', href);
        a.setAttribute('target', '_blank');
        a.setAttribute('style', 'text-decoration: none');
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', textX.toString());
        t.setAttribute('y', y.toString());
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('font-size', fontSize.toString());
        t.setAttribute('font-family', 'sans-serif');
        t.setAttribute('fill', '#333');
        t.textContent = label;
        a.append(t);
        return a;
    };

    if (mode === 'macro') {
        g.append(createLinkedText('© GeoBoundaries', 'https://www.geoboundaries.org', textY1));
        g.append(createLinkedText('CartoSVG', 'https://cartosvg.com', textY2));
    } else {
        g.append(createLinkedText('© OpenStreetMap', 'https://www.openstreetmap.org/copyright', textY1));
        g.append(createLinkedText('CartoSVG', 'https://cartosvg.com', textY2));
    }

    svgElement.append(g);
}

export function changeIdAndReferences(exportedMapElem: Element, newMapId: string): void {
    // change SVG definitions IDs
    exportedMapElem.querySelectorAll('defs > [id], #paths > [id]').forEach(elem => {
        const existingId = elem.getAttribute('id');
        if (existingId) {
            elem.setAttribute('id', `${newMapId}-${existingId}`);
        }
    });

    // change image-filter-name special attribute for contours
    exportedMapElem.querySelectorAll('[image-filter-name]').forEach(elem => {
        const existingFilterName = elem.getAttribute('image-filter-name');
        if (existingFilterName) {
            elem.setAttribute('image-filter-name', `${newMapId}-${existingFilterName}`);
        }
    });

    // change inline styles with url(#...)
    exportedMapElem.querySelectorAll('[style*="url"]').forEach(elem => {
        const elementStyle = (elem as HTMLElement).style;

        for (let i = 0; i < elementStyle.length; i++) {
            const prop = elementStyle[i];
            const propValue = elementStyle.getPropertyValue(prop);
            if (!propValue?.includes('url')) continue;
            const newValue = replaceReferenceValue(propValue, newMapId);
            if (newValue) elementStyle[prop as any] = newValue;
        }
    });

    // change SVG elements attributes that could contain a reference to another element
    exportedMapElem.querySelectorAll(urlUsingAttributes.map(x => `[${x}]`).join(',')).forEach(elem => {
        for (const attributeName of urlUsingAttributes) {
            let attributesToCheck = [attributeName];
            if (attributeName.includes('href')) attributesToCheck = ['href', 'xlink:href'];

            for (const finalAttributeName of attributesToCheck) {
                const attribute = elem.getAttribute(finalAttributeName);
                if (!attribute) continue;
                const newValue = replaceReferenceValue(attribute, newMapId);
                if (newValue) elem.setAttribute(finalAttributeName, newValue);
            }
        }
    });
}

