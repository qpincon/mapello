import type { InlineStyles, ProvidedFont } from "src/types";
import { setTransformScale } from "../svg/svg";
import { detectRequiredSubsets } from "./unicode-subsets";

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

export function fontSubsetUrl(font: ProvidedFont, subset: string): string {
    return `https://fonts.bunny.net/${font.slug}/files/${font.slug}-${subset}-${font.weight}-${font.style}`;
}

// Cache for available subsets per font slug
const availableSubsetsCache = new Map<string, SubsetInfo[]>();

export interface SubsetInfo {
    name: string;
    unicodeRange?: string;
}

/**
 * Fetches the available subsets for a font from the Bunny Fonts CSS API.
 * Parses `/* subset-name * /` comments and `unicode-range` from the @font-face rules.
 */
export async function getAvailableSubsets(font: ProvidedFont): Promise<SubsetInfo[]> {
    const cacheKey = `${font.slug}:${font.weight}`;
    if (availableSubsetsCache.has(cacheKey)) return availableSubsetsCache.get(cacheKey)!;

    try {
        const res = await fetch(`https://fonts.bunny.net/css?family=${font.slug}:${font.weight}`);
        if (!res.ok) return [{ name: font.defSubset }];
        const css = await res.text();

        const subsets: SubsetInfo[] = [];
        // Pattern: /* subset-name */ followed by @font-face { ... }
        const regex = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
        let match;
        while ((match = regex.exec(css)) !== null) {
            const name = match[1];
            const body = match[2];
            const rangeMatch = body.match(/unicode-range:\s*([^;]+)/);
            subsets.push({
                name,
                unicodeRange: rangeMatch ? rangeMatch[1].trim() : undefined,
            });
        }

        if (subsets.length === 0) subsets.push({ name: font.defSubset });
        availableSubsetsCache.set(cacheKey, subsets);
        return subsets;
    } catch {
        return [{ name: font.defSubset }];
    }
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

/**
 * Generates multi-subset @font-face CSS rules with unicode-range for export.
 * Falls back to single-subset if subsets can't be fetched.
 */
export async function fontsToCssMultiSubset(fonts: ProvidedFont[], textContent: string): Promise<string> {
    const needed = detectRequiredSubsets(textContent);
    const results = await Promise.all(fonts.map(async font => {
        const available = await getAvailableSubsets(font);
        const subsets = available.filter(s => needed.has(s.name) || !s.unicodeRange);
        // If no intersection found, fall back to default subset
        if (subsets.length === 0) {
            const base = fontBaseUrl(font);
            return `@font-face { font-family: ${font.name}; src: url("${base}.woff2") format("woff2"), url("${base}.woff") format("woff"); }`;
        }
        return subsets.map(s => {
            const base = fontSubsetUrl(font, s.name);
            const range = s.unicodeRange ? `\n            unicode-range: ${s.unicodeRange};` : '';
            return `@font-face {
            font-family: ${font.name};
            src: url("${base}.woff2") format("woff2"), url("${base}.woff") format("woff");${range}
        }`;
        }).join('\n');
    }));
    return results.join('\n') || '';
}

function arrayBufferToDataUrl(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return `data:font/woff;base64,${btoa(binary)}`;
}

export async function fetchFontAsDataUrl(font: ProvidedFont): Promise<string> {
    const url = fontBaseUrl(font) + '.woff';
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    return arrayBufferToDataUrl(buffer);
}

export async function fetchFontSubsetAsDataUrl(font: ProvidedFont, subset: string): Promise<string | null> {
    const url = fontSubsetUrl(font, subset) + '.woff';
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        return arrayBufferToDataUrl(buffer);
    } catch {
        return null;
    }
}

export async function fontsToCssEmbed(fonts: ProvidedFont[]): Promise<string> {
    const results = await Promise.all(fonts.map(async font => {
        const dataUrl = await fetchFontAsDataUrl(font);
        return `@font-face { font-family: ${font.name}; src: url("${dataUrl}"); }`;
    }));
    return results.join('\n') || '';
}

/**
 * Embeds all needed font subsets as base64 @font-face rules.
 */
export async function fontsToCssEmbedMultiSubset(fonts: ProvidedFont[], textContent: string): Promise<string> {
    const needed = detectRequiredSubsets(textContent);
    const results = await Promise.all(fonts.map(async font => {
        const available = await getAvailableSubsets(font);
        const subsets = available.filter(s => needed.has(s.name) || !s.unicodeRange);
        if (subsets.length === 0) {
            const dataUrl = await fetchFontAsDataUrl(font);
            return `@font-face { font-family: ${font.name}; src: url("${dataUrl}"); }`;
        }
        const faces = await Promise.all(subsets.map(async s => {
            const dataUrl = await fetchFontSubsetAsDataUrl(font, s.name);
            if (!dataUrl) return '';
            return `@font-face { font-family: ${font.name}; src: url("${dataUrl}"); }`;
        }));
        return faces.filter(Boolean).join('\n');
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

function styleSheetToText(sheet: CSSStyleSheet): string {
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
