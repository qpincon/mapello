export type StyleRule = "inline" | CSSStyleRule;

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
