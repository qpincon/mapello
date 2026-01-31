<script lang="ts">
    import type InlineStyleEditor from "inline-style-editor";
    import Accordions from "src/components/Accordions.svelte";
    import MicroLayerParams from "src/components/MicroLayerParams.svelte";
    import { drawPrettyMap, generateCssFromState, initLayersState, resizeMaplibreMap } from "src/micro/drawing";
    import { helpParams, paramDefs, type MicroParams } from "src/params";
    import { appState, microState } from "src/state.svelte";
    import type { Color, MicroLayerId, MicroPaletteWithBorder, StateMicro, SvgSelection } from "src/types";
    import * as _microPalettes from "../microPalettes";
    import { onMicroParamChange, replaceCssSheetContent, syncLayerStateWithCss, updateSvgPatterns } from "../change";
    import { saveState } from "src/util/save";
    import { addProtocol, Map, type StyleSpecification } from "maplibre-gl";
    import { cancelStitch } from "src/util/geometryStitch";
    import { select, selectAll } from "d3-selection";
    import { onDestroy, onMount } from "svelte";
    import { Protocol } from "pmtiles";

    import { createD3ProjectionFromMapLibre } from "src/util/projections";
    import { geoPath } from "d3-geo";
    import { handleInlineStyleChange } from "src/svg/svg";
    import mapStyle from "./mapstyle.json";
    import { initTooltips } from "src/util/common";
    import type { SearchResult } from "src/components/Geocoding.svelte";
    import { transitionCssMicro } from "src/svg/transition";

    let protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const microPalettes = _microPalettes as Record<string, MicroPaletteWithBorder>;
    interface Props {
        styleEditor: InlineStyleEditor | null;
        svg: SvgSelection;
        draw: (simplified?: boolean) => void;
        /** Not passed, we just need to access it from the parent*/
        maplibreMap?: Map | null;
        viewLocked: boolean;
        onMapMoveStart?: () => void;
    }

    let { styleEditor, svg, draw, maplibreMap, viewLocked = $bindable(), onMapMoveStart }: Props = $props();

    let mainMenuSelection = $state<string>("general");
    let additionalCss = $derived(computeCss(microState.microParams));

    $effect(() => {
        if (mainMenuSelection) setTimeout(() => initTooltips(), 10);
    });

    /**
     * Map used for drawing zoomed-in cities as SVG using custom palette
     * It is hidden when in "macro" mode.
     * In "micro" mode, it is either:
     *  - visible if the map is not zoomed enough
     *  - hidden if it is zoomed enough. Instead, we have the custom SVG displaying
     */
    // let maplibreMap: Map | null = $props(null);
    let mapLoadedPromise: Promise<unknown> | null = $state(null);
    let styleSheetElem: HTMLStyleElement;
    export async function drawMicroTotal() {
        if (!maplibreMap) return;
        await mapLoadedPromise;
        appState.projection = createD3ProjectionFromMapLibre(maplibreMap);
        appState.path = geoPath(appState.projection);
        return drawPrettyMap(
            maplibreMap,
            svg,
            appState.path,
            microState.microLayerDefinitions,
            microState.microParams,
            viewLocked,
        );
    }

    export function onStyleChanged(
        target: HTMLElement,
        eventType: "inline" | CSSStyleRule,
        cssProp: string,
        value: string,
    ): void {
        const elemId = target.getAttribute("id")!;
        if (eventType === "inline" && target.hasAttribute("id")) {
            handleInlineStyleChange(elemId, target, cssProp, value);
        }
        const layerDefChanged = syncLayerStateWithCss(eventType, cssProp, value, microState.microLayerDefinitions);
        if (layerDefChanged) microState.microLayerDefinitions = microState.microLayerDefinitions;
        saveState();
    }

    export function onPlaceSelected(result: SearchResult): void {
        maplibreMap!.jumpTo({
            center: [parseFloat(result.lon), parseFloat(result.lat)],
            zoom: 14,
            bearing: 0,
            pitch: 0,
        });
    }

    onMount(() => {
        const microCss = generateCssFromState(microState.microLayerDefinitions);
        styleSheetElem = document.createElement("style");
        styleSheetElem.setAttribute("id", "style-sheet-micro");
        document.head.appendChild(styleSheetElem);
        if (microCss != null) styleSheetElem.innerHTML = microCss;
        // else console.error("Problem: the generated style sheet is null");

        createMaplibreMap();
    });

    function createMaplibreMap() {
        console.log("createMaplibreMap!!!", maplibreMap);
        if (!select(".maplibregl-canvas-container").empty()) return;
        maplibreMap = new Map({
            container: "maplibre-map",
            style: mapStyle as StyleSpecification,
            center: microState.inlinePropsMicro.center,
            zoom: microState.inlinePropsMicro.zoom,
            pitch: microState.inlinePropsMicro.pitch,
            bearing: microState.inlinePropsMicro.bearing,
            attributionControl: false,
        });
        appState.projection = createD3ProjectionFromMapLibre(maplibreMap!);
        appState.path = geoPath(appState.projection);
        maplibreMap.showTileBoundaries = true;
        maplibreMap.on("moveend", async (event) => {
            const center = maplibreMap!.getCenter().toArray();
            if (center[0] !== 0 && center[1] !== 0) {
                microState.inlinePropsMicro = {
                    center,
                    zoom: maplibreMap!.getZoom(),
                    pitch: maplibreMap!.getPitch(),
                    bearing: maplibreMap!.getBearing(),
                };
            }
            await maplibreMap!.once("idle");
            draw();
        });

        maplibreMap.on("movestart", (event) => {
            onMapMoveStart?.();
            cancelStitch();
            select("#maplibre-map").style("opacity", 1);
            selectAll("#static-svg-map g, #static-svg-map rect").remove();
        });

        maplibreMap.on("click", (event) => {
            console.log(event);
            console.log(maplibreMap!.queryRenderedFeatures(event.point));
            console.log(maplibreMap!.getStyle());
        });

        maplibreMap.on("contextmenu", (e) => {
            if (!viewLocked) {
                lockUnlock(true);
                const clickedElem = document.elementFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                Object.defineProperty(e.originalEvent, "target", { writable: false, value: clickedElem });
                svg.node()!.dispatchEvent(e.originalEvent);
            }
        });
        mapLoadedPromise = new Promise((resolve) => {
            maplibreMap!.once("load", resolve);
        });
        return mapLoadedPromise;
    }

    onDestroy(() => {
        maplibreMap?.remove();
    });

    function computeCss(microParams: MicroParams): string {
        let css = "";
        if (microParams.General.animate) css += transitionCssMicro;
        if (microParams.Border.frameShadow) css += "#static-svg-map { filter: drop-shadow(2px 2px 8px rgba(0,0,0,.2));";
        return css;
    }

    function lockUnlock(isLocked: boolean) {
        viewLocked = isLocked;

        const mapLibreContainer = select("#maplibre-map");
        if (viewLocked) {
            svg.style("pointer-events", "auto");
            mapLibreContainer.style("pointer-events", "none");
        } else {
            svg.style("pointer-events", "none");
            mapLibreContainer.style("pointer-events", "auto");
        }
    }

    function handleMicroParamChange(
        layer: MicroLayerId,
        prop: string | string[],
        value: number | Color | string | boolean,
    ) {
        const shouldRedraw = onMicroParamChange(layer, prop, value, microState.microLayerDefinitions);
        if (shouldRedraw) draw();
        saveState();
    }

    function handleMicroPaletteChange(paletteId: string) {
        const palette = microPalettes[paletteId];
        if (palette.borderParams) {
            microState.microParams["Border"] = {
                ...microState.microParams["Border"],
                ...palette.borderParams,
            };
        }
        microState.microLayerDefinitions = initLayersState(palette);
        updateSvgPatterns(
            document.getElementById("static-svg-map") as unknown as SVGElement,
            microState.microLayerDefinitions,
        );
        replaceCssSheetContent(microState.microLayerDefinitions);
        // handleMicroParamChange('other', ['pattern'])
        draw();
        saveState();
    }
</script>

<svelte:head>
    {@html `<${""}style> ${additionalCss} </${""}style>`}
</svelte:head>

<div class="w-100">
    <ul class="nav nav-tabs align-items-center justify-content-center">
        <li class="nav-item d-flex align-items-center mx-1">
            <a
                href="javascript:;"
                class="nav-link d-flex align-items-center position-relative fs-5"
                onclick={() => (mainMenuSelection = "general")}
                class:active={mainMenuSelection === "general"}
            >
                General
            </a>
        </li>
        <li class="nav-item d-flex align-items-center mx-1">
            <a
                href="javascript:;"
                class="nav-link d-flex align-items-center position-relative fs-5"
                onclick={() => (mainMenuSelection = "layers")}
                class:active={mainMenuSelection === "layers"}
            >
                Layers
            </a>
        </li>
    </ul>
</div>

{#if mainMenuSelection === "general"}
    <Accordions
        bind:sections={microState.microParams as unknown as Record<string, Record<string, number>>}
        {paramDefs}
        {helpParams}
        on:change={(e) => {
            draw();
        }}
    ></Accordions>
{:else if mainMenuSelection === "layers"}
    <MicroLayerParams
        bind:layerDefinitions={microState.microLayerDefinitions}
        onUpdate={handleMicroParamChange}
        availablePalettes={microPalettes}
        onPaletteChange={handleMicroPaletteChange}
    ></MicroLayerParams>
{/if}

<style lang="scss">
</style>
