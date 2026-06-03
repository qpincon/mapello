export type StyleRule = "inline" | CSSStyleRule;

import { rgbToHex, parseColorValue, resolveColorToHex } from "./colorMath";

// ── Sentinel probe helpers ────────────────────────────────────────────────────

/** Normalise a CSS property value to a canonical string for comparison. */

function normaliseValue(prop: string, v: string): string {
    const s = (v ?? "").trim();
    if (!s) return "";
    if (prop === "fill" || prop === "stroke") {
        if (s === "none") return "none";
        if (s.startsWith("rgb")) return (rgbToHex(s) || s).toUpperCase();
        // Named colours (e.g. "black", "red") and other formats: resolve via canvas
        const resolved = s.startsWith("#") ? s : resolveColorToHex(s);
        if (resolved.startsWith("rgb")) return (rgbToHex(resolved) || resolved).toUpperCase();
        const { hex } = parseColorValue(resolved);
        return hex ? ("#" + hex).toUpperCase() : resolved.toUpperCase();
    }
    if (prop === "stroke-width") {
        const n = parseFloat(s);
        return isNaN(n) ? s : String(n);
    }
    if (prop === "stroke-dasharray") {
        const n = s.replace(/px/g, "").trim();
        return (!n || n === "none" || n === "0") ? "" : n.replace(/\s*,\s*/g, " ").replace(/\s+/g, " ");
    }
    if (prop === "font-family") {
        // Compare only the first declared family, ignoring quotes
        return s.split(",")[0].trim().replace(/^['"]|['"]$/g, "").trim().toLowerCase();
    }
    return s;
}

/**
 * Clean a CSS rule selector so it can be used with querySelectorAll in the
 * resting (non-hover) state: bail if selector is too long or matches everything;
 * strip :hover and .hovered (Firefox hover mirror used by MacroSidebar).
 * Returns null if the result is empty or looks invalid.
 */
function cleanRuleSelector(selectorText: string): string | null {
    if (!selectorText || selectorText.length > 50) return null;
    if (selectorText.split(",").some((s) => s.trim() === "*")) return null;
    // Hover rules can't be probed via getComputedStyle in the resting state —
    // return null so getElementsAffectedByProp bails out and the caller falls
    // back to highlightRule(), which strips :hover before querying.
    if (/\.hovered|:hover\b/.test(selectorText)) return null;
    return selectorText.trim() || null;
}

// Sentinel values unique enough that no real content would produce them.
const SENTINELS: Record<string, string> = {
    fill:               "rgb(1, 2, 3)",
    stroke:             "rgb(1, 2, 3)",
    "stroke-width":     "97.3px",
    "stroke-dasharray": "9 7 5 3",
    "font-family":      "__mapelloProbe__",
};

export interface PropAffectResult {
    /** Elements that will receive the change (rule wins the cascade for them). */
    will: Element[];
    /** Total elements matched by the rule's selector (capped at max). */
    total: number;
}

/**
 * For a given CSS property, probe which elements matched by `rule`'s selector
 * will actually receive a change if the rule sets that property — i.e. the rule
 * wins the cascade for that element.
 *
 * Uses a sentinel probe: temporarily sets the rule to a unique value, reads each
 * element's computed style, then restores the rule. Synchronous (set → read →
 * restore in one call, no repaint between), so there is no visual flash.
 *
 * Returns null if the selector is invalid / matches nothing / has no sentinel
 * defined for the property.
 */
export function getElementsAffectedByProp(
    rule: CSSStyleRule,
    prop: string,
    opts: { scope: Element; max?: number },
): PropAffectResult | null {
    const { scope, max = 400 } = opts;
    const sentinel = SENTINELS[prop];
    if (!sentinel) return null;

    const sel = cleanRuleSelector(rule.selectorText);
    if (!sel) return null;

    let elements: Element[];
    try {
        elements = Array.from(scope.querySelectorAll(sel)).slice(0, max);
    } catch {
        return null;
    }
    if (elements.length === 0) return null;

    // Save current value + priority, probe, read, restore
    const origVal = rule.style.getPropertyValue(prop);
    const origPriority = rule.style.getPropertyPriority(prop);
    const normSentinel = normaliseValue(prop, sentinel);
    const will: Element[] = [];
    try {
        rule.style.setProperty(prop, sentinel);
        for (const el of elements) {
            const computed = window.getComputedStyle(el).getPropertyValue(prop);
            if (normaliseValue(prop, computed) === normSentinel) will.push(el);
        }
    } finally {
        if (origVal) {
            rule.style.setProperty(prop, origVal, origPriority);
        } else {
            rule.style.removeProperty(prop);
        }
    }
    return { will, total: elements.length };
}

const _warned = new Set<number>();

export function getMatchedCSSRules(
    el: Element,
    cssRuleFilter?: (el: Element, cssSelector: string) => boolean,
): StyleRule[] {
    const matchedRules: StyleRule[] = [];

    if (!cssRuleFilter || cssRuleFilter(el, "inline")) {
        matchedRules.push("inline");
    }

    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
        try {
            const rules = sheets[i].cssRules;
            for (let r = 0; r < rules.length; r++) {
                const rule = rules[r];
                if (!(rule instanceof CSSStyleRule)) continue;
                let selectorText = rule.selectorText;
                if (!selectorText || selectorText.length > 50) continue;
                if (selectorText.split(",").some((s) => s.trim() === "*")) continue;
                if (selectorText.endsWith(":hover"))
                    selectorText = selectorText.slice(0, -":hover".length);
                try {
                    if (el.matches(selectorText)) {
                        if (cssRuleFilter && !cssRuleFilter(el, rule.selectorText)) continue;
                        matchedRules.push(rule);
                    }
                } catch {
                    // Invalid selector after stripping suffix — skip
                }
            }
        } catch {
            if (!_warned.has(i)) {
                console.warn("Style panel: cannot access stylesheet", sheets[i]?.ownerNode);
                _warned.add(i);
            }
        }
    }

    return matchedRules;
}

export function getRuleValue(el: Element, rule: StyleRule, prop: string): string {
    if (rule === "inline") {
        return (el as HTMLElement).style?.getPropertyValue(prop) ?? "";
    }
    return rule.style.getPropertyValue(prop);
}

export function setRuleValue(el: Element, rule: StyleRule, prop: string, value: string): void {
    if (rule === "inline") {
        if (!value) {
            (el as HTMLElement).style?.removeProperty(prop);
        } else {
            (el as HTMLElement).style?.setProperty(prop, value);
        }
    } else {
        if (!value) {
            rule.style.removeProperty(prop);
        } else {
            rule.style.setProperty(prop, value);
        }
    }
}
