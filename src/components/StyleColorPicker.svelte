<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        value?: string;
        onChange: (color: string) => void;
    }
    let { value = "", onChange }: Props = $props();

    const SWATCHES = [
        "#FFFFFF", "#F5F5F5", "#9E9E9E", "#616161", "#424242", "#000000",
        "#E3F2FD", "#90CAF9", "#42A5F5", "#1565C0", "#0D47A1", "#01579B",
        "#E8F5E9", "#A5D6A7", "#66BB6A", "#2E7D32", "#1B5E20", "#558B2F",
        "#FFF8E1", "#FFE082", "#FFC107", "#F57F17", "#BF360C", "#FF5722",
    ];

    const POPOVER_W = 200;
    const POPOVER_H = 430;

    let popoverOpen = $state(false);
    let hexVal = $state("");
    let hue = $state(0); let sat = $state(0); let bri = $state(100); let alpha = $state(100);

    let buttonEl = $state<HTMLButtonElement | null>(null);
    let popoverEl = $state<HTMLDivElement | null>(null);
    let sqEl = $state<HTMLDivElement | null>(null);
    let hueEl = $state<HTMLDivElement | null>(null);
    let alphaEl = $state<HTMLDivElement | null>(null);
    let popTop = $state(0); let popLeft = $state(0);

    const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

    // ── Color math ──────────────────────────────────────────────────
    function parseValue(v: string): { hex: string; alpha: number } {
        if (!v || v === "none") return { hex: "", alpha: 100 };
        const m = v.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
        if (m) return { hex: [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,"0")).join("").toUpperCase(), alpha: Math.round(parseFloat(m[4])*100) };
        if (v.startsWith("#") && v.length === 9) return { hex: v.slice(1,7).toUpperCase(), alpha: Math.round(parseInt(v.slice(7),16)/255*100) };
        if (v.startsWith("#") && v.length >= 7) return { hex: v.slice(1,7).toUpperCase(), alpha: 100 };
        return { hex: "", alpha: 100 };
    }

    function buildOutput(hex: string, a: number): string {
        if (!hex) return "none";
        if (a >= 100) return "#" + hex;
        const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
        return `rgba(${r}, ${g}, ${b}, ${(a/100).toFixed(2)})`;
    }

    function hsvToHex(h: number, s: number, v: number): string {
        s /= 100; v /= 100;
        const hi = Math.floor(h/60)%6, f = h/60-Math.floor(h/60);
        const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
        const rows: [number,number,number][] = [[v,t,p],[t,v,p],[p,v,q],[p,t,v],[q,p,v],[v,p,t]];
        return rows[hi].map(x => Math.round(x*255).toString(16).padStart(2,"0")).join("").toUpperCase();
    }

    function hexToHsv(hex: string): { h: number; s: number; v: number } {
        const h = hex.replace("#","");
        if (h.length < 6) return { h:0, s:0, v:100 };
        const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
        const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
        let hh = 0;
        if (d > 0) {
            if (max===r) hh=((g-b)/d+(g<b?6:0))/6;
            else if (max===g) hh=((b-r)/d+2)/6;
            else hh=((r-g)/d+4)/6;
        }
        return { h:Math.round(hh*360), s:Math.round((max===0?0:d/max)*100), v:Math.round(max*100) };
    }

    $effect(() => {
        const v = value;
        const { hex, alpha: a } = parseValue(v);
        hexVal = hex; alpha = a;
        if (!hex) return;
        if (hsvToHex(hue,sat,bri) !== hex) { const hsv = hexToHsv("#"+hex); hue=hsv.h; sat=hsv.s; bri=hsv.v; }
    });

    function emitHsv() { const hex = hsvToHex(hue,sat,bri); hexVal = hex; onChange(buildOutput(hex, alpha)); }

    // ── Drag handlers ────────────────────────────────────────────────
    function onSqDown(e: PointerEvent) { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); updateSq(e); }
    function onSqMove(e: PointerEvent) { if (e.buttons) updateSq(e); }
    function updateSq(e: PointerEvent) {
        if (!sqEl) return;
        const r = sqEl.getBoundingClientRect();
        sat = Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*100);
        bri = Math.round((1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)))*100);
        emitHsv();
    }
    function onHueDown(e: PointerEvent) { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); updateHue(e); }
    function onHueMove(e: PointerEvent) { if (e.buttons) updateHue(e); }
    function updateHue(e: PointerEvent) { if (!hueEl) return; const r=hueEl.getBoundingClientRect(); hue=Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*360); emitHsv(); }
    function onAlphaDown(e: PointerEvent) { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); updateAlpha(e); }
    function onAlphaMove(e: PointerEvent) { if (e.buttons) updateAlpha(e); }
    function updateAlpha(e: PointerEvent) { if (!alphaEl) return; const r=alphaEl.getBoundingClientRect(); alpha=Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*100); emitHsv(); }
    function onAlphaInput(e: Event) { alpha=Math.max(0,Math.min(100,parseInt((e.target as HTMLInputElement).value)||0)); emitHsv(); }
    function release(e: PointerEvent) { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }

    // ── Popover positioning ──────────────────────────────────────────
    function togglePopover() {
        if (!buttonEl) return;
        if (popoverOpen) { popoverOpen = false; return; }
        const rect = buttonEl.getBoundingClientRect();
        let top = rect.bottom + 6, left = rect.left;
        if (top + POPOVER_H > window.innerHeight) top = rect.top - POPOVER_H - 6;
        if (left + POPOVER_W > window.innerWidth) left = rect.right - POPOVER_W;
        popTop = Math.max(4,top); popLeft = Math.max(4,left);
        popoverOpen = true;
    }

    function pickColor(color: string) {
        if (color === "none") { onChange("none"); popoverOpen = false; return; }
        const { hex } = parseValue(color);
        hexVal = hex; const hsv = hexToHsv("#"+hex); hue=hsv.h; sat=hsv.s; bri=hsv.v; alpha=100;
        onChange(color); popoverOpen = false;
    }

    function onHexInput(e: Event) {
        const raw = (e.target as HTMLInputElement).value.toUpperCase().replace(/[^0-9A-F]/g,"");
        hexVal = raw;
        if (raw.length === 6) { const hsv=hexToHsv("#"+raw); hue=hsv.h; sat=hsv.s; bri=hsv.v; onChange(buildOutput(raw, alpha)); }
    }
    function onHexBlur() { if (hexVal.length===6) { const hsv=hexToHsv("#"+hexVal); hue=hsv.h; sat=hsv.s; bri=hsv.v; onChange(buildOutput(hexVal, alpha)); } }

    async function eyeDropper() {
        try { const d = new (window as any).EyeDropper(); pickColor((await d.open()).sRGBHex); } catch {}
    }

    function handleClickOutside(e: MouseEvent) {
        if (!popoverOpen) return;
        const t = e.target as Node;
        if (buttonEl?.contains(t) || popoverEl?.contains(t)) return;
        popoverOpen = false;
    }
    onMount(() => {
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    });

    const currentHex = $derived(hexVal ? "#"+hexVal : "#000000");

    // ── Imperative API (used by QuillEditor hidden pickers) ─────────
    export function open() {
        if (!buttonEl) return;
        const rect = buttonEl.getBoundingClientRect();
        let top: number, left: number;
        if (rect.width === 0 || rect.height === 0) {
            // Hidden button — centre on viewport
            top = Math.max(4, window.innerHeight / 2 - POPOVER_H / 2);
            left = Math.max(4, window.innerWidth / 2 - POPOVER_W / 2);
        } else {
            top = rect.bottom + 6;
            left = rect.left;
            if (top + POPOVER_H > window.innerHeight) top = rect.top - POPOVER_H - 6;
            if (left + POPOVER_W > window.innerWidth) left = rect.right - POPOVER_W;
            top = Math.max(4, top);
            left = Math.max(4, left);
        }
        popTop = top; popLeft = left;
        popoverOpen = true;
    }

    export function setColor(hex: string) {
        const { hex: h, alpha: a } = parseValue(hex);
        if (!h) return;
        hexVal = h; alpha = a;
        const hsv = hexToHsv("#" + h);
        hue = hsv.h; sat = hsv.s; bri = hsv.v;
    }
</script>

<div class="scp-wrap">
    <button bind:this={buttonEl} class="scp-btn" type="button" onclick={togglePopover} title={value || "No color"}>
        {#if !value || value === "none"}
            <span class="scp-none"></span>
        {:else}
            <span class="scp-swatch-preview" style="background:{value}"></span>
        {/if}
    </button>
</div>

{#if popoverOpen}
    <div bind:this={popoverEl} class="scp-popover bg-white border rounded-3 shadow p-2"
        style="top:{popTop}px;left:{popLeft}px;width:{POPOVER_W}px">

        <!-- Gradient square -->
        <div bind:this={sqEl} class="scp-sq mb-2" style="--h:{hue}"
            onpointerdown={onSqDown} onpointermove={onSqMove} onpointerup={release}>
            <div class="scp-dot" style="left:{sat}%;top:{100-bri}%"></div>
        </div>

        <!-- Hue bar -->
        <div bind:this={hueEl} class="scp-bar scp-hue mb-2"
            onpointerdown={onHueDown} onpointermove={onHueMove} onpointerup={release}>
            <div class="scp-thumb" style="left:{(hue/360)*100}%;background:hsl({hue},100%,50%)"></div>
        </div>

        <!-- Alpha bar -->
        <div bind:this={alphaEl} class="scp-bar scp-alpha mb-2"
            onpointerdown={onAlphaDown} onpointermove={onAlphaMove} onpointerup={release}>
            <div class="scp-alpha-fill" style="--color:{currentHex}"></div>
            <div class="scp-thumb" style="left:{alpha}%;background:{buildOutput(hexVal||'000000',alpha)}"></div>
        </div>

        <hr class="my-2 mx-n2">

        <!-- No color -->
        <button type="button" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-2 mb-2 text-start"
            onclick={() => pickColor("none")}>
            <span class="scp-none-sm"></span>
            No color
        </button>

        <!-- Swatches -->
        <div class="scp-grid mb-2">
            {#each SWATCHES as c}
                <button type="button" class="scp-swatch"
                    class:active={("#"+hexVal).toLowerCase() === c.toLowerCase()}
                    title={c} style="background:{c}"
                    onclick={() => pickColor(c)}></button>
            {/each}
        </div>

        <!-- Hex + alpha + eyedropper -->
        <div class="d-flex align-items-center gap-1">
            <div class="d-flex align-items-center border rounded flex-grow-1 px-2 gap-1" style="height:28px">
                <span class="text-muted" style="font-size:12px;font-family:monospace">#</span>
                <input class="flex-grow-1 border-0 p-0 font-monospace text-uppercase" style="outline:none;font-size:12px;min-width:0;background:transparent"
                    type="text" value={hexVal} maxlength="6" placeholder="RRGGBB"
                    oninput={onHexInput} onblur={onHexBlur} />
            </div>
            <div class="d-flex align-items-center border rounded px-1 gap-1" style="width:54px;height:28px">
                <input class="flex-grow-1 border-0 p-0 text-end" style="outline:none;font-size:11px;min-width:0;background:transparent;-moz-appearance:textfield"
                    type="number" min="0" max="100" value={alpha} oninput={onAlphaInput} title="Opacity %" />
                <span class="text-muted" style="font-size:11px">%</span>
            </div>
            {#if hasEyeDropper}
                <button type="button" class="btn btn-sm btn-link text-secondary p-1" title="Pick from screen" onclick={eyeDropper}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                        <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.41-1.42-1.42 1.42 1.41 1.41L4.01 16.43a2 2 0 00-.59 1.42V20h2.15c.53 0 1.04-.21 1.42-.59l8.4-8.4 1.41 1.41 1.42-1.42-1.42-1.41 3.12-3.12c.4-.4.4-1.02.01-1.42z"/>
                    </svg>
                </button>
            {/if}
        </div>
    </div>
{/if}

<style>
    .scp-wrap { display: inline-block; }

    /* Trigger button */
    .scp-btn {
        width: 26px; height: 26px; padding: 2px;
        border: 2px solid #c9d5e3; border-radius: 4px;
        cursor: pointer; background: white;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .scp-btn:hover { border-color: #506784; }
    .scp-swatch-preview { display: block; width: 100%; height: 100%; border-radius: 2px; }
    .scp-none {
        display: block; width: 100%; height: 100%; border-radius: 2px;
        background: linear-gradient(to bottom right, white 43%, #e74c3c 43%, #e74c3c 57%, white 57%);
        border: 1px solid #ddd;
    }

    /* Popover (fixed positioning so it escapes any overflow) */
    .scp-popover { position: fixed; z-index: 9999; }

    /* Gradient square */
    .scp-sq {
        position: relative; width: 100%; height: 110px; border-radius: 4px;
        cursor: crosshair; touch-action: none; user-select: none;
        background-image:
            linear-gradient(to bottom, transparent, black),
            linear-gradient(to right, white, hsl(calc(var(--h) * 1deg) 100% 50%));
    }
    .scp-dot {
        position: absolute; width: 13px; height: 13px; border-radius: 50%;
        border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,.5);
        transform: translate(-50%,-50%); pointer-events: none;
    }

    /* Shared bar styles (hue + alpha) */
    .scp-bar {
        position: relative; width: 100%; height: 12px; border-radius: 6px;
        cursor: ew-resize; touch-action: none; user-select: none; overflow: hidden;
    }
    .scp-thumb {
        position: absolute; top: 50%; transform: translate(-50%,-50%);
        width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,.35);
        pointer-events: none;
    }

    /* Hue bar */
    .scp-hue {
        background: linear-gradient(to right,
            hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
            hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
            hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
            hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
            hsl(360,100%,50%));
    }
    /* Hue thumb needs to overflow the hidden bar */
    .scp-hue { overflow: visible; }

    /* Alpha bar */
    .scp-alpha {
        background-image:
            linear-gradient(45deg, #bbb 25%, transparent 25%),
            linear-gradient(-45deg, #bbb 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #bbb 75%),
            linear-gradient(-45deg, transparent 75%, #bbb 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
        overflow: visible;
    }
    .scp-alpha-fill {
        position: absolute; inset: 0;
        background: linear-gradient(to right, transparent, var(--color));
    }

    /* Swatches */
    .scp-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
    .scp-swatch {
        width: 24px; height: 24px; border-radius: 3px;
        border: 2px solid transparent; cursor: pointer; padding: 0; box-sizing: border-box; outline: none;
    }
    .scp-swatch:hover, .scp-swatch.active { border-color: #506784; transform: scale(1.12); }
    .scp-none-sm {
        display: inline-block; width: 16px; height: 16px; flex-shrink: 0;
        background: linear-gradient(to bottom right, white 43%, #e74c3c 43%, #e74c3c 57%, white 57%);
        border: 1px solid #ddd; border-radius: 2px;
    }

    /* Remove number input arrows */
    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
