<script lang="ts">
    import { onMount } from "svelte";
    import { Tooltip } from "bootstrap";
    import { rgbToHex, parseColorValue } from "../util/colorMath";
    import { getMatchedCSSRules, getRuleValue, setRuleValue, type StyleRule } from "../util/cssRules";
    import StyleColorPicker from "./StyleColorPicker.svelte";

    // ── Bootstrap tooltip action ─────────────────────────────────────
    function bsTooltip(el: HTMLElement, title: string) {
        let t = new Tooltip(el, { title, placement: "top", trigger: "hover" });
        return {
            update(newTitle: string) { t.dispose(); t = new Tooltip(el, { title: newTitle, placement: "top", trigger: "hover" }); },
            destroy() { t.dispose(); },
        };
    }

    const TOOLTIP_CASCADE = "Not set here — applied automatically from another style.";

    interface Props {
        cssRuleFilter?: (el: Element, cssSelector: string) => boolean;
        getCssRuleName?: (ruleName: string, el: Element) => string;
        onStyleChanged?: (target: Element, rule: StyleRule, prop: string, value: string) => void;
        suppressRing?: boolean;
        availableFonts?: string[];
        onOpenFontPicker?: () => void;
    }

    let { cssRuleFilter, getCssRuleName, onStyleChanged = () => {}, suppressRing = false, availableFonts = [], onOpenFontPicker }: Props = $props();

    const STROKE_WIDTHS = ["0.5", "1", "2", "3", "4", "6", "8", "12"];

    const DASH_PRESETS = [
        { label: "Solid",     value: "" },
        { label: "Dashed",    value: "6 4" },
        { label: "Dotted",    value: "1 4" },
        { label: "Dash-dot",  value: "8 3 1 3" },
        { label: "Long dash", value: "12 4" },
    ];

    const SYSTEM_FONTS = [
        "Arial", "Verdana", "Helvetica", "Tahoma", "Trebuchet MS",
        "Georgia", "Palatino Linotype", "Times New Roman", "Courier New", "Impact",
    ];

    const IC = {
        font:   `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor"><text x="1" y="13" font-size="13" font-weight="700" font-family="serif">A</text></svg>`,
        fill:   `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="currentColor"><path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 000 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/></svg>`,
        stroke: `<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
        width:  `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor"><rect x="2" y="3" width="12" height="1.5" rx="0.75"/><rect x="2" y="7" width="12" height="2.5" rx="1.25"/><rect x="2" y="12" width="12" height="3" rx="1.5"/></svg>`,
        dash:   `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor"><rect x="1" y="7" width="4" height="2" rx="1"/><rect x="6.5" y="7" width="4" height="2" rx="1"/><rect x="12" y="7" width="3" height="2" rx="1"/></svg>`,
    };

    let element: Element | null = $state(null);
    let matchedRules: StyleRule[] = $state([]);
    let selectedRuleIndex = $state(0);
    let widthOpen = $state(false); let dashOpen = $state(false); let fontOpen = $state(false);

    let currentFill = $state(""); let currentStroke = $state("");
    let currentStrokeWidth = $state(""); let currentDasharray = $state("");
    let currentFontFamily = $state("");

    const isTextElement = $derived(!!element && ["text", "tspan"].includes(element.tagName.toLowerCase()));
    const allFonts = $derived([...availableFonts.filter((f) => !SYSTEM_FONTS.includes(f)), ...SYSTEM_FONTS]);
    const selectedRule = $derived(matchedRules[selectedRuleIndex] ?? null);

    let ringStyle = $state(""); let ringVisible = $state(false); let ringRaf = 0;

    // ── Style values ────────────────────────────────────────────────
    function refreshValues() {
        if (!element || !selectedRule) { currentFill = currentStroke = currentStrokeWidth = currentDasharray = currentFontFamily = ""; return; }
        currentFill        = getRuleValue(element, selectedRule, "fill");
        currentStroke      = getRuleValue(element, selectedRule, "stroke");
        currentStrokeWidth = getRuleValue(element, selectedRule, "stroke-width");
        currentDasharray   = getRuleValue(element, selectedRule, "stroke-dasharray");
        currentFontFamily  = getRuleValue(element, selectedRule, "font-family");
    }

    function apply(prop: string, value: string) {
        if (!element || !selectedRule) return;
        setRuleValue(element, selectedRule, prop, value);
        refreshValues();
        onStyleChanged(element, selectedRule, prop, value);
    }

    // ── Computed / cascade values ────────────────────────────────────
    function computedVal(prop: string): string {
        if (!element) return "";
        try {
            const cs = window.getComputedStyle(element as Element);
            switch (prop) {
                case "fill":             return cs.fill          ?? "";
                case "stroke":           return cs.stroke        ?? "";
                case "stroke-width":     return cs.strokeWidth   ?? "";
                case "stroke-dasharray": { const v = cs.strokeDasharray; return !v || v === "none" ? "" : v.replace(/px/g, "").trim(); }
                case "font-family":      return cs.fontFamily    ?? "";
            }
        } catch { /* cross-origin */ }
        return "";
    }

    function inheritedColor(prop: string): string {
        const raw = computedVal(prop);
        if (!raw || raw === "none") return "";
        return raw.startsWith("rgb") ? rgbToHex(raw) : raw;
    }

    function inheritedWidth(): string { const v = computedVal("stroke-width"); const n = parseFloat(v); return isNaN(n) ? "" : `${n}px`; }
    function inheritedDash(): string  { return computedVal("stroke-dasharray"); }

    // ── Helpers ─────────────────────────────────────────────────────
    function normalizeDash(v: string) { return (!v || v === "none" || v === "0") ? "" : v.trim(); }
    function currentDashPreset()      { return DASH_PRESETS.find((p) => p.value === normalizeDash(currentDasharray)) ?? null; }
    function currentWidthDisplay()    { if (!currentStrokeWidth) return "—"; const n = parseFloat(currentStrokeWidth); return isNaN(n) ? currentStrokeWidth : `${n}px`; }
    function currentWidthNum()        { return parseFloat(currentStrokeWidth) || 1; }
    /** Normalise any CSS color value to uppercase hex for display (#RRGGBB or #RRGGBBAA). */
    function displayColor(v: string): string {
        if (!v || v === "none") return v;
        if (v.startsWith("#")) return v.toUpperCase();
        const { hex, alpha } = parseColorValue(v);
        if (!hex) return v;
        if (alpha >= 100) return "#" + hex;
        const a = Math.round(alpha * 255 / 100).toString(16).padStart(2, "0").toUpperCase();
        return "#" + hex + a;
    }

    function cleanFontName(v: string) { return v.trim().replace(/^['"]|['"]$/g, "").trim(); }
    function applyFont(name: string)  { apply("font-family", name.includes(" ") ? `'${name}'` : name); }
    function closeDropdowns()         { widthOpen = dashOpen = fontOpen = false; }

    function getElementInfo() {
        if (!element) return "";
        const tag = element.tagName.toLowerCase();
        const cls = Array.from(element.classList).filter((c) => !c.startsWith("_") && c !== "hovered").slice(0, 2).join(".");
        return `${tag}${cls ? "." + cls : ""}${element.id ? "#" + element.id : ""}`;
    }

    function getRuleLabel(rule: StyleRule) {
        const raw = rule === "inline" ? "inline" : (rule as CSSStyleRule).selectorText;
        if (getCssRuleName && element) return getCssRuleName(raw, element);
        return rule === "inline" ? "This element" : raw;
    }

    // ── Effects ─────────────────────────────────────────────────────
    $effect(() => { selectedRule; element; refreshValues(); });
    $effect(() => {
        if (element) { matchedRules = getMatchedCSSRules(element, cssRuleFilter); selectedRuleIndex = 0; scheduleRingUpdate(); }
        else { matchedRules = []; ringVisible = false; clearHighlight(); }
    });
    $effect(() => { if (suppressRing) ringVisible = false; else if (element) scheduleRingUpdate(); });

    function scheduleRingUpdate() { cancelAnimationFrame(ringRaf); ringRaf = requestAnimationFrame(updateRing); }
    function updateRing() {
        if (!element || suppressRing) { ringVisible = false; return; }
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) { ringVisible = false; return; }
        const pad = 5;
        ringStyle = `left:${rect.left-pad}px;top:${rect.top-pad}px;width:${rect.width+pad*2}px;height:${rect.height+pad*2}px`;
        ringVisible = true;
    }

    // ── Icon tooltips ────────────────────────────────────────────────
    let panelEl: HTMLElement | null = $state(null);
    let widthDropEl: HTMLDivElement | null = $state(null);
    let dashDropEl:  HTMLDivElement | null = $state(null);
    let fontDropEl:  HTMLDivElement | null = $state(null);
    let tipText = $state(""); let tipX = $state(0); let tipY = $state(0); let tipVisible = $state(false);
    function showTip(e: MouseEvent, text: string) { tipText = text; tipX = e.clientX; tipY = e.clientY; tipVisible = true; }
    function hideTip() { tipVisible = false; }

    onMount(() => {
        function handleDocMousedown(e: MouseEvent) {
            const t = e.target as Node;
            if (widthOpen && !widthDropEl?.contains(t)) widthOpen = false;
            if (dashOpen  && !dashDropEl?.contains(t))  dashOpen  = false;
            if (fontOpen  && !fontDropEl?.contains(t))  fontOpen  = false;
            if (!element || panelEl?.contains(t)) return;
            if (document.getElementById("static-svg-map")?.contains(t)) return;
            if (!document.getElementById("map-area")?.contains(t)) return;
            element = null; ringVisible = false;
        }
        document.addEventListener("mousedown", handleDocMousedown);
        return () => document.removeEventListener("mousedown", handleDocMousedown);
    });

    // ── Rule hover highlight ─────────────────────────────────────────
    const DIM_TAGS = ["path", "text", "use", "image", "circle", "rect", "polygon", "line", "ellipse"];
    let _hoverStyle: HTMLStyleElement | null = null;

    function highlightRule(rule: StyleRule) {
        clearHighlight();
        if (!element) return;
        let selector = rule === "inline"
            ? (element.id ? `#${CSS.escape(element.id)}` : "")
            : (rule as CSSStyleRule).selectorText.replace(/\.hovered/g, "").replace(/:hover/g, "").trim();
        if (!selector) return;
        const svgEl = document.getElementById("static-svg-map");
        if (!svgEl) return;
        svgEl.classList.add("sp-hl");
        const dim = DIM_TAGS.map((t) => `#static-svg-map.sp-hl ${t}`).join(", ");
        _hoverStyle = document.createElement("style");
        _hoverStyle.dataset.stylePanelHover = "";
        _hoverStyle.textContent = `${dim}{opacity:.12;transition:opacity .1s}#static-svg-map.sp-hl ${selector}{opacity:1!important}`;
        document.head.appendChild(_hoverStyle);
    }

    function clearHighlight() { document.getElementById("static-svg-map")?.classList.remove("sp-hl"); _hoverStyle?.remove(); _hoverStyle = null; }

    export function open(el: Element) { element = el; closeDropdowns(); }
    export function close() { clearHighlight(); element = null; ringVisible = false; closeDropdowns(); }
    export function isOpen() { return element !== null; }
</script>

<!-- ── Snippets ──────────────────────────────────────────────────── -->

<!-- Reusable SVG line preview (width + dash style dropdowns) -->
{#snippet linePrev(w: number, dash: string)}
<svg class="sp-preview" viewBox="0 0 52 14" width="52" height="14" aria-hidden="true">
    <line x1="2" y1="7" x2="50" y2="7" stroke="#506784" stroke-width={w}
        stroke-dasharray={dash || "none"} stroke-linecap="round"/>
</svg>
{/snippet}

<!-- Reset (×) button — shown only when property has an explicit value -->
{#snippet resetBtn(prop: string, currentVal: string)}
    {#if currentVal}
        <button type="button" class="btn btn-sm btn-link text-muted text-decoration-none p-0 lh-1"
            onclick={() => apply(prop, "")}>×</button>
    {/if}
{/snippet}

<!-- Cascade indicator for color fields (dashed swatch + italic hex) -->
{#snippet cascadeColor(prop: string)}
    {@const ic = inheritedColor(prop)}
    <span class="flex-grow-1"></span>
    <span class="sp-cascade" use:bsTooltip={TOOLTIP_CASCADE}>
        {#if ic}<span class="sp-inherited-swatch" style="background:{ic}"></span>{/if}
        <em class="font-monospace text-muted" style="font-size:10px">{ic || "—"}</em>
    </span>
{/snippet}

<!-- Cascade indicator for text fields (italic value) -->
{#snippet cascadeText(value: string)}
    <span class="flex-grow-1"></span>
    <em class="text-muted me-1" style="font-size:10px" use:bsTooltip={TOOLTIP_CASCADE}>{value || "—"}</em>
{/snippet}

<!-- Full color property row (fill / stroke) -->
{#snippet colorField(prop: string, currentVal: string, icon: string, tipLabel: string)}
{@const effectiveColor = currentVal || inheritedColor(prop)}
<div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" class:sp-inherited-row={!currentVal} style="min-height:38px">
    <span class="sp-icon sp-icon-color" onmouseenter={(e) => showTip(e, tipLabel)} onmouseleave={hideTip}>
        {@html icon}
        <span class="sp-color-bar"
            class:sp-color-bar--inherited={!currentVal}
            style="background:{effectiveColor && effectiveColor !== 'none' ? effectiveColor : 'transparent'}"></span>
    </span>
    <div class="d-flex align-items-center flex-grow-1 gap-2 overflow-hidden">
        <StyleColorPicker value={currentVal} onChange={(c) => apply(prop, c)} />
        {#if currentVal}
            <span class="font-monospace text-secondary text-truncate flex-grow-1" style="font-size:11px">{displayColor(currentVal)}</span>
        {:else}
            {@render cascadeColor(prop)}
        {/if}
    </div>
    {@render resetBtn(prop, currentVal)}
</div>
{/snippet}

<!-- ── Marching-ants ring ─────────────────────────────────────────── -->
{#if ringVisible}
    <div class="style-ring" style={ringStyle}></div>
{/if}

<!-- ── Panel ─────────────────────────────────────────────────────── -->
<aside class="style-panel d-flex flex-column border-start" bind:this={panelEl}>

    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between px-3 border-bottom flex-shrink-0 bg-white" style="min-height:36px">
        {#if element}
            <span class="font-monospace text-secondary text-truncate flex-grow-1" style="font-size:11px">{getElementInfo()}</span>
            <button type="button" class="btn-close ms-2 flex-shrink-0" onclick={close} aria-label="Close" style="font-size:0.6rem"></button>
        {:else}
            <span class="text-secondary fw-semibold text-uppercase" style="font-size:11px;letter-spacing:.04em">Styles</span>
        {/if}
    </div>

    {#if element}
        <!-- Rule tabs -->
        {#if matchedRules.length > 1}
            <div class="d-flex border-bottom">
                {#each matchedRules as rule, i}
                    <button type="button" class="sp-rule-tab" class:active={i === selectedRuleIndex}
                        onmouseenter={() => highlightRule(rule)} onmouseleave={clearHighlight}
                        onclick={() => { selectedRuleIndex = i; closeDropdowns(); }}>
                        {getRuleLabel(rule)}
                    </button>
                {/each}
            </div>
        {:else if matchedRules.length === 1 && matchedRules[0] !== "inline"}
            <div class="px-3 py-1 border-bottom text-secondary fst-italic" style="font-size:11px"
                onmouseenter={() => highlightRule(matchedRules[0])} onmouseleave={clearHighlight}>
                {getRuleLabel(matchedRules[0])}
            </div>
        {/if}

        <!-- Controls -->
        <div class="flex-grow-1 overflow-y-auto">

            <!-- Font family (text elements only) -->
            {#if isTextElement}
            <div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" style="min-height:38px">
                <span class="sp-icon" onmouseenter={(e) => showTip(e, 'Font family')} onmouseleave={hideTip}>{@html IC.font}</span>
                <div class="dropdown flex-grow-1" bind:this={fontDropEl}>
                    <button type="button" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-1 text-start"
                        style="font-family:{currentFontFamily || 'inherit'}"
                        onclick={() => { fontOpen = !fontOpen; widthOpen = dashOpen = false; }}>
                        <span class="flex-grow-1" style="font-size:12px">{cleanFontName(currentFontFamily) || "—"}</span>
                        <span class="text-muted" style="font-size:10px">▾</span>
                    </button>
                    {#if fontOpen}
                        <ul class="dropdown-menu show w-100 overflow-y-auto py-1" style="max-height:280px">
                            <li><button type="button" class="dropdown-item small fw-medium text-teal"
                                onclick={() => { fontOpen = false; onOpenFontPicker?.(); }}>More fonts…</button></li>
                            <li><hr class="dropdown-divider my-1"></li>
                            {#each allFonts as font}
                                <li><button type="button" class="dropdown-item small"
                                    class:active={cleanFontName(currentFontFamily) === font}
                                    style="font-family:'{font}'"
                                    onclick={() => { applyFont(font); fontOpen = false; }}>{font}</button></li>
                            {/each}
                        </ul>
                    {/if}
                </div>
                {@render resetBtn("font-family", currentFontFamily)}
            </div>
            {/if}

            <!-- Fill -->
            {@render colorField("fill", currentFill, IC.fill, "Fill")}

            <!-- Stroke -->
            {@render colorField("stroke", currentStroke, IC.stroke, "Stroke color")}

            <!-- Stroke width -->
            <div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" class:sp-inherited-row={!currentStrokeWidth} style="min-height:38px">
                <span class="sp-icon" onmouseenter={(e) => showTip(e, 'Stroke width')} onmouseleave={hideTip}>{@html IC.width}</span>
                <div class="dropdown flex-grow-1" bind:this={widthDropEl}>
                    <button type="button" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-1"
                        onclick={() => { widthOpen = !widthOpen; dashOpen = false; }}>
                        {@render linePrev(currentWidthNum(), "none")}
                        {#if currentStrokeWidth}
                            <span class="flex-grow-1 text-start" style="font-size:11px">{currentWidthDisplay()}</span>
                        {:else}
                            {@render cascadeText(inheritedWidth())}
                        {/if}
                        <span class="text-muted" style="font-size:10px">▾</span>
                    </button>
                    {#if widthOpen}
                        <ul class="dropdown-menu show w-100 overflow-y-auto py-1" style="max-height:240px">
                            {#each STROKE_WIDTHS as w}
                                <li><button type="button" class="dropdown-item d-flex align-items-center gap-2 small"
                                    class:active={parseFloat(currentStrokeWidth) === parseFloat(w)}
                                    onclick={() => { apply("stroke-width", w + "px"); widthOpen = false; }}>
                                    {@render linePrev(parseFloat(w), "none")}
                                    <span>{w}px</span>
                                </button></li>
                            {/each}
                        </ul>
                    {/if}
                </div>
                {@render resetBtn("stroke-width", currentStrokeWidth)}
            </div>

            <!-- Dash style -->
            <div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" class:sp-inherited-row={!currentDasharray || !normalizeDash(currentDasharray)} style="min-height:38px">
                <span class="sp-icon" onmouseenter={(e) => showTip(e, 'Dash style')} onmouseleave={hideTip}>{@html IC.dash}</span>
                <div class="dropdown flex-grow-1" bind:this={dashDropEl}>
                    <button type="button" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-1"
                        onclick={() => { dashOpen = !dashOpen; widthOpen = false; }}>
                        {@render linePrev(2, normalizeDash(currentDasharray))}
                        {#if currentDasharray && normalizeDash(currentDasharray)}
                            <span class="flex-grow-1 text-start" style="font-size:11px">{currentDashPreset()?.label ?? "—"}</span>
                        {:else}
                            {@render cascadeText(inheritedDash())}
                        {/if}
                        <span class="text-muted" style="font-size:10px">▾</span>
                    </button>
                    {#if dashOpen}
                        <ul class="dropdown-menu show w-100 py-1">
                            {#each DASH_PRESETS as preset}
                                <li><button type="button" class="dropdown-item d-flex align-items-center gap-2 small"
                                    class:active={normalizeDash(currentDasharray) === preset.value}
                                    onclick={() => { apply("stroke-dasharray", preset.value); dashOpen = false; }}>
                                    {@render linePrev(2, preset.value)}
                                    <span>{preset.label}</span>
                                </button></li>
                            {/each}
                        </ul>
                    {/if}
                </div>
                {@render resetBtn("stroke-dasharray", normalizeDash(currentDasharray))}
            </div>

        </div>

    {:else}
        <div class="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-secondary gap-3 p-4" style="font-size:12px;text-align:center;line-height:1.5">
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="4" width="24" height="24" rx="3"/>
                <line x1="10" y1="16" x2="22" y2="16"/>
                <line x1="16" y1="10" x2="16" y2="22"/>
            </svg>
            <span>Click any element<br>to edit its style</span>
        </div>
    {/if}

</aside>

{#if tipVisible}
    <div class="sp-tip" style="left:{tipX + 12}px;top:{tipY - 28}px">{tipText}</div>
{/if}

<style>
    /* Marching-ants ring */
    .style-ring {
        position: fixed; pointer-events: none; z-index: 9997; border-radius: 3px;
        background-image:
            repeating-linear-gradient(0deg,   #506784, #506784 5px, transparent 5px, transparent 10px),
            repeating-linear-gradient(90deg,  #506784, #506784 5px, transparent 5px, transparent 10px),
            repeating-linear-gradient(180deg, #506784, #506784 5px, transparent 5px, transparent 10px),
            repeating-linear-gradient(270deg, #506784, #506784 5px, transparent 5px, transparent 10px);
        background-size: 2px 100%, 100% 2px, 2px 100%, 100% 2px;
        background-position: 0 0, 0 0, 100% 0, 0 100%;
        background-repeat: no-repeat;
        animation: march .5s linear infinite;
    }
    @keyframes march { to { background-position: 0 -10px, 10px 0, 100% 10px, -10px 100%; } }

    .style-panel { width: 248px; }

    .sp-rule-tab {
        padding: 5px 12px; border: none; border-bottom: 2px solid transparent;
        background: none; font-size: 11px; color: #8da5be; cursor: pointer;
        margin-bottom: -1px; white-space: nowrap;
    }
    .sp-rule-tab:hover { color: #506784; }
    .sp-rule-tab.active { color: #506784; font-weight: 600; border-bottom-color: #506784; }

    .sp-icon {
        width: 24px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        color: #8da5be; cursor: default;
    }
    .sp-icon:hover { color: #506784; }
    /* Fill / stroke icons: stack icon above colour bar */
    .sp-icon-color { flex-direction: column; gap: 2px; }
    .sp-color-bar {
        width: 16px; height: 3px; border-radius: 2px;
        border: 1px solid rgba(0,0,0,0.1); flex-shrink: 0;
    }
    .sp-color-bar--inherited { opacity: 0.45; }

    .sp-preview { display: block; flex-shrink: 0; }

    .sp-inherited-row { background: #f8f9fa; }

    .sp-cascade { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .sp-inherited-swatch {
        width: 13px; height: 13px; border-radius: 2px;
        border: 1.5px dashed #adb5bd; flex-shrink: 0;
    }

    .sp-tip {
        position: fixed; pointer-events: none; z-index: 99999;
        background: #2c3e52; color: white;
        font-size: 10px; font-family: system-ui, sans-serif;
        padding: 3px 7px; border-radius: 4px; white-space: nowrap;
    }
</style>
