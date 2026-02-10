<script lang="ts">
    import { mount, onMount, tick } from "svelte";
    import type { GlobalState } from "./types";
    import { select, pointer } from "d3-selection";
    import { drag } from "d3-drag";
    import { zoom } from "d3-zoom";
    import InlineStyleEditor from "inline-style-editor";
    import { cloneDeep, debounce } from "lodash-es";
    import { drawCustomPaths, parseAndUnprojectPath } from "./svg/paths";
    import PathEditor from "./svg/pathEditor";
    import Geocoding from "./components/Geocoding.svelte";
    import { download, initTooltips, pascalCaseToSentence, sleep } from "./util/common";
    import * as shapes from "./svg/shapeDefs";
    import * as markers from "./svg/markerDefs";
    import { setTransformScale, closestDistance, type DistanceQueryResult, pathStringFromParsed } from "./svg/svg";
    import { drawShapes } from "./svg/shape";
    import iso3Data from "./assets/data/iso3_filtered.json";
    import Examples from "./components/Examples.svelte";
    import { freeHandDrawPath, cancelFreeHandDrawPath } from "./svg/freeHandPath";
    import Modal from "./components/Modal.svelte";
    import Navbar from "./components/Navbar.svelte";
    import macroImg from "./assets/img/macro.png";
    import microImg from "./assets/img/micro.png";
    import Instructions from "./components/Instructions.svelte";
    import Icon from "./components/Icon.svelte";
    import { exportStyleSheet, getUsedInlineFonts, fontsToCss, applyStyles } from "./util/dom";
    import { getState, saveState } from "./util/save";
    import { undo, redo, setRestoring, clearHistory } from "./util/history";
    import { exportFontChoices } from "./svg/export";
    import * as _microPalettes from "./micro/microPalettes";
    import { drawFreeHandShapes, FreehandDrawer } from "./svg/freeHandDraw";
    import type {
        SvgSelection,
        ShapeDefinition,
        ProvidedFont,
        ParsedPath,
        ContextMenuInfo,
        MenuState,
        PathDefImage,
        MarkerName,
        ShapeName,
        Mode,
    } from "./types";
    import { Dropdown } from "bootstrap";
    import { applyInlineStyles, changeProjection } from "./macro/drawing";
    import MacroSidebar from "./macro/components/MacroSidebar.svelte";
    import { appState, commonState, macroState, microState } from "./state.svelte";
    import { icons } from "./shared/icons";
    import { defaultState } from "./stateDefaults";
    import { exportMacro } from "./macro/export";
    import MicroSidebar from "./micro/components/MicroSidebar.svelte";
    import { exportMicro } from "./micro/drawing";
    import {
        selectionState,
        identifyClickedEntity,
        identifyClickedPath,
        toggleSelection,
        clearSelection,
        isSelectionActive,
        copySelected,
        pasteFromClipboard,
        deleteSelected,
        refreshOverlay,
    } from "./selection.svelte";

    let openContextMenuInfo: ContextMenuInfo;

    let macroSidebar: MacroSidebar | null = $state(null);
    let microSidebar: MicroSidebar | null = $state(null);
    let svg: SvgSelection = $state(select("#map-container") as unknown as SvgSelection);
    let isDrawing = $state(false);

    let cssFonts = $derived(fontsToCss(commonState.providedFonts));

    // ==== End state =====

    let commonCss: string | undefined = $state(undefined);
    const menuStates: MenuState = $state({
        chosingPoint: false,
        pointSelected: false,
        addingLabel: false,
        pathSelected: false,
        freehandSelected: false,
        addingImageToPath: false,
        chosingMarker: false,
    });
    let editedLabelId: string | null = $state(null);
    let drawingTooltip: HTMLDivElement | null = $state(null);
    let textInput: HTMLTextAreaElement | null = $state(null);
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
    let isCursorInsideMap = $state(false);
    let isActivelyDrawingPath = $state(false);
    let iseOnClickEnabled = $derived(!editingPath && !isDrawingFreeHand && !isDrawingPath);

    let zoomFunc: d3.ZoomBehavior<any, any> | null = $state(null);
    let dragFunc: d3.DragBehavior<any, any, any> | null = $state(null);
    let microLocked = $state(false);
    // let commonStyleSheetElem: HTMLStyleElement;
    onMount(async () => {
        console.log("App onmount");
        // commonStyleSheetElem = document.createElement("style");
        // commonStyleSheetElem.setAttribute("id", "style-sheet-macro");
        // document.head.appendChild(commonStyleSheetElem);
        // commonStyleSheetElem.innerHTML = macroState.baseCss;
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
                    } else if (commonState.currentMode === "micro") {
                        microSidebar!.onStyleChanged(target, eventType, cssProp, value);
                    }
                },
                getElems: (el: HTMLElement) => {
                    console.log(el);
                    if (el.parentElement?.classList.contains("freehand")) {
                        return [
                            [el, "Clicked"],
                            [el.parentElement, "Group"],
                        ];
                    }
                    if (el.parentElement?.parentElement?.id === "buildings") {
                        return [[el.parentElement, "Selected building"]];
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
                    console.log(el, cssSelector);
                    if (el.id === "micro-background" && cssSelector === "inline") return false;
                    if (cssSelector.includes("#freehand-drawings > g")) return false;
                    if (cssSelector.includes("#static-svg-map")) return false;
                    // if (cssSelector.includes(".hovered")) return false;
                    if (cssSelector.includes("ssc-")) return false;
                    if (cssSelector.includes("#micro path")) return false;
                    if (cssSelector.includes("#micro .poly")) return false;
                    if (cssSelector.includes("#micro .line")) return false;
                    /** Only edit buildings via menu */
                    if (cssSelector.includes("#buildings")) return false;
                    return true;
                },
                inlineDeletable: () => false,
                getCssRuleName: (ruleName: string, el: HTMLElement) => {
                    if (ruleName.includes("#freehand-drawings > .freehand")) return "All freehand";
                    let isHover = ruleName.includes(":hover") || ruleName.includes(".hovered");
                    let finalStr = "";
                    // if (ruleName.includes("#buildings .buildings-1")) finalStr = "Building type 1";
                    // else if (ruleName.includes("#buildings .buildings-2")) finalStr = "Building type 2";
                    // else if (ruleName.includes("#buildings .buildings-3")) finalStr = "Building type 3";
                    // else
                    if (ruleName.includes("#micro")) {
                        const layerId = ruleName.match(/#micro \.(.*?)(\:|$)/)?.[1];
                        if (!layerId) return ruleName;
                        finalStr = pascalCaseToSentence(layerId);
                    }
                    //  else if (ruleName.includes("#buildings .buildings")) finalStr = "Buildings";
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
                if (isSelectionActive()) {
                    clearSelection();
                    return;
                }
                stopDrawFreeHand();
                cancelDrawPath();
            } else if (e.code === "Enter") {
                stopDrawFreeHand();
            } else if (e.ctrlKey && e.code === "KeyC") {
                if (isSelectionActive()) {
                    e.preventDefault();
                    copySelected();
                }
            } else if (e.ctrlKey && e.code === "KeyV") {
                if (selectionState.clipboard) {
                    e.preventDefault();
                    pasteFromClipboard(() => redrawEntities());
                }
            } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA") return;
                e.preventDefault();
                if (e.shiftKey) {
                    performRedo();
                } else {
                    performUndo();
                }
            } else if (e.code === "Delete" || e.code === "Backspace") {
                if (isSelectionActive()) {
                    // Don't intercept if user is typing in an input/textarea
                    const tag = (e.target as HTMLElement)?.tagName;
                    if (tag === "INPUT" || tag === "TEXTAREA") return;
                    e.preventDefault();
                    deleteSelected(() => redrawEntities());
                }
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

    async function switchMode(newMode: Mode): Promise<void> {
        if (commonState.currentMode === newMode) return;
        commonState.currentMode = newMode;
        console.log(cloneDeep(microState));
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
    async function draw(simplified = false) {
        if (isDrawing) return;
        isDrawing = true;
        clearSelection();
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
                let shouldOpenMenu = true;
                if (isDrawingFreeHand) {
                    stopDrawFreeHand();
                    shouldOpenMenu = false;
                }
                if (isDrawingPath) {
                    cancelDrawPath();
                    shouldOpenMenu = false;
                }
                e.preventDefault();
                closeMenu();
                let target = null;
                const clickedFreehandGroup = (e.target as Element).closest?.(".freehand");
                if (clickedFreehandGroup) {
                    menuStates.freehandSelected = true;
                    target = e.target;
                    selectedFreehandIndex = parseInt(clickedFreehandGroup.getAttribute("id")!.match(/\d+$/)![0]);
                } else {
                    const [x, y] = pointer(e);
                    const point = { x, y };

                    const pathsElement = document.getElementById("paths");
                    if (pathsElement) {
                        const paths = Array.from(pathsElement.children) as SVGPathElement[];
                        if (paths.length) {
                            const closestPath = paths.reduce((prev: DistanceQueryResult, curElem) => {
                                const curDist = closestDistance(point, curElem);
                                curDist.elem = curElem;
                                return prev.distance! < curDist.distance! ? prev : curDist;
                            }, {} as DistanceQueryResult);
                            if (closestPath.distance != null && closestPath.distance < 6) {
                                menuStates.pathSelected = true;
                                target = closestPath.elem;
                                selectedPathIndex = parseInt(closestPath.elem!.getAttribute("id")!.match(/\d+$/)![0]);
                            }
                        }
                    }
                }
                if (shouldOpenMenu) showMenu(e, target);
                return false;
            },
            false,
        );

        svg.on("click", function (e) {
            if (contextualMenu!.opened) {
                closeMenu();
                return;
            }
            if (styleEditor!.isOpened()) {
                styleEditor!.close();
                return;
            }
            if (!iseOnClickEnabled) return;

            // Try to identify a clicked entity for selection
            let entity = identifyClickedEntity(e.target as Element);
            // Fallback: proximity hit-test for thin paths
            if (!entity) entity = identifyClickedPath(e);
            if (entity) {
                toggleSelection(entity, e.shiftKey);
            } else {
                clearSelection();
            }
        });

        svg.on("dblclick", function (e) {
            if (!iseOnClickEnabled) return;
            // If a single entity is selected, open editor on that entity (not the overlay)
            if (selectionState.selected.length === 1) {
                const sel = selectionState.selected[0];
                const el = document.getElementById(sel.id);
                if (el) {
                    styleEditor!.open(el as HTMLElement, e.pageX, e.pageY);
                    return;
                }
            }
            // Multiple selected: do nothing (bulk style editing not supported)
            if (selectionState.selected.length > 1) return;
            openEditor(e);
        });

        if (commonState.currentMode === "macro") {
            await macroSidebar!.drawMacroTotal(simplified);
        } else if (commonState.currentMode === "micro") {
            await microSidebar?.drawMicroTotal();
        }

        svg.append("g").attr("id", "points-labels");
        svg.append("g").attr("id", "paths");
        drawAndSetupShapes();
        drawCustomPaths(commonState.providedPaths, svg, appState.projection!, commonState.inlineStyles);
        drawFreeHandShapes(svg, commonState.providedFreeHand);
        if (!simplified) {
            applyStyles(commonState.inlineStyles);
            saveState();
        }
        isDrawing = false;
    }

    function saveProject(): void {
        const baseCss = exportStyleSheet("#outline")!;
        // TODO: is is this useful?
        macroState.baseCss = baseCss;
        const state: GlobalState = {
            stateCommon: commonState,
            stateMacro: macroState,
            stateMicro: microState,
        };
        download(JSON.stringify(state), "text/json", "project.cartosvg");
    }

    async function applyState(state: GlobalState): Promise<void> {
        console.trace("applyState", state);
        clearHistory();
        setRestoring(true);
        try {
            Object.assign(commonState, state.stateCommon);
            Object.assign(macroState, state.stateMacro.macroParams ? state.stateMacro : defaultState.stateMacro);
            Object.assign(microState, state.stateMicro.microParams ? state.stateMicro : defaultState.stateMicro);
            await tick();
            changeProjection();
            draw();
            saveState();
        } finally {
            setRestoring(false);
            // Record initial drawing state as baseline for undo
            saveState();
        }
    }

    function restoreStateFromSave() {
        const savedState = getState();
        // console.log("baseCss", savedState?.stateMacro.baseCss);
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

    async function loadExample(e: CustomEvent): Promise<void> {
        if (
            !window.confirm(
                "Caution: Loading the example will discard your current project. Please save it first if you want to keep it.",
            )
        )
            return;

        console.log(e.detail.projectParams);
        applyState(e.detail.projectParams);
        await tick();
        if (commonState.currentMode === "macro") {
            macroSidebar!.applyStateAndDraw();
        }
    }

    function openEditor(e: MouseEvent): void {
        styleEditor!.open(e.target as HTMLElement, e.pageX, e.pageY);
    }
    let selectedPathIndex = $state<number>(0);
    let selectedFreehandIndex = $state<number>(0);

    function editPath(): void {
        closeMenu();
        clearSelection();
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

    function deleteFreehand(): void {
        closeMenu();
        commonState.providedFreeHand.splice(selectedFreehandIndex, 1);
        const existing = document.getElementById("freehand-drawings");
        if (existing) existing.remove();
        drawFreeHandShapes(svg, commonState.providedFreeHand);
        applyStyles(commonState.inlineStyles);
        saveState();
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

    /** Re-render all user entities (shapes, paths, freehand) after a selection operation */
    function redrawEntities(): void {
        drawAndSetupShapes();
        drawCustomPaths(commonState.providedPaths, svg, appState.projection!, commonState.inlineStyles);
        const existing = document.getElementById("freehand-drawings");
        if (existing) existing.remove();
        drawFreeHandShapes(svg, commonState.providedFreeHand);
        applyStyles(commonState.inlineStyles);
    }

    function performUndo(): void {
        const snapshot = undo();
        if (!snapshot) return;
        setRestoring(true);
        try {
            Object.assign(commonState, JSON.parse(snapshot));
            redrawEntities();
            saveState();
        } finally {
            setRestoring(false);
        }
    }

    function performRedo(): void {
        const snapshot = redo();
        if (!snapshot) return;
        setRestoring(true);
        try {
            Object.assign(commonState, JSON.parse(snapshot));
            redrawEntities();
            saveState();
        } finally {
            setRestoring(false);
        }
    }

    function handleInputFont(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const fileName = file.name.split(".")[0];
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            const newFont: ProvidedFont = { name: fileName, content: reader.result as string };
            commonState.providedFonts.push(newFont);
            saveState();
        });
        reader.readAsDataURL(file);
    }

    function addPath(): void {
        closeMenu();
        clearSelection();
        detachListeners();
        isDrawingPath = true;
        isCursorInsideMap = true; // Assume cursor is inside since menu was just clicked
        document.addEventListener("mousemove", updateDrawingTooltip);
        document.addEventListener("mousedown", onPathDrawMouseDown);
        document.addEventListener("mouseup", onPathDrawMouseUp);
        addMapCursorListeners();
        freeHandDrawPath(svg.node() as SVGSVGElement, (finishedElem) => {
            console.log("finishedElem", finishedElem);
            const d = finishedElem.getAttribute("d");
            if (!d) return;
            cleanupPathDrawListeners();
            removeMapCursorListeners();
            attachListeners();
            const pathIndex = commonState.providedPaths.length;
            const id = `path-${pathIndex}`;
            finishedElem.setAttribute("id", id);
            commonState.providedPaths.push({ d: parseAndUnprojectPath(d, appState.projection!) });
            saveDebounced();
            setTimeout(() => {
                isDrawingPath = false;
                isActivelyDrawingPath = false;
            }, 0);
        });
    }

    function onPathDrawMouseDown(): void {
        isActivelyDrawingPath = true;
    }

    function onPathDrawMouseUp(): void {
        isActivelyDrawingPath = false;
    }

    function cleanupPathDrawListeners(): void {
        document.removeEventListener("mousemove", updateDrawingTooltip);
        document.removeEventListener("mousedown", onPathDrawMouseDown);
        document.removeEventListener("mouseup", onPathDrawMouseUp);
    }

    function cancelDrawPath(): void {
        if (!isDrawingPath) return;
        cancelFreeHandDrawPath();
        cleanupPathDrawListeners();
        removeMapCursorListeners();
        attachListeners();
        isDrawingPath = false;
        isActivelyDrawingPath = false;
    }

    function onMapMouseEnter(): void {
        isCursorInsideMap = true;
    }

    function onMapMouseLeave(): void {
        isCursorInsideMap = false;
    }

    function addMapCursorListeners(): void {
        const mapContent = document.getElementById("map-content");
        if (mapContent) {
            mapContent.addEventListener("mouseenter", onMapMouseEnter);
            mapContent.addEventListener("mouseleave", onMapMouseLeave);
        }
    }

    function removeMapCursorListeners(): void {
        const mapContent = document.getElementById("map-content");
        if (mapContent) {
            mapContent.removeEventListener("mouseenter", onMapMouseEnter);
            mapContent.removeEventListener("mouseleave", onMapMouseLeave);
        }
        isCursorInsideMap = false;
    }

    function updateDrawingTooltip(e: MouseEvent): void {
        if (!drawingTooltip) return;
        drawingTooltip.style.left = e.clientX + 15 + "px";
        drawingTooltip.style.top = e.clientY + 15 + "px";
    }

    function drawFreeHand(): void {
        isDrawingFreeHand = true;
        isCursorInsideMap = true; // Assume cursor is inside since menu was just clicked
        closeMenu();
        clearSelection();
        detachListeners();
        freeHandDrawer.start(svg.node() as SVGSVGElement);
        document.addEventListener("mousemove", updateDrawingTooltip);
        addMapCursorListeners();
    }

    function stopDrawFreeHand(): void {
        if (!isDrawingFreeHand) return;
        document.removeEventListener("mousemove", updateDrawingTooltip);
        removeMapCursorListeners();
        attachListeners();
        isDrawingFreeHand = false;
        const newGroup = freeHandDrawer.stop();
        const paths = newGroup.querySelectorAll("path");
        if (!paths.length) return;

        const unprojected: ParsedPath[] = [];
        paths.forEach((pathElem) => {
            const d = pathElem.getAttribute("d");
            if (!d) return;
            const parsed = parseAndUnprojectPath(d, appState.projection!);
            unprojected.push(parsed);
            console.log(parsed);
        });
        if (unprojected.length) commonState.providedFreeHand.push(unprojected);
        // Remove the drawer's temporary group and existing freehand container before re-rendering
        newGroup.remove();
        const existing = document.getElementById("freehand-drawings");
        if (existing) existing.remove();
        drawFreeHandShapes(svg, commonState.providedFreeHand);
        saveState();
    }

    function closeMenu(): void {
        contextualMenu!.style.display = "none";
        contextualMenu!.opened = false;
        menuStates.chosingPoint = false;
        menuStates.pointSelected = false;
        menuStates.addingLabel = false;
        menuStates.pathSelected = false;
        menuStates.freehandSelected = false;
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
        textInput!.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" && !event.shiftKey) {
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
                const labelId = `label-${commonState.shapeCount++}`;
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
        select(container).attr("clip-path", "url(#clipMapBorder)");
        drawShapes(commonState.providedShapes, container, appState.projection!);
        select(container).on("click", (e) => {
            // Let clicks propagate to SVG for selection handling
            // but stop propagation only if selection overlay handled it
        });
        select(container).on("dblclick", (e) => {
            const target = e.target;
            let targetId = target.getAttribute("id");
            if (target.tagName == "tspan") targetId = target.parentNode.getAttribute("id");
            if (targetId && targetId.includes("label")) {
                editedLabelId = targetId;
                const labelDef = commonState.providedShapes.find((def) => def.id === editedLabelId)!;
                typedText = labelDef.text!;
                addLabel();
                showMenu(e);
            } else {
                // Double-click on shapes opens style editor
                openEditor(e);
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
        const shapeId = `${shapeName}-${commonState.shapeCount++}`;
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
        const newShapeId = `${newDef.name ? newDef.name : "label"}-${commonState.shapeCount++}`;
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
        const formData = exportForm ? Object.fromEntries(new FormData(exportForm!).entries()) : {};
        console.log("formData", formData);
        if (commonState.currentMode === "macro") {
            const totalCss = macroSidebar!.computeCss();
            exportMacro(svg, macroState, commonState.providedFonts, true, totalCss, formData);
        } else {
            const microCss = exportStyleSheet("#micro .line")!;
            exportMicro(svg, microState, commonState.providedFonts, microCss, formData);
        }
        showExportConfirm = false;
    }

    let inlineFontUsed = $state(false);
    function onExportSvgClicked() {
        const usedFonts = getUsedInlineFonts(svg.node()!);
        const usedProvidedFonts = commonState.providedFonts.filter((font) => usedFonts.has(font.name));
        inlineFontUsed = usedProvidedFonts.length > 0;
        if (commonState.currentMode === "micro" && !inlineFontUsed) {
            validateExport();
            return;
        }
        showExportConfirm = true;
    }
</script>

<svelte:head>
    {@html `<${""}style> ${commonCss} </${""}style>`}
    {@html `<${""}style> ${cssFonts} .test {} </${""}style>`}
</svelte:head>

<div id="contextmenu" class="border rounded" bind:this={contextualMenu} class:hidden={!contextualMenu?.opened}>
    {#if menuStates.chosingPoint}
        {#each Object.keys(shapes) as shapeName (shapeName)}
            <div role="button" class="px-2 py-1" onclick={() => addShape(shapeName as ShapeName)}>
                {shapeName}
            </div>
        {/each}
    {:else if menuStates.addingLabel}
        <textarea bind:this={textInput} bind:value={typedText}> </textarea>
    {:else if menuStates.pointSelected}
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit styles</div>
        <div role="button" class="px-2 py-1" onclick={copySelection}>Copy</div>
        <div role="button" class="px-2 py-1" onclick={deleteSelection}>Delete</div>
    {:else if menuStates.pathSelected}
        <div role="button" class="px-2 py-1" onclick={editPath}>Edit curve</div>
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit style</div>
        <div role="button" class="px-2 py-1" onclick={deletePath}>Delete curve</div>
        <div role="button" class="px-2 py-1" onclick={addImageToPath}>Image along curve</div>
        <div role="button" class="px-2 py-1" onclick={choseMarker}>Chose curve marker</div>
    {:else if menuStates.freehandSelected}
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit style</div>
        <div role="button" class="px-2 py-1" onclick={deleteFreehand}>Delete drawing</div>
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
        <div role="button" class="px-2 py-1" onclick={addPath}>Draw curve</div>
        <div role="button" class="px-2 py-1" onclick={drawFreeHand}>Draw freehand</div>
        <div role="button" class="px-2 py-1" onclick={addPoint}>Add point</div>
        <div role="button" class="px-2 py-1" onclick={addLabel}>Add label</div>
    {/if}
</div>

{#if (isDrawingFreeHand || (isDrawingPath && !isActivelyDrawingPath)) && isCursorInsideMap}
    <div id="drawing-tooltip" bind:this={drawingTooltip} class="drawing-tooltip">
        {#if isDrawingPath}
            Left-click and hold to draw a curve
        {:else}
            Right-click or press Enter to finish
        {/if}
    </div>
{/if}

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
            <div id="main-menu" class="mt-4">
                {#if commonState.currentMode === "macro"}
                    <MacroSidebar bind:this={macroSidebar} {draw} {svg} {styleEditor}></MacroSidebar>
                {:else}
                    <MicroSidebar
                        bind:this={microSidebar}
                        {draw}
                        {svg}
                        {styleEditor}
                        bind:viewLocked={microLocked}
                        onMapMoveStart={() => {
                            closeMenu();
                            stopDrawFreeHand();
                        }}
                    ></MicroSidebar>
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
                    <Geocoding onPlaceSelected={(res) => microSidebar!.onPlaceSelected(res)}></Geocoding>
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
                    <a href="https://protomaps.com/" target="_blank">Protomaps</a>
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
                        accept=".ttf,.woff,.otf"
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
        <button type="button" class="btn btn-success" onclick={validateExport}> Export </button>
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
        min-width: 400px;
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

    #map-container {
        margin: 0 auto;
        flex: 0 0 auto;
    }

    .drawing-tooltip {
        position: fixed;
        background: rgba(0, 0, 0, 0.75);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 9999;
        white-space: nowrap;
    }
</style>
