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
    import {
        setTransformScale,
        closestDistance,
        type DistanceQueryResult,
        pathStringFromParsed,
        createSvgAnchor,
    } from "./svg/svg";
    import { drawShapes } from "./svg/shape";
    import iso3Data from "./assets/data/iso3_filtered.json";
    import Examples from "./components/Examples.svelte";
    import { freeHandDrawPath, cancelFreeHandDrawPath } from "./svg/freeHandPath";
    import Modal from "./components/Modal.svelte";
    import LabelEditor from "./components/LabelEditor.svelte";
    import FontPicker from "./components/FontPicker.svelte";
    import Navbar from "./components/Navbar.svelte";
    import macroImg from "./assets/img/macro.png";
    import microImg from "./assets/img/micro.png";
    import Icon from "./components/Icon.svelte";
    import { exportStyleSheet, getUsedInlineFonts, fontsToCss, applyStyles } from "./util/dom";
    import { getState, saveState, registerServerSync } from "./util/save";
    import { undo, redo, setRestoring, clearHistory } from "./util/history";
    import { type ExportOptions } from "./svg/export";
    import ExportModal from "./components/ExportModal.svelte";
    import AuthModal from "./components/AuthModal.svelte";
    import ProjectDropdown from "./components/ProjectDropdown.svelte";
    import { signOut } from "$lib/auth-client";
    import { page } from "$app/state";
    import { invalidateAll } from "$app/navigation";
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
    import QuillEditor from "./components/QuillEditor.svelte";
    import { addElementAnnotationListener } from "./tooltip";
    import { showElementPopover, hidePopover, getActivePopoverId, setupPopoverCursors } from "./popover";
    import { Dropdown } from "bootstrap";
    import { applyInlineStyles, changeProjection } from "./macro/drawing";
    import MacroSidebar from "./macro/components/MacroSidebar.svelte";
    import { appState, commonState, macroState, microState } from "./state.svelte";
    import { icons } from "./shared/icons";
    import { defaultState } from "./stateDefaults";
    import { exportMacro } from "./macro/export";
    import MicroSidebar from "./micro/components/MicroSidebar.svelte";
    import { exportMicro } from "./micro/drawing";
    import { replaceCssSheetContent, updateSvgPatterns } from "./micro/change";
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
        getOverlay,
    } from "./selection.svelte";

    let openContextMenuInfo: ContextMenuInfo;

    let macroSidebar: MacroSidebar | null = $state(null);
    let microSidebar: MicroSidebar | null = $state(null);
    let labelEditor: LabelEditor | null = $state(null);
    let svg: SvgSelection = $state(select("#map-container") as unknown as SvgSelection);
    let isDrawing = $state(false);

    let cssFonts = $derived(fontsToCss(commonState.providedFonts));

    // ==== End state =====

    const shapeViewBoxes: Record<string, string> = {
        circle: "-4 -4 8 8",
        rectangle: "0 0 8 8",
        star: "-1 -1 14 14",
        cross: "0 0 12 13",
        heart: "0 -1 8 10",
        location: "-9 -22 18 23",
        pin: "-8 -24 16 25",
    };

    let commonCss: string | undefined = $state(undefined);
    const menuStates: MenuState = $state({
        chosingPoint: false,
        pointSelected: false,
        addingLabel: false,
        addingLink: false,
        pathSelected: false,
        freehandSelected: false,
        addingImageToPath: false,
        chosingMarker: false,
        addingAnnotation: false,
    });

    // Annotation editor state
    let annotationEditorOpen = $state(false);
    let annotationEditingElemId = $state<string | null>(null);
    let annotationEditingType = $state<"tooltip" | "popover">("tooltip");
    let annotationEditorContent = $state("");
    let annotationPreviewEl: HTMLElement | null = null;
    let annotationQuillEditor: ReturnType<typeof QuillEditor> | null = $state(null);

    let drawingTooltip: HTMLDivElement | null = $state(null);
    let textInput: HTMLTextAreaElement | null = $state(null);
    let customImageInput: HTMLInputElement | null = $state(null);
    let typedText = $state("");
    let selectedShapeId: string | null = $state(null);
    let linkInputValue = $state("");
    let linkTargetId: string | null = $state(null);
    let linkInput: HTMLInputElement | null = $state(null);
    let genericSelectedId: string | null = $state(null);
    let styleEditor: InlineStyleEditor | null = $state(null);
    let contextualMenu: (HTMLDivElement & { opened?: boolean }) | null = $state(null);
    let showExportConfirm = $state(false);
    let showAuthModal = $state(false);
    let authAfterCallback: (() => void) | undefined = $state(undefined);
    let currentProjectName = $state('Project 1');
    let activeProjectId = $state<string | null>(null);
    const currentUser = $derived(page.data.user ?? null);

    // TODO: move in menuStates
    let editingPath = $state(false);
    let isDrawingFreeHand = $state(false);
    let isDrawingPath = $state(false);
    let isCursorInsideMap = $state(false);
    let isActivelyDrawingPath = $state(false);
    let iseOnClickEnabled = $derived(!editingPath && !isDrawingFreeHand && !isDrawingPath);

    let zoomFunc: d3.ZoomBehavior<any, any> | null = $state(null);
    let dragFunc: d3.DragBehavior<any, any, any> | null = $state(null);
    // let commonStyleSheetElem: HTMLStyleElement;
    const syncToServer = debounce(() => {
        if (!activeProjectId || !currentUser) return;
        fetch(`/api/projects/${activeProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_json: getProjectJson() }),
        }).catch(() => {});
    }, 3000);

    onMount(async () => {
        console.log("App onmount");
        registerServerSync(syncToServer);
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
                ignoredProps: ["stroke-linejoin"],
                onStyleChanged: (
                    target: HTMLElement,
                    eventType: "inline" | CSSStyleRule,
                    cssProp: string,
                    value: string,
                ) => {
                    if (annotationEditingElemId !== null) {
                        (target.style as any)[cssProp] = value;
                        return;
                    }
                    if (commonState.currentMode === "macro") {
                        macroSidebar!.onStyleChanged(target, eventType, cssProp, value);
                    } else if (commonState.currentMode === "micro") {
                        microSidebar!.onStyleChanged(target, eventType, cssProp, value);
                    }
                    requestAnimationFrame(() => refreshOverlay());
                },
                getElems: (el: HTMLElement) => {
                    console.log(el);
                    if (el.closest(".tooltip-preview")) {
                        return [
                            [el, "Clicked"],
                            [el.parentElement, "All tooltip"],
                        ];
                    }
                    if (el.closest(".elem-annotation-preview")) {
                        return [
                            [el, "Clicked"],
                            [el.parentElement, "All annotation"],
                        ];
                    }
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
                    if (el.closest("foreignObject")) return false;
                    if (el.closest(".tooltip-preview") && cssSelector !== "inline") return false;
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
                    if (ruleName.includes("#micro")) {
                        const layerId = ruleName.match(/#micro \.(.*?)(\:|$)/)?.[1];
                        if (!layerId) return ruleName;
                        finalStr = pascalCaseToSentence(layerId);
                    } else if (ruleName.includes(".adm")) finalStr = "Region";
                    else if (ruleName.includes(".country")) finalStr = "Countries";
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
                if (contextualMenu!.opened) {
                    closeMenu();
                    return;
                }
                if (styleEditor!.isOpened()) {
                    styleEditor!.close();
                    return;
                }
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

    async function handleReset() {
        if (!window.confirm('Reset to default? Your current project will be erased.')) return;
        currentProjectName = 'Project 1';
        activeProjectId = null;
        await applyState(defaultState);
        if (commonState.currentMode === 'macro') macroSidebar!.applyStateAndDraw();
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
            .filter((e) => commonState.currentMode === "macro" && !e.button)
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

    async function switchMode(newMode: Mode): Promise<void> {
        if (commonState.currentMode === newMode) return;
        commonState.currentMode = newMode;
        select("#map-container").html("");
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
        hidePopover();
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
        svg.on("contextmenu", onSvgContextMenu, false);
        svg.on("click", onSvgClick);
        svg.on("dblclick", onSvgDblClick);
        svg.on("mousedown", onSvgMouseDown);
        svg.node()?.addEventListener(
            "wheel",
            (e: WheelEvent) => {
                if (commonState.currentMode !== "micro" || isDrawingFreeHand || isDrawingPath || editingPath) return;
                const canvas = document.querySelector("#maplibre-map canvas") as HTMLCanvasElement | null;
                if (!canvas) return;
                e.preventDefault();
                canvas.dispatchEvent(
                    new WheelEvent("wheel", {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        deltaX: e.deltaX,
                        deltaY: e.deltaY,
                        deltaZ: e.deltaZ,
                        deltaMode: e.deltaMode,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    }),
                );
            },
            { passive: false },
        );

        if (commonState.currentMode === "macro") {
            await macroSidebar!.drawMacroTotal(simplified);
        } else if (commonState.currentMode === "micro") {
            await microSidebar?.drawMicroTotal();
        }

        svg.append("g").attr("id", "points-labels");
        svg.append("g").attr("id", "paths");
        drawAndSetupShapes();
        drawCustomPaths(
            commonState.providedPaths,
            svg,
            appState.projection!,
            commonState.inlineStyles,
            commonState.elementLinks ?? {},
        );
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
        if (!simplified) {
            applyStyles(commonState.inlineStyles);
            applyGenericLinks();
            if (commonState.elementAnnotations) {
                setupPopoverCursors(svg.node() as SVGSVGElement, commonState.elementAnnotations);
            }
            saveState();
        }
        if (!simplified && commonState.currentMode !== "macro") {
            setTimeout(() => {
                addElementAnnotationListener(svg.node() as SVGSVGElement, commonState.elementAnnotations ?? {});
            }, 600);
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

    function onSvgContextMenu(e: MouseEvent): void {
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
                const paths = Array.from(pathsElement.querySelectorAll("path")) as SVGPathElement[];
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
        // Track generic element ID for "Add link" in else-branch menu
        if (!menuStates.freehandSelected && !menuStates.pathSelected) {
            let el: Element | null = e.target as Element;
            genericSelectedId = null;
            const svgRoot = document.getElementById("static-svg-map");
            while (el && el !== svgRoot) {
                const id = el.getAttribute("id");
                if (id) {
                    genericSelectedId = id;
                    break;
                }
                el = el.parentElement;
            }
        }
        if (shouldOpenMenu) showMenu(e, target);
    }

    function onSvgClick(e: MouseEvent): void {
        if ((e.target as Element).closest("a")) e.preventDefault();
        if (contextualMenu!.opened) {
            closeMenu();
            return;
        }
        if (styleEditor!.isOpened()) {
            styleEditor!.close();
            return;
        }
        if (!iseOnClickEnabled) return;

        // Check for popover annotation on clicked element
        let clickedId: string | null = null;
        let el: Element | null = e.target as Element;
        const svgRoot = document.getElementById("static-svg-map");
        while (el && el !== svgRoot) {
            const id = el.getAttribute("id");
            if (id) {
                clickedId = id;
                break;
            }
            el = el.parentElement;
        }
        if (clickedId && commonState.elementAnnotations?.[clickedId]?.popover) {
            showElementPopover(clickedId, svg.node() as SVGSVGElement, commonState.elementAnnotations ?? {});
            return;
        }

        let entity = identifyClickedEntity(e.target as Element);
        if (!entity) entity = identifyClickedPath(e);
        if (entity) {
            // Labels are handled by mousedown (edit mode), not click (selection)
            if (entity.type === "shape" && commonState.providedShapes[entity.index]?.text !== undefined) return;
            toggleSelection(entity, e.shiftKey);
        } else {
            if (getActivePopoverId()) hidePopover();
            clearSelection();
        }
    }

    function onSvgDblClick(e: MouseEvent): void {
        if (!iseOnClickEnabled) return;
        let entity = identifyClickedEntity(e.target as Element) ?? identifyClickedPath(e);
        // Fallback: if clicking on the overlay, use the single selected entity
        if (!entity && (e.target as Element).closest?.("#selection-overlay") && selectionState.selected.length === 1) {
            entity = selectionState.selected[0];
        }
        if (entity) {
            const el = document.getElementById(entity.id);
            if (el) {
                styleEditor!.open(el as HTMLElement, e.pageX, e.pageY);
                return;
            }
        }
        openEditor(e);
    }

    // Select-and-drag: intercept mousedown before d3 drag; labels get click-vs-drag disambiguation
    function onSvgMouseDown(e: MouseEvent): void {
        // if (commonState.currentMode !== "macro") return;
        if (e.button !== 0) return;
        const entity = identifyClickedEntity(e.target as Element) ?? identifyClickedPath(e);
        if (!entity) {
            if (commonState.currentMode === "micro" && !isDrawingFreeHand && !isDrawingPath && !editingPath) {
                const canvas = document.querySelector("#maplibre-map canvas") as HTMLCanvasElement | null;
                if (!canvas) return;
                canvas.dispatchEvent(
                    new MouseEvent("mousedown", {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        button: e.button,
                        buttons: e.buttons || 1,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    }),
                );
                function onDragEnd(ev: MouseEvent) {
                    document.removeEventListener("mouseup", onDragEnd);
                    canvas!.dispatchEvent(
                        new MouseEvent("mouseup", {
                            bubbles: true,
                            cancelable: true,
                            clientX: ev.clientX,
                            clientY: ev.clientY,
                            button: ev.button,
                            buttons: ev.buttons,
                            ctrlKey: ev.ctrlKey,
                            shiftKey: ev.shiftKey,
                            altKey: ev.altKey,
                            metaKey: ev.metaKey,
                        }),
                    );
                }
                document.addEventListener("mouseup", onDragEnd);
            }
            return;
        }
        e.stopPropagation();
        // Labels: disambiguate click vs drag
        if (entity.type === "shape" && commonState.providedShapes[entity.index]?.text !== undefined) {
            const savedEvent = e;
            const savedEntity = entity;
            let moved = false;
            function onMove(ev: MouseEvent) {
                const dx = ev.clientX - savedEvent.clientX;
                const dy = ev.clientY - savedEvent.clientY;
                if (Math.sqrt(dx * dx + dy * dy) > 5) {
                    moved = true;
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                    toggleSelection(savedEntity, savedEvent.shiftKey);
                    getOverlay()?.beginDrag(savedEvent);
                    setupLabelOverlayCallbacks(savedEntity.id, savedEntity.index);
                }
            }
            function onUp() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                if (!moved) {
                    toggleSelection(savedEntity, savedEvent.shiftKey);
                    setupLabelOverlayCallbacks(savedEntity.id, savedEntity.index);
                    const svgText = document.getElementById(savedEntity.id) as SVGTextElement | null;
                    if (svgText) labelEditor?.enter(savedEntity.id, savedEntity.index, svgText);
                }
            }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
            return;
        }
        // Non-labels: select + drag
        toggleSelection(entity, e.shiftKey);
        getOverlay()?.beginDrag(e);
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
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
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
            drawCustomPaths(
                commonState.providedPaths,
                svg,
                appState.projection!,
                commonState.inlineStyles,
                commonState.elementLinks ?? {},
            );
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
        drawCustomPaths(
            commonState.providedPaths,
            svg,
            appState.projection!,
            commonState.inlineStyles,
            commonState.elementLinks ?? {},
        );
        applyInlineStyles();
        saveState();
    }

    /** Re-render all user entities (shapes, paths, freehand) after a selection operation */
    function redrawEntities(): void {
        drawAndSetupShapes();
        drawCustomPaths(
            commonState.providedPaths,
            svg,
            appState.projection!,
            commonState.inlineStyles,
            commonState.elementLinks ?? {},
        );
        const existing = document.getElementById("freehand-drawings");
        if (existing) existing.remove();
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
        applyStyles(commonState.inlineStyles);
    }

    function restoreStyleState(parsed: Record<string, any>): void {
        if (parsed.baseCss !== undefined && commonState.currentMode === "macro") {
            macroState.baseCss = parsed.baseCss;
            const styleElem = document.getElementById("style-sheet-macro");
            if (!styleElem) return;
            styleElem.innerHTML = macroState.baseCss;
        }
        if (parsed.microLayerDefinitions !== undefined && commonState.currentMode === "micro") {
            microState.microLayerDefinitions = parsed.microLayerDefinitions;
            const svgNode = document.getElementById("static-svg-map") as unknown as SVGSVGElement;
            updateSvgPatterns(svgNode, microState.microLayerDefinitions);
            replaceCssSheetContent(microState.microLayerDefinitions);
        }
    }

    function performUndo(): void {
        const snapshot = undo();
        if (!snapshot) return;
        setRestoring(true);
        try {
            const parsed = JSON.parse(snapshot);
            Object.assign(commonState, parsed);
            restoreStyleState(parsed);
            redrawEntities();
            refreshOverlay();
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
            const parsed = JSON.parse(snapshot);
            Object.assign(commonState, parsed);
            restoreStyleState(parsed);
            redrawEntities();
            refreshOverlay();
            saveState();
        } finally {
            setRestoring(false);
        }
    }

    function handleFontSelected(font: ProvidedFont): void {
        commonState.providedFonts.push(font);
        for (const shape of commonState.providedShapes) {
            if (shape.text !== undefined && !shape.fontManual) {
                if (shape.id in commonState.inlineStyles) {
                    commonState.inlineStyles[shape.id]["font-family"] = font.name;
                } else {
                    commonState.inlineStyles[shape.id] = { "font-family": font.name };
                }
            }
        }
        commonState.lastUsedLabelProps["font-family"] = font.name;
        drawAndSetupShapes();
        saveState();
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
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
        saveState();
    }

    async function beginAddLink(elemId: string): Promise<void> {
        console.log("adding link to", elemId);
        linkTargetId = elemId;
        linkInputValue = commonState.elementLinks?.[elemId] ?? "";
        menuStates.pointSelected = false;
        menuStates.pathSelected = false;
        menuStates.freehandSelected = false;
        menuStates.addingLink = true;
        await tick();
        linkInput!.focus();
        linkInput!.addEventListener("keydown", (ev: KeyboardEvent) => {
            if (ev.key === "Enter") validateLink();
        });
    }

    function applyGenericLinks(): void {
        if (!commonState.elementLinks) return;
        const svgElem = document.getElementById("static-svg-map");
        if (!svgElem) return;

        for (const [elemId, url] of Object.entries(commonState.elementLinks)) {
            const el = svgElem.querySelector(`#${CSS.escape(elemId)}`);
            if (!el) continue;
            if (el.parentElement?.tagName.toLowerCase() === "a") {
                // Already wrapped — just ensure href is current
                (el.parentElement as unknown as SVGAElement).setAttributeNS(
                    "http://www.w3.org/1999/xlink",
                    "xlink:href",
                    url,
                );
                continue;
            }
            const a = createSvgAnchor(url);
            el.parentNode!.insertBefore(a, el);
            a.appendChild(el);
        }
    }

    function removeLink(elemId: string): void {
        if (!commonState.elementLinks) return;
        delete commonState.elementLinks[elemId];

        const svgElem = document.getElementById("static-svg-map");
        const el = svgElem?.querySelector(`#${CSS.escape(elemId)}`);
        if (el?.parentElement?.tagName.toLowerCase() === "a") {
            const a = el.parentElement;
            const parent = a.parentNode!;
            while (a.firstChild) parent.insertBefore(a.firstChild, a);
            a.remove();
        }

        drawAndSetupShapes();
        drawCustomPaths(
            commonState.providedPaths,
            svg,
            appState.projection!,
            commonState.inlineStyles,
            commonState.elementLinks ?? {},
        );
        const existing = document.getElementById("freehand-drawings");
        if (existing) existing.remove();
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
        applyInlineStyles();
        applyGenericLinks();
        saveState();
        closeMenu();
    }

    function validateLink(): void {
        if (linkTargetId) {
            if (!commonState.elementLinks) commonState.elementLinks = {};
            if (linkInputValue.trim()) {
                commonState.elementLinks[linkTargetId] = linkInputValue.trim();
            } else {
                delete commonState.elementLinks[linkTargetId];
            }
            drawAndSetupShapes();
            drawCustomPaths(
                commonState.providedPaths,
                svg,
                appState.projection!,
                commonState.inlineStyles,
                commonState.elementLinks,
            );
            const existing = document.getElementById("freehand-drawings");
            if (existing) existing.remove();
            drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks);
            applyInlineStyles();
            applyGenericLinks();
            saveState();
        }
        closeMenu();
    }

    function closeMenu(): void {
        contextualMenu!.style.display = "none";
        contextualMenu!.opened = false;
        menuStates.chosingPoint = false;
        menuStates.pointSelected = false;
        menuStates.addingLabel = false;
        menuStates.addingLink = false;
        menuStates.pathSelected = false;
        menuStates.freehandSelected = false;
        menuStates.addingImageToPath = false;
        menuStates.addingAnnotation = false;
        genericSelectedId = null;
    }

    function beginAddAnnotation(elemId: string, type: "tooltip" | "popover"): void {
        annotationEditingElemId = elemId;
        annotationEditingType = type;
        const existing = commonState.elementAnnotations?.[elemId];
        const existingHtml = type === "tooltip" ? existing?.tooltip : existing?.popover;
        if (existingHtml) {
            const tmp = new DOMParser().parseFromString(existingHtml, "text/html").body
                .firstElementChild as HTMLElement | null;
            annotationEditorContent = tmp?.innerHTML ?? existingHtml;
        } else {
            annotationEditorContent = "";
        }
        annotationEditorOpen = true;
        closeMenu();
    }

    function initAnnotationEditor(): void {
        if (!annotationPreviewEl) return;
        const existing = annotationEditingElemId ? commonState.elementAnnotations?.[annotationEditingElemId] : null;
        const existingHtml = annotationEditingType === "tooltip" ? existing?.tooltip : existing?.popover;
        if (existingHtml) {
            const tmp = new DOMParser().parseFromString(existingHtml, "text/html").body
                .firstElementChild as HTMLElement | null;
            annotationPreviewEl.style.cssText = tmp?.style.cssText ?? "";
        } else {
            annotationPreviewEl.style.cssText =
                "background-color:white;padding:4px 8px;border-radius:4px;font-size:0.82rem;max-width:15rem;width:max-content;";
        }
        annotationQuillEditor?.focus();
    }

    function saveAnnotation(): void {
        if (!annotationEditingElemId) return;
        if (!commonState.elementAnnotations) commonState.elementAnnotations = {};
        const styleStr = annotationPreviewEl?.style.cssText ?? "";
        const innerHtml = annotationPreviewEl?.innerHTML ?? annotationEditorContent;
        const html = `<div style="${styleStr}">${innerHtml}</div>`;
        const entry = commonState.elementAnnotations[annotationEditingElemId] ?? {};
        if (annotationEditingType === "tooltip") {
            entry.tooltip = html;
        } else {
            entry.popover = html;
            // Apply cursor:pointer immediately without needing a full redraw
            const svgEl = svg.node() as SVGSVGElement | null;
            const el = svgEl?.getElementById(annotationEditingElemId);
            if (el) (el as SVGElement).style.cursor = "pointer";
        }
        commonState.elementAnnotations[annotationEditingElemId] = entry;
        saveState();
    }

    function removeAnnotation(elemId: string, type: "tooltip" | "popover"): void {
        const entry = commonState.elementAnnotations?.[elemId];
        if (!entry) return;
        delete entry[type];
        if (!entry.tooltip && !entry.popover) {
            delete commonState.elementAnnotations![elemId];
        }
        if (type === "popover") hidePopover();
        saveState();
    }

    function openAnnotationStyleEditor(e: MouseEvent): void {
        if (!annotationPreviewEl) return;
        styleEditor!.open(e.target as HTMLElement, e.pageX, e.pageY);
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
            const labelId = `label-${commonState.shapeCount++}`;
            commonState.providedShapes.push({
                pos: openContextMenuInfo.position,
                scale: 1,
                id: labelId,
                text: typedText,
            });
            commonState.inlineStyles[labelId] = { ...commonState.lastUsedLabelProps };
            typedText = "";
        }
        drawAndSetupShapes();
        closeMenu();
    }

    function setupLabelOverlayCallbacks(labelId: string, labelIndex: number): void {
        getOverlay()?.setCallbacks({
            onDragConfirmed: () => labelEditor?.exit(),
            onSimpleClick: () => {
                if (labelEditor?.isEditing()) return; // already in edit mode
                const svgText = document.getElementById(labelId) as SVGTextElement | null;
                if (svgText) labelEditor?.enter(labelId, labelIndex, svgText);
            },
        });
    }

    function onLabelCommit(entityIndex: number, newText: string): void {
        commonState.providedShapes[entityIndex].text = newText;
        drawAndSetupShapes();
        refreshOverlay(); // re-point overlay to the newly created DOM element
        const shape = commonState.providedShapes[entityIndex];
        if (shape) setupLabelOverlayCallbacks(shape.id, entityIndex);
        saveState();
    }

    function onLabelCancel(): void {
        // Nothing to do; LabelEditor.exit() already restored SVG text visibility
    }

    function drawAndSetupShapes(): void {
        const container = document.getElementById("points-labels");
        if (!container) return;
        select(container).attr("clip-path", "url(#clipMapBorder)");
        drawShapes(commonState.providedShapes, container, appState.projection!, commonState.elementLinks ?? {});
        select(container).on(
            "contextmenu",
            function (e) {
                e.stopPropagation();
                e.preventDefault();
                // Track which shape was right-clicked
                let el = e.target as Element;
                if (el.tagName === "tspan") el = el.parentElement!;
                while (el && el !== container) {
                    const id = el.getAttribute("id");
                    if (id && commonState.providedShapes.some((s) => s.id === id)) {
                        selectedShapeId = id;
                        break;
                    }
                    el = el.parentElement!;
                }
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
        const lastPoint = [...commonState.providedShapes]
            .reverse()
            .find((s) => s.name !== undefined || s.customImage !== undefined);
        commonState.providedShapes.push({
            name: shapeName,
            pos: openContextMenuInfo.position,
            scale: 1,
            id: shapeId,
        });
        if (lastPoint && commonState.inlineStyles[lastPoint.id]) {
            commonState.inlineStyles[shapeId] = { ...commonState.inlineStyles[lastPoint.id] };
        }
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

    function startImportCustomImageShape(): void {
        closeMenu();
        customImageInput!.click();
    }

    function onCustomImageShapeSelected(e: Event): void {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            const shapeId = `custom-image-${commonState.shapeCount++}`;
            const lastPoint = [...commonState.providedShapes]
                .reverse()
                .find((s) => s.name !== undefined || s.customImage !== undefined);
            commonState.providedShapes.push({
                id: shapeId,
                pos: openContextMenuInfo.position,
                scale: 1,
                customImage: {
                    name: file.name,
                    content: reader.result as string,
                    width: 30,
                    height: 40,
                },
            });
            drawAndSetupShapes();
            closeMenu();
            saveState();
        });
        reader.readAsDataURL(file);
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

    function validateExport(options: ExportOptions): void {
        if (commonState.currentMode === "macro") {
            const totalCss = macroSidebar!.computeCss();
            exportMacro(
                svg,
                macroState,
                commonState.providedFonts,
                true,
                totalCss,
                options,
                commonState.elementAnnotations,
            );
        } else {
            const microCss = exportStyleSheet("#micro .line")!;
            exportMicro(
                svg,
                microState,
                commonState.providedFonts,
                microCss,
                options,
                true,
                commonState.elementAnnotations,
            );
        }
        showExportConfirm = false;
    }

    let inlineFontUsed = $state(false);
    function openExportModal() {
        const usedFonts = getUsedInlineFonts(svg.node()!);
        const usedProvidedFonts = commonState.providedFonts.filter((font) => usedFonts.has(font.name));
        inlineFontUsed = usedProvidedFonts.length > 0;
        showExportConfirm = true;
    }

    function onExportSvgClicked() {
        hidePopover();
        closeMenu();
        stopDrawFreeHand();
        cancelDrawPath();
        styleEditor?.close();

        if (currentUser) {
            openExportModal();
        } else {
            authAfterCallback = openExportModal;
            showAuthModal = true;
        }
    }

    function getProjectJson(): string {
        const baseCss = exportStyleSheet("#outline")!;
        macroState.baseCss = baseCss;
        return JSON.stringify({ stateCommon: commonState, stateMacro: macroState, stateMicro: microState });
    }
</script>

<svelte:head>
    {@html `<${""}style> ${commonCss} </${""}style>`}
    {@html `<${""}style> ${cssFonts} .test {} </${""}style>`}
</svelte:head>

<LabelEditor
    bind:this={labelEditor}
    onCommit={onLabelCommit}
    onCancel={onLabelCancel}
    onStyleEdit={(id, x, y) => {
        const el = document.getElementById(id);
        if (el) styleEditor!.open(el as HTMLElement, x, y);
    }}
/>

<div id="contextmenu" class="border rounded" bind:this={contextualMenu} class:hidden={!contextualMenu?.opened}>
    {#snippet linkMenuItem(elemId: string)}
        {#if !commonState.elementAnnotations?.[elemId]?.popover}
            {#if commonState.elementLinks?.[elemId]}
                <div class="px-2 pt-1 menu-link-url">
                    <small class="text-muted text-truncate d-block">{commonState.elementLinks[elemId]}</small>
                </div>
                <div class="menu-link-item d-flex align-items-center px-2 py-1">
                    <span role="button" class="flex-grow-1" onclick={() => beginAddLink(elemId)}>Edit link</span>
                    <span
                        role="button"
                        class="ms-2 text-danger menu-link-remove"
                        title="Remove link"
                        onclick={() => removeLink(elemId)}>×</span
                    >
                </div>
            {:else}
                <div role="button" class="px-2 py-1" onclick={() => beginAddLink(elemId)}>Add link</div>
            {/if}
        {/if}
    {/snippet}
    {#snippet annotationMenuItem(elemId: string)}
        {@const ann = commonState.elementAnnotations?.[elemId]}
        {#if ann?.tooltip}
            <div class="px-2 pt-1 menu-ann-preview">
                <small class="text-muted d-block text-truncate">{@html ann.tooltip}</small>
            </div>
            <div class="menu-ann-item d-flex align-items-center px-2 py-1">
                <span role="button" class="flex-grow-1" onclick={() => beginAddAnnotation(elemId, "tooltip")}
                    >Edit tooltip</span
                >
                <span
                    role="button"
                    class="ms-2 text-danger menu-ann-remove"
                    title="Remove tooltip"
                    onclick={() => removeAnnotation(elemId, "tooltip")}>×</span
                >
            </div>
        {:else}
            <div role="button" class="px-2 py-1" onclick={() => beginAddAnnotation(elemId, "tooltip")}>Add tooltip</div>
        {/if}
        {#if !commonState.elementLinks?.[elemId]}
            {#if ann?.popover}
                <div class="px-2 pt-1 menu-ann-preview">
                    <small class="text-muted d-block text-truncate">{@html ann.popover}</small>
                </div>
                <div class="menu-ann-item d-flex align-items-center px-2 py-1">
                    <span role="button" class="flex-grow-1" onclick={() => beginAddAnnotation(elemId, "popover")}
                        >Edit popover</span
                    >
                    <span
                        role="button"
                        class="ms-2 text-danger menu-ann-remove"
                        title="Remove popover"
                        onclick={() => removeAnnotation(elemId, "popover")}>×</span
                    >
                </div>
            {:else}
                <div role="button" class="px-2 py-1" onclick={() => beginAddAnnotation(elemId, "popover")}>
                    Add popover
                </div>
            {/if}
        {/if}
    {/snippet}
    {#if menuStates.chosingPoint}
        {#each Object.entries(shapes) as [shapeName, shapeSvg] (shapeName)}
            <div
                role="button"
                class="px-2 py-1 d-flex align-items-center gap-2"
                onclick={() => addShape(shapeName as ShapeName)}
            >
                <svg width="20" height="20" viewBox={shapeViewBoxes[shapeName]}>
                    {@html shapeSvg}
                </svg>
                {shapeName}
            </div>
        {/each}
        <div role="button" class="px-2 py-1" onclick={startImportCustomImageShape}>Custom image…</div>
    {:else if menuStates.addingLabel}
        <textarea bind:this={textInput} bind:value={typedText}> </textarea>
    {:else if menuStates.pointSelected}
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit styles</div>
        <div role="button" class="px-2 py-1" onclick={copySelection}>Copy</div>
        {@render linkMenuItem(selectedShapeId!)}
        {@render annotationMenuItem(selectedShapeId!)}
        <div role="button" class="px-2 py-1" onclick={deleteSelection}>Delete</div>
    {:else if menuStates.pathSelected}
        <div role="button" class="px-2 py-1" onclick={editPath}>Edit curve</div>
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit style</div>
        {@render linkMenuItem(`path-${selectedPathIndex}`)}
        {@render annotationMenuItem(`path-${selectedPathIndex}`)}
        <div role="button" class="px-2 py-1" onclick={deletePath}>Delete curve</div>
        <div role="button" class="px-2 py-1" onclick={addImageToPath}>Image along curve</div>
        <div role="button" class="px-2 py-1" onclick={choseMarker}>Chose curve marker</div>
    {:else if menuStates.freehandSelected}
        <div role="button" class="px-2 py-1" onclick={editStyles}>Edit style</div>
        {@render linkMenuItem(`freehand-${selectedFreehandIndex}`)}
        {@render annotationMenuItem(`freehand-${selectedFreehandIndex}`)}
        <div role="button" class="px-2 py-1" onclick={deleteFreehand}>Delete drawing</div>
    {:else if menuStates.addingLink}
        <div class="px-2 py-1">
            <input
                bind:this={linkInput}
                type="text"
                class="form-control form-control-sm"
                placeholder="https://..."
                bind:value={linkInputValue}
                onblur={validateLink}
            />
        </div>
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
        {#if genericSelectedId}
            {@render linkMenuItem(genericSelectedId!)}
            {@render annotationMenuItem(genericSelectedId!)}
        {/if}
        <hr class="my-1 menu-divider" />
        <div role="button" class="px-2 py-1" onclick={addPath}>Draw curve</div>
        <div role="button" class="px-2 py-1" onclick={drawFreeHand}>Draw freehand</div>
        <div role="button" class="px-2 py-1" onclick={addPoint}>Add point</div>
        <div role="button" class="px-2 py-1" onclick={addLabel}>Add label</div>
    {/if}
</div>

<Modal
    bind:open={annotationEditorOpen}
    modalWidth="55%"
    onOpened={initAnnotationEditor}
    onClosed={() => {
        saveAnnotation();
        annotationEditorOpen = false;
        annotationEditingElemId = null;
        styleEditor?.close();
    }}
>
    <div slot="header">
        {annotationEditingType === "tooltip" ? "Tooltip" : "Popover"} for <code>{annotationEditingElemId}</code>
    </div>
    <div slot="content">
        <div class="d-flex gap-3">
            <div class="flex-grow-1" style="min-width: 0;">
                <QuillEditor bind:this={annotationQuillEditor} bind:value={annotationEditorContent} placeholder="" />
            </div>
            <div class="flex-shrink-0" style="width: 40%;">
                <p class="text-muted small mb-1">
                    Preview <span class="text-muted" style="font-size: 0.7rem;">(click to style)</span>
                </p>
                <div
                    class="elem-annotation-preview"
                    bind:this={annotationPreviewEl}
                    onclick={openAnnotationStyleEditor}
                >
                    {@html annotationEditorContent}
                </div>
            </div>
        </div>
    </div>
    <div slot="footer">
        <button class="btn btn-primary btn-sm" onclick={() => (annotationEditorOpen = false)}>Save</button>
    </div>
</Modal>

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
            <div class="mode-selection" role="group">
                <input
                    type="radio"
                    class="btn-check"
                    name="mainModeSwitch"
                    id="switchMacro"
                    onchange={(e) => switchMode(e.currentTarget.value as Mode)}
                    value="macro"
                    autocomplete="off"
                />
                <label class="mode-btn" for="switchMacro" class:active={commonState.currentMode === "macro"}>
                    <img src={macroImg} width="22" height="22" />
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
                <label class="mode-btn" for="switchMicro" class:active={commonState.currentMode === "micro"}>
                    Detailed
                    <img src={microImg} width="22" height="22" />
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
            <div class="d-flex justify-content-center align-items-center gap-2">
                <div>
                    <FontPicker
                        onFontSelected={handleFontSelected}
                        existingFontNames={commonState.providedFonts.map((f) => f.name)}
                    />
                </div>
                {#if currentUser}
                    <ProjectDropdown
                        bind:currentProjectName
                        bind:currentProjectId={activeProjectId}
                        {getProjectJson}
                        applyState={async (state) => {
                            await applyState(state);
                            if (commonState.currentMode === 'macro') macroSidebar!.applyStateAndDraw();
                        }}
                    />
                {:else}
                    <span class="project-name-label">{currentProjectName}</span>
                    <button class="navbar-btn" type="button" onclick={handleReset}>
                        Reset
                    </button>
                {/if}
                <div>
                    <button class="navbar-btn navbar-btn-cta" type="button" onclick={onExportSvgClicked}>
                        <Icon fillColor="none" svg={icons["download"]} /> Export
                    </button>
                </div>
                <Examples on:example={loadExample} />
                {#if currentUser}
                    <span class="navbar-user-email">{currentUser.email}</span>
                    <button class="navbar-btn" type="button" onclick={async () => { await signOut(); invalidateAll(); }}>
                        Sign out
                    </button>
                {:else}
                    <button class="navbar-btn" type="button" onclick={() => { authAfterCallback = undefined; showAuthModal = true; }}>
                        Sign in
                    </button>
                {/if}
            </div>
        </Navbar>
        <div class="d-flex flex-column justify-content-center align-items-center h-100">
            {#if commonState.currentMode === "micro"}
                <div class="micro-top mb-4 mx-auto d-flex align-items-center justify-content-between">
                    <Geocoding onPlaceSelected={(res) => microSidebar!.onPlaceSelected(res)}></Geocoding>
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
        </div>
    </div>
</div>
<input
    type="file"
    bind:this={customImageInput}
    accept=".png,.jpg,.svg"
    style="display:none"
    onchange={onCustomImageShapeSelected}
/>
<!-- <Modal open={showModal} onClosed={() => onModalClose()}>
    <DataTable slot="content" data={zonesData?.[currentMacroLayerTab]?.["data"]}></DataTable>
</Modal> -->

<ExportModal
    bind:open={showExportConfirm}
    mode={commonState.currentMode}
    svgNode={svg}
    {inlineFontUsed}
    computeMacroCss={() => macroSidebar!.computeCss()}
    onExport={validateExport}
    onClosed={() => (showExportConfirm = false)}
/>

<AuthModal
    bind:open={showAuthModal}
    afterAuth={authAfterCallback}
/>

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

    #main-panel > .mode-selection {
        display: inline-flex;
        margin-bottom: 20px;
        background: #dce6f5;
        border-radius: 100px;
        padding: 3px;
        gap: 2px;

        .mode-btn {
            padding: 6px 18px;
            border: none;
            border-radius: 100px;
            font-size: 14px;
            font-weight: 500;
            color: #506784;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 7px;
            transition:
                background 0.18s ease,
                color 0.18s ease,
                box-shadow 0.18s ease;

            img {
                border-radius: 3px;
                opacity: 0.6;
                transition: opacity 0.18s;
            }

            &.active {
                background: white;
                color: #2a3d5c;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
                img {
                    opacity: 1;
                }
            }
        }

        .btn-check:checked + .mode-btn {
            background: white;
            color: #2a3d5c;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
            img {
                opacity: 1;
            }
        }
    }

    #map-container {
        margin: 0 auto;
        flex: 0 0 auto;
        position: relative;
        z-index: 1;
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

    .project-name-label {
        font-size: 0.9rem;
        font-weight: 500;
        color: #3a4a63;
        padding: 0 4px;
    }

    .navbar-user-email {
        font-size: 0.85rem;
        color: #6c757d;
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
