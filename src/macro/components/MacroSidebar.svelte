<script lang="ts">
    import { onMount, tick } from "svelte";
    import Accordions from "../../components/Accordions.svelte";
    import {
        download,
        formatUnicorn,
        getBestFormatter,
        getColumns,
        getNumericCols,
        htmlToElement,
        initTooltips,
    } from "../../util/common";
    import { applyStyles, DOM_PARSER, exportStyleSheet, reportStyle } from "../../util/dom";
    import { helpParams, noSatelliteParams, type OtherParams, type ParamDefinitions } from "../../params";
    import { appState, commonState, macroState } from "../../state.svelte";
    import Icon from "../../components/Icon.svelte";
    import { icons } from "../../shared/icons";
    import { allAvailableAdm, geometriesState, initWorldData, updateLayerSimplification } from "../geometry-data";
    import RangeInput from "src/components/RangeInput.svelte";
    import ColorPickerPreview from "src/components/ColorPickerPreview.svelte";
    import type {
        Color,
        ColorDef,
        ColorScale,
        FormatterObject,
        LegendColor,
        OrdinalMapping,
        SvgGSelection,
        SvgSelection,
        ZoneData,
        ZoneDataRow,
    } from "src/types";
    import { color as d3Color } from "d3-color";
    import { paramDefs } from "../../params";

    import { saveState } from "src/util/save";
    import DataTable from "src/components/DataTable.svelte";
    import { defaultState, defaultTooltipStyle } from "src/stateDefaults";
    import type InlineStyleEditor from "inline-style-editor";
    import Legend from "src/components/Legend.svelte";
    import { select } from "d3-selection";
    import { scaleLinear, scalePow, scaleOrdinal, scaleQuantize, scaleQuantile } from "d3-scale";

    import {
        CATEGORICAL_SCHEMES,
        CONTINUOUS_SCHEMES,
        type AnyScaleKey,
        type CategoricalScaleKey,
        type ContinuousScaleKey,
    } from "src/util/color-scales";
    import { drawLegend } from "src/svg/legend";
    import { debounce } from "lodash-es";
    import { extent } from "d3";
    import { transitionCssMacro } from "src/svg/transition";
    import dataExplanation from "../../assets/dataColor.svg";
    import { applyInlineStyles, drawMacroTotal, handleChangeProp, projectAndDraw } from "../drawing";
    import { appendCountryImageNew } from "src/svg/contourMethods";
    import { dragged, zoomed } from "../interactions";
    import Modal from "src/components/Modal.svelte";
    import PaletteEditor from "src/components/PaletteEditor.svelte";

    const scalesHelp: string = `
<div class="inline-tooltip">  
    <p> 
        <i> Quantiles </i> separate a population into intervals of similar sizes (the 10% poorest, the 50% tallest, the 1% richest…). It is defined by the data itself (a set of values).
         <br/>
        To <i> quantize </i> means to group values with discrete increments. It is defined by the extent (min/max) of the data.
        </p> 
    <img src=${dataExplanation} width="460" height="60"> <br/>
    Those scales are only available when numeric data is associated with the layer. 
</div>
`;

    const resolvedLocales = import.meta.glob<d3.FormatLocaleDefinition>("../node_modules/d3-format/locale/*.json", {
        eager: true,
        import: "default",
    });
    Object.keys(resolvedLocales).forEach((localeFileName) => {
        const name = localeFileName.match(/\w+/)![0]; // remove extension
        icons[name] = icons[localeFileName];
        delete icons[localeFileName];
    });

    let mainMenuSelection = $state<string>("general");
    let hoveringTab = $state<number>(-1);
    let dragStartIndex = $state<number>(-1);
    let currentMacroLayerTab = $state<string>("land");
    let currentTemplateHasNumeric = $state<boolean>(false);
    let showModal = $state<boolean>(false);
    let templateErrorMessages = $state<Record<string, boolean>>({});
    let commonCss = $state<string | undefined>();
    let availableColumns = $state<string[]>([]);
    let availablePalettes = $state<string[]>([]);
    let showCustomPalette = $state<boolean>(false);
    let htmlTooltipElem = $state<HTMLElement | null>(null);
    let legendSample: SVGGElement | null = $state(null);
    $effect(() => {
        const _ = mainMenuSelection;
        initTooltips();
    });

    // This contains the common CSS that can be edited with inline-css-editor
    // we also have a special svelte:head element containing all CSS that is not in baseCss (border style, legend colors, etc.)
    let totalCommonCss: string;

    let computedOrderedTabs = $derived(
        macroState.orderedTabs.filter((x) => {
            if (x === "countries") return macroState.inlinePropsMacro.showCountries;
            if (x === "land") return macroState.inlinePropsMacro.showLand;
            return true;
        }),
    );
    let curDataDefs = $derived(macroState.colorDataDefs[currentMacroLayerTab]);
    let currentIsColorByNumeric = $derived(["quantile", "quantize"].includes(curDataDefs?.colorScale));
    let availableColorTypes = $derived(
        macroState.zonesData[currentMacroLayerTab]?.numericCols?.length
            ? ["category", "quantile", "quantize"]
            : ["category"],
    );
    let accordionVisiblityParams = $derived(
        macroState.macroParams.General.projection !== "satellite" ? noSatelliteParams : {},
    );

    interface Props {
        // handleChangeProp: (event: CustomEvent<{ prop: string; value: unknown }>) => void;
        // paramDefs: ParamDefinitions;
        // inlinePropsMacro: Record<string, any>;
        // onChange: (changedProp: string) => void;
        styleEditor: InlineStyleEditor | null;
        svg: SvgSelection;
        draw: (simplified?: boolean) => void;
    }

    let { styleEditor, svg, draw }: Props = $props();

    onMount(() => {
        console.log("onmount");
        initWorldData().then(() => {
            draw();
        });
    });

    export function applyStateAndDraw(simplified = false) {
        projectAndDraw(svg, simplified);
    }

    export function onZoom(e: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
        zoomed(e);
        handleChangeProp("altitude");
        drawSimplifyThenReal();
    }

    export function onDrag(e: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) {
        dragged(e);
        handleChangeProp("longitude");
        drawSimplifyThenReal();
    }

    export function onStyleChanged(
        target: HTMLElement,
        eventType: "inline" | CSSStyleRule,
        cssProp: string,
        value: string,
    ): void {
        const elemId = target.getAttribute("id")!;
        const eventAsRule = eventType as CSSStyleRule;
        /**
         * Due to a Firefox bug (the :hover selector is not applied when we move the DOM node when hovering a polygon)
         * we need to apply the :hover style to a custom class selector .hovered, that will be applied programatically
         */
        if (eventAsRule.selectorText?.includes?.(":hover")) {
            const selectorTextToModify = eventAsRule.selectorText.replace(":hover", ".hovered");
            const rule = Array.from(eventAsRule.parentStyleSheet!.cssRules)
                .filter((r) => r instanceof CSSStyleRule)
                .find((r: CSSStyleRule) => r.selectorText === selectorTextToModify);
            if (rule) {
                for (const propName of eventAsRule.style) {
                    rule.style.setProperty(propName, eventAsRule.style.getPropertyValue(propName));
                }
            }
        }

        if (legendSample && legendSample.contains(target) && cssProp !== "fill") {
            macroState.legendDefs[currentMacroLayerTab].sampleHtml = legendSample.outerHTML;
            colorizeAndLegend(svg);
        } else if (htmlTooltipElem && htmlTooltipElem.contains(target)) {
            macroState.tooltipDefs[currentMacroLayerTab].content = htmlTooltipElem.outerHTML;
        } else if (eventType === "inline") {
            if (target.hasAttribute("id")) {
                handleInlineStyleChange(elemId, target, cssProp, value);
            }
        }
        /** Update <image> tag corresponding to changed element */
        if (
            (eventType === "inline" && target.classList.contains("country")) ||
            eventAsRule?.selectorText === ".country"
        ) {
            computedOrderedTabs.forEach((tab) => {
                if (tab.substring(0, tab.length - 5) !== elemId) return;
                const filter = macroState.zonesFilter[tab];
                const countryData = geometriesState.countries.features.find(
                    (country) => country.properties?.name === elemId,
                )!;
                appendCountryImageNew.call(
                    select(`[id='${elemId}-img']`).node() as SVGGElement,
                    countryData,
                    filter,
                    applyInlineStyles,
                    appState.path!,
                    commonState.inlineStyles,
                    false,
                    true,
                );
                svg.selectAll("g[image-class]").classed("hidden-after", true);
            });
        }
        commonState.baseCss = exportStyleSheet("#outline")!;
        saveState();
    }

    let drawTimeoutId: number;
    function drawSimplifyThenReal(): void {
        draw(true);
        clearTimeout(drawTimeoutId);
        drawTimeoutId = setTimeout(() => {
            draw(false);
        }, 500);
    }

    function handleInlineStyleChange(elemId: string, target: HTMLElement, cssProp: string, value: string): void {
        if (elemId.includes("label")) {
            commonState.lastUsedLabelProps[cssProp] = value;
        }
        if (elemId in commonState.inlineStyles) commonState.inlineStyles[elemId][cssProp] = value;
        else commonState.inlineStyles[elemId] = { [cssProp]: value };
        // update path markers
        if (cssProp === "stroke" && target.hasAttribute("marker-end")) {
            const markerId = target.getAttribute("marker-end")?.match(/url\(#(.*)\)/)?.[1];
            if (!markerId) return;
            const newMarkerId = `${markerId.split("-")[0]}-${value.substring(1)}`;
            select(`#${markerId}`).attr("fill", value).attr("id", newMarkerId);
            select(target).attr("marker-end", `url(#${newMarkerId})`);
        }
    }

    const saveDebounced = debounce(saveState, 200);
    function editTooltip(e: MouseEvent): void {
        let target: HTMLElement = e.target as HTMLElement;
        if (target.classList.contains("tooltip-preview")) target = target.firstElementChild! as HTMLElement;
        const rect = (target as HTMLElement).getBoundingClientRect();
        styleEditor!.open(target as HTMLElement, rect.right, rect.bottom);
    }

    function openEditor(e: MouseEvent): void {
        styleEditor!.open(e.target as HTMLElement, e.pageX, e.pageY);
    }

    function applyStylesToTemplate(): void {
        if (htmlTooltipElem && macroState.tooltipDefs[currentMacroLayerTab]?.enabled) {
            const tmpElem = htmlToElement(macroState.tooltipDefs[currentMacroLayerTab].content!)!;
            reportStyle(tmpElem, htmlTooltipElem);
        }
        if (legendSample && macroState.colorDataDefs[currentMacroLayerTab]?.legendEnabled) {
            const tmpElem = htmlToElement(macroState.legendDefs[currentMacroLayerTab].sampleHtml!)!;
            reportStyle(tmpElem, legendSample);
        }
    }

    async function onTabChanged(newTabTitle: string): Promise<void> {
        currentMacroLayerTab = newTabTitle;
        currentTemplateHasNumeric = templateHasNumeric(currentMacroLayerTab) === true;
        await tick();
        initTooltips();
        applyStylesToTemplate();
        autoSelectColors();
    }

    function templateHasNumeric(layerName: string): boolean {
        const toFind = macroState.zonesData[layerName]?.numericCols.map((colDef) => `{${colDef.column}}`);
        const template = macroState.tooltipDefs[layerName]?.template;
        return toFind?.some((str) => template.includes(str));
    }

    function drop(event: DragEvent, target: number): void {
        event.dataTransfer!.dropEffect = "move";
        const newList = macroState.orderedTabs;

        if (dragStartIndex < target) {
            newList.splice(target + 1, 0, newList[dragStartIndex]);
            newList.splice(dragStartIndex, 1);
        } else {
            newList.splice(target, 0, newList[dragStartIndex]);
            newList.splice(dragStartIndex + 1, 1);
        }
        macroState.orderedTabs = newList;
        hoveringTab = -1;
        drawMacroTotal(svg);
    }

    function tabDragStart(event: DragEvent, i: number, prevent = false): void {
        if (prevent) {
            return event.preventDefault();
        }
        event.dataTransfer!.effectAllowed = "move";
        event.dataTransfer!.dropEffect = "move";
        dragStartIndex = i;
    }

    function deleteCountry(country: string, drawAfter = true): void {
        macroState.chosenCountriesAdm = macroState.chosenCountriesAdm.filter((x) => x !== country);
        macroState.orderedTabs = macroState.orderedTabs.filter((x) => x !== country);
        currentMacroLayerTab = macroState.orderedTabs[0];
        delete macroState.tooltipDefs[country];
        delete macroState.legendDefs[country];
        delete macroState.colorDataDefs[country];
        delete macroState.zonesData[country];
        if (drawAfter) drawMacroTotal(svg);
    }

    async function addNewCountry(e: Event): Promise<void> {
        const target = e.target as HTMLSelectElement;
        const newLayerName = target.value;
        if (macroState.chosenCountriesAdm.includes(newLayerName)) return;
        let searchedAdm;
        if (newLayerName.slice(-1) === "1") searchedAdm = newLayerName.replace("ADM1", "ADM2");
        else searchedAdm = newLayerName.replace("ADM2", "ADM1");
        const existingIndex = macroState.chosenCountriesAdm.indexOf(searchedAdm);
        if (existingIndex > -1) {
            deleteCountry(searchedAdm, false);
            return;
        }
        macroState.chosenCountriesAdm.push(newLayerName);
        macroState.orderedTabs.push(newLayerName);
        target.selectedIndex = 0;
        await drawMacroTotal(svg);
        onTabChanged(newLayerName);
    }

    function getZonesDataFormatters(): void {
        Object.entries(macroState.zonesData).forEach(([name, def]) => {
            const locale = macroState.tooltipDefs[name].locale;
            const formatters: FormatterObject = {};
            if (def.numericCols.length) {
                def.numericCols.forEach((colDef) => {
                    const col = colDef.column;
                    formatters[col] = getBestFormatter(
                        def.data.map((row) => row[col] as number),
                        resolvedLocales[locale],
                    );
                });
            }
            macroState.zonesData[name].formatters = formatters;
        });
    }

    function handleDataImport(e: Event): void {
        const file = (e.target as HTMLInputElement).files![0];
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            try {
                let parsed = JSON.parse(reader.result as string);
                const currentNames = new Set<string | undefined>(
                    macroState.zonesData[currentMacroLayerTab].data.map((line) => line.name),
                );
                currentNames.delete(undefined);
                if (!Array.isArray(parsed)) {
                    return window.alert("JSON should be a list of objects, each object reprensenting a line.");
                }
                const noNameLinesMsg = parsed.reduce((errorMsg, entry, index) => {
                    if (entry.name === undefined) {
                        errorMsg += `Entry ${index} is ${JSON.stringify(entry)} \n`;
                    }
                    return errorMsg;
                }, "");
                if (parsed.some((line) => line.name === undefined)) {
                    return window.alert(`All lines should have a 'name' property \n${noNameLinesMsg}`);
                }
                const newNames = new Set(parsed.map((line) => line.name));
                const difference = new Set([...currentNames].filter((x) => !newNames.has(x)));
                if (difference.size) {
                    return window.alert(`Missing names ${[...difference]}`);
                }
                macroState.zonesData[currentMacroLayerTab] = {
                    data: parsed,
                    provided: true,
                    numericCols: getNumericCols(parsed),
                };
                getZonesDataFormatters();
                autoSelectColors();
                saveState();
            } catch (e) {
                console.log("Parse error:", e);
                window.alert("Provided file should be valid JSON.");
            }
        });
        reader.readAsText(file);
    }

    function exportJson(data: any): void {
        download(JSON.stringify(data, null, "\t"), "text/json", "data.json");
    }

    function changeNumericFormatter(): void {
        getZonesDataFormatters();
        colorizeAndLegend(svg);
    }

    function getFirstDataRow(zonesDataDef: ZoneData): ZoneDataRow | null {
        if (!macroState.zonesData) return null;
        const row = { ...zonesDataDef.data[0] };
        zonesDataDef.numericCols.forEach((colDef) => {
            const col = colDef.column;
            row[col] = zonesDataDef.formatters![col](row[col] as number);
        });
        return row;
    }

    function onTemplateChange(): void {
        const parsed = DOM_PARSER.parseFromString(
            macroState.tooltipDefs[currentMacroLayerTab].template,
            "application/xml",
        );
        const errorNode = parsed.querySelector("parsererror");
        if (errorNode) {
            templateErrorMessages[currentMacroLayerTab] = true;
        } else {
            macroState.tooltipDefs[currentMacroLayerTab].content = htmlTooltipElem!.outerHTML;
            currentTemplateHasNumeric = templateHasNumeric(currentMacroLayerTab);
            delete templateErrorMessages[currentMacroLayerTab];
        }
        saveState();
    }

    const colorsCssByTab: Record<string, string> = {};
    const displayedLegend: Record<string, SvgGSelection> = {};
    const ordinalMapping: OrdinalMapping = $state({});
    let sampleLegend = $state({
        color: "black",
        text: "test",
    });

    function computeCss(): void {
        const width = macroState.macroParams.General.width;
        const height = macroState.macroParams.General.height;
        const borderRadius = macroState.macroParams.Border.borderRadius;
        const finalColorsCss = Object.values(colorsCssByTab).reduce((acc, cur) => {
            acc += cur;
            return acc;
        }, "");
        const wantedRadiusInPx = Math.max(width, height) * (borderRadius / 100);
        const radiusX = Math.round(Math.min((wantedRadiusInPx * 100) / width, 50));
        const radiusY = Math.round(Math.min((wantedRadiusInPx * 100) / height, 50));
        let borderCss = `
    #static-svg-map {
        ${macroState.macroParams.Border.frameShadow ? "filter: drop-shadow(2px 2px 8px rgba(0,0,0,.2));" : ""}
    }`;

        borderCss += `#static-svg-map, #static-svg-map > svg {
            border-radius: ${radiusX}%/${radiusY}%;
        }`;
        commonCss = finalColorsCss + borderCss;
        if (macroState.macroParams.General.animate) commonCss += transitionCssMacro;
        // const style = exportStyleSheet("#outline");
        totalCommonCss = commonState.baseCss + commonCss;
    }

    function autoSelectColors() {
        console.log("autoSelectColors");
        if (!macroState.zonesData[currentMacroLayerTab]) return;
        if (curDataDefs.colorScale === null) {
            if (curDataDefs.colorColumn !== null) {
                if (
                    macroState.zonesData[currentMacroLayerTab].numericCols.find(
                        (x) => x.column === curDataDefs.colorColumn,
                    )
                ) {
                    curDataDefs.colorScale = "quantile";
                } else curDataDefs.colorScale = "category";
            } else curDataDefs.colorScale = "category";
        }
        availableColumns =
            curDataDefs.colorScale === "category"
                ? getColumns(macroState.zonesData[currentMacroLayerTab].data)
                : macroState.zonesData?.[currentMacroLayerTab]?.numericCols.map((x) => x.column);
        availablePalettes =
            curDataDefs.colorScale === "category" ? Object.keys(CATEGORICAL_SCHEMES) : Object.keys(CONTINUOUS_SCHEMES);
        if (!availableColumns.includes(curDataDefs.colorColumn)) {
            curDataDefs.colorColumn = availableColumns[0];
        }
        if (!availablePalettes.includes(curDataDefs.colorPalette!))
            curDataDefs.colorPalette = availablePalettes[0] as AnyScaleKey;
        if (svg) colorizeAndLegend(svg);
    }

    async function colorizeAndLegend(svg: SvgSelection): Promise<void> {
        console.log("colorizeAndLegend");
        await tick();
        initTooltips();
        const legendEntries = select("#svg-map-legend");
        if (!legendEntries.empty()) legendEntries.remove();
        const legendSelection = svg.select("svg").append("g").attr("id", "svg-map-legend") as SvgGSelection;
        Object.entries(macroState.colorDataDefs).forEach(([tab, dataColorDef], tabIndex) => {
            if (!macroState.zonesData[tab]) return;
            if (!macroState.legendDefs[tab].noData.manual) macroState.legendDefs[tab].noData.active = false;
            // reset present classes
            document.querySelectorAll(`g[id="${tab}"] [class*="ssc"]`).forEach((el) => {
                [...el.classList].forEach((cls) => {
                    if (cls.includes("ssc")) el.classList.remove(cls);
                });
            });
            if (!dataColorDef.enabled) {
                dataColorDef.legendEnabled = false;
                colorsCssByTab[tab] = "";
                if (displayedLegend[tab]) displayedLegend[tab].remove();
                macroState.zonesData[tab].data.forEach((row) => {
                    const d = row[dataColorDef.colorColumn];
                    const key = row.name;
                    const elem = document.querySelector(`g[id="${tab}"] [id="${key}"]`);
                    if (!elem) return;
                    [...elem.classList].forEach((cls) => {
                        if (cls.includes("ssc")) elem.classList.remove(cls);
                    });
                });
                return;
            }
            const paletteName = dataColorDef.colorPalette;
            // filter out undef or null data
            const data = macroState.zonesData[tab].data.reduce<(string | number)[]>((acc, row) => {
                const d = row[dataColorDef.colorColumn];
                if (d === null || d === undefined) {
                    if (!macroState.legendDefs[tab].noData.manual) macroState.legendDefs[tab].noData.active = true;
                    return acc;
                }
                acc.push(d);
                return acc;
            }, []);
            let scale: ColorScale;
            if (dataColorDef.colorScale === "category") {
                if (dataColorDef.colorPalette === "Custom") {
                    ordinalMapping[tab] = {};
                    scale = scaleOrdinal(macroState.customCategoricalPalette);
                } else scale = scaleOrdinal(CATEGORICAL_SCHEMES[paletteName as CategoricalScaleKey]);
            } else if (dataColorDef.colorScale === "quantile") {
                scale = scaleQuantile<string, number>()
                    .domain(data as number[])
                    .range(CONTINUOUS_SCHEMES[paletteName as ContinuousScaleKey][dataColorDef.nbBreaks]);
            } else if (dataColorDef.colorScale === "quantize") {
                const dataExtent = extent(data as number[]) as [number, number];
                scale = scaleQuantize<string, number>()
                    .domain(dataExtent)
                    .range(CONTINUOUS_SCHEMES[paletteName as ContinuousScaleKey][dataColorDef.nbBreaks]);
            }
            const usedColors: Color[] = [];
            macroState.zonesData[tab].data.forEach((row) => {
                const d = row[dataColorDef.colorColumn];
                const key = row.name;
                const elem = document.querySelector(`g[id="${tab}"] [id="${key}"]`);
                if (!elem) return;
                let color: Color;
                if (d === null || d === undefined) {
                    color = macroState.legendDefs[tab].noData.color;
                } else {
                    // @ts-expect-error
                    color = scale(d) as Color;
                    if (ordinalMapping[tab]) {
                        if (!ordinalMapping[tab][color]) ordinalMapping[tab][color] = new Set([d as string]);
                        else ordinalMapping[tab][color].add(d as string);
                    }
                }
                if (!usedColors.includes(color)) usedColors.push(color);
                const cssClass = `ssc-${tabIndex}-${usedColors.indexOf(color)}`;

                elem.classList.add(cssClass);
            });
            let newCss = "";
            usedColors.forEach((color, i) => {
                newCss += `path.ssc-${tabIndex}-${i}{fill:${color};}
            path.ssc-${tabIndex}-${i}.hovered{fill:${d3Color(color)!.brighter(0.2).hex()};}`;
            });
            colorsCssByTab[tab] = newCss;
            const legendColors = getLegendColors(dataColorDef, tab, scale!, data);
            if (!legendColors) return;
            if (tab === currentMacroLayerTab)
                sampleLegend = {
                    color: legendColors[0][0],
                    text: legendColors[0][1],
                };
            const sampleElem = htmlToElement<SVGSVGElement>(macroState.legendDefs[tab].sampleHtml!)!;
            displayedLegend[tab] = drawLegend(
                legendSelection,
                macroState.legendDefs[tab],
                legendColors,
                dataColorDef.colorScale === "category",
                sampleElem,
                tab,
                saveDebounced,
                applyInlineStyles,
            );
        });
        computeCss();
        applyInlineStyles();
        applyStylesToTemplate();
    }

    function getLegendColors(
        dataColorDef: ColorDef,
        tab: string,
        scale: ColorScale,
        data: (string | number)[],
    ): LegendColor[] | undefined {
        if (!dataColorDef.legendEnabled) {
            if (displayedLegend[tab]) displayedLegend[tab].remove();
            return;
        }
        if (legendSample && macroState.legendDefs[tab].sampleHtml === null)
            macroState.legendDefs[tab].sampleHtml = legendSample.outerHTML;
        if (macroState.legendDefs[tab].title === null) macroState.legendDefs[tab].title = dataColorDef.colorColumn;
        let threshValues: number[];
        let formatter = (x: number | string) => x;
        if (dataColorDef.colorScale === "category") {
            threshValues = [...new Set(data as number[])];
        } else {
            // @ts-expect-error
            formatter = d3
                .formatLocale(resolvedLocales[macroState.tooltipDefs[tab].locale])
                .format(`,.${macroState.legendDefs[tab].significantDigits}r`);
            const minValue = Math.min(...(data as number[]));
            const scaleQuantile = scale as d3.ScaleQuantile<string, number>;
            const scaleQuantize = scale as d3.ScaleQuantize<string, number>;
            if (scaleQuantile.quantiles) threshValues = scaleQuantile.quantiles();
            else if (scaleQuantize.thresholds) threshValues = scaleQuantize.thresholds();
            threshValues!.unshift(minValue);
        }
        const legendColors = threshValues!.reduce((acc, cur) => {
            // @ts-expect-error
            acc.push([scale(cur) as Color, formatter(cur)]);
            return acc;
        }, [] as LegendColor[]);
        if (macroState.legendDefs[tab].direction === "v") return legendColors.reverse();
        return legendColors;
    }
</script>

<svelte:head>
    {@html `<${""}style> ${commonCss} </${""}style>`}
</svelte:head>

<div class="w-100">
    <ul class="nav nav-tabs align-items-center justify-content-center m-1">
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
<div id="main-menu" class="mt-4">
    {#if mainMenuSelection === "general"}
        <Accordions
            bind:sections={macroState.macroParams as unknown as Record<string, Record<string, number>>}
            {paramDefs}
            {helpParams}
            otherParams={accordionVisiblityParams}
            on:change={(e) => handleChangeProp(e, svg)}
        ></Accordions>
    {:else if mainMenuSelection === "layers"}
        <div class="border border-primary rounded layers">
            <div class="p-2">
                <div class="form-check form-switch">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="showLand"
                        bind:checked={macroState.inlinePropsMacro.showLand}
                        onchange={() => drawMacroTotal(svg)}
                    />
                    <label class="form-check-label" for="showLand"> Show land</label>
                </div>
                <div class="form-check form-switch">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="showCountries"
                        bind:checked={macroState.inlinePropsMacro.showCountries}
                        onchange={() => drawMacroTotal(svg)}
                    />
                    <label class="form-check-label" for="showCountries"> Show countries</label>
                </div>
            </div>

            <ul class="nav nav-tabs align-items-center m-1">
                {#each computedOrderedTabs as tabTitle, index (tabTitle)}
                    {@const isLand = tabTitle === "land"}
                    <li
                        class="nav-item d-flex align-items-center mx-1"
                        draggable={isLand}
                        ondragstart={(event) => tabDragStart(event, index, tabTitle !== "land")}
                        ondrop={(event) => {
                            event.preventDefault;
                            drop(event, index);
                        }}
                        ondragover={() => false}
                        ondragenter={() => (hoveringTab = index)}
                        class:is-dnd-hovering-right={hoveringTab === index && index > dragStartIndex}
                        class:is-dnd-hovering-left={hoveringTab === index && index < dragStartIndex}
                        class:grabbable={isLand}
                    >
                        <a
                            href="javascript:;"
                            class:active={currentMacroLayerTab === tabTitle}
                            class="nav-link d-flex align-items-center position-relative"
                            onclick={() => onTabChanged(tabTitle)}
                        >
                            {#if isLand}
                                <Icon svg={icons["draggable"]} />
                            {/if}
                            {tabTitle}
                            {#if tabTitle !== "countries" && !isLand}
                                <span role="button" class="delete-tab" onclick={() => deleteCountry(tabTitle)}>
                                    ✕
                                </span>
                            {/if}
                        </a>
                    </li>{/each}

                <li class="nav-item icon-add">
                    <select role="button" id="country-select" onchange={addNewCountry}>
                        <option disabled selected value> -- select a country -- </option>
                        {#each allAvailableAdm as country}
                            <option value={country}>{country}</option>
                        {/each}
                    </select>
                    <span class="nav-link d-flex">
                        <Icon fillColor="none" svg={icons["add"]} />
                    </span>
                </li>
            </ul>
            <div class="p-2">
                {#if currentMacroLayerTab !== "countries"}
                    <div class="d-flex m-1 align-items-center">
                        <div class="form-floating flex-grow-1">
                            <select
                                id="choseFilter"
                                class="form-select form-select-sm"
                                bind:value={macroState.zonesFilter[currentMacroLayerTab]}
                                onchange={() => drawMacroTotal(svg)}
                            >
                                <option value={null}> None </option>
                                <option value="firstGlow"> First glow </option>
                                <option value="secondGlow"> Second glow </option>
                            </select>
                            <label for="choseFilter">Glow filter</label>
                        </div>
                        <span
                            class="help-tooltip"
                            data-bs-toggle="tooltip"
                            data-bs-title="Two filters are available, that are customizable in the 'General' panel (first / second glow sections)."
                            >?</span
                        >
                    </div>
                {/if}
                {#if currentMacroLayerTab === "land"}
                    <div>
                        <div class="field">
                            <RangeInput
                                id="contourwidth"
                                title="Contour width"
                                onChange={() => drawMacroTotal(svg)}
                                bind:value={macroState.contourParams.strokeWidth}
                                min="0"
                                max="5"
                                step="0.5"
                            ></RangeInput>
                        </div>
                        <div class="field">
                            <ColorPickerPreview
                                id="contourpicker"
                                popup="right"
                                title="Contour color"
                                value={macroState.contourParams.strokeColor}
                                onChange={(col) => {
                                    macroState.contourParams.strokeColor = col;
                                    drawMacroTotal(svg);
                                }}
                            ></ColorPickerPreview>
                        </div>
                        <div class="field">
                            <RangeInput
                                id="contour dash"
                                title="Contour dash"
                                onChange={() => draw()}
                                bind:value={macroState.contourParams.strokeDash}
                                min="0"
                                max="20"
                                step="0.5"
                            ></RangeInput>
                        </div>
                        {#if computedOrderedTabs.findIndex((x) => x === "land") === 0}
                            <ColorPickerPreview
                                id="fillpicker"
                                popup="right"
                                title="Fill color"
                                value={macroState.contourParams.fillColor}
                                onChange={(col) => {
                                    macroState.contourParams.fillColor = col;
                                    draw();
                                }}
                            ></ColorPickerPreview>
                        {/if}
                    </div>
                {/if}
                {#if macroState.zonesData[currentMacroLayerTab]?.["data"]}
                    <div class="d-flex align-items-center">
                        <div>
                            <label for="data-input-json" class="m-2 btn btn-light">
                                Import data for {currentMacroLayerTab}
                            </label>
                            <input
                                id="data-input-json"
                                type="file"
                                accept=".json"
                                onchange={(e) => handleDataImport(e)}
                            />
                        </div>
                        <span
                            class="help-tooltip"
                            data-bs-toggle="tooltip"
                            data-bs-title="Import data for current layer. The 'name' property must be defined for each line. You can export the default data to have a template to start from."
                            >?</span
                        >
                        <div
                            class="mx-2 ms-auto btn btn-outline-primary"
                            onclick={() => exportJson(macroState.zonesData[currentMacroLayerTab]?.["data"])}
                        >
                            Export JSON
                        </div>
                    </div>
                    <div class="data-table border rounded-2 mb-2" onclick={() => (showModal = true)}>
                        <DataTable data={macroState.zonesData[currentMacroLayerTab]?.["data"]}></DataTable>
                    </div>
                    <div class="mx-2 form-check form-switch">
                        <input
                            type="checkbox"
                            role="switch"
                            class="form-check-input"
                            id="showTooltip"
                            bind:checked={macroState.tooltipDefs[currentMacroLayerTab].enabled}
                            onclick={() =>
                                setTimeout(() => {
                                    initTooltips();
                                    saveState();
                                    applyStylesToTemplate();
                                }, 0)}
                        />
                        <label for="showTooltip" class="form-check-label"> Show tooltip on hover </label>
                    </div>
                    {#if macroState.tooltipDefs[currentMacroLayerTab].enabled}
                        <div class="m-2 has-validation">
                            <label for="templatetooltip" class="form-label">
                                Tooltip template
                                <span
                                    class="help-tooltip"
                                    data-bs-toggle="tooltip"
                                    data-bs-title="The template must be valid HTML (<br/> can be used to break lines). Brackets  &#123; &#125; can be used to reference columns from the data above.  "
                                    >?</span
                                >
                            </label>
                            <textarea
                                class="form-control"
                                class:is-invalid={templateErrorMessages[currentMacroLayerTab]}
                                id="templatetooltip"
                                rows="7"
                                bind:value={macroState.tooltipDefs[currentMacroLayerTab].template}
                                onchange={onTemplateChange}
                            ></textarea>
                            {#if templateErrorMessages[currentMacroLayerTab]}
                                <div class="invalid-feedback">
                                    <span> Malformed HTML. Please fix the template </span> <br />
                                    <!-- {templateErrorMessages[currentTab]} -->
                                </div>
                            {/if}
                        </div>
                        <div class="mx-2 d-flex align-items-center">
                            <label for="tooltip-preview-{currentMacroLayerTab}">
                                Example tooltip:
                                <span
                                    class="help-tooltip"
                                    data-bs-toggle="tooltip"
                                    data-bs-title="Click on the example to update style. Pro tip: changes made in the developer panel are also reported."
                                    >?</span
                                >
                            </label>
                            <div class="tooltip-preview" onclick={(e) => editTooltip(e)}>
                                <div
                                    id="tooltip-preview-{currentMacroLayerTab}"
                                    bind:this={htmlTooltipElem}
                                    style="${defaultTooltipStyle}"
                                >
                                    {@html formatUnicorn(
                                        macroState.tooltipDefs[currentMacroLayerTab].template,
                                        getFirstDataRow(macroState.zonesData[currentMacroLayerTab])!,
                                    )}
                                </div>
                            </div>
                        </div>
                    {/if}
                    <!-- COLORING -->
                    <div class="mx-2 form-check form-switch">
                        <input
                            type="checkbox"
                            role="switch"
                            class="form-check-input"
                            id="colorData"
                            bind:checked={curDataDefs.enabled}
                            onchange={(e) => colorizeAndLegend(svg)}
                        />
                        <label for="colorData" class="form-check-label"> Color using data </label>
                    </div>
                    {#if curDataDefs.enabled}
                        <div class="d-flex m-1 align-items-center">
                            <div class="form-floating flex-grow-1">
                                <select
                                    class="form-select form-select-sm"
                                    id="choseColorType"
                                    bind:value={curDataDefs.colorScale}
                                    onchange={autoSelectColors}
                                >
                                    {#each availableColorTypes as colorType}
                                        <option value={colorType}>
                                            {colorType}
                                        </option>
                                    {/each}
                                </select>
                                <label for="choseColorType">Color type</label>
                            </div>
                            <span
                                class="help-tooltip"
                                data-bs-toggle="tooltip"
                                allow-html="true"
                                data-bs-title={scalesHelp}>?</span
                            >
                        </div>

                        <div class="d-flex align-items-center justify-content-between">
                            <div class="flex-grow-1 m-1 form-floating">
                                <select
                                    class="form-select form-select-sm"
                                    id="choseColorColumn"
                                    bind:value={curDataDefs.colorColumn}
                                    onchange={(e) => {
                                        macroState.legendDefs[currentMacroLayerTab].title = (
                                            e.target as HTMLSelectElement
                                        ).value;
                                        autoSelectColors();
                                    }}
                                >
                                    {#each availableColumns as colorColumn}
                                        <option value={colorColumn}>
                                            {colorColumn}
                                        </option>
                                    {/each}
                                </select>
                                <label for="choseColorColumn"> Color on:</label>
                            </div>
                            <div class="flex-grow-1 m-1 form-floating">
                                <select
                                    class="form-select form-select-sm"
                                    id="choseColorPalette"
                                    bind:value={curDataDefs.colorPalette}
                                    onchange={autoSelectColors}
                                >
                                    {#each availablePalettes as palette}
                                        <option value={palette}>
                                            {palette}
                                        </option>
                                    {/each}
                                </select>
                                <label for="choseColorPalette"> Palette </label>
                            </div>
                            {#if curDataDefs.colorPalette === "Custom"}
                                <span class="btn btn-outline-primary" onclick={() => (showCustomPalette = true)}>
                                    Edit palette</span
                                >
                            {/if}
                        </div>
                        {#if curDataDefs.colorScale !== "category"}
                            <div>
                                <RangeInput
                                    id="nbBreaks"
                                    title="Number of breaks"
                                    bind:value={curDataDefs.nbBreaks}
                                    min="3"
                                    max="9"
                                ></RangeInput>
                            </div>
                        {/if}
                        <!-- LEGEND -->
                        <div class="mx-2 form-check form-switch">
                            <input
                                type="checkbox"
                                class="form-check-input"
                                id="showLegend"
                                role="switch"
                                bind:checked={macroState.colorDataDefs[currentMacroLayerTab].legendEnabled}
                                onchange={(e) => colorizeAndLegend(svg)}
                            />
                            <label for="showLegend" class="form-check-label">
                                Show legend
                                <span
                                    class="help-tooltip"
                                    data-bs-toggle="tooltip"
                                    data-bs-title="Drag the title of the legend to move it, as well as the entries."
                                    >?</span
                                >
                            </label>
                        </div>
                    {/if}
                    {#if curDataDefs.legendEnabled}
                        <Legend
                            definition={macroState.legendDefs[currentMacroLayerTab]}
                            on:change={(e) => colorizeAndLegend(svg)}
                            categorical={macroState.colorDataDefs[currentMacroLayerTab].colorScale === "category"}
                        />
                        <svg width="75%" height={macroState.legendDefs[currentMacroLayerTab].rectHeight + 20}>
                            <g bind:this={legendSample}>
                                <rect
                                    x="10"
                                    y="10"
                                    width={macroState.legendDefs[currentMacroLayerTab].rectWidth}
                                    height={macroState.legendDefs[currentMacroLayerTab].rectHeight}
                                    fill={sampleLegend.color}
                                    stroke="black"
                                    onclick={openEditor}
                                ></rect>
                                <text
                                    x={macroState.legendDefs[currentMacroLayerTab].rectWidth + 15}
                                    y={macroState.legendDefs[currentMacroLayerTab].rectHeight / 2 + 10}
                                    text-anchor="start"
                                    dominant-baseline="middle"
                                    onclick={openEditor}
                                    style="font-size: 12px;"
                                >
                                    {sampleLegend.text}
                                </text>
                            </g>
                        </svg>
                        <span
                            class="help-tooltip"
                            data-bs-toggle="tooltip"
                            data-bs-title="Click to update style (the legend is SVG).">?</span
                        >
                    {/if}
                {/if}
                {#if currentIsColorByNumeric || currentTemplateHasNumeric}
                    <div class="mt-1 form-floating">
                        <select
                            class="form-select form-select-sm"
                            id="choseFormatLocale"
                            bind:value={macroState.tooltipDefs[currentMacroLayerTab].locale}
                            onchange={changeNumericFormatter}
                        >
                            {#each Object.keys(resolvedLocales) as locale}
                                <option value={locale}>
                                    {locale}
                                </option>
                            {/each}
                        </select>
                        <label for="choseFormatLocale">Number formatting language</label>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<Modal open={showModal} onClosed={() => (showModal = false)}>
    <DataTable slot="content" data={macroState.zonesData?.[currentMacroLayerTab]?.["data"]}></DataTable>
</Modal>

<Modal open={showCustomPalette} onClosed={() => (showCustomPalette = false)}>
    <div slot="content">
        <PaletteEditor
            customCategoricalPalette={macroState.customCategoricalPalette}
            mapping={ordinalMapping[currentMacroLayerTab]}
            onChange={draw}
        ></PaletteEditor>
    </div>
</Modal>

<style lang="scss" scoped>
    .data-table {
        max-height: 10rem;
        overflow-y: scroll;
    }
    #country-select {
        opacity: 0;
        position: absolute;
        height: 38px;
        width: 4rem;
    }
    #country-select:hover ~ span {
        color: #aeafaf;
    }

    input[type="file"] {
        display: none;
    }

    :global(.is-dnd-hovering-right) {
        border-right: 3px solid black;
    }
    :global(.is-dnd-hovering-left) {
        border-left: 3px solid black;
    }
    .delete-tab {
        position: absolute;
        right: 2px;
        top: 7px;
        &:hover {
            color: #67777a;
        }
    }
    .grabbable {
        cursor: grab !important;
    }

    textarea {
        font-size: 0.82rem;
    }

    .layers {
        background-color: white;
    }

    .tooltip-preview {
        padding: 5px;
    }
</style>
