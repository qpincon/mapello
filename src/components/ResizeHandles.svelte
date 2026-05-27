<script lang="ts">
    import { commonState, macroState, microState } from "../state.svelte";
    import { paramDefs } from "../params";

    interface Props {
        onResize: (w: number, h: number) => void;
    }

    let { onResize }: Props = $props();

    const MIN = (paramDefs.width as { min: number }).min;
    const MAX = (paramDefs.width as { max: number }).max;

    const params = $derived(
        commonState.currentMode === "macro"
            ? macroState.macroParams.General
            : microState.microParams.General
    );

    type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

    let offsetLeft = $state(0);
    let offsetTop = $state(0);
    let isResizing = $state(false);
    let dragLeft = $state(0);
    let dragTop = $state(0);

    function recomputePos() {
        const container = document.getElementById("map-container");
        const parent = document.getElementById("map-content");
        if (!container || !parent) return;
        const cr = container.getBoundingClientRect();
        const pr = parent.getBoundingClientRect();
        offsetLeft = cr.left - pr.left;
        offsetTop = cr.top - pr.top;
    }

    $effect(() => {
        params.width; params.height; commonState.currentMode;
        requestAnimationFrame(recomputePos);
    });

    $effect(() => {
        recomputePos();
        const onWindowResize = () => recomputePos();
        window.addEventListener("resize", onWindowResize);
        const parent = document.getElementById("map-content");
        let ro: ResizeObserver | null = null;
        if (parent) {
            ro = new ResizeObserver(recomputePos);
            ro.observe(parent);
        }
        return () => {
            window.removeEventListener("resize", onWindowResize);
            ro?.disconnect();
        };
    });

    let pendingRaf: number | null = null;
    let pendingW = 0;
    let pendingH = 0;
    let pendingLeft = 0;
    let pendingTop = 0;

    function scheduleStateUpdate(w: number, h: number, left: number, top: number) {
        pendingW = w;
        pendingH = h;
        pendingLeft = left;
        pendingTop = top;
        if (pendingRaf === null) {
            pendingRaf = requestAnimationFrame(() => {
                pendingRaf = null;
                params.width = pendingW;
                params.height = pendingH;
                dragLeft = pendingLeft;
                dragTop = pendingTop;
            });
        }
    }

    function clamp(v: number) {
        return Math.max(MIN, Math.min(MAX, v));
    }

    function isCorner(edge: Edge): boolean {
        return edge.length === 2;
    }

    function setMapVisibility(visible: boolean) {
        const mapContainer = document.getElementById("map-container");
        const maplibre = document.getElementById("maplibre-map");
        const v = visible ? "" : "hidden";
        if (mapContainer) mapContainer.style.visibility = v;
        if (maplibre) maplibre.style.visibility = v;
    }

    function onPointerDown(edge: Edge, e: PointerEvent) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        isResizing = true;
        setMapVisibility(false);

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = params.width;
        const startH = params.height;
        const startLeft = offsetLeft;
        const startTop = offsetTop;
        pendingW = startW;
        pendingH = startH;
        pendingLeft = startLeft;
        pendingTop = startTop;
        dragLeft = startLeft;
        dragTop = startTop;

        function onMove(ev: PointerEvent) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            let newW = startW;
            let newH = startH;

            if (edge.includes("e")) newW = startW + dx;
            if (edge.includes("w")) newW = startW - dx;
            if (edge.includes("s")) newH = startH + dy;
            if (edge.includes("n")) newH = startH - dy;

            if (isCorner(edge)) {
                const ratio = startW / startH;
                const relW = Math.abs(newW - startW) / startW;
                const relH = Math.abs(newH - startH) / startH;
                if (relW >= relH) {
                    newH = newW / ratio;
                } else {
                    newW = newH * ratio;
                }
            }

            const cw = clamp(newW);
            const ch = clamp(newH);
            // Anchor the opposite edge: west drag fixes right, east drag fixes left, etc.
            const newLeft = edge.includes("w") ? startLeft + startW - cw : startLeft;
            const newTop  = edge.includes("n") ? startTop  + startH - ch : startTop;
            scheduleStateUpdate(cw, ch, newLeft, newTop);
        }

        function onUp() {
            target.releasePointerCapture(e.pointerId);
            target.removeEventListener("pointermove", onMove);
            target.removeEventListener("pointerup", onUp);
            target.removeEventListener("pointercancel", onUp);
            if (pendingRaf !== null) {
                cancelAnimationFrame(pendingRaf);
                pendingRaf = null;
                params.width = pendingW;
                params.height = pendingH;
                dragLeft = pendingLeft;
                dragTop = pendingTop;
            }
            isResizing = false;
            setMapVisibility(true);
            onResize(params.width, params.height);
        }

        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerup", onUp);
        target.addEventListener("pointercancel", onUp);
    }

    const edges: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
</script>

<div
    class="resize-handles-wrapper"
    style="left: {isResizing ? dragLeft : offsetLeft}px; top: {isResizing ? dragTop : offsetTop}px; width: {params.width}px; height: {params.height}px;"
>
    {#if isResizing}
        <div class="resize-placeholder">
            <span class="resize-label">{Math.round(params.width)} × {Math.round(params.height)}</span>
        </div>
    {/if}
    {#each edges as edge}
        <div
            class="handle handle-{edge}"
            onpointerdown={(e) => onPointerDown(edge, e)}
            oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        ></div>
    {/each}
</div>

<style>
    .resize-handles-wrapper {
        position: absolute;
        pointer-events: none;
        z-index: 3;
    }

    .resize-placeholder {
        position: absolute;
        inset: 0;
        border: 1px dashed #4a90d9;
        background: rgba(74, 144, 217, 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .resize-label {
        font-family: monospace;
        font-size: 13px;
        color: #4a90d9;
        background: rgba(255, 255, 255, 0.85);
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid rgba(74, 144, 217, 0.3);
        user-select: none;
    }

    .handle {
        position: absolute;
        pointer-events: auto;
        touch-action: none;
    }

    /* Edge handles — thin strips along each side */
    .handle-n,
    .handle-s {
        left: 8px;
        right: 8px;
        height: 8px;
        cursor: ns-resize;
    }
    .handle-n {
        top: -4px;
    }
    .handle-s {
        bottom: -4px;
    }

    .handle-e,
    .handle-w {
        top: 8px;
        bottom: 8px;
        width: 8px;
        cursor: ew-resize;
    }
    .handle-e {
        right: -4px;
    }
    .handle-w {
        left: -4px;
    }

    /* Corner handles */
    .handle-ne,
    .handle-nw,
    .handle-se,
    .handle-sw {
        width: 14px;
        height: 14px;
    }
    .handle-ne {
        top: -7px;
        right: -7px;
        cursor: nesw-resize;
    }
    .handle-nw {
        top: -7px;
        left: -7px;
        cursor: nwse-resize;
    }
    .handle-se {
        bottom: -7px;
        right: -7px;
        cursor: nwse-resize;
    }
    .handle-sw {
        bottom: -7px;
        left: -7px;
        cursor: nesw-resize;
    }

    /* Visible indicator on hover */
    .handle::before {
        content: "";
        display: block;
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity 0.15s;
    }

    .handle:hover::before {
        opacity: 1;
    }

    /* Edge hover: thin blue line along the edge */
    .handle-n::before {
        border-top: 2px solid #4a90d9;
    }
    .handle-s::before {
        border-bottom: 2px solid #4a90d9;
    }
    .handle-e::before {
        border-right: 2px solid #4a90d9;
    }
    .handle-w::before {
        border-left: 2px solid #4a90d9;
    }

    /* Corner hover: small square dot */
    .handle-ne::before,
    .handle-nw::before,
    .handle-se::before,
    .handle-sw::before {
        background: #4a90d9;
        border-radius: 2px;
        width: 6px;
        height: 6px;
        margin: auto;
    }
    .handle-ne::before { position: absolute; top: 0; right: 0; }
    .handle-nw::before { position: absolute; top: 0; left: 0; }
    .handle-se::before { position: absolute; bottom: 0; right: 0; }
    .handle-sw::before { position: absolute; bottom: 0; left: 0; }
</style>
