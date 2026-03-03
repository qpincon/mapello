<script lang="ts">
    import type InlineStyleEditor from "inline-style-editor";
    import Accordions from "src/components/Accordions.svelte";
    import MicroLayerParams from "src/components/MicroLayerParams.svelte";
    import { drawPrettyMap, generateCssFromState, initLayersState } from "src/micro/drawing";
    import { helpParams, paramDefs, type MicroParams } from "src/params";
    import { appState, microState } from "src/state.svelte";
    import type {
        Color,
        MicroLayerId,
        MicroPalette,
        MicroPaletteWithBorder,
        StateMicro,
        SvgSelection,
    } from "src/types";
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

    let protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const microPalettes = _microPalettes as Record<string, MicroPaletteWithBorder>;

    const LAYER_DATA_FIELDS = ["fill", "fills", "stroke", "stroke-width", "stroke-dasharray"] as const;
    const PATTERN_DATA_FIELDS = ["hatch", "color", "strokeWidth", "scale", "backgroundColor"] as const;

    function matchesPalette(current: MicroPalette, palette: Partial<MicroPaletteWithBorder>): boolean {
        const initialized = initLayersState(palette);
        for (const [layerId, curDef] of Object.entries(current)) {
            if (layerId === "borderParams") continue;
            const palDef = initialized[layerId as MicroLayerId];
            if (!palDef) return false;
            for (const field of LAYER_DATA_FIELDS) {
                if (JSON.stringify((curDef as any)[field]) !== JSON.stringify((palDef as any)[field])) return false;
            }
            const curPat = curDef.pattern;
            const palPat = palDef.pattern;
            if ((curPat == null) !== (palPat == null)) return false;
            if (curPat && palPat) {
                for (const field of PATTERN_DATA_FIELDS) {
                    if (curPat[field] !== palPat[field]) return false;
                }
            }
        }
        if (palette.borderParams) {
            const b = microState.microParams.Border;
            const pb = palette.borderParams;
            if (
                b.borderColor !== pb.borderColor ||
                b.borderWidth !== pb.borderWidth ||
                b.borderRadius !== pb.borderRadius ||
                b.borderPadding !== pb.borderPadding
            )
                return false;
        }
        return true;
    }

    const currentPaletteId = $derived(
        Object.keys(microPalettes).find((id) => matchesPalette(microState.microLayerDefinitions, microPalettes[id])) ??
            "",
    );

    interface Props {
        styleEditor: InlineStyleEditor | null;
        svg: SvgSelection;
        draw: (simplified?: boolean) => void;
        /** Not passed, we just need to access it from the parent*/
        maplibreMap?: Map | null;
        onMapMoveStart?: () => void;
    }

    let { styleEditor, svg, draw, maplibreMap, onMapMoveStart }: Props = $props();

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
        const translateAmount =
            microState.microParams.Border.borderPadding + microState.microParams.Border.borderWidth / 2;
        appState.projection = createD3ProjectionFromMapLibre(maplibreMap, translateAmount);
        appState.path = geoPath(appState.projection);
        return drawPrettyMap(maplibreMap, svg, appState.path, microState.microLayerDefinitions, microState.microParams);
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
        const translateAmount =
            microState.microParams.Border.borderPadding + microState.microParams.Border.borderWidth / 2;
        appState.projection = createD3ProjectionFromMapLibre(maplibreMap!, translateAmount);
        appState.path = geoPath(appState.projection);
        // maplibreMap.showTileBoundaries = true;
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
        mapLoadedPromise = new Promise((resolve) => {
            maplibreMap!.once("load", resolve);
        });
        return mapLoadedPromise;
    }

    onDestroy(() => {
        maplibreMap?.remove();
    });

    function computeCss(microParams: MicroParams): string {
        return "";
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
        sectionLabels={{ General: "Dimensions" }}
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
        {currentPaletteId}
    ></MicroLayerParams>
{/if}

<style lang="scss">
</style>
