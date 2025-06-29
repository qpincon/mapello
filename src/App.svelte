<script lang="ts">
    import { mount, onMount, tick } from "svelte";
    import type { GlobalState } from "./types";
    import { select, pointer } from "d3-selection";
    import { drag } from "d3-drag";
    import { zoom } from "d3-zoom";
    import InlineStyleEditor from "inline-style-editor";
    import { debounce, merge } from "lodash-es";
    import { drawCustomPaths, parseAndUnprojectPath } from "./svg/paths";
    import PathEditor from "./svg/pathEditor";
    import Geocoding from "./components/Geocoding.svelte";
    import { download, initTooltips, pascalCaseToSentence } from "./util/common";
    import * as shapes from "./svg/shapeDefs";
    import * as markers from "./svg/markerDefs";
    import { setTransformScale, closestDistance, type DistanceQueryResult } from "./svg/svg";
    import { drawShapes } from "./svg/shape";
    import iso3Data from "./assets/data/iso3_filtered.json";
    import Examples from "./components/Examples.svelte";
    import { freeHandDrawPath } from "./svg/freeHandPath";
    import Modal from "./components/Modal.svelte";
    import Navbar from "./components/Navbar.svelte";
    import macroImg from "./assets/img/macro.png";
    import microImg from "./assets/img/micro.png";
    import Instructions from "./components/Instructions.svelte";
    import Icon from "./components/Icon.svelte";
    import { exportStyleSheet, getUsedInlineFonts, fontsToCss } from "./util/dom";
    import { getState, saveState } from "./util/save";
    import { exportFontChoices } from "./svg/export";
    import { initLayersState } from "./detailed";
    import { Map } from "maplibre-gl";
    import MicroLayerParams from "./components/MicroLayerParams.svelte";
    import * as _microPalettes from "./microPalettes";
    import { FreehandDrawer } from "./svg/freeHandDraw";
    import { cancelStitch } from "./util/geometryStitch";
    import type {
        SvgSelection,
        InlineStyles,
        ZonesData,
        TooltipDefs,
        LegendDef,
        PathDef,
        ShapeDefinition,
        MicroPalette,
        MicroPaletteWithBorder,
        ContourParams,
        ProvidedFont,
        CssDict,
        Color,
        InlinePropsMicro,
        ParsedPath,
        ContextMenuInfo,
        MenuState,
        PathDefImage,
        MarkerName,
        ShapeName,
        ColorDef,
        Mode,
    } from "./types";
    import { Dropdown } from "bootstrap";
    import { applyInlineStyles, changeProjection, drawMacroTotal } from "./macro/drawing";
    import MacroSidebar from "./macro/components/MacroSidebar.svelte";
    import { appState, commonState, macroState, microState } from "./state.svelte";
    import { icons } from "./shared/icons";
    import { defaultState } from "./stateDefaults";

    const microPalettes = _microPalettes as Record<string, MicroPaletteWithBorder>;

    let openContextMenuInfo: ContextMenuInfo;

    let macroSidebar: MacroSidebar | null = $state(null);
    let svg: SvgSelection = $state(select("#map-container") as unknown as SvgSelection);

    // ====== State micro ====
    let microLayerDefinitions: MicroPalette = initLayersState(microPalettes["peach"]);

    // ====== State macro =======
    let providedPaths: PathDef[];
    // let providedShapes: ShapeDefinition[];
    // let chosenCountriesAdm: string[];
    // let inlinePropsMacro: InlinePropsMacro;
    let inlinePropsMicro: InlinePropsMicro;

    let providedFonts: ProvidedFont[] = [];
    // TODO: remove and compute from shape + label size
    let shapeCount = 0;

    let cssFonts = $derived(fontsToCss(commonState.providedFonts));

    // ==== End state =====

    let commonCss: string | undefined = $state(undefined);
    const menuStates: MenuState = {
        chosingPoint: false,
        pointSelected: false,
        addingLabel: false,
        pathSelected: false,
        addingImageToPath: false,
        chosingMarker: false,
    };
    let editedLabelId: string | null = $state(null);
    let textInput: HTMLInputElement | null = $state(null);
    let typedText = $state("");
    let styleEditor: InlineStyleEditor | null = $state(null);
    let contextualMenu: (HTMLDivElement & { opened?: boolean }) | null = $state(null);
    let showExportConfirm = $state(false);
    let showInstructions = $state(false);
    let exportForm: HTMLFormElement | null = $state(null);

    // TODO: move in menuStates
    let editingPath = $state(false);
    let isDrawingFreeHand = $state(false);
    let isDrawingPath = $state(false);
    let iseOnClickEnabled = $derived(!editingPath && !isDrawingFreeHand && !isDrawingPath);

    let zoomFunc: d3.ZoomBehavior<any, any> | null = $state(null);
    let dragFunc: d3.DragBehavior<any, any, any> | null = $state(null);
    /**
     * Map used for drawing zoomed-in cities as SVG using custom palette
     * It is hidden when in "macro" mode.
     * In "micro" mode, it is either:
     *  - visible if the map is not zoomed enough
     *  - hidden if it is zoomed enough. Instead, we have the custom SVG displaying
     */
    let maplibreMap: Map | null = $state(null);
    let mapLoadedPromise: Promise<unknown> | null = $state(null);
    let microLocked = $state(false);
    onMount(async () => {
        console.log("App onmount");
        /** Init bootstrap dropdowns */
        Array.from(document.querySelectorAll(".dropdown-toggle")).forEach((dropdownToggleEl) => {
            new Dropdown(dropdownToggleEl);
        });

        // @ts-expect-error
        styleEditor = mount(InlineStyleEditor, {
            target: document.body,
            props: {
                onStyleChanged: (
                    target: HTMLElement,
                    eventType: "inline" | CSSStyleRule,
                    cssProp: string,
                    value: string,
                ) => {
                    if (commonState.currentMode === "macro") {
                        macroSidebar!.onStyleChanged(target, eventType, cssProp, value);
                    }
                },
                getElems: (el: HTMLElement) => {
                    if (el.classList.contains("freehand")) {
                        return [[el.parentElement, "Clicked"]];
                    }
                    if (el.classList.contains("adm")) {
                        const parent = el.parentNode as HTMLElement;
                        const parentCountry = parent?.getAttribute("id")?.replace(/ ADM(1|2)/, "") || "";
                        const parentCountryIso3 = iso3Data.find((row) => row.name === parentCountry)?.["name"];
                        if (!parentCountryIso3) return [[el, "Clicked"]];
                        const countryElem = document.getElementById(parentCountryIso3);
                        if (!countryElem) return [[el, "Clicked"]];
                        return [
                            [el, "Clicked"],
                            [countryElem, parentCountryIso3],
                        ];
                    }
                    if (el.tagName === "tspan") {
                        return [
                            [el.parentNode, "text"],
                            [el, "text part"],
                        ];
                    }
                    return [[el, "Clicked"]];
                },
                customProps: {
                    scale: {
                        type: "slider",
                        min: 0.5,
                        max: 5,
                        step: 0.1,
                        getter: (el: HTMLElement) => {
                            if (el.closest("#points-labels") == null) return null;
                            const transform = el.getAttribute("transform");
                            if (!transform) return 1;
                            else {
                                const scaleValue = transform.match(/scale\(([0-9\.]+)\)/);
                                if (scaleValue && scaleValue.length > 1) return parseFloat(scaleValue[1]);
                            }
                            return 1;
                        },
                        setter: (el: SVGElement, val: number) => {
                            const scaleStr = `scale(${val})`;
                            setTransformScale(el, scaleStr);
                        },
                    },
                },
                cssRuleFilter: (el: HTMLElement, cssSelector: string) => {
                    console.log(cssSelector);
                    if (cssSelector.includes("#static-svg-map")) return false;
                    // if (cssSelector.includes(".hovered")) return false;
                    if (cssSelector.includes("ssc-")) return false;
                    if (cssSelector.includes("#micro path")) return false;
                    if (cssSelector.includes("#micro .poly")) return false;
                    if (cssSelector.includes("#micro .line")) return false;
                    return true;
                },
                inlineDeletable: () => false,
                getCssRuleName: (ruleName: string, el: HTMLElement) => {
                    let isHover = ruleName.includes(":hover") || ruleName.includes(".hovered");
                    let finalStr = "";
                    if (ruleName.includes("#micro .building-1")) finalStr = "Building type 1";
                    else if (ruleName.includes("#micro .building-2")) finalStr = "Building type 2";
                    else if (ruleName.includes("#micro .building-3")) finalStr = "Building type 3";
                    else if (ruleName.includes("#micro")) {
                        const layerId = ruleName.match(/#micro \.(.*?)(\:|$)/)![1];
                        finalStr = pascalCaseToSentence(layerId);
                    } else if (ruleName.includes("#micro .building")) finalStr = "Buildings";
                    else if (ruleName.includes(".adm")) finalStr = "Region";
                    if (finalStr.length) {
                        if (isHover) return `${finalStr} hover`;
                        return finalStr;
                    }
                    if (ruleName === "inline") return "Selected element";
                    return ruleName;
                },
            },
        });
        document.body.append(contextualMenu!);
        contextualMenu!.style.display = "none";
        contextualMenu!.style.position = "absolute";
        contextualMenu!.opened = false;
        restoreStateFromSave();
        attachListeners();
        // maplibreMap.showTileBoundaries = true;
        window.addEventListener("keydown", (e) => {
            if (e.code === "Escape") {
                stopDrawFreeHand();
            }
        });
    });

    function restoreStateToDefault() {
        applyState(defaultState);
    }

    function attachListeners(): void {
        const container = select("#map-container");
        dragFunc = drag()
            .filter((e) => commonState.currentMode === "macro" && !e.button) // Remove ctrlKey
            .on("drag", (e) => {
                if (commonState.currentMode === "macro") macroSidebar!.onDrag(e);
            })
            .on("start", () => {
                if (menuStates.addingLabel) validateLabel();
                styleEditor!.close();
                closeMenu();
            });

        zoomFunc = zoom()
            .filter((e) => commonState.currentMode === "macro")
            .wheelDelta((event) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002))
            .on("zoom", (e) => {
                if (commonState.currentMode === "macro") macroSidebar!.onZoom(e);
            })
            .on("start", () => {
                closeMenu();
            });
        container.call(dragFunc);
        container.call(zoomFunc);
    }

    function lockUnlock(isLocked: boolean) {
        microLocked = isLocked;

        const mapLibreContainer = select("#maplibre-map");
        if (microLocked) {
            svg.style("pointer-events", "auto");
            mapLibreContainer.style("pointer-events", "none");
        } else {
            svg.style("pointer-events", "none");
            mapLibreContainer.style("pointer-events", "auto");
        }
    }

    function createMaplibreMap() {
        maplibreMap = new Map({
            container: "maplibre-map",
            style: "https://api.maptiler.com/maps/basic-v2/style.json?key=FDR0xJ9eyXD87yIqUjOi",
            center: inlinePropsMicro.center,
            zoom: inlinePropsMicro.zoom,
            pitch: inlinePropsMicro.pitch,
            bearing: inlinePropsMicro.bearing,
            attributionControl: false,
        });

        maplibreMap.on("moveend", (event) => {
            if (commonState.currentMode !== "micro") return;
            const center = maplibreMap!.getCenter().toArray();
            if (center[0] !== 0 && center[1] !== 0) {
                inlinePropsMicro = {
                    center,
                    zoom: maplibreMap!.getZoom(),
                    pitch: maplibreMap!.getPitch(),
                    bearing: maplibreMap!.getBearing(),
                };
            }
            // drawDebounced();
            draw();
        });

        maplibreMap.on("movestart", (event) => {
            // console.log('movestart');
            if (commonState.currentMode !== "micro") return;
            cancelStitch();
            select("#maplibre-map").style("opacity", 1);
        });

        maplibreMap.on("click", (event) => {
            console.log(event);
            console.log(maplibreMap!.queryRenderedFeatures(event.point));
            console.log(maplibreMap!.getStyle());
        });
        maplibreMap.on("contextmenu", (e) => {
            if (!microLocked) {
                lockUnlock(true);
                const clickedElem = document.elementFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                Object.defineProperty(e.originalEvent, "target", {
                    writable: false,
                    value: clickedElem,
                });
                (svg.node() as SVGSVGElement).dispatchEvent(e.originalEvent);
            }
        });
        mapLoadedPromise = maplibreMap.once("load") as Promise<unknown>;
    }

    // function handleMicroParamChange(
    //     layer: MicroLayerId,
    //     prop: string | string[],
    //     value: number | Color | string | boolean,
    // ): void {
    //     const shouldRedraw = onMicroParamChange(layer, prop, value, microLayerDefinitions);
    //     if (shouldRedraw) draw();
    //     save();
    // }

    // function handleMicroPaletteChange(paletteId: string): void {
    //     const palette = microPalettes[paletteId];
    //     if (palette.borderParams) {
    //         microParams["Border"] = {
    //             ...microParams["Border"],
    //             ...palette.borderParams,
    //         };
    //     }
    //     microLayerDefinitions = initLayersState(palette);
    //     updateSvgPatterns(document.getElementById("static-svg-map") as unknown as SVGSVGElement, microLayerDefinitions);
    //     replaceCssSheetContent(microLayerDefinitions);
    //     // handleMicroParamChange('other', ['pattern'])
    //     draw();
    //     save();
    // }

    async function switchMode(newMode: Mode): Promise<void> {
        if (commonState.currentMode === newMode) return;
        commonState.currentMode = newMode;
        await tick();
        const mapLibreContainer = select("#maplibre-map");
        if (commonState.currentMode === "micro") {
            mapLibreContainer.style("display", "block");
            draw();
        } else {
            macroSidebar!.applyStateAndDraw();
        }
        setTimeout(() => initTooltips(), 0);
    }

    function detachListeners(): void {
        const container = select("#map-container");
        container.on(".drag", null);
        container.on(".zoom", null);
    }

    const freeHandDrawer = new FreehandDrawer();
    // without 'countries' if unchecked
    async function draw(simplified = false) {
        console.log("draw", simplified);
        const container = select("#map-container");
        container.html("");
        svg = container.select("svg") as unknown as SvgSelection;
        if (svg.empty())
            svg = container
                .append("svg")
                .attr("xmlns", "http://www.w3.org/2000/svg")
                .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
                .attr("id", "static-svg-map") as unknown as SvgSelection;

        svg.append("defs");
        svg.on(
            "contextmenu",
            function (e) {
                if (editingPath) return;
                stopDrawFreeHand();
                e.preventDefault();
                closeMenu();
                let target = null;
                const [x, y] = pointer(e);
                const point = { x, y };
                const pathsElement = document.getElementById("paths");
                if (!pathsElement) return;
                const paths = Array.from(pathsElement.children) as SVGPathElement[];
                const closestPoint = paths.reduce((prev: DistanceQueryResult, curElem) => {
                    const curDist = closestDistance(point, curElem);
                    curDist.elem = curElem;
                    return prev.distance! < curDist.distance! ? prev : curDist;
                }, {} as DistanceQueryResult);
                if (closestPoint.distance && closestPoint.distance < 6) {
                    menuStates.pathSelected = true;
                    target = closestPoint.elem;
                    selectedPathIndex = parseInt(closestPoint.elem!.getAttribute("id")!.match(/\d+$/)![0]);
                }
                showMenu(e, target);
                return false;
            },
            false,
        );

        svg.on("click", function (e) {
            if (contextualMenu!.opened) closeMenu();
            else if (styleEditor!.isOpened()) styleEditor!.close();
            else if (iseOnClickEnabled) openEditor(e);
        });

        if (commonState.currentMode === "macro") {
            await drawMacroTotal(svg, simplified);
        }
        svg.append("g").attr("id", "points-labels");
        svg.append("g").attr("id", "paths");
        drawAndSetupShapes();
        drawCustomPaths(commonState.providedPaths, svg, appState.projection!, commonState.inlineStyles);
        if (!simplified) saveState();
    }

    // function projectAndDraw(simplified = false): void {
    //     changeProjection();
    //     draw(simplified);
    // }

    let totalCommonCss: string;
    // function computeCss(): void {
    //     if (commonState.currentMode === "micro") {
    //         let css = `
    //     #paths > path {
    //         stroke: #7c490ea0;
    //         stroke-dasharray: 5px;
    //         stroke-width: 2;
    //         fill: none;
    //     }
    //     #static-svg-map {
    //         ${p("frameShadow") ? "filter: drop-shadow(2px 2px 8px rgba(0,0,0,.2));" : ""}
    //     }`;
    //         if (p("animate")) css += transitionCssMicro;
    //         commonCss = css;
    //         totalCommonCss = exportStyleSheet("#micro .poly") + commonCss;
    //         return;
    //     }
    //     const width = p("width");
    //     const height = p("height");
    //     const borderRadius = p("borderRadius");
    //     const finalColorsCss = Object.values(colorsCssByTab).reduce((acc, cur) => {
    //         acc += cur;
    //         return acc;
    //     }, "");
    //     const wantedRadiusInPx = Math.max(width, height) * (borderRadius / 100);
    //     const radiusX = Math.round(Math.min((wantedRadiusInPx * 100) / width, 50));
    //     const radiusY = Math.round(Math.min((wantedRadiusInPx * 100) / height, 50));
    //     let borderCss = `
    // #static-svg-map {
    //     ${p("frameShadow") ? "filter: drop-shadow(2px 2px 8px rgba(0,0,0,.2));" : ""}
    // }`;

    //     if (commonState.currentMode === "macro") {
    //         borderCss += `#static-svg-map, #static-svg-map > svg {
    //         border-radius: ${radiusX}%/${radiusY}%;
    //     }`;
    //     }
    //     commonCss = finalColorsCss + borderCss;
    //     if (p("animate")) commonCss += transitionCssMacro;
    //     totalCommonCss = exportStyleSheet("#outline") + commonCss;
    // }

    // function save(): void {
    //     baseCss = exportStyleSheet("#outline")!;
    //     saveState(toGlobalState());
    // }

    function saveProject(): void {
        const baseCss = exportStyleSheet("#outline")!;
        // TODO: is is this useful?
        commonState.baseCss = baseCss;
        const state: GlobalState = {
            stateCommon: commonState,
            stateMacro: macroState,
            stateMicro: microState,
        };
        download(JSON.stringify(state), "text/json", "project.cartosvg");
    }

    function applyState(state: GlobalState): void {
        Object.assign(commonState, state.stateCommon);
        Object.assign(macroState, state.stateMacro);
        Object.assign(microState, state.stateMicro);
        // merge(commonState, state.stateCommon);
        // merge(macroState, state.stateMacro);
        // merge(microState, state.stateMicro);
        changeProjection();
        draw();
        saveState();
    }

    function restoreStateFromSave() {
        const savedState = getState();
        console.log("savedState=", savedState);
        applyState(savedState ?? defaultState);
    }

    function loadProject(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            try {
                const providedState: GlobalState = JSON.parse(reader.result as string);
                applyState(providedState);
                if (commonState.currentMode === "macro") {
                    macroSidebar!.applyStateAndDraw();
                }
            } catch (e) {
                console.error("Unable to parse provided file. Should be valid JSON.");
            }
        });
        reader.readAsText(file);
    }

    function loadExample(e: CustomEvent): void {
        if (
            !window.confirm(
                "Caution: Loading the example will discard your current project. Please save it first if you want to keep it.",
            )
        )
            return;

        applyState(e.detail.projectParams);
        if (commonState.currentMode === "macro") {
            macroSidebar!.applyStateAndDraw();
        }
    }

    // function applyInlineStyles(styleAll = false): void {
    //     applyStyles(inlineStyles, styleAll ? countryFilteredImages : null);
    //     save();
    // }

    function openEditor(e: MouseEvent): void {
        styleEditor!.open(e.target as HTMLElement, e.pageX, e.pageY);
    }
    let selectedPathIndex = $state<number>(0);

    function editPath(): void {
        closeMenu();
        const pathElem = openContextMenuInfo.target;
        detachListeners();
        editingPath = true;

        new PathEditor(pathElem, svg.node() as SVGSVGElement, (editedPathElem) => {
            // element was deleted
            if (!editedPathElem) {
                commonState.providedPaths.splice(selectedPathIndex, 1);
            } else {
                const parsed = parseAndUnprojectPath(editedPathElem, appState.projection!);
                commonState.providedPaths[selectedPathIndex].d = parsed;
            }
            attachListeners();
            editingPath = false;
            saveState();
        });
    }

    function deletePath(): void {
        closeMenu();
        commonState.providedPaths.splice(selectedPathIndex, 1);
        drawShapesAndSave();
    }

    function addImageToPath(e: Event): void {
        menuStates.pathSelected = false;
        menuStates.addingImageToPath = true;
    }

    function choseMarker(e: Event): void {
        menuStates.pathSelected = false;
        menuStates.chosingMarker = true;
    }

    function importImagePath(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const fileName = file.name;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            const newImage: PathDefImage = { name: fileName, content: reader.result as string };
            commonState.providedPaths[selectedPathIndex].image = newImage;
            if (!commonState.providedPaths[selectedPathIndex].duration) {
                commonState.providedPaths[selectedPathIndex].duration = 10;
                commonState.providedPaths[selectedPathIndex].width = 20;
                commonState.providedPaths[selectedPathIndex].height = 10;
            }
            drawCustomPaths(commonState.providedPaths, svg, appState.projection!, commonState.inlineStyles);
            applyInlineStyles();
            saveState();
        });
        reader.readAsDataURL(file);
    }

    const saveDebounced = debounce(saveState, 200);
    function changeDurationAnimation(e: Event): void {
        commonState.providedPaths[selectedPathIndex].duration = parseInt((e!.target! as HTMLInputElement).value);
        drawShapesAndSave();
    }

    function changePathImageWidth(e: Event): void {
        commonState.providedPaths[selectedPathIndex].width = parseInt((e!.target! as HTMLInputElement).value);
        drawShapesAndSave();
    }

    function changePathImageHeight(e: Event): void {
        commonState.providedPaths[selectedPathIndex].height = parseInt((e!.target! as HTMLInputElement).value);
        drawShapesAndSave();
    }

    function changeMarker(markerName: MarkerName | "delete"): void {
        closeMenu();
        menuStates.chosingMarker = false;
        if (markerName === "delete") delete commonState.providedPaths[selectedPathIndex].marker;
        else commonState.providedPaths[selectedPathIndex].marker = markerName;
        drawShapesAndSave();
    }

    function deleteImage(): void {
        delete commonState.providedPaths[selectedPathIndex].image;
        commonState.providedPaths[selectedPathIndex] = commonState.providedPaths[selectedPathIndex];
        drawShapesAndSave();
    }

    function drawShapesAndSave(): void {
        drawCustomPaths(commonState.providedPaths, svg, appState.projection!, commonState.inlineStyles);
        applyInlineStyles();
        saveState();
    }

    // function getFirstDataRow(zonesDataDef: ZoneData): ZoneDataRow | null {
    //     if (!zonesData) return null;
    //     const row = { ...zonesDataDef.data[0] };
    //     zonesDataDef.numericCols.forEach((colDef) => {
    //         const col = colDef.column;
    //         row[col] = zonesDataDef.formatters![col](row[col] as number);
    //     });
    //     return row;
    // }

    function handleInputFont(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const fileName = file.name.split(".")[0];
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            const newFont: ProvidedFont = { name: fileName, content: reader.result as string };
            providedFonts.push(newFont);
            providedFonts = providedFonts;
            saveState();
        });
        reader.readAsDataURL(file);
    }

    function addPath(): void {
        closeMenu();
        detachListeners();
        isDrawingPath = true;
        freeHandDrawPath(svg.node() as SVGSVGElement, (finishedElem) => {
            console.log("finishedElem", finishedElem);
            const d = finishedElem.getAttribute("d");
            if (!d) return;
            attachListeners();
            const pathIndex = commonState.providedPaths.length;
            const id = `path-${pathIndex}`;
            finishedElem.setAttribute("id", id);
            commonState.providedPaths.push({ d: parseAndUnprojectPath(d, appState.projection!) });
            saveDebounced();
            setTimeout(() => {
                isDrawingPath = false;
            }, 0);
        });
    }

    function drawFreeHand(): void {
        isDrawingFreeHand = true;
        closeMenu();
        detachListeners();
        freeHandDrawer.start(svg.node() as SVGSVGElement);
    }

    let freeHandDrawings: ParsedPath[][] = [];
    function stopDrawFreeHand(): void {
        if (!isDrawingFreeHand) return;
        attachListeners();
        isDrawingFreeHand = false;
        const newGroup = freeHandDrawer.stop();
        const paths = newGroup.querySelectorAll("path");
        if (!paths.length) return;

        // Get first point and store drawing as-is
        // let position = null;
        // for (const pathElem of paths) {
        //     const d = pathElem.getAttribute('d');
        //     if (!d) continue;
        //     position = parseAndUnprojectPath(d, projection)[0];
        //     break;
        // }

        const unprojected: ParsedPath[] = [];
        paths.forEach((pathElem) => {
            const d = pathElem.getAttribute("d");
            if (!d) return;
            const parsed = parseAndUnprojectPath(d, appState.projection!);
            unprojected.push(parsed);
            console.log(parsed);
        });
        if (unprojected.length) freeHandDrawings.push(unprojected);
    }

    // function handleChangeProp(event: CustomEvent<{ prop: string; value: unknown }>): void {
    //     if (firstDraw) return;
    //     const { prop, value } = event.detail;
    //     if (positionVars.includes(prop)) {
    //         // @ts-expect-error
    //         inlinePropsMacro[prop] = value;
    //     }
    //     if (prop === "projection" || prop === "fieldOfView") {
    //         changeAltitudeScale();
    //     }
    //     if (prop === "projection") {
    //         inlinePropsMacro.translateX = 0;
    //         inlinePropsMacro.translateY = 0;
    //     }
    //     if (prop === "height") {
    //         Object.keys(legendDefs).forEach((tab) => {
    //             legendDefs[tab].y = (value as number) - 100;
    //         });
    //     }
    //     redrawThrottle(prop);
    // }

    function closeMenu(): void {
        contextualMenu!.style.display = "none";
        contextualMenu!.opened = false;
        menuStates.chosingPoint = false;
        menuStates.pointSelected = false;
        menuStates.addingLabel = false;
        menuStates.pathSelected = false;
        menuStates.addingImageToPath = false;
        editedLabelId = null;
    }

    function editStyles(): void {
        closeMenu();
        styleEditor!.open(openContextMenuInfo.target, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
    }
    function addPoint(): void {
        menuStates.chosingPoint = true;
    }

    async function addLabel(): Promise<void> {
        menuStates.addingLabel = true;
        await tick();
        textInput!.focus();
        textInput!.addEventListener("keydown", ({ key }) => {
            if (key === "Enter") {
                validateLabel();
            }
        });
    }

    function validateLabel(): void {
        if (typedText.length) {
            if (editedLabelId) {
                const labelDef = commonState.providedShapes.find((def) => def.id === editedLabelId)!;
                labelDef.text = typedText;
            } else {
                const labelId = `label-${shapeCount++}`;
                commonState.providedShapes.push({
                    pos: openContextMenuInfo.position,
                    scale: 1,
                    id: labelId,
                    text: typedText,
                });
                commonState.inlineStyles[labelId] = { ...commonState.lastUsedLabelProps };
            }
            typedText = "";
        }
        drawAndSetupShapes();
        closeMenu();
    }

    function drawAndSetupShapes(): void {
        const container = document.getElementById("points-labels");
        if (!container) return;
        drawShapes(commonState.providedShapes, container, appState.projection!, saveState);
        select(container).on("dblclick", (e) => {
            const target = e.target;
            let targetId = target.getAttribute("id");
            if (target.tagName == "tspan") targetId = target.parentNode.getAttribute("id");
            if (targetId.includes("label")) {
                editedLabelId = targetId;
                const labelDef = commonState.providedShapes.find((def) => def.id === editedLabelId)!;
                typedText = labelDef.text!;
                addLabel();
                showMenu(e);
            }
            e.preventDefault();
            e.stopPropagation();
        });
        select(container).on(
            "contextmenu",
            function (e) {
                e.stopPropagation();
                e.preventDefault();
                menuStates.pointSelected = true;
                showMenu(e);
                return false;
            },
            false,
        );
        applyInlineStyles();
    }

    function showMenu(e: MouseEvent, target: EventTarget | null = null): void {
        openContextMenuInfo = {
            event: e,
            position: appState.projection!.invert!(pointer(e))!,
            target: (target ? target : e.target) as SVGPathElement,
        };
        contextualMenu!.opened = true;
        contextualMenu!.style.display = "block";
        contextualMenu!.style.left = e.pageX + "px";
        contextualMenu!.style.top = e.pageY + "px";
    }

    async function addShape(shapeName: ShapeName): Promise<void> {
        const shapeId = `${shapeName}-${shapeCount++}`;
        commonState.providedShapes.push({
            name: shapeName,
            pos: openContextMenuInfo.position,
            scale: 1,
            id: shapeId,
        });
        drawAndSetupShapes();
        closeMenu();
        await tick();
        setTimeout(() => {
            const lastShape = document.getElementById(
                commonState.providedShapes[commonState.providedShapes.length - 1].id,
            )!;
            styleEditor!.open(lastShape, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
        }, 0);
    }

    function copySelection(): void {
        let objectId = openContextMenuInfo.target.getAttribute("id");
        if (openContextMenuInfo.target.tagName === "tspan") {
            objectId = (openContextMenuInfo.target.parentNode as HTMLElement).getAttribute("id");
        }
        const newDef: ShapeDefinition = { ...commonState.providedShapes.find((def) => def.id === objectId)! };
        const projected = appState.projection!(newDef.pos)!;
        newDef.pos = appState.projection!.invert!([projected[0] - 10, projected[1]])!;
        const newShapeId = `${newDef.name ? newDef.name : "label"}-${shapeCount++}`;
        commonState.inlineStyles[newShapeId] = { ...commonState.inlineStyles[newDef.id] };
        newDef.id = newShapeId;
        commonState.providedShapes.push(newDef);
        drawAndSetupShapes();
        closeMenu();
    }

    function deleteSelection(): void {
        let pointId = openContextMenuInfo.target.getAttribute("id")!;
        delete commonState.inlineStyles[pointId];
        if (openContextMenuInfo.target.tagName === "tspan") {
            pointId = (openContextMenuInfo.target.parentNode as HTMLElement).getAttribute("id")!;
            delete commonState.inlineStyles[pointId];
        }
        commonState.providedShapes = commonState.providedShapes.filter((def) => def.id !== pointId);
        drawAndSetupShapes();
        closeMenu();
    }

    function validateExport(): void {
        const formData = Object.fromEntries(new FormData(exportForm!).entries());
        console.log("formData", formData);
        // if (commonState.currentMode === "macro") {
        //     exportSvg(
        //         svg,
        //         p("width"),
        //         p("height"),
        //         tooltipDefs,
        //         chosenCountriesAdm,
        //         zonesData,
        //         providedFonts,
        //         true,
        //         totalCommonCss,
        //         p("animate"),
        //         formData,
        //     );
        //     fetch("/exportSvgMacro");
        // } else {
        //     const attributionColor = microLayerDefinitions["road-network"]["stroke"] ?? "#aaa";
        //     console.log("attributionColor=", attributionColor);
        //     exportMicro(svg, microParams, providedFonts, totalCommonCss, p("animate"), attributionColor, formData);
        //     fetch("/exportSvgMicro");
        // }
        // showExportConfirm = false;
    }

    let inlineFontUsed = false;
    function onExportSvgClicked() {
        const usedFonts = getUsedInlineFonts(svg.node()!);
        const usedProvidedFonts = providedFonts.filter((font) => usedFonts.has(font.name));
        inlineFontUsed = usedProvidedFonts.length > 0;
        if (commonState.currentMode === "micro" && !inlineFontUsed) {
            validateExport();
            return;
        }
        showExportConfirm = true;
    }

    // TODO: check menu opened to avoid it being display on page land
</script>

<svelte:head>
    {@html `<${""}style> ${commonCss} </${""}style>`}
    {@html `<${""}style> ${cssFonts} </${""}style>`}
</svelte:head>

<div id="contextmenu" class="border rounded" bind:this={contextualMenu} class:hidden={!contextualMenu?.opened}>
    {#if menuStates.chosingPoint}
        {#each Object.keys(shapes) as shapeName (shapeName)}
            <div role="button" class="px-2 py-1" onclick={() => addShape(shapeName as ShapeName)}>
                {shapeName}
            </div>
        {/each}
    {:else if menuStates.addingLabel}
        <input type="text" bind:this={textInput} bind:value={typedText} />
    {:else if menuStates.pointSelected}
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit styles</div>
        <div role="button" class="px-2 py-1" onclick={copySelection}>Copy</div>
        <div role="button" class="px-2 py-1" onclick={deleteSelection}>Delete</div>
    {:else if menuStates.pathSelected}
        <div role="button" class="px-2 py-1" onclick={editPath}>Edit path</div>
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit style</div>
        <div role="button" class="px-2 py-1" onclick={deletePath}>Delete path</div>
        <div role="button" class="px-2 py-1" onclick={addImageToPath}>Image along path</div>
        <div role="button" class="px-2 py-1" onclick={choseMarker}>Chose marker</div>
    {:else if menuStates.chosingMarker}
        <div class="d-flex">
            <div role="button" class="px-2 py-1" onclick={() => changeMarker("delete")}>
                <Icon fillColor="red" svg={icons["trash"]} />
            </div>
            {#each Object.entries(markers) as [markerName, markerDef] (markerName)}
                <div role="button" class="px-2 py-1" onclick={() => changeMarker(markerName as MarkerName)}>
                    <svg width="30" height="30" viewBox={`0 0 ${markerDef.width} ${markerDef.height}`}>
                        <path d={markerDef.d} />
                    </svg>
                </div>
            {/each}
        </div>
    {:else if menuStates.addingImageToPath}
        <div class="d-flex align-items-center">
            <div class="m-1">
                <label for="image-select" class="m-2 d-flex align-items-center btn btn-sm btn-light">
                    File: {commonState.providedPaths[selectedPathIndex].image?.name || "Import image"}
                </label>
                <input type="file" id="image-select" accept=".png,.jpg,.svg" onchange={importImagePath} />
            </div>
            <div role="button" class="" onclick={deleteImage}>
                <Icon fillColor="red" svg={icons["trash"]} />
            </div>
        </div>
        <div class="row m-1">
            <label for="duration-select" class="col-6 col-form-label col-form-label-sm"> Duration </label>
            <div class="col-6">
                <input
                    id="duration-select"
                    class="form-control form-control-sm"
                    type="number"
                    value={commonState.providedPaths[selectedPathIndex].duration}
                    onchange={changeDurationAnimation}
                />
            </div>
        </div>
        <div class="row m-1">
            <label for="path-img-width" class="col-6 col-form-label col-form-label-sm"> Image width </label>
            <div class="col-6">
                <input
                    id="path-img-width"
                    class="form-control form-control-sm"
                    type="number"
                    value={commonState.providedPaths[selectedPathIndex].width}
                    onchange={changePathImageWidth}
                />
            </div>
        </div>
        <div class="row m-1">
            <label for="path-img-height" class="col-6 col-form-label col-form-label-sm"> Image height </label>
            <div class="col-6">
                <input
                    id="path-img-height"
                    class="form-control form-control-sm"
                    type="number"
                    value={commonState.providedPaths[selectedPathIndex].height}
                    onchange={changePathImageHeight}
                />
            </div>
        </div>
    {:else}
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit styles</div>
        <div role="button" class="px-2 py-1" onclick={addPath}>Draw path</div>
        <div role="button" class="px-2 py-1" onclick={drawFreeHand}>Draw freehand</div>
        <div role="button" class="px-2 py-1" onclick={addPoint}>Add point</div>
        <div role="button" class="px-2 py-1" onclick={addLabel}>Add label</div>
    {/if}
</div>

<div class="d-flex align-items-start h-100">
    <aside id="params" class="h-100">
        <div id="main-panel" class="d-flex flex-column align-items-center pt-4 h-100">
            <div class="mode-selection btn-group" role="group">
                <input
                    type="radio"
                    class="btn-check"
                    name="mainModeSwitch"
                    id="switchMacro"
                    onchange={(e) => switchMode(e.currentTarget.value as Mode)}
                    value="macro"
                    autocomplete="off"
                />
                <label
                    class="btn btn-outline-primary fs-3"
                    for="switchMacro"
                    class:active={commonState.currentMode === "macro"}
                >
                    <img src={macroImg} width="50" height="50" />
                    Macro
                </label>

                <input
                    type="radio"
                    class="btn-check"
                    name="mainModeSwitch"
                    id="switchMicro"
                    autocomplete="off"
                    onchange={(e) => switchMode(e.currentTarget.value as Mode)}
                    value="micro"
                />
                <label
                    class="btn btn-outline-primary fs-3"
                    for="switchMicro"
                    class:active={commonState.currentMode === "micro"}
                >
                    Detailed
                    <img src={microImg} width="50" height="50" />
                </label>
            </div>
            <!-- 
            <div class="w-100">
                <ul class="nav nav-tabs align-items-center justify-content-center m-1">
                    <li class="nav-item d-flex align-items-center mx-1">
                        <a
                            href="javascript:;"
                            class="nav-link d-flex align-items-center position-relative fs-5"
                            on:click={() => (mainMenuSelection = "general")}
                            class:active={mainMenuSelection === "general"}
                        >
                            General
                        </a>
                    </li>
                    <li class="nav-item d-flex align-items-center mx-1">
                        <a
                            href="javascript:;"
                            class="nav-link d-flex align-items-center position-relative fs-5"
                            on:click={() => (mainMenuSelection = "layers")}
                            class:active={mainMenuSelection === "layers"}
                        >
                            Layers
                        </a>
                    </li>
                </ul>
            </div> -->
            <div id="main-menu" class="mt-4">
                {#if commonState.currentMode === "macro"}
                    <MacroSidebar bind:this={macroSidebar} {draw} {svg} {styleEditor}></MacroSidebar>
                {:else}
                    <div>Nothing for now</div>
                {/if}
            </div>
        </div>
    </aside>
    <div class="w-auto d-flex flex-grow-1 flex-column align-items-center h-100">
        <Navbar>
            <div class="d-flex justify-content-center align-items-center">
                <span class="px-2 py-1 btn btn-outline-primary" role="button" onclick={() => (showInstructions = true)}>
                    <Icon marginRight="0px" width="1.8rem" svg={icons["help"]} />
                    Instructions
                </span>
                <Examples on:example={loadExample} />
            </div>
        </Navbar>
        <div class="d-flex flex-column justify-content-center align-items-center h-100">
            {#if commonState.currentMode === "micro"}
                <div class="micro-top mb-4 mx-auto d-flex align-items-center justify-content-between">
                    <Geocoding {maplibreMap}></Geocoding>
                    <div class="d-flex mx-2 align-items-center justify-content-center">
                        <input
                            type="checkbox"
                            class="btn-check"
                            id="lock-unlock"
                            bind:checked={microLocked}
                            onchange={(e) => lockUnlock(microLocked)}
                        />
                        <label class="btn btn-outline-primary" class:active={microLocked} for="lock-unlock">
                            <Icon svg={microLocked ? icons["lock"] : icons["unlock"]} />
                            {microLocked ? "View locked" : "View unlocked"}
                        </label>
                    </div>
                </div>
            {/if}

            <div id="map-content" style="position: relative;">
                <div id="map-container" class="col mx-4"></div>
                <div id="maplibre-map"></div>
            </div>
            {#if commonState.currentMode === "micro"}
                <div class="ms-auto me-4 mt-2">
                    Map data:
                    <a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>
                    <a href="https://www.openstreetmap.org/copyright" target="_blank"
                        >&copy; OpenStreetMap contributors</a
                    >
                </div>
            {/if}
            <div class="mt-4 d-flex align-items-center justify-content-center">
                <div class="mx-2">
                    <label for="fontinput" class="m-2 d-flex align-items-center btn btn-outline-primary">
                        <Icon svg={icons["font"]} /> Add font</label
                    >
                    <input
                        type="file"
                        class="d-none"
                        id="fontinput"
                        accept=".ttf,.woff,.woff2,.otf"
                        onchange={handleInputFont}
                    />
                </div>
                <div class="dropdown mx-2">
                    <button
                        class="btn btn-secondary dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                    >
                        <Icon fillColor="white" svg={icons["map"]} /> Project
                    </button>
                    <ul class="dropdown-menu">
                        <li>
                            <a class="dropdown-item" href="#" onclick={() => restoreStateToDefault()}>
                                <Icon svg={icons["reset"]} />Reset
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#" onclick={saveProject}>
                                <Icon fillColor="none" svg={icons["save"]} />
                                Save project
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#">
                                <label role="button" for="project-import">
                                    <Icon svg={icons["restore"]} /> Load project</label
                                >
                                <input
                                    id="project-import"
                                    class="d-none"
                                    type="file"
                                    accept=".cartosvg"
                                    onchange={loadProject}
                                />
                            </a>
                        </li>
                    </ul>
                </div>
                <div class="dropdown mx-2">
                    <button class="btn btn-outline-success" type="button" onclick={onExportSvgClicked}>
                        <Icon fillColor="none" svg={icons["download"]} /> Export
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
<!-- <Modal open={showModal} onClosed={() => onModalClose()}>
    <DataTable slot="content" data={zonesData?.[currentMacroLayerTab]?.["data"]}></DataTable>
</Modal> -->

<Modal open={showExportConfirm} onClosed={() => (showExportConfirm = false)} modalWidth="35%">
    <div slot="header">
        <h2 class="fs-3 p-2 m-0">Export options</h2>
    </div>
    <form slot="content" bind:this={exportForm}>
        {#if inlineFontUsed}
            <h3 class="fs-4">Font export</h3>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    value={exportFontChoices.noExport}
                    id="exportFonts1"
                />
                <label class="form-check-label" for="exportFonts1">
                    Do not export fonts
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="If the final HTML document containing the map contains imported fonts, no need to export it as part of the SVG"
                        >?</span
                    >
                </label>
            </div>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    value={exportFontChoices.convertToPath}
                    id="exportFonts2"
                />
                <label class="form-check-label" for="exportFonts2">
                    Convert texts with imported fonts to path
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Convert text to <path> elements to remove dependency on the imported font(s)"
                        >?</span
                    >
                </label>
            </div>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    value={exportFontChoices.embedFont}
                    id="exportFonts3"
                />
                <label class="form-check-label" for="exportFonts3">
                    Embed font(s)
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Always embed imported font(s) (only used fonts will be exported)">?</span
                    >
                </label>
            </div>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    id="exportFonts4"
                    value={exportFontChoices.smallest}
                    checked
                />
                <label class="form-check-label" for="exportFonts4">
                    Smallest of the 2
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Automatically determine the smallest file size between converting to <path> and embedding font"
                        >?</span
                    >
                </label>
            </div>
        {/if}
        {#if commonState.currentMode === "macro"}
            <h3 class="fs-4">Resize</h3>
            <div class="form-check form-switch">
                <input
                    class="form-check-input"
                    name="hideOnResize"
                    type="checkbox"
                    role="switch"
                    id="hideOnResize"
                    checked
                />
                <label class="form-check-label" for="hideOnResize">
                    Hide svg on resize
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="On some browsers, resizing the window triggers a re-render, which can cause a slowdown. If activated, the SVG will be hidden while the window is being resized, thus reducing the computing load."
                        >?</span
                    >
                </label>
            </div>
            <h3 class="fs-4">Javascript</h3>
            <div class="form-check form-switch">
                <input class="form-check-input" name="minifyJs" type="checkbox" role="switch" id="minifyJs" checked />
                <label class="form-check-label" for="minifyJs">
                    Minify javascript
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Some JS is included in the SVG (for the tooltip for instance). Minifying it will make the file smaller, but more difficult to edit."
                        >?</span
                    >
                </label>
            </div>
        {/if}
    </form>
    <div slot="footer" class="d-flex justify-content-end">
        <button type="button" class="btn btn-success" data-goatcounter-click="export-svg" onclick={validateExport}>
            Export
        </button>
    </div>
</Modal>

<Modal open={showInstructions} onClosed={() => (showInstructions = false)}>
    <div slot="header">
        <h1>Instructions</h1>
    </div>
    <div slot="content">
        <Instructions></Instructions>
    </div>
</Modal>

<style lang="scss" scoped>
    #params {
        flex: 1 1 400px;
        min-width: 300px;
        max-width: 550px;
        background-color: #ebf0f8;
        border-right: 1px solid #c8d4e3;
        overflow-x: hidden;
        overflow-y: auto;
    }

    #main-panel > .btn-group {
        .btn-check:checked + .btn {
            background-color: #465da3;
        }
        .btn {
            width: 100px;
        }

        &.mode-selection {
            margin-bottom: 20px;
            width: 80%;
            .btn {
                display: flex;
                align-items: center;
                justify-content: space-around;
                img {
                    border: 2px solid transparent;
                    border-radius: 3px;
                }
                &.active img {
                    border: 2px solid white;
                }
            }
        }
    }

    .tooltip-preview {
        padding: 5px;
    }
    #map-container {
        margin: 0 auto;
        flex: 0 0 auto;
    }
</style>
