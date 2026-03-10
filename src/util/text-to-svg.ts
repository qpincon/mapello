/**
 * Adapted from https://github.com/shrhdk/text-to-svg
 * Copyright (c) 2016 Hideki Shiro — MIT License
 *
 * Stripped to browser-only usage: removed loadSync / default font / CJS export.
 * Depends on opentype.js (1.x).
 */

import * as opentype from 'opentype.js';

type HorizontalAnchor = 'left' | 'center' | 'right';
type VerticalAnchor = 'baseline' | 'top' | 'middle' | 'bottom';

interface TextToSVGOptions {
    x?: number;
    y?: number;
    fontSize?: number;
    anchor?: string;
    kerning?: boolean;
    letterSpacing?: number | false;
    tracking?: number | false;
    attributes?: Record<string, string>;
}

function parseAnchorOption(anchor: string): { horizontal: HorizontalAnchor; vertical: VerticalAnchor } {
    let horizontal = (anchor.match(/left|center|right/gi) || [])[0] as HorizontalAnchor | undefined;
    let vertical = (anchor.match(/baseline|top|bottom|middle/gi) || [])[0] as VerticalAnchor | undefined;
    return {
        horizontal: horizontal ?? 'left',
        vertical: vertical ?? 'baseline',
    };
}

export default class TextToSVG {
    private font: opentype.Font;

    constructor(font: opentype.Font) {
        this.font = font;
    }

    static load(url: string, cb: (err: Error | null, textToSVG: TextToSVG | null) => void): void {
        opentype.load(url, (err: Error | null, font?: opentype.Font) => {
            if (err || !font) return cb(err ?? new Error('Font failed to load'), null);
            cb(null, new TextToSVG(font));
        });
    }

    getWidth(text: string, options: TextToSVGOptions): number {
        const fontSize = options.fontSize ?? 72;
        const kerning = options.kerning ?? true;
        const fontScale = (1 / this.font.unitsPerEm) * fontSize;

        let width = 0;
        const glyphs = this.font.stringToGlyphs(text);
        for (let i = 0; i < glyphs.length; i++) {
            const glyph = glyphs[i];
            if (glyph.advanceWidth) width += glyph.advanceWidth * fontScale;
            if (kerning && i < glyphs.length - 1) {
                width += this.font.getKerningValue(glyph, glyphs[i + 1]) * fontScale;
            }
            if (options.letterSpacing) {
                width += options.letterSpacing * fontSize;
            } else if (options.tracking) {
                width += (options.tracking / 1000) * fontSize;
            }
        }
        return width;
    }

    getHeight(fontSize: number): number {
        const fontScale = (1 / this.font.unitsPerEm) * fontSize;
        return (this.font.ascender - this.font.descender) * fontScale;
    }

    getMetrics(text: string, options: TextToSVGOptions = {}) {
        const fontSize = options.fontSize ?? 72;
        const anchor = parseAnchorOption(options.anchor ?? '');
        const width = this.getWidth(text, options);
        const height = this.getHeight(fontSize);
        const fontScale = (1 / this.font.unitsPerEm) * fontSize;
        const ascender = this.font.ascender * fontScale;
        const descender = this.font.descender * fontScale;

        let x = options.x ?? 0;
        switch (anchor.horizontal) {
            case 'left':   break;
            case 'center': x -= width / 2; break;
            case 'right':  x -= width; break;
        }

        let y = options.y ?? 0;
        switch (anchor.vertical) {
            case 'baseline': y -= ascender; break;
            case 'top':      break;
            case 'middle':   y -= height / 2; break;
            case 'bottom':   y -= height; break;
        }

        return { x, y, baseline: y + ascender, width, height, ascender, descender };
    }

    getD(text: string, options: TextToSVGOptions = {}): string {
        const fontSize = options.fontSize ?? 72;
        const kerning = options.kerning ?? true;
        const letterSpacing = options.letterSpacing ?? false;
        const tracking = options.tracking ?? false;
        const metrics = this.getMetrics(text, options);
        const path = this.font.getPath(text, metrics.x, metrics.baseline, fontSize, {
            kerning,
            letterSpacing: letterSpacing || undefined,
            tracking: tracking || undefined,
        });
        return path.toPathData(undefined);
    }

    getPath(text: string, options: TextToSVGOptions = {}): string {
        const attrs = Object.entries(options.attributes ?? {})
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ');
        const d = this.getD(text, options);
        return attrs ? `<path ${attrs} d="${d}"/>` : `<path d="${d}"/>`;
    }
}
