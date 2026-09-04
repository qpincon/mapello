<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { hsvToHex, hexToHsv, parseColorValue, buildColorOutput, popoverPosition, alphaToHex, hexToAlpha } from "../util/colorMath";

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

    const POPOVER_W = 200, POPOVER_H = 430;

    let popoverOpen = $state(false);
    let hexVal = $state(""); let hue = $state(0); let sat = $state(0); let bri = $state(100); let alpha = $state(100);
    let buttonEl = $state<HTMLButtonElement | null>(null);
    let popoverEl = $state<HTMLDivElement | null>(null);
    let sqEl = $state<HTMLDivElement | null>(null);
    let hueEl = $state<HTMLDivElement | null>(null);
    let alphaEl = $state<HTMLDivElement | null>(null);
    let popTop = $state(0); let popLeft = $state(0);
    let popBottom = $state<number | null>(null); // non-null → use bottom instead of top
    let popMaxHeight = $state<number | null>(null);

    const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

    // Sync from value prop
    $effect(() => {
        const v = value;
        const { hex, alpha: a } = parseColorValue(v);
        untrack(() => {
            hexVal = hex; alpha = a;
            if (!hex) return;
            if (hsvToHex(hue, sat, bri) !== hex) { const hsv = hexToHsv("#" + hex); hue = hsv.h; sat = hsv.s; bri = hsv.v; }
        });
    });

    // Text shown in the hex input — "RRGGBB" when fully opaque, "RRGGBBAA" otherwise.
    // Kept as its own state (rather than a $derived on hexVal/alpha) so mid-typing
    // keystrokes aren't clobbered by a re-render before the user finishes typing.
    let hexBoxText = $state("");
    $effect(() => { hexBoxText = hexVal + (alpha >= 100 ? "" : alphaToHex(alpha)); });

    function emitHsv() { const hex = hsvToHex(hue, sat, bri); hexVal = hex; onChange(buildColorOutput(hex, alpha)); }

    // ── Drag helpers ─────────────────────────────────────────────────
    // Factory so each draggable region gets a down/move pair without repetition
    function makeDrag(update: (e: PointerEvent) => void) {
        return {
            down(e: PointerEvent) { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); update(e); },
            move(e: PointerEvent) { if (e.buttons) update(e); },
        };
    }
    function release(e: PointerEvent) { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }

    function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

    const sq = makeDrag((e) => {
        if (!sqEl) return;
        const r = sqEl.getBoundingClientRect();
        sat = Math.round(clamp01((e.clientX - r.left) / r.width) * 100);
        bri = Math.round((1 - clamp01((e.clientY - r.top) / r.height)) * 100);
        emitHsv();
    });

    const hueBar = makeDrag((e) => {
        if (!hueEl) return;
        const r = hueEl.getBoundingClientRect();
        hue = Math.round(clamp01((e.clientX - r.left) / r.width) * 360);
        emitHsv();
    });

    const alphaBar = makeDrag((e) => {
        if (!alphaEl) return;
        const r = alphaEl.getBoundingClientRect();
        alpha = Math.round(clamp01((e.clientX - r.left) / r.width) * 100);
        emitHsv();
    });

    // ── Popover ───────────────────────────────────────────────────────
    function openPopover() {
        if (!buttonEl) return;
        const { top, left } = popoverPosition(buttonEl, POPOVER_W, POPOVER_H);
        popTop = top; popLeft = left; popBottom = null; popMaxHeight = null;
        popoverOpen = true;
    }

    function togglePopover() { popoverOpen ? (popoverOpen = false) : openPopover(); }

    function pickColor(color: string) {
        if (color === "none") { onChange("none"); popoverOpen = false; return; }
        const { hex } = parseColorValue(color);
        hexVal = hex; const hsv = hexToHsv("#" + hex); hue = hsv.h; sat = hsv.s; bri = hsv.v; alpha = 100;
        onChange(color); popoverOpen = false;
    }

    // Accepts either a 6-char RGB hex (alpha implied opaque) or a full 8-char RRGGBBAA hex.
    function commitHex(raw: string) {
        if (raw.length !== 6 && raw.length !== 8) return;
        const rgb = raw.slice(0, 6);
        const newAlpha = raw.length === 8 ? hexToAlpha(raw.slice(6, 8)) : 100;
        const hsv = hexToHsv("#" + rgb);
        hexVal = rgb; alpha = newAlpha; hue = hsv.h; sat = hsv.s; bri = hsv.v;
        onChange(buildColorOutput(rgb, newAlpha));
    }
    function onHexInput(e: Event) {
        const raw = (e.target as HTMLInputElement).value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 8);
        hexBoxText = raw;
        // Commit at 6 (opaque RRGGBB) or 8 (RRGGBBAA) chars. Committing at 6 only resets
        // alpha to 100, which is a no-op on the displayed text, so it doesn't clobber
        // further alpha digits if the user keeps typing past 6.
        if (raw.length === 6 || raw.length === 8) commitHex(raw);
    }
    function onHexBlur(e: Event) {
        commitHex((e.target as HTMLInputElement).value.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 8));
    }

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

    const currentHex = $derived(hexVal ? "#" + hexVal : "#000000");

    // ── Imperative API (used by QuillEditor hidden pickers) ──────────
    export function open(anchor?: HTMLElement, preferAbove = false) {
        const ref = anchor ?? buttonEl;
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        let left = rect.left;
        if (left + POPOVER_W > window.innerWidth) left = rect.right - POPOVER_W;
        popLeft = Math.max(4, left);
        if (preferAbove) {
            // Anchor picker bottom to button top; constrain height to available space
            popBottom = window.innerHeight - rect.top + 6;
            popMaxHeight = Math.max(80, rect.top - 6 - 4);
            popTop = 0;
        } else {
            const pos = popoverPosition(ref, POPOVER_W, POPOVER_H);
            popTop = pos.top; popLeft = pos.left;
            popBottom = null; popMaxHeight = null;
        }
        popoverOpen = true;
    }
    export function setColor(hex: string) {
        const { hex: h, alpha: a } = parseColorValue(hex);
        if (!h) return;
        hexVal = h; alpha = a; const hsv = hexToHsv("#" + h); hue = hsv.h; sat = hsv.s; bri = hsv.v;
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
        style="{popBottom !== null ? `bottom:${popBottom}px` : `top:${popTop}px`};left:{popLeft}px;width:{POPOVER_W}px;{popMaxHeight !== null ? `max-height:${popMaxHeight}px;overflow-y:auto` : ''}">

        <!-- Gradient square -->
        <div bind:this={sqEl} class="scp-sq mb-2" style="--h:{hue}"
            onpointerdown={sq.down} onpointermove={sq.move} onpointerup={release}>
            <div class="scp-dot" style="left:{sat}%;top:{100 - bri}%"></div>
        </div>

        <!-- Hue bar -->
        <div bind:this={hueEl} class="scp-bar scp-hue mb-2"
            onpointerdown={hueBar.down} onpointermove={hueBar.move} onpointerup={release}>
            <div class="scp-thumb" style="left:{(hue / 360) * 100}%;background:hsl({hue},100%,50%)"></div>
        </div>

        <!-- Alpha bar -->
        <div bind:this={alphaEl} class="scp-bar scp-alpha mb-2"
            onpointerdown={alphaBar.down} onpointermove={alphaBar.move} onpointerup={release}>
            <div class="scp-alpha-fill" style="--color:{currentHex}"></div>
            <div class="scp-thumb" style="left:{alpha}%;background:{buildColorOutput(hexVal || '000000', alpha)}"></div>
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
                    class:active={("#" + hexVal).toLowerCase() === c.toLowerCase()}
                    title={c} style="background:{c}" onclick={() => pickColor(c)}></button>
            {/each}
        </div>

        <!-- Hex (RRGGBBAA, opacity as the trailing alpha byte) + eyedropper -->
        <div class="d-flex align-items-center gap-1">
            <div class="d-flex align-items-center border rounded flex-grow-1 px-2 gap-1" style="height:28px">
                <span class="text-muted" style="font-size:12px;font-family:monospace">#</span>
                <input class="flex-grow-1 border-0 p-0 font-monospace text-uppercase" style="outline:none;font-size:12px;min-width:0;background:transparent"
                    type="text" value={hexBoxText} maxlength="8" placeholder="RRGGBBAA" title="Hex color, with opacity as the last 2 digits"
                    oninput={onHexInput} onblur={onHexBlur} />
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

    .scp-popover { position: fixed; z-index: 9999; pointer-events: auto; }

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

    /* Shared bar styles (hue + alpha use the same base) */
    .scp-bar {
        position: relative; width: 100%; height: 12px; border-radius: 6px;
        cursor: ew-resize; touch-action: none; user-select: none; overflow: visible;
    }
    .scp-thumb {
        position: absolute; top: 50%; transform: translate(-50%,-50%);
        width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,.35);
        pointer-events: none;
    }

    .scp-hue {
        background: linear-gradient(to right,
            hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
            hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
            hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
            hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
            hsl(360,100%,50%));
    }
    .scp-alpha {
        overflow: hidden; /* clips fill + checkered bg to border-radius */
        background-image:
            linear-gradient(45deg, #bbb 25%, transparent 25%),
            linear-gradient(-45deg, #bbb 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #bbb 75%),
            linear-gradient(-45deg, transparent 75%, #bbb 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
    }
    .scp-alpha-fill { position: absolute; inset: 0; background: linear-gradient(to right, transparent, var(--color)); }

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
</style>
