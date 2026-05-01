/**
 * Maps Unicode code points to Bunny Fonts subset names.
 * Used to determine which font subset files to load for text-to-path conversion.
 */

interface SubsetRange {
    subset: string;
    start: number;
    end: number;
}

// Ordered by specificity — more specific ranges first, catch-alls last.
const SUBSET_RANGES: SubsetRange[] = [
    // Korean
    { subset: 'korean', start: 0x1100, end: 0x11FF },
    { subset: 'korean', start: 0x3130, end: 0x318F },
    { subset: 'korean', start: 0xAC00, end: 0xD7AF },

    // Japanese (Hiragana, Katakana, CJK)
    { subset: 'japanese', start: 0x3000, end: 0x30FF },   // CJK symbols, Hiragana, Katakana
    { subset: 'japanese', start: 0x31F0, end: 0x31FF },   // Katakana extensions
    { subset: 'japanese', start: 0x4E00, end: 0x9FFF },   // CJK Unified Ideographs
    { subset: 'japanese', start: 0xF900, end: 0xFAFF },   // CJK Compatibility Ideographs
    { subset: 'japanese', start: 0xFF00, end: 0xFFEF },   // Halfwidth/Fullwidth forms
    { subset: 'japanese', start: 0x3400, end: 0x4DBF },   // CJK Extension A
    { subset: 'japanese', start: 0x20000, end: 0x2A6DF }, // CJK Extension B

    // Chinese simplified (fallback if no japanese subset)
    { subset: 'chinese-simplified', start: 0x4E00, end: 0x9FFF },
    { subset: 'chinese-simplified', start: 0x3400, end: 0x4DBF },

    // Devanagari
    { subset: 'devanagari', start: 0x0900, end: 0x097F },
    { subset: 'devanagari', start: 0xA8E0, end: 0xA8FF },

    // Arabic
    { subset: 'arabic', start: 0x0600, end: 0x06FF },
    { subset: 'arabic', start: 0x0750, end: 0x077F },
    { subset: 'arabic', start: 0xFB50, end: 0xFDFF },
    { subset: 'arabic', start: 0xFE70, end: 0xFEFF },

    // Hebrew
    { subset: 'hebrew', start: 0x0590, end: 0x05FF },
    { subset: 'hebrew', start: 0xFB1D, end: 0xFB4F },

    // Thai
    { subset: 'thai', start: 0x0E00, end: 0x0E7F },

    // Greek
    { subset: 'greek-ext', start: 0x1F00, end: 0x1FFF },
    { subset: 'greek', start: 0x0370, end: 0x03FF },

    // Cyrillic
    { subset: 'cyrillic-ext', start: 0x0500, end: 0x052F },
    { subset: 'cyrillic-ext', start: 0x2DE0, end: 0x2DFF },
    { subset: 'cyrillic-ext', start: 0xA640, end: 0xA69F },
    { subset: 'cyrillic', start: 0x0400, end: 0x04FF },

    // Latin-ext (must come before latin)
    { subset: 'latin-ext', start: 0x0100, end: 0x02FF },
    { subset: 'latin-ext', start: 0x1D00, end: 0x1EFF },
    { subset: 'latin-ext', start: 0x2C60, end: 0x2C7F },
    { subset: 'latin-ext', start: 0xA720, end: 0xA7FF },

    // Latin (Basic Latin + Latin-1 Supplement)
    { subset: 'latin', start: 0x0000, end: 0x00FF },
];

function codePointToSubset(cp: number): string | null {
    for (const { subset, start, end } of SUBSET_RANGES) {
        if (cp >= start && cp <= end) return subset;
    }
    return null;
}

/**
 * Given a string, returns the set of Bunny Fonts subset names needed to cover all characters.
 * Always includes 'latin' since most fonts include it and it covers punctuation/numbers.
 */
export function detectRequiredSubsets(text: string): Set<string> {
    const subsets = new Set<string>();
    subsets.add('latin'); // always include as baseline

    for (const char of text) {
        const cp = char.codePointAt(0)!;
        const subset = codePointToSubset(cp);
        if (subset) {
            subsets.add(subset);
        }
    }

    return subsets;
}

export interface TextSegment {
    text: string;
    subset: string;
}

/**
 * Segments a string into consecutive runs of characters belonging to the same font subset.
 * Characters that don't match any known range use `defaultSubset`.
 */
export function segmentTextBySubset(text: string, defaultSubset: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let currentSubset = '';
    let currentText = '';

    for (const char of text) {
        const cp = char.codePointAt(0)!;
        const subset = codePointToSubset(cp) || defaultSubset;

        if (subset === currentSubset) {
            currentText += char;
        } else {
            if (currentText) {
                segments.push({ text: currentText, subset: currentSubset });
            }
            currentSubset = subset;
            currentText = char;
        }
    }

    if (currentText) {
        segments.push({ text: currentText, subset: currentSubset });
    }

    return segments;
}
