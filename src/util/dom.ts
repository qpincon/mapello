import type { InlineStyles, ProvidedFont } from "src/types";
import { setTransformScale } from "../svg/svg";

export const DOM_PARSER = new DOMParser();

export function reportStyle(reference: Element, target: Element): void {
    const walkerRef = document.createTreeWalker(reference, NodeFilter.SHOW_ELEMENT);
    const walkerTarget = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);
    reportStyleElem(walkerRef.currentNode as Element, walkerTarget.currentNode as Element);
    while (walkerRef.nextNode()) {
        walkerTarget.nextNode();
        reportStyleElem(walkerRef.currentNode as Element, walkerTarget.currentNode as Element);
    }
}

export function reportStyleElem(ref: Element, target: Element): void {
    const refStyle = ref.getAttribute('style');
    if (refStyle && refStyle !== "null") {
        target.setAttribute('style', refStyle);
    }
    const transform = ref.getAttribute('transform');
    if (transform && transform !== "null") {
        target.setAttribute('transform', transform);
    }
}

export function fontBaseUrl(font: ProvidedFont): string {
    return `https://fonts.bunny.net/${font.slug}/files/${font.slug}-${font.defSubset}-${font.weight}-${font.style}`;
}

export function fontsToCss(fonts: ProvidedFont[]): string {
    return fonts.map(font => {
        const base = fontBaseUrl(font);
        return `@font-face {
            font-family: ${font.name};
            src: url("${base}.woff2") format("woff2"), url("${base}.woff") format("woff");
        }`;
    }).join('\n') || '';
}

export async function fetchFontAsDataUrl(font: ProvidedFont): Promise<string> {
    const url = fontBaseUrl(font) + '.woff';
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return `data:font/woff;base64,${btoa(binary)}`;
}

export async function fontsToCssEmbed(fonts: ProvidedFont[]): Promise<string> {
    const results = await Promise.all(fonts.map(async font => {
        const dataUrl = await fetchFontAsDataUrl(font);
        return `@font-face { font-family: ${font.name}; src: url("${dataUrl}"); }`;
    }));
    return results.join('\n') || '';
}

export function getUsedInlineFonts(svg: SVGSVGElement): Set<string> {
    const fonts = new Set<string>();
    for (const node of svg.querySelectorAll<SVGElement>('*')) {
        if (!node.style) continue;
        const fontFamily = node.style.fontFamily || null;
        if (fontFamily) fonts.add(fontFamily);
    }
    return fonts;
}

export function styleSheetToText(sheet: CSSStyleSheet): string {
    let styleTxt = '';
    const rules = sheet.cssRules;
    for (const r of Array.from(rules)) {
        styleTxt += (r as CSSStyleRule).cssText;
    }
    return styleTxt.replace(/undefined/g, '');
}

// Returns [sheet, rule]
export function findStyleSheet(selectorToFind: string): [CSSStyleSheet | null, CSSStyleRule | null] {
    const sheets = document.styleSheets;
    for (const sheet of Array.from(sheets)) {
        const rules = (sheet as CSSStyleSheet).cssRules;
        for (const rule of Array.from(rules)) {
            const selectorText = (rule as CSSStyleRule).selectorText;
            if (selectorText === selectorToFind) {
                return [sheet as CSSStyleSheet, rule as CSSStyleRule];
            }
        }
    }
    return [null, null];
}

export function exportStyleSheet(selectorToFind: string): string | undefined {
    const [sheet] = findStyleSheet(selectorToFind);
    if (sheet) return styleSheetToText(sheet);
}

export function applyStyles(inlineStyles: InlineStyles): void {
    Object.entries(inlineStyles).forEach(([elemId, style]) => {
        const elem = document.getElementById(elemId) as unknown as SVGElement;
        if (!elem) return;
        Object.entries(style).forEach(([cssProp, cssValue]) => {
            if (cssProp === 'scale') {
                setTransformScale(elem, `scale(${cssValue})`);
            } else if (cssProp === 'bringtofront') {
                elem.parentNode?.appendChild(elem);
            } else if (cssProp === 'stroke-width' && cssValue === null) {
                elem.style.removeProperty('stroke-width');
                elem.style.removeProperty('stroke');
            } else {
                elem.style.setProperty(cssProp, cssValue as string);
            }
        });
    });
}

export function updateStyleSheetOrGenerateCss(
    stylesheet: CSSStyleSheet | null,
    cssSelector: string,
    styleDict: Record<string, string | number>
): string {
    if (stylesheet) {
        let rule: CSSStyleRule | null = null;
        for (const r of Array.from(stylesheet.cssRules)) {
            if ((r as CSSStyleRule).selectorText === cssSelector) {
                rule = r as CSSStyleRule;
                break;
            }
        }
        if (rule) {
            Object.entries(styleDict).forEach(([propName, propValue]) => {
                rule!.style.setProperty(propName, propValue as string);
            });
        } else {
            const ruleToInsert = `${cssSelector} { ${styleDictToCssRulesStr(styleDict)} }`;
            stylesheet.insertRule(ruleToInsert);
        }
        return '';
    }
    return `${cssSelector} { ${styleDictToCssRulesStr(styleDict)} }`;
}

export function styleDictToCssRulesStr(styleDict: Record<string, string | number>): string {
    let cssString = '';
    Object.entries(styleDict).forEach(([propName, propValue]) => {
        cssString += `${propName}: ${propValue};`;
    });
    return cssString;
}
