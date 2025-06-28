import { appState, commonState, macroState } from "src/state.svelte";
import { select } from "d3-selection";
import { geoGraticule, geoPath } from "d3-geo";
import { geometriesState, initializeAdms, resolvedAdmGeometry, updateLayerSimplification } from "./geometry-data";
import type { FrameSelection, MacroGroupData, SvgSelection } from "src/types";
import { appendBgPattern, appendGlow } from "src/svg/svgDefs";
import type { MultiLineString } from "geojson";
import { appendCountryImageNew, appendLandImageNew } from "src/svg/contourMethods";
import { getNumericCols, sortBy } from "src/util/common";
import { applyStyles } from "src/util/dom";
import { saveState } from "src/util/save";
import { duplicateContourCleanFirst } from "src/svg/svg";
import { addTooltipListener } from "src/tooltip";
import { getProjection } from "src/util/projections";
import { macroPositionVars } from "src/stateDefaults";
import { changeAltitudeScale } from "./interactions";

export async function drawMacroTotal(svg: SvgSelection, simplified = false) {
    console.log("drawMacroTotal", simplified);
    if (!svg) return;
    const computedOrderedTabs = macroState.orderedTabs.filter((x) => {
        if (x === "countries") return macroState.inlinePropsMacro.showCountries;
        if (x === "land") return macroState.inlinePropsMacro.showLand;
        return true;
    });

    const width = macroState.macroParams.General.width;
    const height = macroState.macroParams.General.height;
    const container = select("#map-container");
    const mapLibreContainer = select("#maplibre-map");
    const animated = macroState.macroParams.General.animate;

    appState.path = geoPath(appState.projection);
    appState.pathLarger = geoPath(appState.projectionLarger);

    appState.countryFilteredImages.clear();
    await initializeAdms();
    const graticule = geoGraticule().step([macroState.macroParams.Background.graticuleStep, macroState.macroParams.Background.graticuleStep])();
    if (!macroState.macroParams.Background.showGraticule) graticule.coordinates = [];
    if (simplified) {
        svg.remove();
        let canvas = container.select<HTMLCanvasElement>("#canvas");
        if (canvas.empty()) {
            canvas = container.append("canvas").attr("id", "canvas").attr("width", width).attr("height", height);
        }
        const context = canvas!.node()!.getContext("2d")!;
        context.fillStyle = "#55a4c5";
        context.rect(0, 0, width, height);
        context.fillStyle = "#cdb396";
        appState.path = geoPath(appState.projection, context);
        context.beginPath();
        appState.path(graticule);
        context.strokeStyle = "#ddf";
        context.globalAlpha = 0.8;
        context.stroke();
        context.beginPath();
        appState.path(simplified ? geometriesState.simpleLand : geometriesState.land);
        context.fill();
        return;
    }

    svg.classed("animate-transition", true).classed("animate", animated);

    if (macroState.macroParams.General.useViewBox) {
        svg.attr("viewBox", `0 0 ${width} ${height}`);
    } else {
        svg.attr("width", `${width}`).attr("height", `${height}`);
    }
    container.style("width", `${width}px`).style("height", `${height}px`);
    // mapLibreContainer.style("width", `${width}px`).style("height", `${height}px`);
    appState.path = geoPath(appState.projection);
    appState.pathLarger = geoPath(appState.projectionLarger);
    // svg.html("");
    // svg.append("defs");

    const groupData: MacroGroupData[] = [];
    Object.values(macroState.zonesFilter).forEach((filterName) => {
        if (!filterName) return;
        appendGlow(svg, filterName, false, macroState.macroParams[filterName as 'firstGlow' | 'secondGlow']);
    });
    mapLibreContainer.style("display", "none");
    container.style("display", "block");
    drawMacro(svg, graticule, groupData, computedOrderedTabs);
    appendBgPattern(svg, "noise", macroState.macroParams.Background.seaColor, macroState.macroParams.Background.backgroundNoise);

    select("#outline").style("fill", "url(#noise)");
    // colorizeAndLegend();
    // computeCss();

    let frame: FrameSelection;
    frame = drawMacroFrame(svg);

    if (animated) {
        frame!.on("animationend", (e) => {
            setTimeout(() => {
                svg.classed("animate", false);
                svg.selectAll("path[pathLength]").attr("pathLength", null);
                const landElem = svg.select("#land");
                const landGroupDef = groupData.find((x) => x.type === "landImg")!;
                const countryGroupDefs = groupData.filter((x) => x.type === "filterImg");
                if (!landElem.empty() && landGroupDef) {
                    appendLandImageNew.call(
                        landElem.node() as SVGGElement,
                        landGroupDef.showSource || false,
                        macroState.zonesFilter,
                        width,
                        height,
                        macroState.macroParams.Border.borderWidth,
                        macroState.contourParams,
                        geometriesState.land,
                        appState.pathLarger!,
                        macroState.macroParams[macroState.zonesFilter["land"] as 'firstGlow' | 'secondGlow'],
                        false,
                    );
                }
                countryGroupDefs.forEach((def) => {
                    appendCountryImageNew.call(
                        svg.select(`[id='${def.name}']`).node() as SVGGElement,
                        def.countryData!,
                        def.filter ?? null,
                        applyInlineStyles,
                        appState.path!,
                        commonState.inlineStyles,
                        false,
                    );
                });
                duplicateContourCleanFirst(svg.node() as SVGSVGElement);
                setTimeout(() => {
                    svg.selectAll("g[image-class]").classed("hidden-after", true);
                    svg.classed("animate-transition", false);
                }, 1500);
            }, 200);
        });
    }

    // const map = document.getElementById("static-svg-map") as unknown as SVGSVGElement;
    // if (!map) return;
    // await tick();
    addTooltipListener(svg.node() as SVGSVGElement, macroState.tooltipDefs, macroState.zonesData);
    duplicateContourCleanFirst(svg.node() as SVGSVGElement);
    if (!animated) {
        svg.selectAll("path[pathLength]").attr("pathLength", null);
        svg.selectAll("g[image-class]").classed("hidden-after", true);
    }
}



function drawMacro(svg: SvgSelection, graticule: MultiLineString, groupData: MacroGroupData[], computedOrderedTabs: string[]): void {
    const width = macroState.macroParams.General.width;
    const height = macroState.macroParams.General.height;
    const borderWidth = macroState.macroParams.Border.borderWidth;
    const animated = macroState.macroParams.General.animate;
    const outline = { type: "Sphere" };
    groupData.push({
        name: "outline",
        data: [outline],
        id: null,
        props: [],
        class: "outline",
        filter: null,
    });
    groupData.push({
        name: "graticule",
        data: [graticule],
        id: null,
        props: [],
        class: "graticule",
        filter: null,
    });
    computedOrderedTabs.forEach((layer, i) => {
        const filter = macroState.zonesFilter[layer] ?? null;
        if (layer === "countries" && macroState.inlinePropsMacro.showCountries && geometriesState.countries) {
            if (!("countries" in macroState.zonesData) && !macroState.zonesData["countries"]?.provided) {
                const countryProps = geometriesState.countries.features.map((f) => f.properties);
                sortBy(countryProps, "name")!;
                macroState.zonesData["countries"] = {
                    data: countryProps,
                    numericCols: getNumericCols(countryProps),
                };
                // getZonesDataFormatters();
            }
            groupData.push({
                name: "countries",
                data: geometriesState.countries,
                id: "name",
                props: [],
                containerClass: "choro",
                class: "country",
                filter: filter,
            });
        }
        if (layer === "land" && macroState.inlinePropsMacro.showLand) groupData.push({ type: "landImg", showSource: i === 0 });
        // selected country
        else if (layer !== "countries") {
            groupData.push({
                name: layer,
                data: resolvedAdmGeometry[layer],
                id: "name",
                props: [],
                containerClass: "choro",
                class: "adm",
                filter: null,
            });
            const countryOutlineId = layer.substring(0, layer.length - 5);
            const countryData = geometriesState.countries?.features.find((country) => country.properties.name === countryOutlineId);
            appState.countryFilteredImages.add(countryOutlineId);
            groupData.push({
                name: `${countryOutlineId}-img`,
                type: "filterImg",
                countryData,
                filter,
            });
        }
    });
    groupData.push({
        name: "paths",
        data: [],
        props: [],
        filter: null,
    });
    groupData.push({
        name: "points-labels",
        data: [],
        props: [],
        filter: null,
    });
    // const groups = svg.selectAll('svg').data(groupData).join('svg').attr('id', d => d.name);
    const groups = svg
        // .append("svg")
        .selectAll("g")
        .data(groupData)
        .join("g")
        .attr("id", (d) => d.name!);
    // .attr('clip-path', 'url(#clipMapBorder)')

    function drawPaths(this: SVGGElement, data: MacroGroupData) {
        if (data.type === "landImg")
            return appendLandImageNew.call(
                this,
                data.showSource ?? false,
                macroState.zonesFilter,
                width,
                height,
                borderWidth,
                macroState.contourParams,
                geometriesState.land,
                appState.pathLarger!,
                macroState.macroParams[macroState.zonesFilter["land"] as 'firstGlow' | 'secondGlow'],
                animated,
            );
        if (data.type === "filterImg")
            return appendCountryImageNew.call(
                this,
                data.countryData!,
                data.filter ?? null,
                applyInlineStyles,
                appState.path!,
                commonState.inlineStyles,
                animated,
            );
        if (!data.data) return;
        const parentPathElem = select(this).style("will-change", "opacity");
        if (data.containerClass) parentPathElem.classed(data.containerClass, true);
        const pathElem = parentPathElem
            .selectAll("path")
            // @ts-expect-error
            .data(data.data.features ? data.data.features : data.data)
            .join("path")
            .attr("pathLength", 1)
            .attr("d", (d) => {
                return appState.path!(d);
            });
        // @ts-expect-error
        if (data.id) pathElem.attr("id", (d) => d.properties[data.id]);
        if (data.class) pathElem.attr("class", data.class);
        if (data.filter) parentPathElem.attr("filter", `url(#${data.filter})`);
        // data.props?.forEach((prop) => pathElem.attr(prop, (d) => d.properties[prop]));
    }
    // @ts-expect-error
    groups.each(drawPaths);
}
function drawMacroFrame(svg: SvgSelection): FrameSelection {
    const borderWidth = macroState.macroParams.Border.borderWidth;
    const borderRadius = macroState.macroParams.Border.borderRadius;
    const width = macroState.macroParams.General.width;
    const height = macroState.macroParams.General.height;
    const rx = Math.max(width, height) * (borderRadius / 100);
    const frame = svg
        .append("rect")
        .attr("x", borderWidth / 2)
        .attr("y", borderWidth / 2)
        .attr("id", "frame")
        .attr("pathLength", 1)
        .attr("stroke", macroState.macroParams.Border.borderColor)
        .attr("stroke-width", borderWidth)
        .attr("fill", "none")
        .attr("width", width - borderWidth)
        .attr("height", height - borderWidth)
        .attr("rx", rx);
    return frame;
}

export function applyInlineStyles(styleAll = false): void {
    applyStyles(commonState.inlineStyles, styleAll ? appState.countryFilteredImages : null);
    saveState();
}


export async function changeProjection(): Promise<void> {
    const projName = macroState.macroParams.General.projection;
    const alt = macroState.inlinePropsMacro.altitude || macroState.macroParams.General.altitude;
    const projectionParams = {
        projectionName: projName,
        fov: macroState.macroParams.General.fieldOfView,
        width: macroState.macroParams.General.width,
        height: macroState.macroParams.General.height,
        translateX: macroState.inlinePropsMacro.translateX,
        translateY: macroState.inlinePropsMacro.translateY,
        longitude: macroState.inlinePropsMacro.longitude,
        latitude: macroState.inlinePropsMacro.latitude,
        rotation: macroState.inlinePropsMacro.rotation,
        altitude: alt,
        tilt: macroState.inlinePropsMacro.tilt,
        borderWidth: macroState.macroParams.Border.borderWidth,
    };
    appState.projection = getProjection(projectionParams);
    appState.projectionLarger = getProjection({ ...projectionParams, larger: true });
}


export function projectAndDraw(svg: SvgSelection, simplified = false): void {
    changeProjection();
    drawMacroTotal(svg, simplified);
}

export function handleChangeProp(event: CustomEvent<{ prop: string; value: unknown }> | string): void {
    console.log('handleChangeProp', event)
    let prop: string;
    let value: unknown;
    if (typeof event === "string") {
        prop = event;
    } else {
        prop = event.detail.prop;
        value = event.detail.value;
    }
    if (macroPositionVars.includes(prop)) {
        if (value) {
            // @ts-expect-error
            macroState.inlinePropsMacro[prop] = value;
        }
    }
    if (prop === "projection" || prop === "fieldOfView") {
        changeAltitudeScale();
    }
    if (prop === "projection") {
        macroState.inlinePropsMacro.translateX = 0;
        macroState.inlinePropsMacro.translateY = 0;
    }
    if (prop === "height" && value) {
        Object.keys(macroState.legendDefs).forEach((tab) => {
            macroState.legendDefs[tab].y = (value as number) - 100;
        });
    }
    changeProjection();
    updateLayerSimplification();
}